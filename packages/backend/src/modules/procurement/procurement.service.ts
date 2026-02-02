import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { PurchaseRequest, PurchaseRequestItem, PRStatus, PRPriority } from '../../database/entities/purchase-request.entity';
import { PurchaseOrder, PurchaseOrderItem, POStatus } from '../../database/entities/purchase-order.entity';
import { GoodsReceiptNote, GoodsReceiptItem, GRNStatus } from '../../database/entities/goods-receipt.entity';
import { StockLedger, StockBalance, MovementType } from '../../database/entities/inventory.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import {
  CreatePurchaseRequestDto,
  ApprovePRDto,
  RejectPRDto,
  CreatePurchaseOrderDto,
  CreatePOFromPRDto,
  CreateGoodsReceiptDto,
  InspectGRNDto,
} from './dto/procurement.dto';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);
  constructor(
    @InjectRepository(PurchaseRequest)
    private prRepo: Repository<PurchaseRequest>,
    @InjectRepository(PurchaseRequestItem)
    private prItemRepo: Repository<PurchaseRequestItem>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseOrderItem)
    private poItemRepo: Repository<PurchaseOrderItem>,
    @InjectRepository(GoodsReceiptNote)
    private grnRepo: Repository<GoodsReceiptNote>,
    @InjectRepository(GoodsReceiptItem)
    private grnItemRepo: Repository<GoodsReceiptItem>,
    @InjectRepository(StockLedger)
    private stockLedgerRepo: Repository<StockLedger>,
    @InjectRepository(StockBalance)
    private stockBalanceRepo: Repository<StockBalance>,
    @InjectRepository(Supplier)
    private supplierRepo: Repository<Supplier>,
  ) {}

  // ============ PURCHASE REQUEST ============

  private async generatePRNumber(facilityId: string): Promise<string> {
    const count = await this.prRepo.count({ where: { facilityId } });
    const date = new Date();
    return `PR${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createPurchaseRequest(dto: CreatePurchaseRequestDto, userId: string): Promise<PurchaseRequest> {
    try {
      this.logger.log(`Creating PR for facility ${dto.facilityId} with ${dto.items.length} items`);
      const requestNumber = await this.generatePRNumber(dto.facilityId);

      // Calculate total estimated
      const totalEstimated = dto.items.reduce((sum, item) => {
        return sum + (item.quantityRequested * (item.unitPriceEstimated || 0));
      }, 0);

      const pr = this.prRepo.create({
        requestNumber,
        facilityId: dto.facilityId,
        departmentId: dto.departmentId,
        priority: dto.priority || PRPriority.NORMAL,
        justification: dto.justification,
        requiredDate: dto.requiredDate ? new Date(dto.requiredDate) : undefined,
        totalEstimated,
        notes: dto.notes,
        status: PRStatus.DRAFT,
        requestedById: userId,
      });

      const savedPR = await this.prRepo.save(pr);
      this.logger.log(`Created PR ${(savedPR as PurchaseRequest).requestNumber}`);

      // Create items
      const items = dto.items.map(item => this.prItemRepo.create({
        purchaseRequestId: (savedPR as PurchaseRequest).id,
        itemId: item.itemId,
        itemCode: item.itemCode,
        itemName: item.itemName,
        itemUnit: item.itemUnit || 'unit',
        quantityRequested: item.quantityRequested,
        unitPriceEstimated: item.unitPriceEstimated || 0,
        specifications: item.specifications,
        notes: item.notes,
      }));

      await this.prItemRepo.save(items);

      return this.getPurchaseRequest((savedPR as PurchaseRequest).id);
    } catch (error) {
      this.logger.error(`Error creating PR: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPurchaseRequest(id: string): Promise<PurchaseRequest> {
    const pr = await this.prRepo.findOne({
      where: { id },
      relations: ['items', 'department', 'requestedBy', 'approvedBy', 'facility'],
    });
    if (!pr) throw new NotFoundException('Purchase request not found');
    return pr;
  }

  async getPurchaseRequests(facilityId: string, options: {
    status?: PRStatus;
    priority?: PRPriority;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.prRepo.createQueryBuilder('pr')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('pr.department', 'department')
      .leftJoinAndSelect('pr.requestedBy', 'requestedBy');

    let hasWhere = false;
    if (facilityId && facilityId.trim() !== '') {
      qb.where('pr.facilityId = :facilityId', { facilityId });
      hasWhere = true;
    }

    if (options.status) {
      if (hasWhere) {
        qb.andWhere('pr.status = :status', { status: options.status });
      } else {
        qb.where('pr.status = :status', { status: options.status });
        hasWhere = true;
      }
    }
    if (options.priority) {
      qb.andWhere('pr.priority = :priority', { priority: options.priority });
    }
    if (options.startDate && options.endDate) {
      qb.andWhere('pr.createdAt BETWEEN :start AND :end', {
        start: new Date(options.startDate),
        end: new Date(options.endDate),
      });
    }

    return qb.orderBy('pr.createdAt', 'DESC').getMany();
  }

  async submitPurchaseRequest(id: string): Promise<PurchaseRequest> {
    const pr = await this.getPurchaseRequest(id);
    if (pr.status !== PRStatus.DRAFT) {
      throw new BadRequestException('Only draft PRs can be submitted');
    }
    if (pr.items.length === 0) {
      throw new BadRequestException('PR must have at least one item');
    }
    pr.status = PRStatus.PENDING_APPROVAL;
    return this.prRepo.save(pr);
  }

  async approvePurchaseRequest(id: string, dto: ApprovePRDto, userId: string): Promise<PurchaseRequest> {
    const pr = await this.getPurchaseRequest(id);
    if (pr.status !== PRStatus.PENDING_APPROVAL) {
      throw new BadRequestException('PR must be pending approval');
    }

    // Update approved quantities if provided
    if (dto.approvedItems) {
      for (const approved of dto.approvedItems) {
        const item = pr.items.find(i => i.itemId === approved.itemId);
        if (item) {
          item.quantityApproved = approved.quantityApproved;
          await this.prItemRepo.save(item);
        }
      }
    } else {
      // Default: approve all requested quantities
      for (const item of pr.items) {
        item.quantityApproved = item.quantityRequested;
        await this.prItemRepo.save(item);
      }
    }

    pr.status = PRStatus.APPROVED;
    pr.approvedById = userId;
    pr.approvedAt = new Date();
    return this.prRepo.save(pr);
  }

  async rejectPurchaseRequest(id: string, dto: RejectPRDto, userId: string): Promise<PurchaseRequest> {
    const pr = await this.getPurchaseRequest(id);
    if (pr.status !== PRStatus.PENDING_APPROVAL) {
      throw new BadRequestException('PR must be pending approval');
    }
    pr.status = PRStatus.REJECTED;
    pr.approvedById = userId;
    pr.approvedAt = new Date();
    pr.rejectionReason = dto.rejectionReason;
    return this.prRepo.save(pr);
  }

  // ============ PURCHASE ORDER ============

  private async generatePONumber(facilityId: string): Promise<string> {
    const count = await this.poRepo.count({ where: { facilityId } });
    const date = new Date();
    return `PO${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, userId: string): Promise<PurchaseOrder> {
    const orderNumber = await this.generatePONumber(dto.facilityId);

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const itemsWithTotals = dto.items.map(item => {
      const lineGross = item.quantityOrdered * item.unitPrice;
      const lineDiscount = lineGross * (item.discountPercent || 0) / 100;
      const lineNet = lineGross - lineDiscount;
      const lineTax = lineNet * (item.taxRate || 0) / 100;
      const lineTotal = lineNet + lineTax;

      subtotal += lineNet;
      taxAmount += lineTax;
      discountAmount += lineDiscount;

      return { ...item, lineTotal };
    });

    const po = this.poRepo.create({
      orderNumber,
      facilityId: dto.facilityId,
      supplierId: dto.supplierId,
      purchaseRequestId: dto.purchaseRequestId,
      orderDate: dto.orderDate ? new Date(dto.orderDate) : new Date(),
      expectedDelivery: dto.expectedDelivery ? new Date(dto.expectedDelivery) : undefined,
      paymentTerms: dto.paymentTerms,
      deliveryAddress: dto.deliveryAddress,
      subtotal,
      taxAmount,
      discountAmount,
      totalAmount: subtotal + taxAmount,
      terms: dto.terms,
      notes: dto.notes,
      status: POStatus.DRAFT,
      createdById: userId,
    });

    const savedPO = await this.poRepo.save(po);

    // Create items
    const items = itemsWithTotals.map(item => this.poItemRepo.create({
      purchaseOrderId: (savedPO as PurchaseOrder).id,
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemUnit: item.itemUnit || 'unit',
      quantityOrdered: item.quantityOrdered,
      unitPrice: item.unitPrice,
      taxRate: item.taxRate || 0,
      discountPercent: item.discountPercent || 0,
      lineTotal: item.lineTotal,
      notes: item.notes,
    }));

    await this.poItemRepo.save(items);

    return this.getPurchaseOrder((savedPO as PurchaseOrder).id);
  }

  async createPOFromPR(dto: CreatePOFromPRDto, userId: string): Promise<PurchaseOrder> {
    const pr = await this.getPurchaseRequest(dto.purchaseRequestId);
    if (pr.status !== PRStatus.APPROVED) {
      throw new BadRequestException('PR must be approved to create PO');
    }

    const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplierId } });
    if (!supplier) throw new NotFoundException('Supplier not found');

    // Map prices
    const priceMap = new Map(dto.itemPrices?.map(p => [p.itemId, p.unitPrice]) || []);

    const poDto: CreatePurchaseOrderDto = {
      facilityId: pr.facilityId,
      supplierId: dto.supplierId,
      purchaseRequestId: pr.id,
      expectedDelivery: dto.expectedDelivery,
      paymentTerms: dto.paymentTerms || supplier.paymentTerms,
      items: pr.items
        .filter(item => (item.quantityApproved || 0) > item.quantityOrdered)
        .map(item => ({
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemUnit: item.itemUnit,
          quantityOrdered: (item.quantityApproved || item.quantityRequested) - item.quantityOrdered,
          unitPrice: priceMap.get(item.itemId) || item.unitPriceEstimated,
        })),
    };

    if (poDto.items.length === 0) {
      throw new BadRequestException('No items available to order');
    }

    const po = await this.createPurchaseOrder(poDto, userId);

    // Update PR items with ordered quantities
    for (const poItem of po.items) {
      const prItem = pr.items.find(i => i.itemId === poItem.itemId);
      if (prItem) {
        prItem.quantityOrdered += poItem.quantityOrdered;
        await this.prItemRepo.save(prItem);
      }
    }

    // Update PR status
    const allOrdered = pr.items.every(i => i.quantityOrdered >= (i.quantityApproved || i.quantityRequested));
    pr.status = allOrdered ? PRStatus.FULLY_ORDERED : PRStatus.PARTIALLY_ORDERED;
    await this.prRepo.save(pr);

    return po;
  }

  async getPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: ['items', 'supplier', 'purchaseRequest', 'createdBy', 'approvedBy', 'facility'],
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async getPurchaseOrders(facilityId: string, options: {
    status?: POStatus;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.poRepo.createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.createdBy', 'createdBy');

    let hasWhere = false;
    if (facilityId && facilityId.trim() !== '') {
      qb.where('po.facilityId = :facilityId', { facilityId });
      hasWhere = true;
    }

    if (options.status) {
      if (hasWhere) {
        qb.andWhere('po.status = :status', { status: options.status });
      } else {
        qb.where('po.status = :status', { status: options.status });
        hasWhere = true;
      }
    }
    if (options.supplierId) {
      qb.andWhere('po.supplierId = :supplierId', { supplierId: options.supplierId });
    }
    if (options.startDate && options.endDate) {
      qb.andWhere('po.createdAt BETWEEN :start AND :end', {
        start: new Date(options.startDate),
        end: new Date(options.endDate),
      });
    }

    return qb.orderBy('po.createdAt', 'DESC').getMany();
  }

  async approvePurchaseOrder(id: string, userId: string): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id);
    if (po.status !== POStatus.DRAFT && po.status !== POStatus.PENDING_APPROVAL) {
      throw new BadRequestException('PO cannot be approved from current status');
    }
    po.status = POStatus.APPROVED;
    po.approvedById = userId;
    po.approvedAt = new Date();
    return this.poRepo.save(po);
  }

  async sendPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id);
    if (po.status !== POStatus.APPROVED) {
      throw new BadRequestException('PO must be approved before sending');
    }
    po.status = POStatus.SENT;
    po.sentAt = new Date();
    return this.poRepo.save(po);
  }

  async cancelPurchaseOrder(id: string): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id);
    if ([POStatus.FULLY_RECEIVED, POStatus.CLOSED].includes(po.status)) {
      throw new BadRequestException('Cannot cancel a received or closed PO');
    }
    po.status = POStatus.CANCELLED;
    return this.poRepo.save(po);
  }

  // ============ GOODS RECEIPT NOTE ============

  private async generateGRNNumber(facilityId: string): Promise<string> {
    const count = await this.grnRepo.count({ where: { facilityId } });
    const date = new Date();
    return `GRN${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, userId: string): Promise<GoodsReceiptNote> {
    const grnNumber = await this.generateGRNNumber(dto.facilityId);

    // Calculate totals
    let totalQuantityReceived = 0;
    let totalValue = 0;

    const itemsWithTotals = dto.items.map(item => {
      const lineTotal = item.quantityReceived * item.unitCost;
      totalQuantityReceived += item.quantityReceived;
      totalValue += lineTotal;
      return { ...item, lineTotal };
    });

    const grn = this.grnRepo.create({
      grnNumber,
      facilityId: dto.facilityId,
      supplierId: dto.supplierId,
      purchaseOrderId: dto.purchaseOrderId,
      receivedAt: new Date(),
      deliveryNoteNumber: dto.deliveryNoteNumber,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: dto.invoiceDate ? new Date(dto.invoiceDate) : undefined,
      invoiceAmount: dto.invoiceAmount,
      totalQuantityReceived,
      totalValue,
      notes: dto.notes,
      status: GRNStatus.DRAFT,
      receivedById: userId,
    });

    const savedGRN = await this.grnRepo.save(grn);

    // Create items
    const items = itemsWithTotals.map(item => this.grnItemRepo.create({
      goodsReceiptNoteId: (savedGRN as GoodsReceiptNote).id,
      itemId: item.itemId,
      itemCode: item.itemCode,
      itemName: item.itemName,
      itemUnit: item.itemUnit || 'unit',
      quantityExpected: item.quantityExpected,
      quantityReceived: item.quantityReceived,
      unitCost: item.unitCost,
      lineTotal: item.lineTotal,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
      manufactureDate: item.manufactureDate ? new Date(item.manufactureDate) : undefined,
      purchaseOrderItemId: item.purchaseOrderItemId,
      notes: item.notes,
    }));

    await this.grnItemRepo.save(items);

    return this.getGoodsReceipt((savedGRN as GoodsReceiptNote).id);
  }

  async createGRNFromPO(purchaseOrderId: string, receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[], userId: string): Promise<GoodsReceiptNote> {
    const po = await this.getPurchaseOrder(purchaseOrderId);
    if (![POStatus.SENT, POStatus.PARTIALLY_RECEIVED].includes(po.status)) {
      throw new BadRequestException('PO must be sent or partially received to create GRN');
    }

    const receivedMap = new Map(receivedItems.map(r => [r.itemId, r]));

    const grnDto: CreateGoodsReceiptDto = {
      facilityId: po.facilityId,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      items: po.items
        .filter(item => receivedMap.has(item.itemId))
        .map(item => {
          const received = receivedMap.get(item.itemId)!;
          return {
            itemId: item.itemId,
            itemCode: item.itemCode,
            itemName: item.itemName,
            itemUnit: item.itemUnit,
            quantityExpected: item.quantityOrdered - item.quantityReceived,
            quantityReceived: received.quantityReceived,
            unitCost: item.unitPrice,
            batchNumber: received.batchNumber,
            expiryDate: received.expiryDate,
            purchaseOrderItemId: item.id,
          };
        }),
    };

    return this.createGoodsReceipt(grnDto, userId);
  }

  async getGoodsReceipt(id: string): Promise<GoodsReceiptNote> {
    const grn = await this.grnRepo.findOne({
      where: { id },
      relations: ['items', 'supplier', 'purchaseOrder', 'receivedBy', 'inspectedBy', 'postedBy', 'facility'],
    });
    if (!grn) throw new NotFoundException('Goods receipt not found');
    return grn;
  }

  async getGoodsReceipts(facilityId: string, options: {
    status?: GRNStatus;
    supplierId?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const qb = this.grnRepo.createQueryBuilder('grn')
      .leftJoinAndSelect('grn.items', 'items')
      .leftJoinAndSelect('grn.supplier', 'supplier')
      .leftJoinAndSelect('grn.purchaseOrder', 'purchaseOrder')
      .leftJoinAndSelect('grn.receivedBy', 'receivedBy');

    let hasWhere = false;
    if (facilityId && facilityId.trim() !== '') {
      qb.where('grn.facilityId = :facilityId', { facilityId });
      hasWhere = true;
    }

    if (options.status) {
      if (hasWhere) {
        qb.andWhere('grn.status = :status', { status: options.status });
      } else {
        qb.where('grn.status = :status', { status: options.status });
        hasWhere = true;
      }
    }
    if (options.supplierId) {
      qb.andWhere('grn.supplierId = :supplierId', { supplierId: options.supplierId });
    }
    if (options.startDate && options.endDate) {
      qb.andWhere('grn.receivedAt BETWEEN :start AND :end', {
        start: new Date(options.startDate),
        end: new Date(options.endDate),
      });
    }

    return qb.orderBy('grn.receivedAt', 'DESC').getMany();
  }

  async inspectGoodsReceipt(id: string, dto: InspectGRNDto, userId: string): Promise<GoodsReceiptNote> {
    const grn = await this.getGoodsReceipt(id);
    if (grn.status !== GRNStatus.DRAFT && grn.status !== GRNStatus.PENDING_INSPECTION) {
      throw new BadRequestException('GRN is not available for inspection');
    }

    // Update items with inspection results
    for (const inspected of dto.inspectedItems) {
      const item = grn.items.find(i => i.itemId === inspected.itemId);
      if (item) {
        item.quantityAccepted = inspected.quantityAccepted;
        item.quantityRejected = inspected.quantityRejected;
        if (inspected.rejectionReason) {
          item.rejectionReason = inspected.rejectionReason;
        }
        await this.grnItemRepo.save(item);
      }
    }

    grn.status = GRNStatus.INSPECTED;
    grn.inspectedById = userId;
    grn.inspectedAt = new Date();
    if (dto.inspectionNotes) {
      grn.inspectionNotes = dto.inspectionNotes;
    }

    return this.grnRepo.save(grn);
  }

  async approveGoodsReceipt(id: string, userId: string): Promise<GoodsReceiptNote> {
    const grn = await this.getGoodsReceipt(id);
    if (grn.status !== GRNStatus.DRAFT && grn.status !== GRNStatus.INSPECTED) {
      throw new BadRequestException('GRN cannot be approved from current status');
    }
    grn.status = GRNStatus.APPROVED;
    return this.grnRepo.save(grn);
  }

  async postGoodsReceipt(id: string, userId: string): Promise<GoodsReceiptNote> {
    const grn = await this.getGoodsReceipt(id);
    if (grn.status !== GRNStatus.APPROVED) {
      throw new BadRequestException('GRN must be approved before posting');
    }

    // Update stock ledger for each item
    for (const item of grn.items) {
      const quantityToPost = item.quantityAccepted ?? item.quantityReceived;
      if (quantityToPost <= 0) continue;

      // Get current balance
      let stockBalance = await this.stockBalanceRepo.findOne({
        where: { itemId: item.itemId, facilityId: grn.facilityId },
      });

      const newBalance = (stockBalance?.totalQuantity || 0) + quantityToPost;

      // Create ledger entry
      const ledgerEntry = this.stockLedgerRepo.create({
        itemId: item.itemId,
        facilityId: grn.facilityId,
        batchNumber: item.batchNumber,
        expiryDate: item.expiryDate,
        quantity: quantityToPost,
        balanceAfter: newBalance,
        movementType: MovementType.PURCHASE,
        unitCost: item.unitCost,
        referenceType: 'goods_receipt_note',
        referenceId: grn.id,
        notes: `GRN: ${grn.grnNumber}`,
        createdById: userId,
      });
      await this.stockLedgerRepo.save(ledgerEntry);

      // Update or create stock balance
      if (stockBalance) {
        stockBalance.totalQuantity = newBalance;
        stockBalance.availableQuantity = newBalance - stockBalance.reservedQuantity;
        stockBalance.lastMovementAt = new Date();
        await this.stockBalanceRepo.save(stockBalance);
      } else {
        stockBalance = this.stockBalanceRepo.create({
          itemId: item.itemId,
          facilityId: grn.facilityId,
          totalQuantity: quantityToPost,
          reservedQuantity: 0,
          availableQuantity: quantityToPost,
          lastMovementAt: new Date(),
        });
        await this.stockBalanceRepo.save(stockBalance);
      }
    }

    // Update PO received quantities if linked
    if (grn.purchaseOrderId) {
      const po = await this.getPurchaseOrder(grn.purchaseOrderId);
      for (const grnItem of grn.items) {
        if (grnItem.purchaseOrderItemId) {
          const poItem = po.items.find(i => i.id === grnItem.purchaseOrderItemId);
          if (poItem) {
            poItem.quantityReceived += grnItem.quantityAccepted ?? grnItem.quantityReceived;
            await this.poItemRepo.save(poItem);
          }
        }
      }

      // Update PO status
      const allReceived = po.items.every(i => i.quantityReceived >= i.quantityOrdered);
      po.status = allReceived ? POStatus.FULLY_RECEIVED : POStatus.PARTIALLY_RECEIVED;
      await this.poRepo.save(po);
    }

    grn.status = GRNStatus.POSTED;
    grn.postedById = userId;
    grn.postedAt = new Date();

    return this.grnRepo.save(grn);
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      pendingPRs,
      approvedPRs,
      pendingPOs,
      sentPOs,
      pendingGRNs,
      totalValueToday,
    ] = await Promise.all([
      this.prRepo.count({ where: { facilityId, status: PRStatus.PENDING_APPROVAL } }),
      this.prRepo.count({ where: { facilityId, status: PRStatus.APPROVED } }),
      this.poRepo.count({ where: { facilityId, status: In([POStatus.DRAFT, POStatus.PENDING_APPROVAL]) } }),
      this.poRepo.count({ where: { facilityId, status: POStatus.SENT } }),
      this.grnRepo.count({ where: { facilityId, status: In([GRNStatus.DRAFT, GRNStatus.PENDING_INSPECTION, GRNStatus.INSPECTED, GRNStatus.APPROVED]) } }),
      this.grnRepo.createQueryBuilder('grn')
        .select('SUM(grn.totalValue)', 'total')
        .where('grn.facilityId = :facilityId', { facilityId })
        .andWhere('grn.status = :status', { status: GRNStatus.POSTED })
        .andWhere('grn.postedAt BETWEEN :today AND :tomorrow', { today, tomorrow })
        .getRawOne(),
    ]);

    return {
      pendingPRs,
      approvedPRs,
      pendingPOs,
      sentPOs,
      pendingGRNs,
      totalValueToday: totalValueToday?.total || 0,
    };
  }
}
