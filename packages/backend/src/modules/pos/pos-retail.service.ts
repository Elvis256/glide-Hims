/**
 * POS Retail Service — Phase B
 * Handles: B1 Returns, B2 Void, B3 Hold, B4 Discounts, B6 Reprint, B7 QuickKeys, B8 RetailCustomer
 */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

import {
  PharmacySale,
  PharmacySaleItem,
  SaleStatus,
  SaleChannel,
} from '../../database/entities/pharmacy-sale.entity';
import {
  PharmacyReturn,
  PharmacyReturnItem,
  HeldSale,
  DiscountApplication,
  DiscountType,
  DiscountValueType,
  PosQuickKey,
  RetailCustomer,
  ReceiptReprint,
  ReturnStatus,
} from '../../database/entities/pos-retail.entity';
import {
  Item,
  StockBalance,
  StockLedger,
  MovementType,
} from '../../database/entities/inventory.entity';
import { PosShift } from '../../database/entities/pos.entity';
import { EfrisDocumentType } from '../../database/entities/pos-compliance.entity';
import { EfrisService } from '../efris/efris.service';
import { PosShiftGuardService } from './services/pos-shift-guard.service';
import { FinanceService } from '../finance/finance.service';
import { SystemSettingsService } from '../system-settings/system-settings.service';
import {
  CreateReturnDto,
  VoidSaleDto,
  HoldSaleDto,
  RecallHoldDto,
  ApplyDiscountDto,
  UpsertQuickKeyDto,
  GetReprintReceiptOptions,
  UpdateRetailCustomerDto,
} from './pos-retail.dto';

function generateReturnNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `RTN-${ts}-${rand}`;
}

@Injectable()
export class PosRetailService {
  private readonly logger = new Logger(PosRetailService.name);

  constructor(
    @InjectRepository(PharmacySale) private saleRepo: Repository<PharmacySale>,
    @InjectRepository(PharmacySaleItem) private saleItemRepo: Repository<PharmacySaleItem>,
    @InjectRepository(PharmacyReturn) private returnRepo: Repository<PharmacyReturn>,
    @InjectRepository(PharmacyReturnItem) private returnItemRepo: Repository<PharmacyReturnItem>,
    @InjectRepository(HeldSale) private heldSaleRepo: Repository<HeldSale>,
    @InjectRepository(DiscountApplication) private discountRepo: Repository<DiscountApplication>,
    @InjectRepository(PosQuickKey) private quickKeyRepo: Repository<PosQuickKey>,
    @InjectRepository(RetailCustomer) private retailCustomerRepo: Repository<RetailCustomer>,
    @InjectRepository(ReceiptReprint) private reprintRepo: Repository<ReceiptReprint>,
    @InjectRepository(Item) private itemRepo: Repository<Item>,
    @InjectRepository(StockBalance) private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(StockLedger) private stockLedgerRepo: Repository<StockLedger>,
    private dataSource: DataSource,
    private efrisService: EfrisService,
    private posShiftGuard: PosShiftGuardService,
    private financeService: FinanceService,
    private settingsService: SystemSettingsService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ─── B1: Returns ──────────────────────────────────────────────────────────

  async createReturn(dto: CreateReturnDto, userId: string, tenantId: string): Promise<PharmacyReturn> {
    const sale = await this.saleRepo.findOne({
      where: { id: dto.originalSaleId, tenantId },
      relations: ['items', 'store'],
    });
    if (!sale) throw new NotFoundException('Original sale not found');
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Only completed sales can be returned');
    }

    // Compute already-returned quantities per sale item
    const existingReturns = await this.returnItemRepo
      .createQueryBuilder('ri')
      .innerJoin('ri.pharmacyReturn', 'r')
      .where('r.original_sale_id = :saleId', { saleId: sale.id })
      .andWhere('r.status != :voided', { voided: ReturnStatus.VOIDED })
      .andWhere(tenantId ? 'r.tenant_id = :tenantId' : '1=1', { tenantId })
      .getMany();

    const returnedQtyMap = new Map<string, number>();
    for (const ri of existingReturns) {
      const prev = returnedQtyMap.get(ri.originalSaleItemId) || 0;
      returnedQtyMap.set(ri.originalSaleItemId, prev + ri.qtyReturned);
    }

    // Validate return lines
    let totalRefund = 0;
    const returnItemsData: Array<{
      saleItem: PharmacySaleItem;
      qtyReturned: number;
      restockable: boolean;
    }> = [];

    for (const line of dto.items) {
      const saleItem = sale.items.find((i) => i.id === line.saleItemId);
      if (!saleItem) {
        throw new BadRequestException(`Sale item ${line.saleItemId} not found in sale`);
      }
      const alreadyReturned = returnedQtyMap.get(saleItem.id) || 0;
      const returnable = saleItem.quantity - alreadyReturned;
      if (line.qtyReturned <= 0 || line.qtyReturned > returnable) {
        throw new BadRequestException(
          `Cannot return ${line.qtyReturned} of "${saleItem.itemName}" — returnable qty is ${returnable}`,
        );
      }
      const lineGross = (Number(saleItem.grossAmount) / saleItem.quantity) * line.qtyReturned;
      totalRefund += lineGross;
      returnItemsData.push({
        saleItem,
        qtyReturned: line.qtyReturned,
        restockable: line.restockable !== false,
      });
    }

    let savedReturn!: PharmacyReturn;

    await this.dataSource.transaction(async (manager) => {
      const facilityId = sale.store?.facilityId;

      // Restock inventory (where restockable = true)
      for (const { saleItem, qtyReturned, restockable } of returnItemsData) {
        if (restockable && facilityId) {
          await this.restockItem(manager, saleItem.itemId, qtyReturned, facilityId, tenantId, sale.id);
        }
      }

      // Build the return entity
      const returnEntity = manager.create(PharmacyReturn, {
        originalSaleId: sale.id,
        returnNumber: generateReturnNumber(),
        returnedAt: new Date(),
        returnedById: userId,
        reason: dto.reason,
        totalRefund,
        paymentMethod: dto.paymentMethod || 'cash',
        refundReference: dto.refundReference,
        posShiftId: dto.posShiftId || sale.posShiftId || undefined,
        posRegisterId: dto.posRegisterId || sale.posRegisterId || undefined,
        status: ReturnStatus.COMPLETED,
        tenantId,
      });
      savedReturn = await manager.save(PharmacyReturn, returnEntity);

      // Return items
      for (const { saleItem, qtyReturned, restockable } of returnItemsData) {
        const unitGross = Number(saleItem.grossAmount) / saleItem.quantity;
        const unitNet = Number(saleItem.netAmount) / saleItem.quantity;
        const unitTax = Number(saleItem.taxAmount) / saleItem.quantity;
        await manager.save(
          PharmacyReturnItem,
          manager.create(PharmacyReturnItem, {
            returnId: savedReturn.id,
            originalSaleItemId: saleItem.id,
            itemId: saleItem.itemId,
            batchId: saleItem.batchNumber || undefined,
            qtyReturned,
            unitPrice: Number(saleItem.unitPrice),
            taxAmount: unitTax * qtyReturned,
            netAmount: unitNet * qtyReturned,
            grossAmount: unitGross * qtyReturned,
            restockable,
            tenantId,
          }),
        );
      }

      // POS shift: record negative amount
      if (savedReturn.posShiftId) {
        try {
          const lockedShift = await manager.findOne(PosShift, {
            where: { id: savedReturn.posShiftId, tenantId },
            lock: { mode: 'pessimistic_write' },
          });
          if (lockedShift && lockedShift.status === 'open') {
            await this.posShiftGuard.recordSale(manager, {
              shift: lockedShift,
              saleId: savedReturn.id,
              tenantId,
              paymentMethod: savedReturn.paymentMethod,
              amount: -totalRefund,
              transactionReference: savedReturn.refundReference,
            });
          }
        } catch (err) {
          this.logger.warn(`POS shift update failed for return ${savedReturn.id}: ${err.message}`);
        }
      }

      // GL reversal (best-effort)
      if (facilityId) {
        try {
          await this.financeService.autoPostPharmacySaleJournal(
            {
              facilityId,
              saleNumber: `RETURN:${savedReturn.returnNumber}`,
              totalAmount: -totalRefund,
              paymentMethod: savedReturn.paymentMethod,
              userId,
            },
            tenantId,
          );
        } catch (err) {
          this.logger.warn(`GL reversal post failed for return ${savedReturn.id}: ${err.message}`);
        }
      }

      // EFRIS credit note (best-effort)
      try {
        const cfg = await this.efrisService.getConfig(tenantId);
        if (cfg?.isEnabled) {
          const idempKey = `return:${savedReturn.id}:credit_note`;
          const payload = {
            returnId: savedReturn.id,
            originalSaleId: sale.id,
            totalRefund,
            reason: dto.reason,
          };
          await this.efrisService.enqueueDocument(
            manager,
            {
              tenantId,
              saleId: sale.id,
              documentType: EfrisDocumentType.CREDIT_NOTE,
              payload,
            },
            idempKey,
          );
        }
      } catch (err) {
        this.logger.warn(`EFRIS credit note enqueue failed: ${err.message}`);
      }
    });

    this.eventEmitter.emit('pharmacy.return.completed', {
      returnId: savedReturn.id,
      originalSaleId: sale.id,
      tenantId,
      userId,
    });

    return this.getReturn(savedReturn.id, tenantId);
  }

  async getReturn(id: string, tenantId: string): Promise<PharmacyReturn> {
    const r = await this.returnRepo.findOne({
      where: { id, tenantId },
      relations: ['items', 'originalSale', 'returnedBy'],
    });
    if (!r) throw new NotFoundException('Return not found');
    return r;
  }

  async listReturns(
    tenantId: string,
    query: { from?: string; to?: string; saleId?: string },
  ): Promise<PharmacyReturn[]> {
    const qb = this.returnRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.items', 'items')
      .leftJoinAndSelect('r.originalSale', 'sale')
      .leftJoinAndSelect('r.returnedBy', 'user')
      .where('r.tenant_id = :tenantId', { tenantId })
      .orderBy('r.returned_at', 'DESC');

    if (query.from) qb.andWhere('r.returned_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('r.returned_at <= :to', { to: new Date(query.to) });
    if (query.saleId) qb.andWhere('r.original_sale_id = :saleId', { saleId: query.saleId });

    return qb.getMany();
  }

  private async restockItem(
    manager: EntityManager,
    itemId: string,
    qty: number,
    facilityId: string,
    tenantId: string,
    referenceId: string,
  ): Promise<void> {
    const stockBalance = await manager.findOne(StockBalance, {
      where: { itemId, facilityId, ...(tenantId ? { tenantId } : {}) },
      lock: { mode: 'pessimistic_write' },
    });
    if (stockBalance) {
      stockBalance.totalQuantity = Number(stockBalance.totalQuantity) + qty;
      stockBalance.availableQuantity = Number(stockBalance.availableQuantity) + qty;
      stockBalance.lastMovementAt = new Date();
      await manager.save(StockBalance, stockBalance);
    }
    await manager.save(
      StockLedger,
      manager.create(StockLedger, {
        itemId,
        movementType: MovementType.RETURN,
        quantity: qty,
        balanceAfter: stockBalance ? Number(stockBalance.totalQuantity) : qty,
        referenceType: 'pharmacy_return',
        referenceId,
        notes: 'POS Return restock',
        createdById: 'system',
        facilityId,
        ...(tenantId ? { tenantId } : {}),
      }),
    );
  }

  // ─── B2: Void Sale ────────────────────────────────────────────────────────

  async voidSale(
    saleId: string,
    dto: VoidSaleDto,
    userId: string,
    tenantId: string,
  ): Promise<PharmacySale> {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, tenantId },
      relations: ['items', 'store'],
    });
    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Only completed sales can be voided');
    }
    if (sale.voidedAt) throw new BadRequestException('Sale is already voided');

    // Manager PIN verification
    await this.verifyManagerPin(dto.managerPin, tenantId);

    // Same-shift check
    if (dto.posShiftId && sale.posShiftId && sale.posShiftId !== dto.posShiftId) {
      throw new BadRequestException('Void is only allowed within the same shift the sale was made');
    }

    const facilityId = sale.store?.facilityId;

    await this.dataSource.transaction(async (manager) => {
      // Restock all items
      if (facilityId) {
        for (const item of sale.items) {
          await this.restockItem(
            manager,
            item.itemId,
            item.quantity,
            facilityId,
            tenantId,
            saleId,
          );
        }
      }

      // Mark sale voided
      await manager.update(PharmacySale, { id: saleId }, {
        status: SaleStatus.CANCELLED,
        voidedAt: new Date(),
        voidReason: dto.reason,
        voidedById: userId,
      } as Partial<PharmacySale>);

      // EFRIS credit note (full void)
      try {
        const cfg = await this.efrisService.getConfig(tenantId);
        if (cfg?.isEnabled) {
          await this.efrisService.enqueueDocument(
            manager,
            {
              tenantId,
              saleId: sale.id,
              documentType: EfrisDocumentType.CREDIT_NOTE,
              payload: { voidSaleId: sale.id, reason: dto.reason, fullVoid: true },
            },
            `void:${sale.id}:credit_note`,
          );
        }
      } catch (err) {
        this.logger.warn(`EFRIS void enqueue failed: ${err.message}`);
      }

      // GL reversal (best-effort)
      if (facilityId) {
        try {
          await this.financeService.autoPostPharmacySaleJournal(
            {
              facilityId,
              saleNumber: `VOID:${sale.saleNumber}`,
              totalAmount: -Number(sale.totalAmount),
              paymentMethod: sale.paymentMethod,
              userId,
            },
            tenantId,
          );
        } catch (err) {
          this.logger.warn(`GL void reversal failed: ${err.message}`);
        }
      }
    });

    this.eventEmitter.emit('pharmacy.sale.voided', { saleId, tenantId, userId });
    return this.saleRepo.findOne({ where: { id: saleId, tenantId }, relations: ['items'] }) as Promise<PharmacySale>;
  }

  async setManagerPin(pin: string, tenantId: string): Promise<void> {
    if (!pin || pin.length < 4) {
      throw new BadRequestException('Manager PIN must be at least 4 characters');
    }
    const hash = await bcrypt.hash(pin, 10);
    await this.settingsService.upsert('pos.manager_pin', hash, tenantId, 'Manager PIN (bcrypt hash)');
  }

  async verifyManagerPin(pin: string, tenantId: string): Promise<void> {
    const setting = await this.settingsService.getByKey('pos.manager_pin', tenantId).catch(() => null);
    if (!setting?.value) {
      throw new ForbiddenException('Manager PIN is not configured. Set it in POS Settings.');
    }
    const matches = await bcrypt.compare(pin, setting.value);
    if (!matches) throw new ForbiddenException('Invalid manager PIN');
  }

  // ─── B3: Hold / Park Sale ─────────────────────────────────────────────────

  async holdSale(dto: HoldSaleDto, cashierId: string, tenantId: string): Promise<HeldSale> {
    const heldAt = new Date();
    const expiresAt = new Date(heldAt.getTime() + 12 * 60 * 60 * 1000);
    const held = this.heldSaleRepo.create({
      posShiftId: dto.posShiftId,
      posRegisterId: dto.posRegisterId,
      cashierId,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      cartSnapshot: dto.cartSnapshot,
      holdReason: dto.holdReason,
      heldAt,
      expiresAt,
      tenantId,
    });
    return this.heldSaleRepo.save(held);
  }

  async listHeldSales(
    tenantId: string,
    registerId?: string,
    shiftId?: string,
  ): Promise<HeldSale[]> {
    const qb = this.heldSaleRepo
      .createQueryBuilder('h')
      .where('h.tenant_id = :tenantId', { tenantId })
      .andWhere('h.expires_at > NOW()')
      .orderBy('h.held_at', 'DESC');
    if (registerId) qb.andWhere('h.pos_register_id = :registerId', { registerId });
    if (shiftId) qb.andWhere('h.pos_shift_id = :shiftId', { shiftId });
    return qb.getMany();
  }

  async recallHeldSale(id: string, tenantId: string): Promise<HeldSale> {
    const held = await this.heldSaleRepo.findOne({ where: { id, tenantId } });
    if (!held) throw new NotFoundException('Held sale not found or expired');
    await this.heldSaleRepo.delete(id);
    return held;
  }

  async deleteHeldSale(id: string, tenantId: string): Promise<void> {
    const held = await this.heldSaleRepo.findOne({ where: { id, tenantId } });
    if (!held) throw new NotFoundException('Held sale not found');
    await this.heldSaleRepo.delete(id);
  }

  /** Cron: remove expired held sales */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpiredHolds(): Promise<number> {
    const result = await this.heldSaleRepo
      .createQueryBuilder()
      .delete()
      .where('expires_at < NOW()')
      .execute();
    return result.affected || 0;
  }

  // ─── B4: Discounts ────────────────────────────────────────────────────────

  async applyDiscount(
    dto: ApplyDiscountDto,
    appliedById: string,
    tenantId: string,
  ): Promise<DiscountApplication> {
    const thresholdPct = await this.getDiscountThresholdPct(tenantId);
    const thresholdAmt = await this.getDiscountThresholdAmt(tenantId);

    const needsApproval =
      (dto.valueType === DiscountValueType.PERCENT && dto.value > thresholdPct) ||
      (dto.valueType === DiscountValueType.AMOUNT && dto.value > thresholdAmt);

    let approverId: string | undefined;
    let pinHash: string | undefined;

    if (needsApproval) {
      if (!dto.managerPin) {
        throw new BadRequestException(
          `Discount above threshold (${thresholdPct}% / ${thresholdAmt} UGX) requires manager PIN`,
        );
      }
      await this.verifyManagerPin(dto.managerPin, tenantId);
      approverId = dto.approverId;
      pinHash = dto.managerPin ? await bcrypt.hash(dto.managerPin, 10) : undefined;
    }

    const entry = this.discountRepo.create({
      saleId: dto.saleId,
      saleItemId: dto.saleItemId,
      type: dto.type as DiscountType,
      value: dto.value,
      valueType: dto.valueType as DiscountValueType,
      reason: dto.reason,
      approverId,
      approverPinHash: pinHash,
      appliedById,
      appliedAt: new Date(),
      tenantId,
    });
    return this.discountRepo.save(entry);
  }

  private async getDiscountThresholdPct(tenantId: string): Promise<number> {
    const s = await this.settingsService.getByKey('pos.discount.threshold_percent', tenantId).catch(() => null);
    return s ? parseFloat(s.value) : 10;
  }

  private async getDiscountThresholdAmt(tenantId: string): Promise<number> {
    const s = await this.settingsService.getByKey('pos.discount.threshold_amount', tenantId).catch(() => null);
    return s ? parseFloat(s.value) : 50000;
  }

  // ─── B6: Receipt Reprint ──────────────────────────────────────────────────

  async getReceipt(
    saleId: string,
    options: GetReprintReceiptOptions,
    userId: string,
    tenantId: string,
  ): Promise<{ sale: PharmacySale; isDuplicate: boolean; reprintCount: number; existingReturns: PharmacyReturn[] }> {
    const sale = await this.saleRepo.findOne({
      where: { id: saleId, tenantId },
      relations: ['items', 'store', 'patient', 'soldBy'],
    });
    if (!sale) throw new NotFoundException('Sale not found');

    let reprintCount = 0;
    if (options.duplicate) {
      // Log the reprint
      const existing = await this.reprintRepo.findOne({ where: { saleId, tenantId } });
      if (existing) {
        existing.reprintCount += 1;
        existing.reprintedAt = new Date();
        existing.reprintedById = userId;
        await this.reprintRepo.save(existing);
        reprintCount = existing.reprintCount;
      } else {
        const reprint = await this.reprintRepo.save(
          this.reprintRepo.create({
            saleId,
            reprintedById: userId,
            reprintCount: 1,
            reprintedAt: new Date(),
            tenantId,
          }),
        );
        reprintCount = reprint.reprintCount;
      }
    }

    const existingReturns = await this.returnRepo.find({
      where: { originalSaleId: saleId, tenantId },
      relations: ['items'],
    });

    return {
      sale,
      isDuplicate: !!options.duplicate,
      reprintCount,
      existingReturns,
    };
  }

  async listReceiptHistory(
    tenantId: string,
    query: { from?: string; to?: string; cashierId?: string; saleNumber?: string },
  ) {
    const qb = this.saleRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.soldBy', 'user')
      .leftJoinAndSelect('s.store', 'store')
      .where('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status = :status', { status: SaleStatus.COMPLETED })
      .orderBy('s.created_at', 'DESC')
      .take(200);

    if (query.from) qb.andWhere('s.created_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('s.created_at <= :to', { to: new Date(query.to) });
    if (query.cashierId) qb.andWhere('s.sold_by_id = :cashierId', { cashierId: query.cashierId });
    if (query.saleNumber) qb.andWhere('s.sale_number ILIKE :sn', { sn: `%${query.saleNumber}%` });

    const sales = await qb.getMany();

    // Attach reprint counts
    const reprintMap = new Map<string, number>();
    if (sales.length > 0) {
      const reprints = await this.reprintRepo
        .createQueryBuilder('rp')
        .where('rp.sale_id IN (:...ids)', { ids: sales.map((s) => s.id) })
        .getMany();
      for (const rp of reprints) {
        reprintMap.set(rp.saleId, rp.reprintCount);
      }
    }

    return sales.map((s) => ({
      ...s,
      reprintCount: reprintMap.get(s.id) || 0,
    }));
  }

  // ─── B5: Barcode lookup ───────────────────────────────────────────────────

  async getItemByBarcode(barcode: string, tenantId: string, facilityId?: string) {
    const item = await this.itemRepo
      .createQueryBuilder('i')
      .where('i.barcode = :barcode', { barcode })
      .andWhere(tenantId ? 'i.tenant_id = :tenantId' : '1=1', { tenantId })
      .getOne();

    if (!item) throw new NotFoundException(`No item found for barcode "${barcode}"`);

    let availableQty = 0;
    if (facilityId) {
      const sb = await this.stockBalanceRepo.findOne({
        where: { itemId: item.id, facilityId, ...(tenantId ? { tenantId } : {}) },
      });
      availableQty = sb ? Number(sb.availableQuantity) : 0;
    }

    return { ...item, availableQty };
  }

  // ─── B7: Quick Keys ───────────────────────────────────────────────────────

  async upsertQuickKey(dto: UpsertQuickKeyDto, createdById: string, tenantId: string): Promise<PosQuickKey> {
    const existing = await this.quickKeyRepo.findOne({
      where: {
        tenantId,
        registerId: dto.registerId || undefined,
        position: dto.position,
      },
    });
    if (existing) {
      Object.assign(existing, {
        itemId: dto.itemId,
        label: dto.label,
        color: dto.color,
        createdById,
      });
      return this.quickKeyRepo.save(existing);
    }
    const qk = this.quickKeyRepo.create({
      ...dto,
      createdById,
      tenantId,
    });
    return this.quickKeyRepo.save(qk);
  }

  async listQuickKeys(tenantId: string, registerId?: string): Promise<PosQuickKey[]> {
    const where: any = { tenantId };
    if (registerId) where.registerId = registerId;
    return this.quickKeyRepo.find({
      where,
      order: { position: 'ASC' },
    });
  }

  async deleteQuickKey(id: string, tenantId: string): Promise<void> {
    const qk = await this.quickKeyRepo.findOne({ where: { id, tenantId } });
    if (!qk) throw new NotFoundException('Quick key not found');
    await this.quickKeyRepo.delete(id);
  }

  // ─── B8: Retail Customer ─────────────────────────────────────────────────

  async upsertRetailCustomer(
    phone: string,
    tenantId: string,
    totalSpent: number,
    name?: string,
  ): Promise<RetailCustomer> {
    let customer = await this.retailCustomerRepo.findOne({ where: { phone, tenantId } });
    const now = new Date();
    if (customer) {
      customer.totalVisits += 1;
      customer.totalSpend = Number(customer.totalSpend) + totalSpent;
      customer.lastSeenAt = now;
      if (name && !customer.name) customer.name = name;
    } else {
      customer = this.retailCustomerRepo.create({
        phone,
        name,
        totalVisits: 1,
        totalSpend: totalSpent,
        firstSeenAt: now,
        lastSeenAt: now,
        tenantId,
      });
    }
    return this.retailCustomerRepo.save(customer);
  }

  async getCustomerByPhone(
    phone: string,
    tenantId: string,
  ): Promise<{ customer: RetailCustomer; recentSales: PharmacySale[] }> {
    const customer = await this.retailCustomerRepo.findOne({ where: { phone, tenantId } });
    if (!customer) throw new NotFoundException(`No customer found for phone ${phone}`);

    const recentSales = await this.saleRepo
      .createQueryBuilder('s')
      .where('s.customer_phone = :phone', { phone })
      .andWhere('s.tenant_id = :tenantId', { tenantId })
      .andWhere('s.status = :status', { status: SaleStatus.COMPLETED })
      .orderBy('s.created_at', 'DESC')
      .take(10)
      .getMany();

    return { customer, recentSales };
  }

  async updateRetailCustomer(
    id: string,
    dto: UpdateRetailCustomerDto,
    tenantId: string,
  ): Promise<RetailCustomer> {
    const customer = await this.retailCustomerRepo.findOne({ where: { id, tenantId } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (dto.name !== undefined) customer.name = dto.name;
    return this.retailCustomerRepo.save(customer);
  }
}
