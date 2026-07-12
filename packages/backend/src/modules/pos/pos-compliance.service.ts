import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { createHash } from 'crypto';
import { PosShift, PosRegister, PosPaymentSplit } from '../../database/entities/pos.entity';
import {
  PosCashDrawerEvent,
  PosZReport,
  CashDrawerEventType,
} from '../../database/entities/pos-compliance.entity';
import { CreateDrawerEventDto, GenerateZReportDto } from './pos-compliance.dto';

/**
 * Compliance-grade POS operations that must produce immutable, auditable rows:
 *  - Cash drawer events (no_sale, paid_in, paid_out, cash_drop)
 *  - X-report (live, read-only aggregate of an open shift)
 *  - Z-report (immutable, written once per shift, locks the shift to z_finalized)
 */
@Injectable()
export class PosComplianceService {
  private readonly logger = new Logger(PosComplianceService.name);

  constructor(
    @InjectRepository(PosShift) private shiftRepo: Repository<PosShift>,
    @InjectRepository(PosRegister) private registerRepo: Repository<PosRegister>,
    @InjectRepository(PosPaymentSplit) private splitRepo: Repository<PosPaymentSplit>,
    @InjectRepository(PosCashDrawerEvent) private drawerRepo: Repository<PosCashDrawerEvent>,
    @InjectRepository(PosZReport) private zRepo: Repository<PosZReport>,
    private dataSource: DataSource,
  ) {}

  // ─── Drawer Events ──────────────────────────────────────────────────────────

  async createDrawerEvent(
    dto: CreateDrawerEventDto,
    userId: string,
    tenantId: string,
  ): Promise<PosCashDrawerEvent> {
    const shift = await this.shiftRepo.findOne({ where: { id: dto.shiftId, tenantId } });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== 'open') {
      throw new BadRequestException(`Cannot record drawer events on a ${shift.status} shift`);
    }

    const affects =
      dto.eventType === CashDrawerEventType.NO_SALE ||
      dto.eventType === CashDrawerEventType.OPENING_FLOAT
        ? false
        : true;

    const event = this.drawerRepo.create({
      shiftId: dto.shiftId,
      eventType: dto.eventType,
      amount: dto.amount || 0,
      reason: dto.reason,
      reference: dto.reference,
      createdById: userId,
      affectsExpectedCash: affects,
      tenantId,
    });
    return this.drawerRepo.save(event);
  }

  async listDrawerEvents(shiftId: string, tenantId: string) {
    return this.drawerRepo.find({
      where: { shiftId, tenantId },
      order: { createdAt: 'ASC' },
    });
  }

  // ─── X-Report (live, non-destructive) ───────────────────────────────────────

  /**
   * Live snapshot of an open shift. Computed on demand, never persisted.
   * Cashiers can call this any number of times during their shift.
   */
  async getXReport(shiftId: string, tenantId: string) {
    const shift = await this.shiftRepo.findOne({
      where: { id: shiftId, tenantId },
      relations: ['register', 'cashier'],
    });
    if (!shift) throw new NotFoundException('Shift not found');

    const aggregates = await this.computeShiftAggregates(shift);
    return {
      reportType: 'X',
      shiftId: shift.id,
      registerName: shift.register?.name,
      cashier: shift.cashier
        ? {
            id: shift.cashier.id,
            name: shift.cashier.fullName || shift.cashier.username,
          }
        : null,
      openedAt: shift.openedAt,
      status: shift.status,
      ...aggregates,
      generatedAt: new Date(),
    };
  }

  // ─── Z-Report (immutable, persists, locks shift) ────────────────────────────

  async generateZReport(
    shiftId: string,
    dto: GenerateZReportDto,
    userId: string,
    tenantId: string,
  ): Promise<PosZReport> {
    return this.dataSource.transaction(async (manager) => {
      // Lock WITHOUT relations (FOR UPDATE cannot be applied to the nullable
      // side of the outer join a relation adds); load register separately
      const shift = await manager.findOne(PosShift, {
        where: { id: shiftId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!shift) throw new NotFoundException('Shift not found');
      shift.register = (await manager.findOne(PosRegister, {
        where: { id: shift.registerId, tenantId },
      }))!;
      if (shift.status === 'z_finalized') {
        throw new BadRequestException(
          'Z-report has already been generated for this shift. Z-reports are immutable.',
        );
      }
      if (shift.status !== 'open' && shift.status !== 'closed') {
        throw new BadRequestException(`Cannot Z-finalize a shift in status ${shift.status}`);
      }

      const existing = await manager.findOne(PosZReport, { where: { shiftId, tenantId } });
      if (existing) {
        throw new BadRequestException('Z-report row already exists for this shift');
      }

      const aggregates = await this.computeShiftAggregates(shift);
      const countedCash = dto.countedCash ?? aggregates.expectedCash;
      const variance = Number((countedCash - aggregates.expectedCash).toFixed(2));

      const reportNumber = await this.nextZReportNumber(manager, tenantId);

      const payload = {
        ...aggregates,
        countedCash,
        variance,
        denominationCount: dto.denominationCount,
        reportNumber,
        shiftId,
        registerId: shift.registerId,
        generatedAt: new Date().toISOString(),
        notes: dto.notes,
      };
      const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

      const z = manager.create(PosZReport, {
        shiftId,
        registerId: shift.registerId,
        reportNumber,
        generatedAt: new Date(),
        generatedById: userId,
        openingCash: shift.openingBalance,
        cashSales: aggregates.cashSales,
        cashRefunds: 0,
        paidInTotal: aggregates.paidInTotal,
        paidOutTotal: aggregates.paidOutTotal,
        cashDropTotal: aggregates.cashDropTotal,
        expectedCash: aggregates.expectedCash,
        countedCash,
        cashVariance: variance,
        paymentMethodBreakdown: aggregates.paymentMethodBreakdown,
        denominationCount: dto.denominationCount || undefined,
        transactionCount: shift.transactionCount,
        returnCount: 0,
        grossSales: aggregates.grossSales,
        returnsTotal: 0,
        netSales: aggregates.netSales,
        taxTotal: aggregates.taxTotal,
        discountTotal: aggregates.discountTotal,
        notes: dto.notes,
        payloadHash,
        tenantId,
      });
      const saved = await manager.save(PosZReport, z);

      // Lock the shift forever
      shift.status = 'z_finalized';
      if (!shift.closedAt) shift.closedAt = new Date();
      shift.closingBalance = countedCash;
      shift.expectedBalance = aggregates.expectedCash;
      shift.cashDifference = variance;
      await manager.save(PosShift, shift);

      this.logger.log(
        `Z-report ${reportNumber} generated for shift ${shiftId} by user ${userId} (variance=${variance})`,
      );
      return saved;
    });
  }

  async getZReport(shiftId: string, tenantId: string) {
    const z = await this.zRepo.findOne({
      where: { shiftId, tenantId },
      relations: ['shift', 'register', 'generatedBy'],
    });
    if (!z) throw new NotFoundException('Z-report not generated for this shift');
    return z;
  }

  async listZReports(tenantId: string, registerId?: string, limit = 50) {
    const where: any = { tenantId };
    if (registerId) where.registerId = registerId;
    return this.zRepo.find({
      where,
      relations: ['register'],
      order: { generatedAt: 'DESC' },
      take: limit,
    });
  }

  // ─── Internals ──────────────────────────────────────────────────────────────

  private async computeShiftAggregates(shift: PosShift): Promise<{
    cashSales: number;
    mobileMoneySales: number;
    cardSales: number;
    paidInTotal: number;
    paidOutTotal: number;
    cashDropTotal: number;
    expectedCash: number;
    paymentMethodBreakdown: Record<string, number>;
    grossSales: number;
    netSales: number;
    taxTotal: number;
    discountTotal: number;
    transactionCount: number;
  }> {
    // Sum payment_splits attributed to this shift
    const breakdownRows = await this.splitRepo
      .createQueryBuilder('ps')
      .select('ps.payment_method', 'method')
      .addSelect('SUM(ps.amount)', 'total')
      .where('ps.shift_id = :sid', { sid: shift.id })
      .groupBy('ps.payment_method')
      .getRawMany();
    const breakdown: Record<string, number> = {};
    for (const r of breakdownRows) breakdown[r.method] = Number(r.total) || 0;

    const cashSales = breakdown['cash'] || Number(shift.cashSales) || 0;
    const mobileMoneySales = breakdown['mobile_money'] || Number(shift.mobileMoneySales) || 0;
    const cardSales = breakdown['card'] || Number(shift.cardSales) || 0;

    // Sum drawer events for this shift
    const drawerRows = await this.drawerRepo
      .createQueryBuilder('d')
      .select('d.event_type', 'type')
      .addSelect('SUM(d.amount)', 'total')
      .where('d.shift_id = :sid', { sid: shift.id })
      .groupBy('d.event_type')
      .getRawMany();
    const drawer: Record<string, number> = {};
    for (const r of drawerRows) drawer[r.type] = Number(r.total) || 0;

    const paidInTotal = drawer[CashDrawerEventType.PAID_IN] || 0;
    const paidOutTotal = drawer[CashDrawerEventType.PAID_OUT] || 0;
    const cashDropTotal = drawer[CashDrawerEventType.CASH_DROP] || 0;

    const expectedCash = Number(
      (
        Number(shift.openingBalance) +
        cashSales +
        paidInTotal -
        paidOutTotal -
        cashDropTotal
      ).toFixed(2),
    );

    // Sales aggregates from pharmacy_sales (gross/net/tax/discount)
    const salesAgg = await this.dataSource
      .createQueryBuilder()
      .select('COALESCE(SUM(s.subtotal),0)', 'gross')
      .addSelect('COALESCE(SUM(s.total_amount),0)', 'total')
      .addSelect('COALESCE(SUM(s.tax_amount),0)', 'tax')
      .addSelect('COALESCE(SUM(s.discount_amount),0)', 'discount')
      .from('pharmacy_sales', 's')
      .where('s.pos_shift_id = :sid', { sid: shift.id })
      .andWhere("s.status = 'completed'")
      .getRawOne();

    const grossSales = Number(salesAgg?.gross || 0);
    const taxTotal = Number(salesAgg?.tax || 0);
    const discountTotal = Number(salesAgg?.discount || 0);
    const netSales = Number(salesAgg?.total || 0);

    return {
      cashSales,
      mobileMoneySales,
      cardSales,
      paidInTotal,
      paidOutTotal,
      cashDropTotal,
      expectedCash,
      paymentMethodBreakdown: breakdown,
      grossSales,
      netSales,
      taxTotal,
      discountTotal,
      transactionCount: shift.transactionCount,
    };
  }

  private async nextZReportNumber(manager: any, tenantId: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    // Advisory lock: the shift-row lock held by the caller does not serialize
    // z-report generation across DIFFERENT shifts, so the per-day counter
    // could hand out the same number twice.
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `pos:z-report-number:${tenantId}:${dateStr}`,
    ]);
    const count = await manager
      .getRepository(PosZReport)
      .createQueryBuilder('z')
      .where('z.tenant_id = :tid', { tid: tenantId })
      .andWhere('DATE(z.generated_at) = CURRENT_DATE')
      .getCount();
    return `Z-${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }
}
