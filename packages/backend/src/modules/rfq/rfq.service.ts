import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { RFQ, RFQItem, RFQVendor, VendorQuotation, VendorQuotationItem, QuotationApproval, RFQStatus, QuotationStatus, ApprovalLevel, QuotationApprovalStatus } from '../../database/entities/rfq.entity';
import { Supplier } from '../../database/entities/supplier.entity';
import { CreateRFQDto, UpdateRFQDto, AddVendorsDto, CreateQuotationDto, ApproveQuotationDto, RejectQuotationDto } from './dto/rfq.dto';

@Injectable()
export class RFQService {
  private readonly logger = new Logger(RFQService.name);

  constructor(
    @InjectRepository(RFQ) private rfqRepo: Repository<RFQ>,
    @InjectRepository(RFQItem) private rfqItemRepo: Repository<RFQItem>,
    @InjectRepository(RFQVendor) private rfqVendorRepo: Repository<RFQVendor>,
    @InjectRepository(VendorQuotation) private quotationRepo: Repository<VendorQuotation>,
    @InjectRepository(VendorQuotationItem) private quotationItemRepo: Repository<VendorQuotationItem>,
    @InjectRepository(QuotationApproval) private approvalRepo: Repository<QuotationApproval>,
    @InjectRepository(Supplier) private supplierRepo: Repository<Supplier>,
  ) {}

  private async generateRFQNumber(facilityId: string): Promise<string> {
    const count = await this.rfqRepo.count({ where: { facilityId } });
    const date = new Date();
    return `RFQ${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(count + 1).padStart(5, '0')}`;
  }

  async create(dto: CreateRFQDto, userId: string): Promise<RFQ> {
    const rfqNumber = await this.generateRFQNumber(dto.facilityId);

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
    });

    const savedRFQ = await this.rfqRepo.save(rfq);

    // Create items
    const items = dto.items.map((item) =>
      this.rfqItemRepo.create({
        rfqId: savedRFQ.id,
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        unit: item.unit || 'unit',
        specifications: item.specifications,
      })
    );
    await this.rfqItemRepo.save(items);

    // Add vendors if provided
    if (dto.vendorIds?.length) {
      await this.addVendors(savedRFQ.id, { vendorIds: dto.vendorIds });
    }

    return this.findOne(savedRFQ.id);
  }

  async findAll(facilityId: string, options: { status?: RFQStatus } = {}) {
    const qb = this.rfqRepo
      .createQueryBuilder('rfq')
      .leftJoinAndSelect('rfq.items', 'items')
      .leftJoinAndSelect('rfq.vendors', 'vendors')
      .leftJoinAndSelect('vendors.supplier', 'supplier')
      .leftJoinAndSelect('rfq.quotations', 'quotations')
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

    return qb.orderBy('rfq.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<RFQ> {
    const rfq = await this.rfqRepo.findOne({
      where: { id },
      relations: ['items', 'vendors', 'vendors.supplier', 'quotations', 'quotations.items', 'quotations.supplier', 'purchaseRequest', 'createdBy'],
    });
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  async update(id: string, dto: UpdateRFQDto): Promise<RFQ> {
    const rfq = await this.findOne(id);
    if (rfq.status !== RFQStatus.DRAFT) {
      throw new BadRequestException('Only draft RFQs can be updated');
    }
    Object.assign(rfq, dto);
    if (dto.deadline) rfq.deadline = new Date(dto.deadline);
    await this.rfqRepo.save(rfq);
    return this.findOne(id);
  }

  async addVendors(id: string, dto: AddVendorsDto): Promise<RFQ> {
    const rfq = await this.findOne(id);
    if (rfq.status === RFQStatus.CLOSED || rfq.status === RFQStatus.CANCELLED) {
      throw new BadRequestException('Cannot add vendors to closed/cancelled RFQ');
    }

    for (const vendorId of dto.vendorIds) {
      const exists = await this.rfqVendorRepo.findOne({
        where: { rfqId: id, supplierId: vendorId },
      });
      if (!exists) {
        const vendor = this.rfqVendorRepo.create({
          rfqId: id,
          supplierId: vendorId,
        });
        await this.rfqVendorRepo.save(vendor);
      }
    }

    return this.findOne(id);
  }

  async sendToVendors(id: string): Promise<RFQ> {
    const rfq = await this.findOne(id);
    if (rfq.status !== RFQStatus.DRAFT) {
      throw new BadRequestException('Only draft RFQs can be sent');
    }
    if (!rfq.vendors?.length) {
      throw new BadRequestException('RFQ must have at least one vendor');
    }
    if (!rfq.items?.length) {
      throw new BadRequestException('RFQ must have at least one item');
    }

    rfq.status = RFQStatus.SENT;
    rfq.sentDate = new Date();
    await this.rfqRepo.save(rfq);

    // TODO: Send email notifications to vendors

    return this.findOne(id);
  }

  async receiveQuotation(dto: CreateQuotationDto, userId: string): Promise<VendorQuotation> {
    const rfq = await this.findOne(dto.rfqId);
    if (![RFQStatus.SENT, RFQStatus.PENDING_RESPONSES, RFQStatus.RESPONSES_RECEIVED].includes(rfq.status)) {
      throw new BadRequestException('RFQ is not accepting quotations');
    }

    const quotation = this.quotationRepo.create({
      quotationNumber: dto.quotationNumber,
      rfqId: dto.rfqId,
      supplierId: dto.supplierId,
      totalAmount: dto.totalAmount,
      deliveryDays: dto.deliveryDays,
      paymentTerms: dto.paymentTerms,
      warranty: dto.warranty,
      validUntil: new Date(dto.validUntil),
      receivedDate: new Date(),
      notes: dto.notes,
      status: QuotationStatus.RECEIVED,
    });

    const savedQuotation = await this.quotationRepo.save(quotation);

    // Create quotation items
    const items = dto.items.map((item) =>
      this.quotationItemRepo.create({
        quotationId: savedQuotation.id,
        rfqItemId: item.rfqItemId,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        deliveryDays: item.deliveryDays,
        inStock: item.inStock ?? true,
        notes: item.notes,
      })
    );
    await this.quotationItemRepo.save(items);

    // Update RFQ vendor response status
    await this.rfqVendorRepo.update(
      { rfqId: dto.rfqId, supplierId: dto.supplierId },
      { hasResponded: true, responseDate: new Date() }
    );

    // Update RFQ status
    const allResponded = rfq.vendors.every((v) => v.hasResponded || v.supplierId === dto.supplierId);
    rfq.status = allResponded ? RFQStatus.RESPONSES_RECEIVED : RFQStatus.PENDING_RESPONSES;
    await this.rfqRepo.save(rfq);

    return this.getQuotation(savedQuotation.id);
  }

  async getQuotation(id: string): Promise<VendorQuotation> {
    const quotation = await this.quotationRepo.findOne({
      where: { id },
      relations: ['items', 'supplier', 'rfq'],
    });
    if (!quotation) throw new NotFoundException('Quotation not found');
    return quotation;
  }

  async getQuotationsForRFQ(rfqId: string): Promise<VendorQuotation[]> {
    return this.quotationRepo.find({
      where: { rfqId },
      relations: ['items', 'supplier'],
      order: { totalAmount: 'ASC' },
    });
  }

  async selectWinner(quotationId: string, userId: string): Promise<VendorQuotation> {
    const quotation = await this.getQuotation(quotationId);

    // Mark other quotations as rejected
    await this.quotationRepo.update(
      { rfqId: quotation.rfqId, id: Not(quotationId) },
      { status: QuotationStatus.REJECTED }
    );

    // Mark selected quotation as under review
    quotation.status = QuotationStatus.UNDER_REVIEW;
    await this.quotationRepo.save(quotation);

    // Create approval workflow
    const approvalLevels = [ApprovalLevel.MANAGER, ApprovalLevel.FINANCE, ApprovalLevel.DIRECTOR];
    for (const level of approvalLevels) {
      const approval = this.approvalRepo.create({
        quotationId: quotation.id,
        level,
        status: QuotationApprovalStatus.PENDING,
      });
      await this.approvalRepo.save(approval);
    }

    return this.getQuotation(quotationId);
  }

  async getPendingApprovals(facilityId: string, level?: ApprovalLevel) {
    const qb = this.approvalRepo
      .createQueryBuilder('approval')
      .leftJoinAndSelect('approval.quotation', 'quotation')
      .leftJoinAndSelect('quotation.supplier', 'supplier')
      .leftJoinAndSelect('quotation.rfq', 'rfq')
      .leftJoinAndSelect('quotation.items', 'items')
      .where('approval.status = :status', { status: QuotationApprovalStatus.PENDING })
      .andWhere('rfq.facilityId = :facilityId', { facilityId });

    if (level) {
      qb.andWhere('approval.level = :level', { level });
    }

    return qb.orderBy('quotation.receivedDate', 'ASC').getMany();
  }

  async approveQuotation(approvalId: string, dto: ApproveQuotationDto, userId: string): Promise<QuotationApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId },
      relations: ['quotation', 'quotation.rfq'],
    });
    if (!approval) throw new NotFoundException('Approval not found');
    if (approval.status !== QuotationApprovalStatus.PENDING) {
      throw new BadRequestException('Approval is not pending');
    }

    // Check if previous levels are approved
    const levelOrder = { [ApprovalLevel.MANAGER]: 1, [ApprovalLevel.FINANCE]: 2, [ApprovalLevel.DIRECTOR]: 3 };
    const previousApprovals = await this.approvalRepo.find({
      where: { quotationId: approval.quotationId },
    });
    for (const prev of previousApprovals) {
      if (levelOrder[prev.level] < levelOrder[approval.level] && prev.status !== QuotationApprovalStatus.APPROVED) {
        throw new BadRequestException(`${prev.level} approval is required first`);
      }
    }

    approval.status = QuotationApprovalStatus.APPROVED;
    approval.approverId = userId;
    approval.approvedAt = new Date();
    approval.comments = dto.comments || '';
    await this.approvalRepo.save(approval);

    // Check if all approvals are complete
    const allApprovals = await this.approvalRepo.find({ where: { quotationId: approval.quotationId } });
    const allApproved = allApprovals.every((a) => a.status === QuotationApprovalStatus.APPROVED);

    if (allApproved) {
      const quotation = await this.getQuotation(approval.quotationId);
      quotation.status = QuotationStatus.SELECTED;
      await this.quotationRepo.save(quotation);

      // Close the RFQ
      const rfq = await this.findOne(quotation.rfqId);
      rfq.status = RFQStatus.CLOSED;
      rfq.closedDate = new Date();
      await this.rfqRepo.save(rfq);
    }

    return approval;
  }

  async rejectQuotation(approvalId: string, dto: RejectQuotationDto, userId: string): Promise<QuotationApproval> {
    const approval = await this.approvalRepo.findOne({
      where: { id: approvalId },
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
    const quotation = await this.getQuotation(approval.quotationId);
    quotation.status = QuotationStatus.REJECTED;
    await this.quotationRepo.save(quotation);

    return approval;
  }

  async closeRFQ(id: string): Promise<RFQ> {
    const rfq = await this.findOne(id);
    rfq.status = RFQStatus.CLOSED;
    rfq.closedDate = new Date();
    await this.rfqRepo.save(rfq);
    return this.findOne(id);
  }
}
