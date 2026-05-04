import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  InvoiceMatch,
  InvoiceMatchItem,
  InvoiceMatchStatus,
} from '../../database/entities/invoice-match.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote } from '../../database/entities/goods-receipt.entity';
import { CreateInvoiceMatchDto, ApproveMatchDto } from './dto/invoice-match.dto';

@Injectable()
export class InvoiceMatchingService {
  private readonly logger = new Logger(InvoiceMatchingService.name);

  constructor(
    @InjectRepository(InvoiceMatch) private matchRepo: Repository<InvoiceMatch>,
    @InjectRepository(InvoiceMatchItem) private matchItemRepo: Repository<InvoiceMatchItem>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceiptNote) private grnRepo: Repository<GoodsReceiptNote>,
  ) {}

  private async generateMatchNumber(facilityId: string, tenantId?: string): Promise<string> {
    const count = await this.matchRepo.count({
      where: { facilityId, ...(tenantId ? { tenantId } : {}) },
    });
    const date = new Date();
    return `INV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async create(
    dto: CreateInvoiceMatchDto,
    userId: string,
    tenantId?: string,
  ): Promise<InvoiceMatch> {
    // Get PO first to verify it exists and get supplier ID
    const po = await this.poRepo.findOne({
      where: { id: dto.purchaseOrderId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items', 'supplier'],
    });
    if (!po) throw new NotFoundException('Purchase order not found');

    // CRITICAL FIX: Check for duplicate invoice matches
    const existingMatch = await this.matchRepo.findOne({
      where: {
        vendorInvoiceNumber: dto.invoiceNumber,
        supplierId: po.supplierId,
        status: InvoiceMatchStatus.PENDING,
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (existingMatch) {
      throw new BadRequestException(
        `Invoice ${dto.invoiceNumber} is already matched (Match #${existingMatch.matchNumber} created on ${existingMatch.createdAt}). Cannot create duplicate match.`,
      );
    }

    const matchNumber = await this.generateMatchNumber(dto.facilityId, tenantId);

    if (!dto.grnId) {
      throw new BadRequestException(
        'GRN ID is required for 3-way invoice matching. All supplier invoices must be matched against both PO and GRN.',
      );
    }
    const grn = await this.grnRepo.findOne({
      where: { id: dto.grnId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items'],
    });
    if (!grn) throw new NotFoundException('Goods Receipt Note not found');

    const poAmount =
      po.items?.reduce((sum, item) => sum + item.quantityOrdered * Number(item.unitPrice), 0) || 0;
    const grnAmount =
      grn?.items?.reduce((sum, item) => sum + item.quantityReceived * Number(item.unitCost), 0) ||
      0;

    const match = this.matchRepo.create({
      matchNumber,
      facilityId: dto.facilityId,
      purchaseOrderId: dto.purchaseOrderId,
      grnId: dto.grnId,
      vendorInvoiceNumber: dto.invoiceNumber,
      invoiceDate: new Date(dto.invoiceDate),
      dueDate: dto.dueDate ? new Date(dto.dueDate) : new Date(dto.invoiceDate),
      invoiceTotal: dto.invoiceAmount,
      supplierId: po.supplierId,
      poTotal: poAmount,
      grnTotal: grnAmount,
      status: InvoiceMatchStatus.PENDING,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedMatch = await this.matchRepo.save(match);

    // Crit 5: Validate invoice items exist on the PO before creating match items
    const poItemIds = new Set(po.items?.map((i) => i.itemId) || []);
    for (const itemDto of dto.items) {
      if (!poItemIds.has(itemDto.itemId)) {
        throw new BadRequestException(
          `Item ${itemDto.itemName || itemDto.itemId} is not on PO ${po.orderNumber}. Invoice items must correspond to PO line items.`,
        );
      }
    }

    // Create match items
    let hasVariance = false;
    for (const itemDto of dto.items) {
      const qtyMatch = itemDto.invoiceQty === itemDto.grnQty;
      const priceMatch = itemDto.invoicePrice === itemDto.poPrice;
      if (!qtyMatch || !priceMatch) hasVariance = true;

      const item = this.matchItemRepo.create({
        matchId: savedMatch.id,
        itemId: itemDto.itemId,
        itemName: itemDto.itemName,
        poQty: itemDto.poQty,
        poPrice: itemDto.poPrice,
        grnQty: itemDto.grnQty || 0,
        invoiceQty: itemDto.invoiceQty,
        invoicePrice: itemDto.invoicePrice,
        qtyMatch,
        priceMatch,
        ...(tenantId ? { tenantId } : {}),
      });
      await this.matchItemRepo.save(item);
    }

    // Calculate overall variance
    const variance = dto.invoiceAmount - poAmount;
    savedMatch.variance = variance;
    savedMatch.variancePercent = poAmount > 0 ? (variance / poAmount) * 100 : 0;
    savedMatch.status = hasVariance ? InvoiceMatchStatus.MISMATCH : InvoiceMatchStatus.MATCHED;

    // Auto-flag if variance exceeds 5% threshold
    if (Math.abs(savedMatch.variancePercent) > 5) {
      savedMatch.status = InvoiceMatchStatus.FLAGGED;
      savedMatch.notes = `Auto-flagged: Variance of ${savedMatch.variancePercent.toFixed(2)}% exceeds 5% threshold`;
    }

    await this.matchRepo.save(savedMatch);

    return this.findOne(savedMatch.id, tenantId);
  }

  async findAll(
    facilityId: string,
    options: { status?: InvoiceMatchStatus } = {},
    tenantId?: string,
  ) {
    const qb = this.matchRepo
      .createQueryBuilder('match')
      .leftJoinAndSelect('match.purchaseOrder', 'po')
      .leftJoinAndSelect('match.supplier', 'supplier')
      .leftJoinAndSelect('match.goodsReceipt', 'grn')
      .leftJoinAndSelect('match.items', 'items')
      .leftJoinAndSelect('match.approvedBy', 'approvedBy');

    if (facilityId && facilityId.trim() !== '') {
      qb.where('match.facilityId = :facilityId', { facilityId });
    }

    if (options.status) {
      if (facilityId && facilityId.trim() !== '') {
        qb.andWhere('match.status = :status', { status: options.status });
      } else {
        qb.where('match.status = :status', { status: options.status });
      }
    }

    if (tenantId) {
      qb.andWhere('match.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('match.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<InvoiceMatch> {
    const match = await this.matchRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: [
        'purchaseOrder',
        'purchaseOrder.items',
        'supplier',
        'goodsReceipt',
        'goodsReceipt.items',
        'items',
        'approvedBy',
      ],
    });
    if (!match) throw new NotFoundException('Invoice match not found');
    return match;
  }

  async resolveItem(
    matchItemId: string,
    resolution: { qtyMatch: boolean; priceMatch: boolean },
    userId: string,
    tenantId?: string,
  ): Promise<InvoiceMatchItem> {
    const item = await this.matchItemRepo.findOne({
      where: { id: matchItemId, ...(tenantId ? { tenantId } : {}) },
      relations: ['match'],
    });
    if (!item) throw new NotFoundException('Match item not found');

    item.qtyMatch = resolution.qtyMatch;
    item.priceMatch = resolution.priceMatch;
    await this.matchItemRepo.save(item);

    // Check if all items are resolved
    const allItems = await this.matchItemRepo.find({
      where: { matchId: item.matchId, ...(tenantId ? { tenantId } : {}) },
    });
    const allResolved = allItems.every((i) => i.qtyMatch && i.priceMatch);

    if (allResolved) {
      const match = await this.findOne(item.matchId, tenantId);
      match.status = InvoiceMatchStatus.MATCHED;
      await this.matchRepo.save(match);
    }

    return item;
  }

  async approve(
    id: string,
    dto: ApproveMatchDto,
    userId: string,
    tenantId?: string,
  ): Promise<InvoiceMatch> {
    const match = await this.findOne(id, tenantId);
    if (match.status === InvoiceMatchStatus.FLAGGED) {
      throw new BadRequestException(
        'This invoice is FLAGGED for variance/discrepancy and cannot be approved directly. Use the "Override & Approve" workflow with a documented reason and authorised approver.',
      );
    }
    if (match.status !== InvoiceMatchStatus.MATCHED) {
      throw new BadRequestException('Only matched invoices can be approved');
    }

    match.status = InvoiceMatchStatus.APPROVED;
    match.approvedById = userId;
    match.approvedAt = new Date();
    match.notes = dto.notes || match.notes;
    if (dto.paymentScheduled) {
      match.paymentScheduled = new Date(dto.paymentScheduled);
    }
    await this.matchRepo.save(match);

    return this.findOne(id, tenantId);
  }

  async markAsPaid(id: string, tenantId?: string): Promise<InvoiceMatch> {
    const match = await this.findOne(id, tenantId);
    if (match.status !== InvoiceMatchStatus.APPROVED) {
      throw new BadRequestException('Only approved invoices can be marked as paid');
    }

    match.status = InvoiceMatchStatus.PAID;
    await this.matchRepo.save(match);

    return this.findOne(id, tenantId);
  }

  async flag(id: string, reason: string, tenantId?: string): Promise<InvoiceMatch> {
    const match = await this.findOne(id, tenantId);
    match.status = InvoiceMatchStatus.FLAGGED;
    match.notes = reason;
    await this.matchRepo.save(match);
    return this.findOne(id, tenantId);
  }

  /**
   * Override a FLAGGED invoice — explicit approval despite variance.
   * Requires a documented overrideReason and authorised user.
   * Sets status APPROVED and stamps overriddenBy/At for audit.
   */
  async overrideFlag(
    id: string,
    dto: { overrideReason: string; notes?: string },
    userId: string,
    tenantId?: string,
  ): Promise<InvoiceMatch> {
    const match = await this.findOne(id, tenantId);
    if (match.status !== InvoiceMatchStatus.FLAGGED) {
      throw new BadRequestException(
        `Override only applies to FLAGGED invoices (current: ${match.status})`,
      );
    }
    if (!dto.overrideReason || dto.overrideReason.trim().length < 10) {
      throw new BadRequestException(
        'Override reason is required and must be at least 10 characters',
      );
    }
    match.status = InvoiceMatchStatus.APPROVED;
    match.approvedById = userId;
    match.approvedAt = new Date();
    match.overrideReason = dto.overrideReason.trim();
    match.overriddenById = userId;
    match.overriddenAt = new Date();
    if (dto.notes) match.notes = dto.notes;
    await this.matchRepo.save(match);
    return this.findOne(id, tenantId);
  }

  async getStats(facilityId: string, tenantId?: string) {
    const whereClause = facilityId && facilityId.trim() !== '' ? { facilityId } : {};
    if (tenantId) (whereClause as any).tenantId = tenantId;

    const [pending, matched, mismatch, approved, paid, flagged] = await Promise.all([
      this.matchRepo.count({ where: { ...whereClause, status: InvoiceMatchStatus.PENDING } }),
      this.matchRepo.count({ where: { ...whereClause, status: InvoiceMatchStatus.MATCHED } }),
      this.matchRepo.count({ where: { ...whereClause, status: InvoiceMatchStatus.MISMATCH } }),
      this.matchRepo.count({ where: { ...whereClause, status: InvoiceMatchStatus.APPROVED } }),
      this.matchRepo.count({ where: { ...whereClause, status: InvoiceMatchStatus.PAID } }),
      this.matchRepo.count({ where: { ...whereClause, status: InvoiceMatchStatus.FLAGGED } }),
    ]);

    const qb = this.matchRepo
      .createQueryBuilder('match')
      .where('match.status = :status', { status: InvoiceMatchStatus.MISMATCH })
      .select('SUM(ABS(match.variance))', 'sum');

    if (facilityId && facilityId.trim() !== '') {
      qb.andWhere('match.facilityId = :facilityId', { facilityId });
    }
    if (tenantId) {
      qb.andWhere('match.tenant_id = :tenantId', { tenantId });
    }

    const totalVariance = await qb.getRawOne();

    return {
      pending,
      matched,
      mismatch,
      approved,
      paid,
      flagged,
      totalVarianceAmount: parseFloat(totalVariance?.sum || '0'),
    };
  }
}
