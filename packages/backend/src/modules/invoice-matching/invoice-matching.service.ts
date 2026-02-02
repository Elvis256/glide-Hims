import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InvoiceMatch, InvoiceMatchItem, InvoiceMatchStatus } from '../../database/entities/invoice-match.entity';
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

  private async generateMatchNumber(facilityId: string): Promise<string> {
    const count = await this.matchRepo.count({ where: { facilityId } });
    const date = new Date();
    return `INV${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateInvoiceMatchDto, userId: string): Promise<InvoiceMatch> {
    const matchNumber = await this.generateMatchNumber(dto.facilityId);

    const po = await this.poRepo.findOne({ where: { id: dto.purchaseOrderId }, relations: ['items', 'supplier'] });
    if (!po) throw new NotFoundException('Purchase order not found');

    const grn = dto.grnId ? await this.grnRepo.findOne({ where: { id: dto.grnId }, relations: ['items'] }) : null;

    const poAmount = po.items?.reduce((sum, item) => sum + (item.quantityOrdered * Number(item.unitPrice)), 0) || 0;
    const grnAmount = grn?.items?.reduce((sum, item) => sum + (item.quantityReceived * Number(item.unitCost)), 0) || 0;

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
    });

    const savedMatch = await this.matchRepo.save(match);

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
      });
      await this.matchItemRepo.save(item);
    }

    // Calculate overall variance
    const variance = dto.invoiceAmount - poAmount;
    savedMatch.variance = variance;
    savedMatch.variancePercent = poAmount > 0 ? (variance / poAmount) * 100 : 0;
    savedMatch.status = hasVariance ? InvoiceMatchStatus.MISMATCH : InvoiceMatchStatus.MATCHED;
    await this.matchRepo.save(savedMatch);

    return this.findOne(savedMatch.id);
  }

  async findAll(facilityId: string, options: { status?: InvoiceMatchStatus } = {}) {
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

    return qb.orderBy('match.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<InvoiceMatch> {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: ['purchaseOrder', 'purchaseOrder.items', 'supplier', 'goodsReceipt', 'goodsReceipt.items', 'items', 'approvedBy'],
    });
    if (!match) throw new NotFoundException('Invoice match not found');
    return match;
  }

  async resolveItem(matchItemId: string, resolution: { qtyMatch: boolean; priceMatch: boolean }, userId: string): Promise<InvoiceMatchItem> {
    const item = await this.matchItemRepo.findOne({
      where: { id: matchItemId },
      relations: ['match'],
    });
    if (!item) throw new NotFoundException('Match item not found');

    item.qtyMatch = resolution.qtyMatch;
    item.priceMatch = resolution.priceMatch;
    await this.matchItemRepo.save(item);

    // Check if all items are resolved
    const allItems = await this.matchItemRepo.find({ where: { matchId: item.matchId } });
    const allResolved = allItems.every((i) => i.qtyMatch && i.priceMatch);

    if (allResolved) {
      const match = await this.findOne(item.matchId);
      match.status = InvoiceMatchStatus.MATCHED;
      await this.matchRepo.save(match);
    }

    return item;
  }

  async approve(id: string, dto: ApproveMatchDto, userId: string): Promise<InvoiceMatch> {
    const match = await this.findOne(id);
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

    return this.findOne(id);
  }

  async markAsPaid(id: string): Promise<InvoiceMatch> {
    const match = await this.findOne(id);
    if (match.status !== InvoiceMatchStatus.APPROVED) {
      throw new BadRequestException('Only approved invoices can be marked as paid');
    }

    match.status = InvoiceMatchStatus.PAID;
    await this.matchRepo.save(match);

    return this.findOne(id);
  }

  async flag(id: string, reason: string): Promise<InvoiceMatch> {
    const match = await this.findOne(id);
    match.status = InvoiceMatchStatus.FLAGGED;
    match.notes = reason;
    await this.matchRepo.save(match);
    return this.findOne(id);
  }

  async getStats(facilityId: string) {
    const whereClause = facilityId && facilityId.trim() !== '' ? { facilityId } : {};
    
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

    const totalVariance = await qb.getRawOne();

    return { pending, matched, mismatch, approved, paid, flagged, totalVarianceAmount: parseFloat(totalVariance?.sum || '0') };
  }
}
