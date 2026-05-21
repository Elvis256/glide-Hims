import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import {
  RFQ,
  RFQItem,
  RFQVendor,
  VendorQuotation,
  VendorQuotationItem,
  QuotationApproval,
  RFQStatus,
  QuotationStatus,
  ApprovalLevel,
  QuotationApprovalStatus,
} from '../../database/entities/rfq.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { User } from '../../database/entities/user.entity';
import { PurchaseOrder } from '../../database/entities/purchase-order.entity';
import {
  CreateRFQDto,
  UpdateRFQDto,
  AddVendorsDto,
  CreateQuotationDto,
  ApproveQuotationDto,
  RejectQuotationDto,
} from './dto/rfq.dto';

// Approval thresholds (UGX)
const THRESHOLD_SINGLE = 5_000_000; // Below: 1 approval
const THRESHOLD_DOUBLE = 20_000_000; // Below: 2 approvals, Above: 3 approvals

@Injectable()
export class RFQService {
  private readonly logger = new Logger(RFQService.name);

  constructor(
    @InjectRepository(RFQ) private rfqRepo: Repository<RFQ>,
    @InjectRepository(RFQItem) private rfqItemRepo: Repository<RFQItem>,
    @InjectRepository(RFQVendor) private rfqVendorRepo: Repository<RFQVendor>,
    @InjectRepository(VendorQuotation) private quotationRepo: Repository<VendorQuotation>,
    @InjectRepository(VendorQuotationItem)
    private quotationItemRepo: Repository<VendorQuotationItem>,
    @InjectRepository(QuotationApproval) private approvalRepo: Repository<QuotationApproval>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
  ) {}

  private getRequiredApprovals(totalAmount: number): number {
    if (totalAmount < THRESHOLD_SINGLE) return 1;
    if (totalAmount < THRESHOLD_DOUBLE) return 2;
    return 3;
  }

  private async generateRFQNumber(_facilityId: string, _tenantId?: string): Promise<string> {
    // rfq_number has a GLOBAL unique constraint, so we derive the next suffix
    // from the highest existing number that matches this month's prefix
    // (rather than count(*) which is both wrong cross-tenant and race-prone).
    const date = new Date();
    const prefix = `RFQ${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    const row = await this.rfqRepo
      .createQueryBuilder('rfq')
      .select('MAX(rfq.rfq_number)', 'max')
      .where('rfq.rfq_number LIKE :p', { p: `${prefix}%` })
      .withDeleted()
      .getRawOne<{ max: string | null }>();
    const lastSuffix = row?.max ? parseInt(row.max.slice(prefix.length), 10) : 0;
    const next = Number.isFinite(lastSuffix) ? lastSuffix + 1 : 1;
    return `${prefix}${String(next).padStart(5, '0')}`;
  }

  async create(dto: CreateRFQDto, userId: string, tenantId?: string): Promise<RFQ> {
    if (dto.purchaseRequestId) {
      const existing = await this.rfqRepo.findOne({
        where: {
          purchaseRequestId: dto.purchaseRequestId,
          status: Not(RFQStatus.CANCELLED),
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (existing) {
        throw new BadRequestException(
          `An RFQ (${existing.rfqNumber}) already exists for this requisition. ` +
            `Cancel it first if you need to create a new one.`,
        );
      }
    }
    let savedRFQ: RFQ | null = null;
    let lastErr: any = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      const rfqNumber = await this.generateRFQNumber(dto.facilityId, tenantId);
      const rfq = this.rfqRepo.create({
        rfqNumber,
        title: dto.title,
        facilityId: dto.facilityId,
        purchaseRequestId: dto.purchaseRequestId,
        deadline: new Date(dto.deadline),
        notes: dto.notes,
        instructions: dto.instructions,
        status: RFQStatus.DRAFT,
        createdById: userId,
        ...(tenantId ? { tenantId } : {}),
      });
      try {
        savedRFQ = await this.rfqRepo.save(rfq);
        break;
      } catch (err: any) {
        lastErr = err;
        // 23505 = unique_violation. Retry with a fresh number.
        if (err?.code !== '23505' || !String(err?.detail || '').includes('rfq_number')) {
          throw err;
        }
        this.logger.warn(
          `RFQ number collision on ${rfqNumber} (attempt ${attempt + 1}/5), retrying`,
        );
      }
    }
    if (!savedRFQ) {
      throw lastErr ?? new BadRequestException('Failed to allocate RFQ number');
    }

    // Create items
    const items = dto.items.map((item) =>
      this.rfqItemRepo.create({
        rfqId: savedRFQ.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit || 'unit',
        specifications: item.specifications,
        ...(tenantId ? { tenantId } : {}),
      }),
    );
    await this.rfqItemRepo.save(items);

    // Add vendors if provided
    if (dto.vendorIds?.length) {
      await this.addVendors(savedRFQ.id, { vendorIds: dto.vendorIds }, tenantId);
    }

    return this.findOne(savedRFQ.id, tenantId);
  }

  async findAll(facilityId: string, options: { status?: RFQStatus } = {}, tenantId?: string) {
    const qb = this.rfqRepo
      .createQueryBuilder('rfq')
      .leftJoinAndSelect('rfq.items', 'items')
      .leftJoinAndSelect('rfq.vendors', 'vendors')
      .leftJoinAndSelect('vendors.supplier', 'supplier')
      .leftJoinAndSelect('rfq.quotations', 'quotations')
      .leftJoinAndSelect('quotations.items', 'quotationItems')
      .leftJoinAndSelect('quotations.supplier', 'quotationSupplier')
      .leftJoinAndSelect('quotations.approvals', 'approvals')
      .leftJoinAndSelect('rfq.purchaseRequest', 'purchaseRequest')
      .leftJoinAndSelect('rfq.createdBy', 'createdBy');

    if (facilityId && facilityId.trim() !== '') {
      qb.where('rfq.facilityId = :facilityId', { facilityId });
    }

    if (options.status) {
      if (facilityId && facilityId.trim() !== '') {
        qb.andWhere('rfq.status = :status', { status: options.status });
      } else {
        qb.where('rfq.status = :status', { status: options.status });
      }
    }

    if (tenantId) {
      qb.andWhere('rfq.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('rfq.createdAt', 'DESC').getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<RFQ> {
    const rfq = await this.rfqRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: [
        'items',
        'vendors',
        'vendors.supplier',
        'quotations',
        'quotations.items',
        'quotations.supplier',
        'purchaseRequest',
        'createdBy',
      ],
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  async update(id: string, dto: UpdateRFQDto, tenantId?: string): Promise<RFQ> {
    const rfq = await this.findOne(id, tenantId);
    if (rfq.status !== RFQStatus.DRAFT) {
      throw new BadRequestException('Only draft RFQs can be updated');
    }
    Object.assign(rfq, dto);
    if (dto.deadline) rfq.deadline = new Date(dto.deadline);
    await this.rfqRepo.save(rfq);
    return this.findOne(id, tenantId);
  }

  async addVendors(id: string, dto: AddVendorsDto, tenantId?: string): Promise<RFQ> {
    const rfq = await this.findOne(id, tenantId);
    if (rfq.status === RFQStatus.CLOSED || rfq.status === RFQStatus.CANCELLED) {
      throw new BadRequestException('Cannot add vendors to closed/cancelled RFQ');
    }

    for (const vendorId of dto.vendorIds) {
      // Validate supplier is active before adding to RFQ
      const supplier = await this.supplierRepo.findOne({
        where: { id: vendorId, ...(tenantId ? { tenantId } : {}) },
      });
      if (!supplier) {
        throw new NotFoundException(`Supplier ${vendorId} not found`);
      }
      if (supplier.status !== 'active') {
        throw new BadRequestException(
          `Cannot add ${supplier.name || vendorId}: supplier status is ${supplier.status}. Only active suppliers can participate in RFQs.`,
        );
      }

      const exists = await this.rfqVendorRepo.findOne({
        where: { rfqId: id, supplierId: vendorId, ...(tenantId ? { tenantId } : {}) },
      });
      if (!exists) {
        const vendor = this.rfqVendorRepo.create({
          rfqId: id,
          supplierId: vendorId,
          ...(tenantId ? { tenantId } : {}),
        });
        await this.rfqVendorRepo.save(vendor);
      }
    }

    return this.findOne(id, tenantId);
  }

  async sendToVendors(id: string, tenantId?: string): Promise<RFQ> {
    const rfq = await this.findOne(id, tenantId);
    if (rfq.status !== RFQStatus.DRAFT) {
      throw new BadRequestException('Only draft RFQs can be sent');
    }
    if (!rfq.vendors?.length || rfq.vendors.length < 3) {
      throw new BadRequestException(
        'RFQ must have at least 3 vendors for competitive bidding compliance',
      );
    }
    if (!rfq.items?.length) {
      throw new BadRequestException('RFQ must have at least one item');
    }

    rfq.status = RFQStatus.SENT;
    rfq.sentDate = new Date();
    await this.rfqRepo.save(rfq);

    // TODO: Send email notifications to vendors

    return this.findOne(id, tenantId);
  }

  async receiveQuotation(
    dto: CreateQuotationDto,
    userId: string,
    tenantId?: string,
  ): Promise<VendorQuotation> {
    const rfq = await this.findOne(dto.rfqId, tenantId);
    if (
      ![RFQStatus.SENT, RFQStatus.PENDING_RESPONSES, RFQStatus.RESPONSES_RECEIVED].includes(
        rfq.status,
      )
    ) {
      throw new BadRequestException('RFQ is not accepting quotations');
    }

    // Validate quotation prices are non-negative
    if (dto.totalAmount < 0) {
      throw new BadRequestException('Quotation total amount cannot be negative');
    }
    for (const item of dto.items) {
      if (item.unitPrice < 0) {
        throw new BadRequestException('Quotation item unit price cannot be negative');
      }
      if (item.totalPrice < 0) {
        throw new BadRequestException('Quotation item total price cannot be negative');
      }
    }

    const quotation = this.quotationRepo.create({
      quotationNumber: dto.quotationNumber,
      rfq: { id: dto.rfqId } as RFQ,
      rfqId: dto.rfqId,
      supplier: { id: dto.supplierId } as Supplier,
      supplierId: dto.supplierId,
      totalAmount: dto.totalAmount,
      deliveryDays: dto.deliveryDays,
      paymentTerms: dto.paymentTerms,
      warranty: dto.warranty,
      validUntil: new Date(dto.validUntil),
      receivedDate: new Date(),
      notes: dto.notes,
      status: QuotationStatus.RECEIVED,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedQuotation = await this.quotationRepo.save(quotation);

    // Create quotation items
    const items = dto.items.map((item) =>
      this.quotationItemRepo.create({
        quotation: { id: savedQuotation.id } as VendorQuotation,
        quotationId: savedQuotation.id,
        rfqItemId: item.rfqItemId,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        deliveryDays: item.deliveryDays,
        inStock: item.inStock ?? true,
        notes: item.notes,
        ...(tenantId ? { tenantId } : {}),
      }),
    );
    await this.quotationItemRepo.save(items);

    // Update RFQ vendor response status
    await this.rfqVendorRepo.update(
      { rfqId: dto.rfqId, supplierId: dto.supplierId },
      { hasResponded: true, responseDate: new Date() },
    );

    // Update RFQ status using targeted update to avoid cascade side-effects
    const allResponded = rfq.vendors.every(
      (v) => v.hasResponded || v.supplierId === dto.supplierId,
    );
    const newStatus = allResponded ? RFQStatus.RESPONSES_RECEIVED : RFQStatus.PENDING_RESPONSES;
    await this.rfqRepo.update(rfq.id, { status: newStatus });

    return this.getQuotation(savedQuotation.id, tenantId);
  }

  async getQuotation(id: string, tenantId?: string): Promise<VendorQuotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['items', 'supplier', 'rfq'],
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async getQuotationsForRFQ(rfqId: string, tenantId?: string): Promise<VendorQuotation[]> {
    return this.quotationRepo.find({
      where: { rfqId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items', 'supplier'],
      order: { totalAmount: 'ASC' },
    });
  }

  /**
   * Quotations that have been approved (SELECTED) and not yet converted into a
   * Purchase Order. These are the ones a procurement officer can convert next.
   */
  async getSelectedQuotations(facilityId: string, tenantId?: string) {
    const qb = this.quotationRepo
      .createQueryBuilder('quotation')
      .leftJoinAndSelect('quotation.supplier', 'supplier')
      .leftJoinAndSelect('quotation.rfq', 'rfq')
      .leftJoinAndSelect('rfq.items', 'rfqItems')
      .leftJoinAndSelect('quotation.items', 'items')
      .where('quotation.status = :status', { status: QuotationStatus.SELECTED })
      .andWhere('rfq.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      qb.andWhere('quotation.tenantId = :tenantId', { tenantId });
    }

    const candidates = await qb.orderBy('quotation.createdAt', 'DESC').getMany();
    if (candidates.length === 0) return [];

    // Exclude quotations that have already been converted to a PO
    const ids = candidates.map((q) => q.id);
    const existingPOs = await this.poRepo
      .createQueryBuilder('po')
      .select('po.quotationId', 'quotationId')
      .where('po.quotationId IN (:...ids)', { ids })
      .getRawMany<{ quotationId: string }>();
    const converted = new Set(existingPOs.map((r) => r.quotationId));
    return candidates.filter((q) => !converted.has(q.id));
  }

  async selectWinner(
    quotationId: string,
    userId: string,
    tenantId?: string,
  ): Promise<VendorQuotation> {
    const quotation = await this.getQuotation(quotationId, tenantId);

    // Require minimum quotations for competitive bidding compliance
    const quotationCount = await this.quotationRepo.count({
      where: {
        rfqId: quotation.rfqId,
        status: QuotationStatus.RECEIVED,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    if (quotationCount < 2) {
      throw new BadRequestException(
        `Competitive bidding requires at least 2 quotations. Only ${quotationCount} received. Cannot select a winner yet.`,
      );
    }

    // Mark other quotations as rejected
    await this.quotationRepo.update(
      { rfqId: quotation.rfqId, id: Not(quotationId) },
      { status: QuotationStatus.REJECTED },
    );

    // Mark selected quotation as under review
    quotation.status = QuotationStatus.UNDER_REVIEW;
    await this.quotationRepo.save(quotation);

    // Create threshold-based approval workflow
    const requiredApprovals = this.getRequiredApprovals(Number(quotation.totalAmount));
    const levels = [ApprovalLevel.APPROVAL_1, ApprovalLevel.APPROVAL_2, ApprovalLevel.APPROVAL_3];
    for (let i = 0; i < requiredApprovals; i++) {
      const approval = this.approvalRepo.create({
        quotationId: quotation.id,
        level: levels[i],
        status: QuotationApprovalStatus.PENDING,
        ...(tenantId ? { tenantId } : {}),
      });
      await this.approvalRepo.save(approval);
    }

    this.logger.log(
      `Quotation ${quotation.quotationNumber} selected as winner. Amount: ${quotation.totalAmount}, Approvals required: ${requiredApprovals}`,
    );

    return this.getQuotation(quotationId, tenantId);
  }

  async getPendingApprovals(facilityId: string, level?: ApprovalLevel, tenantId?: string) {
    const qb = this.approvalRepo
      .createQueryBuilder('approval')
      .leftJoinAndSelect('approval.quotation', 'quotation')
      .leftJoinAndSelect('quotation.supplier', 'supplier')
      .leftJoinAndSelect('quotation.rfq', 'rfq')
      .leftJoinAndSelect('rfq.items', 'rfqItems')
      .leftJoinAndSelect('quotation.items', 'items')
      .where('approval.status = :status', { status: QuotationApprovalStatus.PENDING })
      .andWhere('rfq.facilityId = :facilityId', { facilityId });

    if (level) {
      qb.andWhere('approval.level = :level', { level });
    }

    if (tenantId) {
      qb.andWhere('rfq.tenant_id = :tenantId', { tenantId });
    }
    return qb.orderBy('quotation.receivedDate', 'ASC').getMany();
  }

  async approveQuotation(
    approvalId: string,
    dto: ApproveQuotationDto,
    userId: string,
    tenantId?: string,
  ): Promise<QuotationApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, ...(tenantId ? { tenantId } : {}) },
      relations: ['quotation', 'quotation.rfq'],
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== QuotationApprovalStatus.PENDING) {
      throw new BadRequestException('Approval is not pending');
    }

    // Check sequential order: previous levels must be approved
    const levelOrder = {
      [ApprovalLevel.APPROVAL_1]: 1,
      [ApprovalLevel.APPROVAL_2]: 2,
      [ApprovalLevel.APPROVAL_3]: 3,
    };
    const allApprovals = await this.approvalRepo.find({
      where: { quotationId: approval.quotationId, ...(tenantId ? { tenantId } : {}) },
    });
    for (const prev of allApprovals) {
      if (
        levelOrder[prev.level] < levelOrder[approval.level] &&
        prev.status !== QuotationApprovalStatus.APPROVED
      ) {
        throw new BadRequestException(`Approval ${levelOrder[prev.level]} must be completed first`);
      }
    }

    // Separation of duties: check if this user already approved another level
    const userAlreadyApproved = allApprovals.find(
      (a) => a.approverId === userId && a.status === QuotationApprovalStatus.APPROVED,
    );

    let isSelfApproval = false;

    if (userAlreadyApproved) {
      // Check if facility has other users with procurement.approve permission
      const facilityId = approval.quotation?.rfq?.facilityId;
      const otherApprovers = await this.userRepo
        .createQueryBuilder('user')
        .innerJoin('user.userRoles', 'ur')
        .innerJoin('ur.role', 'role')
        .innerJoin('role_permissions', 'rp', 'rp.role_id = role.id')
        .innerJoin('permissions', 'perm', 'perm.id = rp.permission_id')
        .where('user.id != :userId', { userId })
        .andWhere('user.status = :activeStatus', { activeStatus: 'active' })
        .andWhere('perm.code LIKE :permCode', { permCode: '%procurement%approve%' })
        .andWhere(facilityId ? 'user.facilityId = :facilityId' : '1=1', { facilityId })
        .getCount();

      if (otherApprovers > 0) {
        throw new BadRequestException(
          'Separation of duties: you have already approved this quotation. A different user must approve this level.',
        );
      }

      // Self-approve fallback: no other approvers available
      if (!dto.justification?.trim()) {
        throw new BadRequestException(
          'You are the only approver available. Please provide a justification for self-approval.',
        );
      }

      isSelfApproval = true;
      this.logger.warn(
        `Self-approval by user ${userId} on quotation ${approval.quotationId} — no other approvers. Justification: ${dto.justification}`,
      );
    }

    approval.status = QuotationApprovalStatus.APPROVED;
    approval.approverId = userId;
    approval.approvedAt = new Date();
    approval.comments = dto.comments || '';
    approval.selfApproved = isSelfApproval;
    approval.justification = isSelfApproval ? dto.justification || null : null;
    await this.approvalRepo.save(approval);

    // Check if all approvals are complete
    const updatedApprovals = await this.approvalRepo.find({
      where: { quotationId: approval.quotationId, ...(tenantId ? { tenantId } : {}) },
    });
    const allApproved = updatedApprovals.every(
      (a) => a.status === QuotationApprovalStatus.APPROVED,
    );

    if (allApproved) {
      const quotation = await this.getQuotation(approval.quotationId, tenantId);
      quotation.status = QuotationStatus.SELECTED;
      await this.quotationRepo.save(quotation);

      // Close the RFQ
      const rfq = await this.findOne(quotation.rfqId, tenantId);
      rfq.status = RFQStatus.CLOSED;
      rfq.closedDate = new Date();
      await this.rfqRepo.save(rfq);
    }

    return approval;
  }

  async rejectQuotation(
    approvalId: string,
    dto: RejectQuotationDto,
    userId: string,
    tenantId?: string,
  ): Promise<QuotationApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId, ...(tenantId ? { tenantId } : {}) },
      relations: ['quotation'],
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== QuotationApprovalStatus.PENDING) {
      throw new BadRequestException('Approval is not pending');
    }

    approval.status = QuotationApprovalStatus.REJECTED;
    approval.approverId = userId;
    approval.approvedAt = new Date();
    approval.comments = dto.comments;
    await this.approvalRepo.save(approval);

    // Mark quotation as rejected
    const quotation = await this.getQuotation(approval.quotationId, tenantId);
    quotation.status = QuotationStatus.REJECTED;
    await this.quotationRepo.save(quotation);

    return approval;
  }

  async closeRFQ(id: string, tenantId?: string): Promise<RFQ> {
    const rfq = await this.findOne(id, tenantId);
    rfq.status = RFQStatus.CLOSED;
    rfq.closedDate = new Date();
    await this.rfqRepo.save(rfq);
    return this.findOne(id, tenantId);
  }

  async cancelRFQ(id: string, tenantId?: string): Promise<RFQ> {
    const rfq = await this.findOne(id, tenantId);
    if (rfq.status === RFQStatus.CLOSED) {
      throw new BadRequestException('Cannot cancel a closed RFQ');
    }
    if (rfq.status === RFQStatus.CANCELLED) {
      return rfq;
    }
    const hasSelectedQuotation = (rfq.quotations || []).some(
      (q) => q.status === QuotationStatus.SELECTED,
    );
    if (hasSelectedQuotation) {
      throw new BadRequestException(
        'Cannot cancel an RFQ that already has a selected quotation',
      );
    }
    rfq.status = RFQStatus.CANCELLED;
    await this.rfqRepo.save(rfq);
    return this.findOne(id, tenantId);
  }

  async deleteRFQ(id: string, tenantId?: string): Promise<{ deleted: true; id: string }> {
    const rfq = await this.findOne(id, tenantId);
    if (rfq.status !== RFQStatus.DRAFT && rfq.status !== RFQStatus.CANCELLED) {
      throw new BadRequestException(
        'Only draft or cancelled RFQs can be deleted. Cancel it first.',
      );
    }
    const hasQuotations = (rfq.quotations || []).length > 0;
    if (hasQuotations) {
      throw new BadRequestException(
        'Cannot delete an RFQ that already has quotations attached',
      );
    }
    await this.rfqRepo.softRemove(rfq);
    return { deleted: true, id };
  }
}
