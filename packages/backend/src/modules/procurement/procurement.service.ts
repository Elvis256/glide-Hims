import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between, DataSource, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  PurchaseRequest,
  PurchaseRequestItem,
  PRStatus,
  PRPriority,
} from '../../database/entities/purchase-request.entity';
import {
  PurchaseOrder,
  PurchaseOrderItem,
  POStatus,
} from '../../database/entities/purchase-order.entity';
import {
  GoodsReceiptNote,
  GoodsReceiptItem,
  GRNStatus,
} from '../../database/entities/goods-receipt.entity';
import {
  StockLedger,
  StockBalance,
  MovementType,
  Item,
} from '../../database/entities/inventory.entity';
import { ItemCategory } from '../../database/entities/item-classification.entity';
import { Supplier, SupplierStatus } from '../../database/entities/supplier.entity';
import {
  VendorQuotation,
  VendorQuotationItem,
  QuotationStatus,
  RFQ,
  RFQStatus,
  RFQItem,
} from '../../database/entities/rfq.entity';
import {
  CreatePurchaseRequestDto,
  ApprovePRDto,
  RejectPRDto,
  CreatePurchaseOrderDto,
  CreatePOFromPRDto,
  CreatePOFromQuotationDto,
  CreateGoodsReceiptDto,
  InspectGRNDto,
} from './dto/procurement.dto';
import { FinanceService } from '../finance/finance.service';
import { BudgetService } from '../finance/budget.service';
import { InvoiceMatch } from '../../database/entities/invoice-match.entity';
import { ProcurementApprovalThreshold } from '../../database/entities/procurement-approval-threshold.entity';
import {
  ProcurementApprovalChain,
  ApprovalChainStatus,
} from '../../database/entities/procurement-approval-chain.entity';

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
    @InjectRepository(Item)
    private itemRepo: Repository<Item>,
    @InjectRepository(VendorQuotation)
    private quotationRepo: Repository<VendorQuotation>,
    @InjectRepository(InvoiceMatch)
    private invoiceMatchRepo: Repository<InvoiceMatch>,
    @InjectRepository(ProcurementApprovalThreshold)
    private approvalThresholdRepo: Repository<ProcurementApprovalThreshold>,
    @InjectRepository(ProcurementApprovalChain)
    private approvalChainRepo: Repository<ProcurementApprovalChain>,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
    @Inject(forwardRef(() => BudgetService))
    private budgetService: BudgetService,
    private dataSource: DataSource,
  ) {}

  // ============ PURCHASE REQUEST ============

  private async generatePRNumber(facilityId: string, tenantId?: string): Promise<string> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseRequest);

      const where: any = { facilityId, deletedAt: IsNull() };
      if (tenantId) where.tenantId = tenantId;

      const count = await prRepo.count({ where });
      const date = new Date();
      return `PR${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
    });
  }

  async createPurchaseRequest(
    dto: CreatePurchaseRequestDto,
    userId: string,
    tenantId?: string,
  ): Promise<PurchaseRequest> {
    try {
      this.logger.log(`Creating PR for facility ${dto.facilityId} with ${dto.items.length} items`);

      // Validate facility exists
      const facilityRepo = this.dataSource.getRepository('Facility');
      const facilityWhere: any = { id: dto.facilityId };
      if (tenantId) facilityWhere.tenantId = tenantId;
      const facility = await facilityRepo.findOne({ where: facilityWhere });
      if (!facility) {
        throw new BadRequestException('Facility not found or does not belong to this tenant');
      }

      // Validate department exists (if provided)
      if (dto.departmentId) {
        const deptRepo = this.dataSource.getRepository('Department');
        const deptWhere: any = { id: dto.departmentId };
        if (tenantId) deptWhere.tenantId = tenantId;
        const department = await deptRepo.findOne({ where: deptWhere });
        if (!department) {
          throw new BadRequestException('Department not found or does not belong to this tenant');
        }
      }

      // Validate all items have positive quantities and exist
      for (const item of dto.items) {
        if (!item.quantityRequested || item.quantityRequested <= 0) {
          throw new BadRequestException(
            `Item "${item.itemName || item.itemCode}" must have quantity > 0`,
          );
        }
        if (item.unitPriceEstimated !== undefined && item.unitPriceEstimated < 0) {
          throw new BadRequestException(
            `Item "${item.itemName || item.itemCode}" cannot have a negative estimated price`,
          );
        }

        // Validate item exists
        const itemWhere: any = { id: item.itemId };
        if (tenantId) itemWhere.tenantId = tenantId;
        const existingItem = await this.itemRepo.findOne({ where: itemWhere });
        if (!existingItem) {
          throw new BadRequestException(
            `Item "${item.itemName || item.itemCode}" (${item.itemId}) not found or does not belong to this tenant`,
          );
        }
      }

      const requestNumber = await this.generatePRNumber(dto.facilityId, tenantId);

      // Calculate total estimated
      const totalEstimated = dto.items.reduce((sum, item) => {
        return sum + item.quantityRequested * (item.unitPriceEstimated || 0);
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
        ...(tenantId ? { tenantId } : {}),
      });

      const savedPR = await this.prRepo.save(pr);
      this.logger.log(`Created PR ${(savedPR as PurchaseRequest).requestNumber}`);

      // Create items
      const items = dto.items.map((item) =>
        this.prItemRepo.create({
          purchaseRequestId: (savedPR as PurchaseRequest).id,
          itemId: item.itemId,
          itemCode: item.itemCode,
          itemName: item.itemName,
          itemUnit: item.itemUnit || 'unit',
          quantityRequested: item.quantityRequested,
          unitPriceEstimated: item.unitPriceEstimated || 0,
          specifications: item.specifications,
          notes: item.notes,
        }),
      );

      await this.prItemRepo.save(items);

      return this.getPurchaseRequest((savedPR as PurchaseRequest).id, tenantId);
    } catch (error) {
      this.logger.error(`Error creating PR: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getPurchaseRequest(id: string, tenantId?: string): Promise<PurchaseRequest> {
    const where: any = { id, deletedAt: IsNull() };
    if (tenantId) where.tenantId = tenantId;
    const pr = await this.prRepo.findOne({
      where,
      relations: ['items', 'department', 'requestedBy', 'approvedBy', 'facility'],
    });
    if (!pr) throw new NotFoundException('Purchase request not found');
    return pr;
  }

  async getPurchaseRequests(
    facilityId: string,
    options: {
      status?: PRStatus;
      priority?: PRPriority;
      startDate?: string;
      endDate?: string;
    },
    tenantId?: string,
  ) {
    const qb = this.prRepo
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.items', 'items')
      .leftJoinAndSelect('pr.department', 'department')
      .leftJoinAndSelect('pr.requestedBy', 'requestedBy')
      .where('pr.deletedAt IS NULL');

    let hasWhere = true;
    if (facilityId && facilityId.trim() !== '') {
      qb.andWhere('pr.facilityId = :facilityId', { facilityId });
    }

    if (options.status) {
      qb.andWhere('pr.status = :status', { status: options.status });
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

    if (tenantId) {
      qb.andWhere('pr.tenantId = :tenantId', { tenantId });
    }

    return qb.orderBy('pr.createdAt', 'DESC').getMany();
  }

  async submitPurchaseRequest(id: string, tenantId?: string): Promise<PurchaseRequest> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseRequest);

      const where: any = { id, deletedAt: IsNull() };
      if (tenantId) where.tenantId = tenantId;

      const pr = await prRepo.findOne({
        where,
        relations: ['items'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr) throw new NotFoundException('Purchase request not found');
      if (pr.status !== PRStatus.DRAFT) {
        throw new BadRequestException('Only draft PRs can be submitted');
      }
      if (pr.items.length === 0) {
        throw new BadRequestException('PR must have at least one item');
      }

      // Calculate total estimated for approval chain routing
      let totalEstimated = 0;
      for (const item of pr.items) {
        totalEstimated += item.quantityRequested * Number(item.unitPriceEstimated || 0);
      }

      pr.status = PRStatus.PENDING_APPROVAL;
      pr.totalEstimated = totalEstimated;
      const saved = await prRepo.save(pr);

      // Phase 2B: Create approval chain
      try {
        await this.createApprovalChain(pr.id, 'PR', totalEstimated, pr.facilityId, tenantId);
      } catch (error) {
        this.logger.warn(
          `Failed to create approval chain for PR ${pr.id}: ${error.message}`,
        );
        // Don't fail PR submission if approval chain fails
      }

      return saved;
    });
  }

  async approvePurchaseRequest(
    id: string,
    dto: ApprovePRDto,
    userId: string,
    tenantId?: string,
  ): Promise<PurchaseRequest> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseRequest);
      const prItemRepo = manager.getRepository(PurchaseRequestItem);
      const chainRepo = manager.getRepository(ProcurementApprovalChain);

      const where: any = { id, deletedAt: IsNull() };
      if (tenantId) where.tenantId = tenantId;

      const pr = await prRepo.findOne({
        where,
        relations: ['items'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr) throw new NotFoundException('Purchase request not found');
      if (pr.status !== PRStatus.PENDING_APPROVAL) {
        throw new BadRequestException('PR must be pending approval');
      }

      // Segregation of duties: requester cannot approve their own PR
      if (pr.requestedById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the requester cannot approve their own purchase request',
        );
      }

      // Phase 2C: Get next pending approval in chain
      const chainWhere: any = { documentId: id, status: ApprovalChainStatus.PENDING };
      if (tenantId) chainWhere.tenantId = tenantId;

      const nextChain = await chainRepo.findOne({
        where: chainWhere,
        order: { approvalLevel: 'ASC' },
        relations: ['approver'],
      });

      if (!nextChain) {
        throw new BadRequestException(
          'No pending approval required for this PR or approval chain is complete',
        );
      }

      // Verify current user has required role (TODO: implement role checking)
      // For now, log the required role
      this.logger.log(
        `Approving PR at level ${nextChain.approvalLevel} (requires role: ${nextChain.requiredRole})`,
      );

      // Mark approval at this level
      nextChain.status = ApprovalChainStatus.APPROVED;
      nextChain.approvedById = userId;
      nextChain.approvedAt = new Date();
      nextChain.comments = dto.comments;
      await chainRepo.save(nextChain);

      // Update approved quantities if provided
      let totalEstimatedApproved = 0;
      if (dto.approvedItems) {
        for (const approved of dto.approvedItems) {
          const item = pr.items.find((i) => i.itemId === approved.itemId);
          if (item) {
            if (approved.quantityApproved > item.quantityRequested) {
              throw new BadRequestException(
                `Approved quantity (${approved.quantityApproved}) cannot exceed requested quantity (${item.quantityRequested}) for item ${item.itemName}`,
              );
            }
            item.quantityApproved = approved.quantityApproved;
            totalEstimatedApproved += approved.quantityApproved * Number(item.unitPriceEstimated || 0);
          }
        }
      } else {
        // Default: approve all requested quantities
        for (const item of pr.items) {
          item.quantityApproved = item.quantityRequested;
          totalEstimatedApproved += item.quantityRequested * Number(item.unitPriceEstimated || 0);
        }
      }

      // Phase 2A: Validate sufficient budget available
      try {
        await this.budgetService.validateBudgetSufficient(
          pr.facilityId,
          totalEstimatedApproved,
          tenantId,
        );
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        // Log but don't fail if budget service unavailable (e.g., no budget configured)
        this.logger.warn(
          `Budget validation skipped for PR ${id}: ${error.message}`,
        );
      }

      await prItemRepo.save(pr.items);
      pr.totalEstimated = totalEstimatedApproved;

      // Check if approval chain is complete
      const pendingChains = await chainRepo.find({
        where: { documentId: id, status: ApprovalChainStatus.PENDING },
      });

      if (pendingChains.length === 0) {
        // All approvals complete → transition to APPROVED
        pr.status = PRStatus.APPROVED;
        pr.approvedById = userId;
        pr.approvedAt = new Date();
        this.logger.log(`PR ${id} fully approved after ${nextChain.approvalLevel} approval levels`);
      } else {
        // More approvals needed → stay PENDING_APPROVAL
        this.logger.log(
          `PR ${id} approved at level ${nextChain.approvalLevel}, ${pendingChains.length} more approvals needed`,
        );
      }

      return prRepo.save(pr);
    });
  }

  async rejectPurchaseRequest(
    id: string,
    dto: RejectPRDto,
    userId: string,
    tenantId?: string,
  ): Promise<PurchaseRequest> {
    return this.dataSource.transaction(async (manager) => {
      const prRepo = manager.getRepository(PurchaseRequest);
      const chainRepo = manager.getRepository(ProcurementApprovalChain);

      const where: any = { id, deletedAt: IsNull() };
      if (tenantId) where.tenantId = tenantId;

      const pr = await prRepo.findOne({
        where,
        lock: { mode: 'pessimistic_write' },
      });

      if (!pr) throw new NotFoundException('Purchase request not found');
      if (pr.status !== PRStatus.PENDING_APPROVAL) {
        throw new BadRequestException('PR must be pending approval');
      }

      // Phase 2C: Reject approval chain
      const chainWhere: any = { documentId: id };
      if (tenantId) chainWhere.tenantId = tenantId;

      const chains = await chainRepo.find({ where: chainWhere });
      for (const chain of chains) {
        if (chain.status === ApprovalChainStatus.PENDING) {
          chain.status = ApprovalChainStatus.REJECTED;
          chain.approvedById = userId;
          chain.approvedAt = new Date();
          chain.comments = dto.rejectionReason;
        }
      }
      await chainRepo.save(chains);

      pr.status = PRStatus.REJECTED;
      pr.approvedById = userId;
      pr.approvedAt = new Date();
      pr.rejectionReason = dto.rejectionReason;
      
      this.logger.log(`PR ${id} rejected by user ${userId}`);
      return prRepo.save(pr);
    });
  }

  // ============ PURCHASE ORDER ============

  private async generatePONumber(facilityId: string, tenantId?: string): Promise<string> {
    const count = await this.poRepo.count({
      where: { facilityId, ...(tenantId ? { tenantId } : {}) },
    });
    const date = new Date();
    return `PO${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createPurchaseOrder(
    dto: CreatePurchaseOrderDto,
    userId: string,
    tenantId?: string,
  ): Promise<PurchaseOrder> {
    // Validate facility exists
    const facilityRepo = this.dataSource.getRepository('Facility');
    const facilityWhere: any = { id: dto.facilityId };
    if (tenantId) facilityWhere.tenantId = tenantId;
    const facility = await facilityRepo.findOne({ where: facilityWhere });
    if (!facility) {
      throw new BadRequestException('Facility not found or does not belong to this tenant');
    }

    // Validate department exists (if provided for direct PO)
    if (dto.departmentId) {
      const deptRepo = this.dataSource.getRepository('Department');
      const deptWhere: any = { id: dto.departmentId };
      if (tenantId) deptWhere.tenantId = tenantId;
      const department = await deptRepo.findOne({ where: deptWhere });
      if (!department) {
        throw new BadRequestException('Department not found or does not belong to this tenant');
      }
    }

    // Verify supplier is active before creating PO
    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (supplier.status !== SupplierStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot create PO for ${supplier.status} supplier. Only active suppliers are allowed.`,
      );
    }

    const orderNumber = await this.generatePONumber(dto.facilityId, tenantId);

    // Calculate totals
    let subtotal = 0;
    let taxAmount = 0;
    let discountAmount = 0;

    const itemsWithTotals = dto.items.map((item) => {
      const lineGross = item.quantityOrdered * item.unitPrice;
      const lineDiscount = (lineGross * (item.discountPercent || 0)) / 100;
      const lineNet = lineGross - lineDiscount;
      const lineTax = (lineNet * (item.taxRate || 0)) / 100;
      const lineTotal = lineNet + lineTax;

      subtotal += lineNet;
      taxAmount += lineTax;
      discountAmount += lineDiscount;

      return { ...item, lineTotal };
    });

    const po = this.poRepo.create({
      orderNumber,
      facilityId: dto.facilityId,
      departmentId: dto.departmentId,
      costCenterId: dto.costCenterId,
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
      emergencyJustification: dto.emergencyJustification,
      status: POStatus.DRAFT,
      createdById: userId,
      createdFrom: 'manual',
      ...(tenantId ? { tenantId } : {}),
    });

    const savedPO = await this.poRepo.save(po);

    // Create items
    const items = itemsWithTotals.map((item) =>
      this.poItemRepo.create({
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
      }),
    );

    await this.poItemRepo.save(items);

    return this.getPurchaseOrder((savedPO as PurchaseOrder).id);
  }

  async createPOFromPR(
    dto: CreatePOFromPRDto,
    userId: string,
    tenantId?: string,
  ): Promise<PurchaseOrder> {
    const pr = await this.getPurchaseRequest(dto.purchaseRequestId, tenantId);
    if (pr.status !== PRStatus.APPROVED) {
      throw new BadRequestException('PR must be approved to create PO');
    }

    const supplier = await this.supplierRepo.findOne({
      where: { id: dto.supplierId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    if (supplier.status !== SupplierStatus.ACTIVE) {
      throw new BadRequestException(
        `Cannot create PO for ${supplier.status} supplier. Only active suppliers are allowed.`,
      );
    }

    // Map prices
    const priceMap = new Map(dto.itemPrices?.map((p) => [p.itemId, p.unitPrice]) || []);

    const poDto: CreatePurchaseOrderDto = {
      facilityId: pr.facilityId,
      supplierId: dto.supplierId,
      purchaseRequestId: pr.id,
      expectedDelivery: dto.expectedDelivery,
      paymentTerms: dto.paymentTerms || supplier.paymentTerms,
      items: pr.items
        .filter(
          (item) =>
            (item.quantityApproved || item.quantityRequested) >= item.quantityOrdered &&
            (item.quantityApproved || item.quantityRequested) - item.quantityOrdered > 0,
        )
        .map((item) => ({
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

    const po = await this.createPurchaseOrder(poDto, userId, tenantId);

    // Update PR items with ordered quantities
    for (const poItem of po.items) {
      const prItem = pr.items.find((i) => i.itemId === poItem.itemId);
      if (prItem) {
        prItem.quantityOrdered += poItem.quantityOrdered;
        await this.prItemRepo.save(prItem);
      }
    }

    // Update PR status
    const allOrdered = pr.items.every(
      (i) => i.quantityOrdered >= (i.quantityApproved || i.quantityRequested),
    );
    pr.status = allOrdered ? PRStatus.FULLY_ORDERED : PRStatus.PARTIALLY_ORDERED;
    await this.prRepo.save(pr);

    return po;
  }

  async getPurchaseOrder(id: string, tenantId?: string): Promise<PurchaseOrder> {
    const where: any = { id, deletedAt: IsNull() };
    if (tenantId) where.tenantId = tenantId;
    const po = await this.poRepo.findOne({
      where,
      relations: ['items', 'supplier', 'purchaseRequest', 'createdBy', 'approvedBy', 'facility'],
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async getPurchaseOrders(
    facilityId: string,
    options: {
      status?: POStatus;
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    },
    tenantId?: string,
  ) {
    const qb = this.poRepo
      .createQueryBuilder('po')
      .leftJoinAndSelect('po.items', 'items')
      .leftJoinAndSelect('po.supplier', 'supplier')
      .leftJoinAndSelect('po.createdBy', 'createdBy')
      .leftJoinAndSelect('po.approvedBy', 'approvedBy')
      .where('po.deletedAt IS NULL');

    if (facilityId && facilityId.trim() !== '') {
      qb.andWhere('po.facilityId = :facilityId', { facilityId });
    }

    if (options.status) {
      qb.andWhere('po.status = :status', { status: options.status });
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

    if (tenantId) {
      qb.andWhere('po.tenantId = :tenantId', { tenantId });
    }

    return qb.orderBy('po.createdAt', 'DESC').getMany();
  }

  async createPOFromQuotation(
    dto: CreatePOFromQuotationDto,
    userId: string,
    tenantId?: string,
  ): Promise<PurchaseOrder> {
    const quotation = await this.quotationRepo.findOne({
      where: { id: dto.quotationId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items', 'supplier', 'rfq'],
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    if (quotation.status !== QuotationStatus.SELECTED) {
      throw new BadRequestException('Only selected (approved) quotations can be converted to POs');
    }

    // Enforce quotation validity period (PPDA compliance)
    if (quotation.validUntil) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const validUntil = new Date(quotation.validUntil);
      validUntil.setHours(0, 0, 0, 0);
      if (validUntil < today) {
        throw new BadRequestException(
          `Quotation ${quotation.quotationNumber} expired on ${quotation.validUntil}. Request a new quotation from the supplier.`,
        );
      }
    }

    const supplier = quotation.supplier;
    if (!supplier) throw new NotFoundException('Supplier not found on quotation');
    if (supplier.status !== SupplierStatus.ACTIVE) {
      throw new BadRequestException(`Cannot create PO for ${supplier.status} supplier`);
    }

    const rfq = quotation.rfq;
    if (!rfq) throw new NotFoundException('RFQ not found on quotation');

    // Crit 3: Validate RFQ is CLOSED before allowing PO creation (PPDA procurement compliance)
    if (rfq.status !== RFQStatus.CLOSED) {
      throw new BadRequestException(
        `RFQ ${rfq.rfqNumber} is in ${rfq.status} status. RFQ must be CLOSED before creating PO (ensures bidding period has concluded).`,
      );
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(rfq.deadline);
    deadline.setHours(0, 0, 0, 0);
    if (today > deadline) {
      throw new BadRequestException(
        `RFQ ${rfq.rfqNumber} deadline expired on ${rfq.deadline.toISOString().slice(0, 10)}. Cannot create PO after RFQ deadline.`,
      );
    }

    // Load RFQ items to get item details (codes, names, units)
    const rfqItems = await this.dataSource.getRepository(RFQItem).find({
      where: { rfqId: rfq.id },
    });
    const rfqItemMap = new Map(rfqItems.map((ri) => [ri.id, ri]));

    const poDto: CreatePurchaseOrderDto = {
      facilityId: rfq.facilityId,
      supplierId: quotation.supplierId,
      expectedDelivery: dto.expectedDelivery,
      paymentTerms: dto.paymentTerms || quotation.paymentTerms || supplier.paymentTerms,
      deliveryAddress: dto.deliveryAddress,
      notes:
        dto.notes || `Created from RFQ ${rfq.rfqNumber}, Quotation ${quotation.quotationNumber}`,
      items: quotation.items.map((qi) => {
        const rfqItem = rfqItemMap.get(qi.rfqItemId);
        return {
          itemId: rfqItem?.itemCode || qi.rfqItemId,
          itemCode: rfqItem?.itemCode || '',
          itemName: rfqItem?.itemName || '',
          itemUnit: rfqItem?.unit || 'unit',
          quantityOrdered: rfqItem?.quantity || 0,
          unitPrice: Number(qi.unitPrice),
          notes: qi.notes,
        };
      }),
    };

    if (poDto.items.length === 0) {
      throw new BadRequestException('No items found in quotation');
    }

    // Resolve item IDs from item codes
    for (const item of poDto.items) {
      if (!item.itemId || item.itemId === item.itemCode) {
        const dbItem = await this.itemRepo.findOne({
          where: { code: item.itemCode, ...(tenantId ? { tenantId } : {}) },
        });
        if (dbItem) item.itemId = dbItem.id;
      }
    }

    const po = await this.createPurchaseOrder(poDto, userId, tenantId);

    // Link PO to RFQ and quotation
    await this.poRepo.update(po.id, {
      rfqId: rfq.id,
      quotationId: quotation.id,
      createdFrom: 'quotation',
    });

    return this.getPurchaseOrder(po.id, tenantId);
  }

  async approvePurchaseOrder(
    id: string,
    userId: string,
    tenantId?: string,
    userRoles?: string[],
  ): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id, tenantId);
    if (po.status !== POStatus.DRAFT && po.status !== POStatus.PENDING_APPROVAL) {
      throw new BadRequestException('PO cannot be approved from current status');
    }

    // Segregation of duties: PO creator cannot approve their own PO
    // Super Admin bypasses this check (logged for audit)
    const isSuperAdminUser = userRoles?.some((r) => r.toLowerCase() === 'super admin');
    if (po.createdById === userId && !isSuperAdminUser) {
      const otherApprovers = await this.dataSource
        .createQueryBuilder()
        .select('u.id')
        .from('users', 'u')
        .innerJoin('user_roles', 'ur', 'ur.user_id = u.id')
        .innerJoin('role_permissions', 'rp', 'rp.role_id = ur.role_id')
        .innerJoin('permissions', 'perm', 'perm.id = rp.permission_id')
        .where('u.id != :userId', { userId })
        .andWhere('u.status = :status', { status: 'active' })
        .andWhere('perm.code LIKE :permCode', { permCode: '%procurement%approve%' })
        .andWhere(po.facilityId ? 'u.facility_id = :facilityId' : '1=1', {
          facilityId: po.facilityId,
        })
        .getCount();

      if (otherApprovers > 0) {
        throw new BadRequestException(
          'Segregation of duties: the PO creator cannot approve their own purchase order. Another approver is available.',
        );
      }
      this.logger.warn(
        `Self-approval: user ${userId} approving own PO ${po.orderNumber} — no other approvers available`,
      );
    }

    if (po.createdById === userId && isSuperAdminUser) {
      this.logger.warn(
        `Super Admin self-approval: user ${userId} approving own PO ${po.orderNumber}`,
      );
    }

    // Spending threshold enforcement for high-value POs
    const totalAmount = Number(po.totalAmount) || 0;
    if (totalAmount > 50000000) {
      this.logger.warn(
        `HIGH-VALUE PO ${po.orderNumber}: ${totalAmount.toLocaleString()} UGX requires director-level approval. Approved by ${userId}`,
      );
      if (!po.notes?.includes('[DIRECTOR_APPROVED]')) {
        po.status = POStatus.PENDING_APPROVAL;
        po.notes =
          `${po.notes || ''}\n[HIGH_VALUE] Amount ${totalAmount.toLocaleString()} UGX exceeds 50M threshold. Director approval required.`.trim();
        return this.poRepo.save(po);
      }
    }

    po.status = POStatus.APPROVED;
    po.approvedById = userId;
    po.approvedAt = new Date();
    return this.poRepo.save(po);
  }

  async sendPurchaseOrder(id: string, tenantId?: string): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id, tenantId);
    if (po.status !== POStatus.APPROVED) {
      throw new BadRequestException('PO must be approved before sending');
    }
    po.status = POStatus.SENT;
    po.sentAt = new Date();
    return this.poRepo.save(po);
  }

  async cancelPurchaseOrder(id: string, tenantId?: string): Promise<PurchaseOrder> {
    const po = await this.getPurchaseOrder(id, tenantId);
    if ([POStatus.FULLY_RECEIVED, POStatus.CLOSED].includes(po.status)) {
      throw new BadRequestException('Cannot cancel a received or closed PO');
    }
    po.status = POStatus.CANCELLED;
    return this.poRepo.save(po);
  }

  // ============ GOODS RECEIPT NOTE ============

  private async generateGRNNumber(facilityId: string, tenantId?: string): Promise<string> {
    const count = await this.grnRepo.count({
      where: { facilityId, ...(tenantId ? { tenantId } : {}) },
    });
    const date = new Date();
    return `GRN${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async createGoodsReceipt(
    dto: CreateGoodsReceiptDto,
    userId: string,
    tenantId?: string,
  ): Promise<GoodsReceiptNote> {
    // Validate PO status — prevent receiving on fully received/closed/cancelled POs
    if (dto.purchaseOrderId) {
      const po = await this.poRepo.findOne({
        where: { id: dto.purchaseOrderId, ...(tenantId ? { tenantId } : {}) },
      });
      if (!po) throw new NotFoundException('Purchase Order not found');
      if ([POStatus.FULLY_RECEIVED, POStatus.CLOSED, POStatus.CANCELLED].includes(po.status)) {
        throw new BadRequestException(
          `Cannot receive delivery for PO ${po.orderNumber} — status is ${po.status.replace('_', ' ')}. Each delivery should be received only once per PO.`,
        );
      }
      if (![POStatus.SENT, POStatus.PARTIALLY_RECEIVED].includes(po.status)) {
        throw new BadRequestException(
          `PO ${po.orderNumber} is not ready for delivery (status: ${po.status}). PO must be sent to the supplier first.`,
        );
      }

      // Crit 1: Validate GRN item quantities don't exceed PO allowance
      const poItems = await this.poItemRepo.find({ where: { purchaseOrderId: po.id } });
      for (const grnItem of dto.items) {
        const poItem = poItems.find((pi) => pi.itemId === grnItem.itemId);
        if (!poItem) {
          throw new BadRequestException(
            `Item ${grnItem.itemName || grnItem.itemId} is not on PO ${po.orderNumber}.`,
          );
        }
        const alreadyReceived = poItem.quantityReceived || 0;
        const maxAllowed = poItem.quantityOrdered - alreadyReceived;
        if (grnItem.quantityReceived > maxAllowed) {
          throw new BadRequestException(
            `Cannot receive ${grnItem.quantityReceived} units of "${grnItem.itemName}". PO line allows max ${maxAllowed} more units (ordered: ${poItem.quantityOrdered}, already received: ${alreadyReceived}).`,
          );
        }
      }
    }

    const grnNumber = await this.generateGRNNumber(dto.facilityId, tenantId);

    // Calculate totals
    let totalQuantityReceived = 0;
    let totalValue = 0;

    const itemsWithTotals = dto.items.map((item) => {
      const lineTotal = item.quantityReceived * item.unitCost;
      totalQuantityReceived += item.quantityReceived;
      totalValue += lineTotal;
      return { ...item, lineTotal };
    });

    // Validate no items have past expiry dates
    for (const item of itemsWithTotals) {
      if (item.expiryDate && new Date(item.expiryDate) < new Date()) {
        throw new BadRequestException(
          `Cannot receive item ${item.itemName || item.itemCode || item.itemId} with past expiry date: ${item.expiryDate}. Reject expired goods at receiving dock.`,
        );
      }
    }

    const grn = this.grnRepo.create({
      grnNumber,
      facilityId: dto.facilityId,
      storeId: dto.storeId,
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
      ...(tenantId ? { tenantId } : {}),
    });

    const savedGRN = await this.grnRepo.save(grn);

    // Create items
    const items = itemsWithTotals.map((item) =>
      this.grnItemRepo.create({
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
      }),
    );

    await this.grnItemRepo.save(items);

    return this.getGoodsReceipt((savedGRN as GoodsReceiptNote).id);
  }

  async createGRNFromPO(
    purchaseOrderId: string,
    receivedItems: {
      itemId: string;
      quantityReceived: number;
      batchNumber?: string;
      expiryDate?: string;
    }[],
    userId: string,
    tenantId?: string,
    storeId?: string,
  ): Promise<GoodsReceiptNote> {
    const po = await this.getPurchaseOrder(purchaseOrderId, tenantId);
    if (![POStatus.SENT, POStatus.PARTIALLY_RECEIVED].includes(po.status)) {
      throw new BadRequestException('PO must be sent or partially received to create GRN');
    }

    const receivedMap = new Map(receivedItems.map((r) => [r.itemId, r]));

    const grnDto: CreateGoodsReceiptDto = {
      facilityId: po.facilityId,
      storeId,
      supplierId: po.supplierId,
      purchaseOrderId: po.id,
      items: po.items
        .filter((item) => receivedMap.has(item.itemId))
        .map((item) => {
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

    return this.createGoodsReceipt(grnDto, userId, tenantId);
  }

  async getGoodsReceipt(id: string, tenantId?: string): Promise<GoodsReceiptNote> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const grn = await this.grnRepo.findOne({
      where,
      relations: [
        'items',
        'supplier',
        'purchaseOrder',
        'receivedBy',
        'inspectedBy',
        'postedBy',
        'facility',
      ],
    });
    if (!grn) throw new NotFoundException('Goods receipt not found');
    return grn;
  }

  async getGoodsReceipts(
    facilityId: string,
    options: {
      status?: GRNStatus;
      supplierId?: string;
      startDate?: string;
      endDate?: string;
    },
    tenantId?: string,
  ) {
    const qb = this.grnRepo
      .createQueryBuilder('grn')
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

    if (tenantId) {
      qb.andWhere('grn.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('grn.receivedAt', 'DESC').getMany();
  }

  async inspectGoodsReceipt(
    id: string,
    dto: InspectGRNDto,
    userId: string,
    tenantId?: string,
  ): Promise<GoodsReceiptNote> {
    const grn = await this.getGoodsReceipt(id, tenantId);
    if (grn.status !== GRNStatus.DRAFT && grn.status !== GRNStatus.PENDING_INSPECTION) {
      throw new BadRequestException('GRN is not available for inspection');
    }

    // Update items with inspection results
    for (const inspected of dto.inspectedItems) {
      const item = grn.items.find((i) => i.itemId === inspected.itemId);
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

  async approveGoodsReceipt(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<GoodsReceiptNote> {
    const grn = await this.getGoodsReceipt(id, tenantId);

    // Mandatory inspection before approval
    if (grn.status !== GRNStatus.INSPECTED) {
      throw new BadRequestException(
        'GRN must be inspected before approval. Current status: ' + grn.status,
      );
    }

    grn.status = GRNStatus.APPROVED;
    return this.grnRepo.save(grn);
  }

  async postGoodsReceipt(id: string, userId: string, tenantId?: string): Promise<GoodsReceiptNote> {
    return this.dataSource.transaction(async (manager) => {
      const grnRepo = manager.getRepository(GoodsReceiptNote);
      const grnItemRepo = manager.getRepository(GoodsReceiptItem);
      const stockLedgerRepo = manager.getRepository(StockLedger);
      const stockBalanceRepo = manager.getRepository(StockBalance);
      const itemRepo = manager.getRepository(Item);
      const poRepo = manager.getRepository(PurchaseOrder);
      const poItemRepo = manager.getRepository(PurchaseOrderItem);

      // Lock the GRN row to prevent double-posting (no relations — FOR UPDATE can't use outer joins)
      const grn = await grnRepo.findOne({
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!grn) throw new NotFoundException('GRN not found');
      if (grn.status !== GRNStatus.APPROVED) {
        throw new BadRequestException('GRN must be approved before posting');
      }

      // Load items separately (not under pessimistic lock)
      grn.items = await grnItemRepo.find({ where: { goodsReceiptNoteId: grn.id } });

      // Update stock ledger for each item
      for (const item of grn.items) {
        const quantityToPost = item.quantityAccepted ?? item.quantityReceived;
        if (quantityToPost <= 0) continue;

        // Pessimistic lock on stock balance to prevent concurrent updates.
        // Per-store balance when GRN routes to a specific store, otherwise facility-level (storeId IS NULL).
        let stockBalance = await stockBalanceRepo.findOne({
          where: {
            itemId: item.itemId,
            facilityId: grn.facilityId,
            storeId: grn.storeId ?? IsNull(),
            ...(tenantId ? { tenantId } : {}),
          },
          lock: { mode: 'pessimistic_write' },
        });

        const newBalance = (stockBalance?.totalQuantity || 0) + quantityToPost;

        // Create ledger entry
        const ledgerEntry = stockLedgerRepo.create({
          itemId: item.itemId,
          facilityId: grn.facilityId,
          storeId: grn.storeId,
          batchNumber: item.batchNumber,
          expiryDate: item.expiryDate,
          quantity: quantityToPost,
          balanceAfter: newBalance,
          movementType: MovementType.PURCHASE,
          unitCost: item.unitCost,
          referenceType: 'goods_receipt_note',
          referenceId: grn.id,
          notes: `GRN: ${grn.grnNumber}${grn.storeId ? ' (store-routed)' : ''}`,
          createdById: userId,
          ...(tenantId ? { tenantId } : {}),
        });
        await stockLedgerRepo.save(ledgerEntry);

        // Update or create stock balance
        if (stockBalance) {
          stockBalance.totalQuantity = newBalance;
          stockBalance.availableQuantity = newBalance - stockBalance.reservedQuantity;
          stockBalance.lastMovementAt = new Date();
          await stockBalanceRepo.save(stockBalance);
        } else {
          stockBalance = stockBalanceRepo.create({
            itemId: item.itemId,
            facilityId: grn.facilityId,
            storeId: grn.storeId,
            totalQuantity: quantityToPost,
            reservedQuantity: 0,
            availableQuantity: quantityToPost,
            lastMovementAt: new Date(),
            ...(tenantId ? { tenantId } : {}),
          });
          await stockBalanceRepo.save(stockBalance);
        }

        // Update item's unit cost and pricing from GRN
        const itemUpdate: Partial<Item> = { unitCost: item.unitCost };
        if (item.sellingPrice) {
          itemUpdate.sellingPrice = item.sellingPrice;
        }
        if (item.markupPercentage) {
          itemUpdate.markupPercentage = item.markupPercentage;
        }

        // Auto-calculate retail/wholesale prices from category markup defaults when not explicitly set
        let retailPrice = item.retailPrice ? Number(item.retailPrice) : null;
        let wholesalePrice = item.wholesalePrice ? Number(item.wholesalePrice) : null;
        const unitCost = Number(item.unitCost);

        if ((!retailPrice || !wholesalePrice) && unitCost > 0) {
          const existingItem = await itemRepo.findOne({
            where: { id: item.itemId },
            select: ['id', 'categoryId'],
          });
          if (existingItem?.categoryId) {
            const categoryRepo = manager.getRepository(ItemCategory);
            const category = await categoryRepo.findOne({
              where: { id: existingItem.categoryId },
              select: ['id', 'defaultRetailMarkup', 'defaultWholesaleMarkup'],
            });
            if (category) {
              if (!retailPrice && category.defaultRetailMarkup) {
                retailPrice =
                  Math.round(unitCost * (1 + Number(category.defaultRetailMarkup) / 100) * 100) /
                  100;
              }
              if (!wholesalePrice && category.defaultWholesaleMarkup) {
                wholesalePrice =
                  Math.round(unitCost * (1 + Number(category.defaultWholesaleMarkup) / 100) * 100) /
                  100;
              }
            }
          }
        }

        if (retailPrice) {
          itemUpdate.retailPrice = retailPrice;
          // Also update legacy sellingPrice to match retail price
          if (!item.sellingPrice) {
            itemUpdate.sellingPrice = retailPrice;
          }
        }
        if (wholesalePrice) {
          itemUpdate.wholesalePrice = wholesalePrice;
        }

        await itemRepo.update(item.itemId, itemUpdate);
      }

      // Update PO received quantities if linked
      if (grn.purchaseOrderId) {
        const po = await poRepo.findOne({
          where: { id: grn.purchaseOrderId, ...(tenantId ? { tenantId } : {}) },
          relations: ['items'],
        });
        if (po) {
          for (const grnItem of grn.items) {
            if (grnItem.purchaseOrderItemId) {
              const poItem = po.items.find((i) => i.id === grnItem.purchaseOrderItemId);
              if (poItem) {
                poItem.quantityReceived += grnItem.quantityAccepted ?? grnItem.quantityReceived;
                await poItemRepo.save(poItem);
              }
            }
          }

          // Update PO status
          const allReceived = po.items.every((i) => i.quantityReceived >= i.quantityOrdered);
          po.status = allReceived ? POStatus.FULLY_RECEIVED : POStatus.PARTIALLY_RECEIVED;
          await poRepo.save(po);
        }
      }

      grn.status = GRNStatus.POSTED;
      grn.postedById = userId;
      grn.postedAt = new Date();

      const saved = await grnRepo.save(grn);

      // Auto-post journal entry: Inventory DR, AP CR (outside transaction is fine — non-critical)
      this.financeService
        .autoPostGRNJournal(
          {
            facilityId: grn.facilityId,
            grnNumber: grn.grnNumber,
            totalValue: Number(grn.totalValue) || 0,
            supplierId: grn.supplierId,
            userId,
          },
          tenantId,
        )
        .catch((err) =>
          this.logger.warn(`GL auto-post failed for GRN ${grn.grnNumber}: ${err.message}`),
        );

      // Try auto-completing the originating PR (best effort)
      if (grn.purchaseOrderId) {
        const po = await poRepo.findOne({
          where: { id: grn.purchaseOrderId, ...(tenantId ? { tenantId } : {}) },
          select: ['id', 'purchaseRequestId'],
        });
        if (po?.purchaseRequestId) {
          this.tryAutoCompletePR(po.purchaseRequestId, tenantId).catch((err) =>
            this.logger.warn(`Auto-complete PR failed: ${err.message}`),
          );
        }
      }

      return saved;
    });
  }

  /**
   * Closes a PR (status COMPLETED) when:
   *  - PR is FULLY_ORDERED
   *  - All linked POs are FULLY_RECEIVED or CANCELLED
   * Called best-effort after GRN post and after invoice payment.
   */
  async tryAutoCompletePR(prId: string, tenantId?: string): Promise<boolean> {
    const where: any = { id: prId };
    if (tenantId) where.tenantId = tenantId;
    const pr = await this.prRepo.findOne({ where });
    if (!pr) return false;
    if (pr.status !== PRStatus.FULLY_ORDERED) return false;

    const poWhere: any = { purchaseRequestId: prId };
    if (tenantId) poWhere.tenantId = tenantId;
    const pos = await this.poRepo.find({ where: poWhere, select: ['id', 'status'] });
    if (pos.length === 0) return false;

    const allClosed = pos.every(
      (p) => p.status === POStatus.FULLY_RECEIVED || p.status === POStatus.CANCELLED,
    );
    if (!allClosed) return false;

    pr.status = PRStatus.COMPLETED;
    await this.prRepo.save(pr);
    this.logger.log(`PR ${pr.requestNumber} auto-completed`);
    return true;
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string, tenantId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const prWhere: any = { facilityId, deletedAt: IsNull() };
    if (tenantId) prWhere.tenantId = tenantId;
    const poWhere: any = { facilityId, deletedAt: IsNull() };
    if (tenantId) poWhere.tenantId = tenantId;
    const grnWhere: any = { facilityId, deletedAt: IsNull() };
    if (tenantId) grnWhere.tenantId = tenantId;

    const [pendingPRs, approvedPRs, pendingPOs, sentPOs, pendingGRNs, totalValueToday] =
      await Promise.all([
        this.prRepo.count({ where: { ...prWhere, status: PRStatus.PENDING_APPROVAL } }),
        this.prRepo.count({ where: { ...prWhere, status: PRStatus.APPROVED } }),
        this.poRepo.count({
          where: { ...poWhere, status: In([POStatus.DRAFT, POStatus.PENDING_APPROVAL]) },
        }),
        this.poRepo.count({ where: { ...poWhere, status: POStatus.SENT } }),
        this.grnRepo.count({
          where: {
            ...grnWhere,
            status: In([
              GRNStatus.DRAFT,
              GRNStatus.PENDING_INSPECTION,
              GRNStatus.INSPECTED,
              GRNStatus.APPROVED,
            ]),
          },
        }),
        (() => {
          const qb = this.grnRepo
            .createQueryBuilder('grn')
            .select('SUM(grn.totalValue)', 'total')
            .where('grn.facilityId = :facilityId', { facilityId })
            .andWhere('grn.deletedAt IS NULL')
            .andWhere('grn.status = :status', { status: GRNStatus.POSTED })
            .andWhere('grn.postedAt BETWEEN :today AND :tomorrow', { today, tomorrow });
          if (tenantId) {
            qb.andWhere('grn.tenantId = :tenantId', { tenantId });
          }
          return qb.getRawOne();
        })(),
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

  // ============ PROCUREMENT TRACE ============
  /**
   * Build the full PR -> PO -> GRN -> Invoice chain starting from any document.
   * type: 'pr' | 'po' | 'grn' | 'invoice'
   */
  async traceProcurement(
    type: 'pr' | 'po' | 'grn' | 'invoice',
    id: string,
    tenantId?: string,
  ): Promise<{
    pr: any;
    pos: any[];
    grns: any[];
    invoices: any[];
  }> {
    const tFilter = tenantId ? { tenantId } : {};

    let prId: string | undefined;
    let poIds: string[] = [];
    let grnIds: string[] = [];

    if (type === 'pr') {
      prId = id;
      const pos = await this.poRepo.find({ where: { purchaseRequestId: prId, ...tFilter }, select: ['id'] });
      poIds = pos.map((p) => p.id);
    } else if (type === 'po') {
      poIds = [id];
      const po = await this.poRepo.findOne({ where: { id, ...tFilter }, select: ['id', 'purchaseRequestId'] });
      if (!po) throw new NotFoundException('Purchase order not found');
      prId = po.purchaseRequestId || undefined;
    } else if (type === 'grn') {
      grnIds = [id];
      const grn = await this.grnRepo.findOne({ where: { id, ...tFilter }, select: ['id', 'purchaseOrderId'] });
      if (!grn) throw new NotFoundException('GRN not found');
      if (grn.purchaseOrderId) {
        poIds = [grn.purchaseOrderId];
        const po = await this.poRepo.findOne({ where: { id: grn.purchaseOrderId, ...tFilter }, select: ['id', 'purchaseRequestId'] });
        prId = po?.purchaseRequestId || undefined;
      }
    } else if (type === 'invoice') {
      const inv = await this.invoiceMatchRepo.findOne({ where: { id, ...tFilter }, select: ['id', 'purchaseOrderId', 'grnId'] });
      if (!inv) throw new NotFoundException('Invoice match not found');
      if (inv.purchaseOrderId) {
        poIds = [inv.purchaseOrderId];
        const po = await this.poRepo.findOne({ where: { id: inv.purchaseOrderId, ...tFilter }, select: ['id', 'purchaseRequestId'] });
        prId = po?.purchaseRequestId || undefined;
      }
      if (inv.grnId) grnIds = [inv.grnId];
    }

    // Discover all GRNs from PO chain
    if (poIds.length && !grnIds.length) {
      const grns = await this.grnRepo.find({ where: { purchaseOrderId: In(poIds), ...tFilter }, select: ['id'] });
      grnIds = grns.map((g) => g.id);
    } else if (poIds.length && grnIds.length) {
      const more = await this.grnRepo.find({ where: { purchaseOrderId: In(poIds), ...tFilter }, select: ['id'] });
      grnIds = Array.from(new Set([...grnIds, ...more.map((g) => g.id)]));
    }

    const [pr, pos, grns, invoices] = await Promise.all([
      prId
        ? this.prRepo.findOne({
            where: { id: prId, ...tFilter },
            relations: ['items', 'requestedBy', 'department', 'facility', 'approvedBy'],
          })
        : Promise.resolve(null),
      poIds.length
        ? this.poRepo.find({
            where: { id: In(poIds), ...tFilter },
            relations: ['items', 'supplier', 'createdBy', 'approvedBy', 'facility'],
            order: { createdAt: 'ASC' },
          })
        : Promise.resolve([]),
      grnIds.length
        ? this.grnRepo.find({
            where: { id: In(grnIds), ...tFilter },
            relations: ['items', 'supplier', 'receivedBy', 'inspectedBy', 'postedBy', 'facility'],
            order: { receivedAt: 'ASC' },
          })
        : Promise.resolve([]),
      poIds.length
        ? this.invoiceMatchRepo.find({
            where: { purchaseOrderId: In(poIds), ...tFilter },
            order: { createdAt: 'ASC' },
          })
        : Promise.resolve([]),
    ]);

    return { pr, pos, grns, invoices };
  }

  /** Search document numbers across PR/PO/GRN/Invoice for the trace UI. */
  async searchTraceDocuments(
    q: string,
    tenantId?: string,
  ): Promise<Array<{ type: 'pr' | 'po' | 'grn' | 'invoice'; id: string; number: string; status: string; createdAt: Date }>> {
    const term = `%${q.toLowerCase()}%`;
    const tFilter = tenantId ? { tenantId } : {};

    const [prs, pos, grns, invoices] = await Promise.all([
      this.prRepo
        .createQueryBuilder('pr')
        .where('LOWER(pr.requestNumber) LIKE :term', { term })
        .andWhere(tenantId ? 'pr.tenantId = :tenantId' : '1=1', { tenantId })
        .select(['pr.id', 'pr.requestNumber', 'pr.status', 'pr.createdAt'])
        .limit(10)
        .getMany(),
      this.poRepo
        .createQueryBuilder('po')
        .where('LOWER(po.orderNumber) LIKE :term', { term })
        .andWhere(tenantId ? 'po.tenantId = :tenantId' : '1=1', { tenantId })
        .select(['po.id', 'po.orderNumber', 'po.status', 'po.createdAt'])
        .limit(10)
        .getMany(),
      this.grnRepo
        .createQueryBuilder('grn')
        .where('LOWER(grn.grnNumber) LIKE :term', { term })
        .andWhere(tenantId ? 'grn.tenantId = :tenantId' : '1=1', { tenantId })
        .select(['grn.id', 'grn.grnNumber', 'grn.status', 'grn.createdAt'])
        .limit(10)
        .getMany(),
      this.invoiceMatchRepo
        .createQueryBuilder('inv')
        .where('LOWER(inv.invoiceNumber) LIKE :term', { term })
        .andWhere(tenantId ? 'inv.tenantId = :tenantId' : '1=1', { tenantId })
        .select(['inv.id', 'inv.invoiceNumber', 'inv.status', 'inv.createdAt'])
        .limit(10)
        .getMany(),
    ]);

    return [
      ...prs.map((p) => ({ type: 'pr' as const, id: p.id, number: p.requestNumber, status: p.status, createdAt: p.createdAt })),
      ...pos.map((p) => ({ type: 'po' as const, id: p.id, number: p.orderNumber, status: p.status, createdAt: p.createdAt })),
      ...grns.map((g) => ({ type: 'grn' as const, id: g.id, number: g.grnNumber, status: g.status, createdAt: g.createdAt })),
      ...invoices.map((i: any) => ({ type: 'invoice' as const, id: i.id, number: i.invoiceNumber, status: i.status, createdAt: i.createdAt })),
    ].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  // ============ AUTO-DRAFT PR FROM REORDER LEVELS ============

  /**
   * Find items at/below reorder level across all facilities/tenants and create
   * a single DRAFT PR per (tenant, facility, supplier-cluster). Idempotent per
   * day: skips items already present in any open (non-cancelled, non-completed)
   * PR created in the past 7 days for the same facility.
   *
   * Suggested target = max(maxStockLevel - currentStock, reorderLevel * 2 - currentStock).
   */
  async runAutoReorderDraftPRs(opts?: { tenantId?: string; facilityId?: string; userId?: string; dryRun?: boolean }): Promise<{
    facilitiesProcessed: number;
    prsCreated: number;
    itemsSkipped: number;
    drafts: Array<{ facilityId: string; tenantId?: string; itemCount: number; prNumber?: string; prId?: string; items: Array<{ itemId: string; itemName: string; available: number; reorderLevel: number; suggestedQty: number }> }>;
  }> {
    const dryRun = !!opts?.dryRun;
    const drafts: any[] = [];
    let prsCreated = 0;
    let itemsSkipped = 0;

    // Find low-stock balances grouped by tenant+facility
    const qb = this.stockBalanceRepo
      .createQueryBuilder('sb')
      .innerJoinAndSelect('sb.item', 'item')
      .where('sb.availableQuantity <= item.reorderLevel')
      .andWhere('item.status = :active', { active: 'active' });

    if (opts?.tenantId) qb.andWhere('sb.tenantId = :tid', { tid: opts.tenantId });
    if (opts?.facilityId) qb.andWhere('sb.facilityId = :fid', { fid: opts.facilityId });

    const lowStock = await qb.getMany();

    if (lowStock.length === 0) {
      return { facilitiesProcessed: 0, prsCreated: 0, itemsSkipped: 0, drafts: [] };
    }

    // Group by (tenantId, facilityId)
    const groups = new Map<string, typeof lowStock>();
    for (const sb of lowStock) {
      const key = `${sb.tenantId || ''}::${sb.facilityId}`;
      if (!groups.has(key)) groups.set(key, [] as any);
      groups.get(key)!.push(sb);
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    for (const [key, balances] of groups) {
      const [tenantId, facilityId] = key.split('::');
      const tFilter = tenantId ? { tenantId } : {};

      // Find items already in a recent open PR for this facility
      const recentOpenPRs = await this.prRepo.find({
        where: {
          facilityId,
          status: In([PRStatus.DRAFT, PRStatus.PENDING_APPROVAL, PRStatus.APPROVED, PRStatus.PARTIALLY_ORDERED, PRStatus.FULLY_ORDERED]),
          createdAt: Between(sevenDaysAgo, new Date()),
          ...tFilter,
        },
        relations: ['items'],
      });
      const itemsAlreadyPending = new Set<string>();
      for (const pr of recentOpenPRs) {
        for (const it of pr.items || []) {
          if (it.itemId) itemsAlreadyPending.add(it.itemId);
        }
      }

      const toReorder = balances.filter((sb) => {
        if (itemsAlreadyPending.has(sb.itemId)) {
          itemsSkipped++;
          return false;
        }
        return true;
      });

      if (toReorder.length === 0) continue;

      const items = toReorder.map((sb) => {
        const reorderLevel = Number(sb.item.reorderLevel || 0);
        const maxLevel = Number(sb.item.maxStockLevel || 0);
        const available = Number(sb.availableQuantity || 0);
        const fromMax = maxLevel > 0 ? maxLevel - available : 0;
        const fromReorder = reorderLevel * 2 - available;
        const suggestedQty = Math.max(Math.ceil(Math.max(fromMax, fromReorder, reorderLevel)), 1);
        return {
          itemId: sb.itemId,
          itemCode: sb.item.code,
          itemName: sb.item.name,
          itemUnit: sb.item.unit || 'unit',
          quantityRequested: suggestedQty,
          unitPriceEstimated: Number(sb.item.unitCost || 0),
          notes: `Auto-generated: stock ${available} ≤ reorder level ${reorderLevel}`,
        };
      });

      const draftSummary = {
        facilityId,
        tenantId: tenantId || undefined,
        itemCount: items.length,
        items: items.map((i) => ({
          itemId: i.itemId,
          itemName: i.itemName,
          available: Number(toReorder.find((x) => x.itemId === i.itemId)?.availableQuantity || 0),
          reorderLevel: Number(toReorder.find((x) => x.itemId === i.itemId)?.item.reorderLevel || 0),
          suggestedQty: i.quantityRequested,
        })),
      } as any;

      if (dryRun) {
        drafts.push(draftSummary);
        continue;
      }

      try {
        const requestNumber = await this.generatePRNumber(facilityId, tenantId || undefined);
        const totalEstimated = items.reduce((s, it) => s + it.quantityRequested * (it.unitPriceEstimated || 0), 0);

        const pr = this.prRepo.create({
          requestNumber,
          facilityId,
          priority: PRPriority.NORMAL,
          justification: 'Automatic reorder — items at or below reorder level',
          totalEstimated,
          notes: `System-generated draft from reorder-level monitor at ${new Date().toISOString()}`,
          status: PRStatus.DRAFT,
          requestedById: opts?.userId || (recentOpenPRs[0]?.requestedById as string) || undefined as any,
          ...(tenantId ? { tenantId } : {}),
        });
        const savedPR = await this.prRepo.save(pr);

        const prItems = items.map((it) =>
          this.prItemRepo.create({
            purchaseRequestId: (savedPR as PurchaseRequest).id,
            itemId: it.itemId,
            itemCode: it.itemCode,
            itemName: it.itemName,
            itemUnit: it.itemUnit,
            quantityRequested: it.quantityRequested,
            unitPriceEstimated: it.unitPriceEstimated,
            notes: it.notes,
          }),
        );
        await this.prItemRepo.save(prItems);

        prsCreated++;
        drafts.push({ ...draftSummary, prNumber: (savedPR as PurchaseRequest).requestNumber, prId: (savedPR as PurchaseRequest).id });
        this.logger.log(`Auto-created draft PR ${(savedPR as PurchaseRequest).requestNumber} with ${items.length} items for facility ${facilityId}`);
      } catch (err: any) {
        this.logger.error(`Failed to auto-create PR for facility ${facilityId}: ${err.message}`);
      }
    }

    return { facilitiesProcessed: groups.size, prsCreated, itemsSkipped, drafts };
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'auto-reorder-draft-prs' })
  async scheduledAutoReorder(): Promise<void> {
    try {
      const result = await this.runAutoReorderDraftPRs();
      this.logger.log(
        `[auto-reorder] facilities=${result.facilitiesProcessed} drafts=${result.prsCreated} skipped=${result.itemsSkipped}`,
      );
    } catch (err: any) {
      this.logger.error(`[auto-reorder] job failed: ${err.message}`);
    }
  }

  // ============ APPROVAL WORKFLOW (Phase 2B) ============

  /**
   * Get or create approval threshold config for facility
   */
  private async getApprovalThreshold(
    facilityId: string,
    tenantId?: string,
  ): Promise<ProcurementApprovalThreshold> {
    const where: any = {
      facilityId,
      isActive: true,
      deletedAt: IsNull(),
    };
    if (tenantId) where.tenantId = tenantId;

    let threshold = await this.approvalThresholdRepo.findOne({ where });

    // If not found, create defaults
    if (!threshold) {
      threshold = this.approvalThresholdRepo.create({
        facilityId,
        ...(tenantId ? { tenantId } : {}),
        level1MaxAmount: 500,
        level2MaxAmount: 5000,
        level3MaxAmount: 50000,
        level4MaxAmount: null as any,
        requireJustificationMin: 50000,
        isActive: true,
      });
      await this.approvalThresholdRepo.save(threshold);
      this.logger.log(`Created default approval threshold for facility ${facilityId}`);
    }

    return threshold;
  }

  /**
   * Calculate approval level (1-4) based on amount and thresholds
   */
  private calculateApprovalLevel(
    amount: number,
    thresholds: ProcurementApprovalThreshold,
  ): number {
    const amt = Number(amount);

    if (amt <= Number(thresholds.level1MaxAmount)) return 1;
    if (amt <= Number(thresholds.level2MaxAmount)) return 2;
    if (amt <= Number(thresholds.level3MaxAmount)) return 3;
    return 4; // Above level 3, requires CFO
  }

  /**
   * Get required approver roles for each level
   */
  private getRoleForLevel(level: number): string {
    const roleMap: Record<number, string> = {
      1: 'manager',
      2: 'finance_officer',
      3: 'director',
      4: 'cfo',
    };
    return roleMap[level] || 'manager';
  }

  /**
   * Create approval chain for PR/PO
   * Returns array of approval chain records (one per level)
   */
  async createApprovalChain(
    documentId: string,
    documentType: 'PR' | 'PO',
    amount: number,
    facilityId: string,
    tenantId?: string,
  ): Promise<ProcurementApprovalChain[]> {
    try {
      const thresholds = await this.getApprovalThreshold(facilityId, tenantId);
      const maxApprovalLevel = this.calculateApprovalLevel(amount, thresholds);

      const chains: ProcurementApprovalChain[] = [];

      // Create chain records for each required approval level
      for (let level = 1; level <= maxApprovalLevel; level++) {
        const chain = this.approvalChainRepo.create({
          documentId,
          documentType,
          tenantId,
          approvalLevel: level,
          requiredRole: this.getRoleForLevel(level),
          status: ApprovalChainStatus.PENDING,
        });
        chains.push(await this.approvalChainRepo.save(chain));
      }

      this.logger.log(
        `Created ${maxApprovalLevel}-level approval chain for ${documentType} ${documentId}`,
      );
      return chains;
    } catch (error) {
      this.logger.error(
        `Error creating approval chain: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get pending approval chain for document
   */
  async getApprovalChain(
    documentId: string,
    tenantId?: string,
  ): Promise<ProcurementApprovalChain[]> {
    const where: any = { documentId };
    if (tenantId) where.tenantId = tenantId;

    return this.approvalChainRepo.find({
      where,
      relations: ['approver', 'approvedBy'],
      order: { approvalLevel: 'ASC', createdAt: 'ASC' },
    });
  }

  /**
   * Get next pending approval in chain
   */
  async getNextPendingApproval(
    documentId: string,
    tenantId?: string,
  ): Promise<ProcurementApprovalChain | null> {
    const where: any = {
      documentId,
      status: ApprovalChainStatus.PENDING,
    };
    if (tenantId) where.tenantId = tenantId;

    return this.approvalChainRepo.findOne({
      where,
      relations: ['approver', 'approvedBy'],
      order: { approvalLevel: 'ASC' },
    });
  }

  /**
   * Check if all approvals are complete
   */
  async isApprovalChainComplete(
    documentId: string,
    tenantId?: string,
  ): Promise<boolean> {
    const where: any = { documentId };
    if (tenantId) where.tenantId = tenantId;

    const chains = await this.approvalChainRepo.find({ where });
    if (chains.length === 0) return true; // No chain = no approvals required

    return chains.every((c) => c.status === ApprovalChainStatus.APPROVED);
  }

  /**
   * Approve at current level
   */
  async approveAtLevel(
    documentId: string,
    documentType: 'PR' | 'PO',
    userId: string,
    comments?: string,
    tenantId?: string,
  ): Promise<ProcurementApprovalChain> {
    return this.dataSource.transaction(async (manager) => {
      const chainRepo = manager.getRepository(ProcurementApprovalChain);

      // Get next pending approval
      const where: any = {
        documentId,
        documentType,
        status: ApprovalChainStatus.PENDING,
      };
      if (tenantId) where.tenantId = tenantId;

      const chain = await chainRepo.findOne({
        where,
        relations: ['approver'],
        order: { approvalLevel: 'ASC' },
      });

      if (!chain) {
        throw new NotFoundException(
          `No pending approval found for ${documentType} ${documentId}`,
        );
      }

      // Mark as approved
      chain.status = ApprovalChainStatus.APPROVED;
      chain.approvedById = userId;
      chain.approvedAt = new Date();
      chain.comments = comments;

      return chainRepo.save(chain);
    });
  }

  /**
   * Reject approval chain (stops entire workflow)
   */
  async rejectApprovalChain(
    documentId: string,
    userId: string,
    comments: string,
    tenantId?: string,
  ): Promise<ProcurementApprovalChain[]> {
    return this.dataSource.transaction(async (manager) => {
      const chainRepo = manager.getRepository(ProcurementApprovalChain);

      const where: any = { documentId };
      if (tenantId) where.tenantId = tenantId;

      const chains = await chainRepo.find({ where });

      // Mark first pending as rejected, others as cancelled
      for (const chain of chains) {
        if (chain.status === ApprovalChainStatus.PENDING) {
          chain.status = ApprovalChainStatus.REJECTED;
          chain.approvedById = userId;
          chain.approvedAt = new Date();
          chain.comments = comments;
          break; // Only first pending is rejected
        }
      }

      return chainRepo.save(chains);
    });
  }
}
