import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, IsNull } from 'typeorm';
import { FinanceService } from '../finance/finance.service';
import { InsuranceProvider } from '../../database/entities/insurance-provider.entity';
import { InsurancePolicy, PolicyStatus } from '../../database/entities/insurance-policy.entity';
import { InsuranceClaim, ClaimStatus } from '../../database/entities/insurance-claim.entity';
import { ClaimItem, ClaimItemStatus, ClaimItemType } from '../../database/entities/claim-item.entity';
import { PreAuthorization, PreAuthStatus } from '../../database/entities/pre-authorization.entity';
import { Encounter, PayerType } from '../../database/entities/encounter.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import {
  CreateProviderDto,
  CreatePolicyDto,
  CreateClaimDto,
  CreateClaimItemDto,
  CreatePreAuthDto,
  ProcessClaimDto,
  ProcessPreAuthDto,
  RecordPaymentDto,
} from './dto/insurance.dto';

@Injectable()
export class InsuranceService {
  private readonly logger = new Logger(InsuranceService.name);

  constructor(
    @InjectRepository(InsuranceProvider)
    private providerRepo: Repository<InsuranceProvider>,
    @InjectRepository(InsurancePolicy)
    private policyRepo: Repository<InsurancePolicy>,
    @InjectRepository(InsuranceClaim)
    private claimRepo: Repository<InsuranceClaim>,
    @InjectRepository(ClaimItem)
    private claimItemRepo: Repository<ClaimItem>,
    @InjectRepository(PreAuthorization)
    private preAuthRepo: Repository<PreAuthorization>,
    @InjectRepository(Encounter)
    private encounterRepo: Repository<Encounter>,
    @InjectRepository(Invoice)
    private invoiceRepo: Repository<Invoice>,
    @Inject(forwardRef(() => FinanceService))
    private financeService: FinanceService,
  ) {}

  // ============ DASHBOARD ============
  async getDashboard(facilityId: string, tenantId?: string) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const tenantFilter = tenantId ? { tenantId } : {};

    const [
      totalProviders,
      activePolicies,
      pendingClaims,
      pendingPreAuths,
      claimsThisMonth,
      totalClaimedThisMonth,
      totalApprovedThisMonth,
      totalPaidThisMonth,
    ] = await Promise.all([
      this.providerRepo.count({ where: { facilityId, isActive: true, ...tenantFilter } }),
      this.policyRepo.count({ where: { status: PolicyStatus.ACTIVE, ...tenantFilter } }),
      this.claimRepo.count({ where: { facilityId, status: ClaimStatus.SUBMITTED, ...tenantFilter } }),
      this.preAuthRepo.count({ where: { facilityId, status: PreAuthStatus.PENDING, ...tenantFilter } }),
      this.claimRepo.count({ 
        where: { facilityId, createdAt: MoreThan(startOfMonth), ...tenantFilter } 
      }),
      this.claimRepo
        .createQueryBuilder('claim')
        .select('COALESCE(SUM(claim.totalClaimed), 0)', 'total')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.createdAt >= :startOfMonth', { startOfMonth })
        .andWhere(tenantId ? 'claim.tenant_id = :tenantId' : '1=1', tenantId ? { tenantId } : {})
        .getRawOne(),
      this.claimRepo
        .createQueryBuilder('claim')
        .select('COALESCE(SUM(claim.totalApproved), 0)', 'total')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.createdAt >= :startOfMonth', { startOfMonth })
        .andWhere(tenantId ? 'claim.tenant_id = :tenantId' : '1=1', tenantId ? { tenantId } : {})
        .getRawOne(),
      this.claimRepo
        .createQueryBuilder('claim')
        .select('COALESCE(SUM(claim.totalPaid), 0)', 'total')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status = :status', { status: ClaimStatus.PAID })
        .andWhere('claim.paidAt >= :startOfMonth', { startOfMonth })
        .andWhere(tenantId ? 'claim.tenant_id = :tenantId' : '1=1', tenantId ? { tenantId } : {})
        .getRawOne(),
    ]);

    return {
      totalProviders,
      activePolicies,
      pendingClaims,
      pendingPreAuths,
      claimsThisMonth,
      totalClaimedThisMonth: parseFloat(totalClaimedThisMonth?.total || 0),
      totalApprovedThisMonth: parseFloat(totalApprovedThisMonth?.total || 0),
      totalPaidThisMonth: parseFloat(totalPaidThisMonth?.total || 0),
    };
  }

  // ============ PROVIDERS ============
  async createProvider(dto: CreateProviderDto, tenantId?: string): Promise<InsuranceProvider> {
    const provider = this.providerRepo.create({
      ...dto,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.providerRepo.save(provider);
  }

  async getProviders(facilityId: string, filters?: { active?: boolean }, tenantId?: string): Promise<InsuranceProvider[]> {
    const where: any = { facilityId };
    if (filters?.active !== undefined) {
      where.isActive = filters.active;
    }
    if (tenantId) where.tenantId = tenantId;
    return this.providerRepo.find({ where, order: { name: 'ASC' } });
  }

  async getProvider(id: string, tenantId?: string): Promise<InsuranceProvider> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const provider = await this.providerRepo.findOne({ where });
    if (!provider) throw new NotFoundException('Insurance provider not found');
    return provider;
  }

  async updateProvider(id: string, dto: Partial<CreateProviderDto>, tenantId?: string): Promise<InsuranceProvider> {
    const provider = await this.getProvider(id, tenantId);
    Object.assign(provider, dto);
    return this.providerRepo.save(provider);
  }

  // ============ POLICIES ============
  async createPolicy(dto: CreatePolicyDto, tenantId?: string): Promise<InsurancePolicy> {
    const policy = this.policyRepo.create({
      ...dto,
      effectiveDate: new Date(dto.effectiveDate),
      expiryDate: new Date(dto.expiryDate),
      ...(tenantId ? { tenantId } : {}),
    });
    return this.policyRepo.save(policy);
  }

  async getPolicies(filters: { providerId?: string; patientId?: string; status?: PolicyStatus }, tenantId?: string): Promise<InsurancePolicy[]> {
    const where: any = {};
    if (filters.providerId) where.providerId = filters.providerId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;
    if (tenantId) where.tenantId = tenantId;
    
    return this.policyRepo.find({
      where,
      relations: ['provider', 'patient'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPolicy(id: string, tenantId?: string): Promise<InsurancePolicy> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const policy = await this.policyRepo.findOne({
      where,
      relations: ['provider', 'patient'],
    });
    if (!policy) throw new NotFoundException('Insurance policy not found');
    return policy;
  }

  async getPatientActivePolicies(patientId: string, tenantId?: string): Promise<InsurancePolicy[]> {
    const today = new Date();
    const where: any = {
      patientId,
      status: PolicyStatus.ACTIVE,
      effectiveDate: LessThan(today),
      expiryDate: MoreThan(today),
    };
    if (tenantId) where.tenantId = tenantId;
    return this.policyRepo.find({
      where,
      relations: ['provider'],
    });
  }

  async verifyPolicy(id: string, tenantId?: string): Promise<InsurancePolicy> {
    const policy = await this.getPolicy(id, tenantId);
    policy.isVerified = true;
    policy.verifiedAt = new Date();
    return this.policyRepo.save(policy);
  }

  async updatePolicyStatus(id: string, status: PolicyStatus, tenantId?: string): Promise<InsurancePolicy> {
    const policy = await this.getPolicy(id, tenantId);
    policy.status = status;
    return this.policyRepo.save(policy);
  }

  // ============ CLAIMS ============
  private async generateClaimNumber(facilityId: string): Promise<string> {
    const today = new Date();
    const prefix = `CLM${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.claimRepo.count({ 
      where: { facilityId, claimNumber: Between(`${prefix}0001`, `${prefix}9999`) as any }
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  async createClaim(dto: CreateClaimDto, tenantId?: string): Promise<InsuranceClaim> {
    const policy = await this.getPolicy(dto.policyId, tenantId);

    // Validate policy is active
    if (policy.status !== PolicyStatus.ACTIVE) {
      throw new BadRequestException(`Policy ${policy.policyNumber} is ${policy.status}. Claims require an active policy.`);
    }

    // Validate insurance provider is active
    if (policy.provider && (policy.provider as any).status === 'inactive') {
      throw new BadRequestException(`Insurance provider "${policy.provider.name}" is inactive. Cannot create claims against inactive providers.`);
    }
    
    const claimNumber = await this.generateClaimNumber(dto.facilityId);
    
    const claim = this.claimRepo.create({
      ...dto,
      claimNumber,
      providerId: policy.providerId,
      patientId: policy.patientId,
      serviceDate: new Date(dto.serviceDate),
      admissionDate: dto.admissionDate ? new Date(dto.admissionDate) : undefined,
      dischargeDate: dto.dischargeDate ? new Date(dto.dischargeDate) : undefined,
      totalClaimed: 0,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedClaim = await this.claimRepo.save(claim);

    // Create claim items if provided
    if (dto.items?.length) {
      // Validate claim items
      const seenItems = new Set<string>();
      let totalClaimed = 0;
      for (const itemDto of dto.items) {
        // Validate no negative amounts
        if (itemDto.unitPrice < 0) {
          throw new BadRequestException(`Claim item unit price cannot be negative: ${itemDto.description || itemDto.serviceCode}`);
        }
        if ((itemDto.quantity || 1) <= 0) {
          throw new BadRequestException(`Claim item quantity must be positive: ${itemDto.description || itemDto.serviceCode}`);
        }
        // Check for duplicate items (same service code + same service date)
        const itemKey = `${itemDto.serviceCode}-${itemDto.serviceDate}`;
        if (seenItems.has(itemKey)) {
          throw new BadRequestException(`Duplicate claim item detected: ${itemDto.serviceCode} on ${itemDto.serviceDate}. Each service should be claimed once.`);
        }
        seenItems.add(itemKey);

        const item = this.claimItemRepo.create({
          claimId: savedClaim.id,
          ...itemDto,
          quantity: itemDto.quantity || 1,
          claimedAmount: (itemDto.quantity || 1) * itemDto.unitPrice,
          serviceDate: new Date(itemDto.serviceDate),
          ...(tenantId ? { tenantId } : {}),
        });
        await this.claimItemRepo.save(item);
        totalClaimed += item.claimedAmount;
      }
      savedClaim.totalClaimed = totalClaimed;
      await this.claimRepo.save(savedClaim);
    }

    return this.getClaim(savedClaim.id, tenantId);
  }

  async addClaimItem(claimId: string, dto: CreateClaimItemDto, tenantId?: string): Promise<ClaimItem> {
    const claim = await this.getClaim(claimId, tenantId);
    
    if (claim.status !== ClaimStatus.DRAFT) {
      throw new BadRequestException('Can only add items to draft claims');
    }

    // Validate amounts
    if (dto.unitPrice < 0) {
      throw new BadRequestException('Unit price cannot be negative');
    }
    if ((dto.quantity || 1) <= 0) {
      throw new BadRequestException('Quantity must be positive');
    }

    // Check for duplicate items in this claim
    const existingItems = await this.claimItemRepo.find({
      where: { claimId, ...(tenantId ? { tenantId } : {}) },
    });
    const duplicateItem = existingItems.find(
      (item) => item.serviceCode === dto.serviceCode && 
                 new Date(item.serviceDate).toISOString().slice(0, 10) === new Date(dto.serviceDate).toISOString().slice(0, 10)
    );
    if (duplicateItem) {
      throw new BadRequestException(`Duplicate claim item: ${dto.serviceCode} already exists for ${dto.serviceDate}`);
    }

    const item = this.claimItemRepo.create({
      claimId,
      ...dto,
      quantity: dto.quantity || 1,
      claimedAmount: (dto.quantity || 1) * dto.unitPrice,
      serviceDate: new Date(dto.serviceDate),
      ...(tenantId ? { tenantId } : {}),
    });

    const savedItem = await this.claimItemRepo.save(item);

    // Update claim total
    claim.totalClaimed = Number(claim.totalClaimed) + Number(savedItem.claimedAmount);
    await this.claimRepo.save(claim);

    return savedItem;
  }

  async getClaims(facilityId: string, filters?: {
    status?: ClaimStatus;
    providerId?: string;
    patientId?: string;
    startDate?: string;
    endDate?: string;
  }, tenantId?: string): Promise<InsuranceClaim[]> {
    const query = this.claimRepo
      .createQueryBuilder('claim')
      .leftJoinAndSelect('claim.provider', 'provider')
      .leftJoinAndSelect('claim.policy', 'policy')
      .leftJoinAndSelect('claim.patient', 'patient')
      .where('claim.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      query.andWhere('claim.tenant_id = :tenantId', { tenantId });
    }

    if (filters?.status) {
      query.andWhere('claim.status = :status', { status: filters.status });
    }
    if (filters?.providerId) {
      query.andWhere('claim.providerId = :providerId', { providerId: filters.providerId });
    }
    if (filters?.patientId) {
      query.andWhere('claim.patientId = :patientId', { patientId: filters.patientId });
    }
    if (filters?.startDate) {
      query.andWhere('claim.serviceDate >= :startDate', { startDate: new Date(filters.startDate) });
    }
    if (filters?.endDate) {
      query.andWhere('claim.serviceDate <= :endDate', { endDate: new Date(filters.endDate) });
    }

    return query.orderBy('claim.createdAt', 'DESC').getMany();
  }

  async getClaim(id: string, tenantId?: string): Promise<InsuranceClaim> {
    const claim = await this.claimRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['provider', 'policy', 'patient', 'items', 'submittedBy', 'encounter'],
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  async submitClaim(id: string, userId: string, tenantId?: string): Promise<InsuranceClaim> {
    const claim = await this.getClaim(id, tenantId);
    
    if (claim.status !== ClaimStatus.DRAFT) {
      throw new BadRequestException('Claim is not in draft status');
    }

    if (!claim.items?.length) {
      throw new BadRequestException('Claim must have at least one item');
    }

    claim.status = ClaimStatus.SUBMITTED;
    claim.submittedAt = new Date();
    claim.submittedById = userId;

    return this.claimRepo.save(claim);
  }

  async processClaim(id: string, dto: ProcessClaimDto, approve: boolean, tenantId?: string): Promise<InsuranceClaim> {
    const claim = await this.getClaim(id, tenantId);

    if (claim.status !== ClaimStatus.SUBMITTED && claim.status !== ClaimStatus.IN_REVIEW) {
      throw new BadRequestException('Claim cannot be processed in current status');
    }

    claim.reviewedAt = new Date();

    if (approve) {
      claim.totalApproved = dto.approvedAmount;
      claim.patientResponsibility = Number(claim.totalClaimed) - dto.approvedAmount;
      
      if (dto.approvedAmount >= Number(claim.totalClaimed)) {
        claim.status = ClaimStatus.APPROVED;
      } else if (dto.approvedAmount > 0) {
        claim.status = ClaimStatus.PARTIALLY_APPROVED;
      } else {
        claim.status = ClaimStatus.REJECTED;
        claim.denialReason = dto.denialReason;
        claim.denialCode = dto.denialCode;
      }
    } else {
      claim.status = ClaimStatus.REJECTED;
      claim.denialReason = dto.denialReason;
      claim.denialCode = dto.denialCode;
      claim.totalApproved = 0;
      claim.patientResponsibility = Number(claim.totalClaimed);
    }

    if (dto.notes) claim.notes = dto.notes;

    return this.claimRepo.save(claim);
  }

  async recordPayment(id: string, dto: RecordPaymentDto, tenantId?: string): Promise<InsuranceClaim> {
    const claim = await this.getClaim(id, tenantId);

    if (claim.status !== ClaimStatus.APPROVED && claim.status !== ClaimStatus.PARTIALLY_APPROVED) {
      throw new BadRequestException('Claim must be approved to record payment');
    }

    claim.totalPaid = dto.paidAmount;
    claim.paymentReference = dto.paymentReference;
    claim.paidAt = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
    claim.status = ClaimStatus.PAID;

    // Update policy used amount
    const policy = await this.getPolicy(claim.policyId, tenantId);
    policy.usedAmount = Number(policy.usedAmount) + dto.paidAmount;
    await this.policyRepo.save(policy);

    const saved = await this.claimRepo.save(claim);

    // Auto-post GL entry: DR Cash/Bank, CR Accounts Receivable
    if (claim.facilityId) {
      this.financeService.autoPostInsurancePaymentJournal({
        facilityId: claim.facilityId,
        claimNumber: claim.claimNumber,
        amount: dto.paidAmount,
        paymentReference: dto.paymentReference,
        userId: 'system',
      }, tenantId).catch(err => {
        this.logger.warn(`GL auto-post failed for insurance claim ${claim.claimNumber}: ${err.message}`);
      });
    }

    return saved;
  }

  // ============ PRE-AUTHORIZATIONS ============
  private async generatePreAuthNumber(facilityId: string): Promise<string> {
    const today = new Date();
    const prefix = `PA${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.preAuthRepo.count({ 
      where: { facilityId, authNumber: Between(`${prefix}0001`, `${prefix}9999`) as any }
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  async createPreAuth(dto: CreatePreAuthDto, userId: string, tenantId?: string): Promise<PreAuthorization> {
    const policy = await this.getPolicy(dto.policyId, tenantId);

    // Validate estimated cost is positive
    if (dto.estimatedCost !== undefined && dto.estimatedCost <= 0) {
      throw new BadRequestException('Estimated cost must be positive');
    }

    // Validate against policy coverage limit
    if (policy.annualLimit && dto.estimatedCost > Number(policy.annualLimit)) {
      throw new BadRequestException(
        `Estimated cost ${dto.estimatedCost} exceeds policy annual limit of ${policy.annualLimit}. Adjust the estimated cost or contact the insurer.`
      );
    }

    // Validate policy is active
    if (policy.status !== PolicyStatus.ACTIVE) {
      throw new BadRequestException(`Policy ${policy.policyNumber} is ${policy.status}. Pre-authorization requires an active policy.`);
    }
    
    const authNumber = await this.generatePreAuthNumber(dto.facilityId);
    
    const preAuth = this.preAuthRepo.create({
      ...dto,
      authNumber,
      patientId: policy.patientId,
      requestedById: userId,
      expectedAdmissionDate: dto.expectedAdmissionDate ? new Date(dto.expectedAdmissionDate) : undefined,
      expectedDischargeDate: dto.expectedDischargeDate ? new Date(dto.expectedDischargeDate) : undefined,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.preAuthRepo.save(preAuth);
  }

  async getPreAuths(facilityId: string, filters?: {
    status?: PreAuthStatus;
    patientId?: string;
    policyId?: string;
  }, tenantId?: string): Promise<PreAuthorization[]> {
    const where: any = { facilityId };
    if (tenantId) where.tenantId = tenantId;
    if (filters?.status) where.status = filters.status;
    if (filters?.patientId) where.patientId = filters.patientId;
    if (filters?.policyId) where.policyId = filters.policyId;

    return this.preAuthRepo.find({
      where,
      relations: ['policy', 'policy.provider', 'patient', 'requestedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async getPreAuth(id: string, tenantId?: string): Promise<PreAuthorization> {
    const preAuth = await this.preAuthRepo.findOne({
      where: { id , ...(tenantId ? { tenantId } : {}) },
      relations: ['policy', 'policy.provider', 'patient', 'requestedBy'],
    });
    if (!preAuth) throw new NotFoundException('Pre-authorization not found');
    return preAuth;
  }

  async submitPreAuth(id: string, tenantId?: string): Promise<PreAuthorization> {
    const preAuth = await this.getPreAuth(id, tenantId);
    
    if (preAuth.status !== PreAuthStatus.PENDING) {
      throw new BadRequestException('Pre-authorization already submitted');
    }

    preAuth.status = PreAuthStatus.SUBMITTED;
    return this.preAuthRepo.save(preAuth);
  }

  async processPreAuth(id: string, dto: ProcessPreAuthDto, approve: boolean, tenantId?: string): Promise<PreAuthorization> {
    const preAuth = await this.getPreAuth(id, tenantId);

    if (preAuth.status !== PreAuthStatus.SUBMITTED && preAuth.status !== PreAuthStatus.PENDING) {
      throw new BadRequestException('Pre-authorization cannot be processed');
    }

    preAuth.approvedAt = new Date();

    if (approve) {
      preAuth.approvedAmount = dto.approvedAmount;
      if (dto.validFrom) preAuth.validFrom = new Date(dto.validFrom);
      if (dto.validUntil) preAuth.validUntil = new Date(dto.validUntil);
      if (dto.insurerReference) preAuth.insurerReference = dto.insurerReference;
      
      if (dto.approvedAmount >= Number(preAuth.estimatedCost)) {
        preAuth.status = PreAuthStatus.APPROVED;
      } else if (dto.approvedAmount > 0) {
        preAuth.status = PreAuthStatus.PARTIALLY_APPROVED;
      } else {
        preAuth.status = PreAuthStatus.DENIED;
        preAuth.denialReason = dto.denialReason;
      }
    } else {
      preAuth.status = PreAuthStatus.DENIED;
      preAuth.denialReason = dto.denialReason;
      preAuth.approvedAmount = 0;
    }

    if (dto.notes) preAuth.notes = dto.notes;

    return this.preAuthRepo.save(preAuth);
  }

  // ============ REPORTS ============
  async getClaimStatusReport(facilityId: string, startDate: string, endDate: string, tenantId?: string) {
    const qb = this.claimRepo
      .createQueryBuilder('claim')
      .select('claim.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(claim.totalClaimed)', 'totalClaimed')
      .addSelect('SUM(claim.totalApproved)', 'totalApproved')
      .addSelect('SUM(claim.totalPaid)', 'totalPaid')
      .where('claim.facilityId = :facilityId', { facilityId })
      .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    if (tenantId) qb.andWhere('claim.tenant_id = :tenantId', { tenantId });
    const claims = await qb.groupBy('claim.status').getRawMany();

    return claims;
  }

  async getDenialsAnalysis(facilityId: string, startDate: string, endDate: string, tenantId?: string) {
    const qb = this.claimRepo
      .createQueryBuilder('claim')
      .select('claim.denialCode', 'code')
      .addSelect('claim.denialReason', 'reason')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(claim.totalClaimed)', 'totalClaimed')
      .where('claim.facilityId = :facilityId', { facilityId })
      .andWhere('claim.status = :status', { status: ClaimStatus.REJECTED })
      .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    if (tenantId) qb.andWhere('claim.tenant_id = :tenantId', { tenantId });
    const denials = await qb
      .groupBy('claim.denialCode')
      .addGroupBy('claim.denialReason')
      .orderBy('count', 'DESC')
      .getRawMany();

    return denials;
  }

  async getProviderPerformance(facilityId: string, startDate: string, endDate: string, tenantId?: string) {
    const qb = this.claimRepo
      .createQueryBuilder('claim')
      .leftJoin('claim.provider', 'provider')
      .select('provider.id', 'providerId')
      .addSelect('provider.name', 'providerName')
      .addSelect('COUNT(*)', 'totalClaims')
      .addSelect('SUM(CASE WHEN claim.status = :paid THEN 1 ELSE 0 END)', 'paidClaims')
      .addSelect('SUM(CASE WHEN claim.status = :rejected THEN 1 ELSE 0 END)', 'rejectedClaims')
      .addSelect('SUM(claim.totalClaimed)', 'totalClaimed')
      .addSelect('SUM(claim.totalPaid)', 'totalPaid')
      .addSelect('AVG(EXTRACT(EPOCH FROM (claim.paidAt - claim.submittedAt)) / 86400)', 'avgDaysToPayment')
      .where('claim.facilityId = :facilityId', { facilityId })
      .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
      .setParameter('paid', ClaimStatus.PAID)
      .setParameter('rejected', ClaimStatus.REJECTED);
    if (tenantId) qb.andWhere('claim.tenant_id = :tenantId', { tenantId });
    const performance = await qb
      .groupBy('provider.id')
      .addGroupBy('provider.name')
      .orderBy('totalClaimed', 'DESC')
      .getRawMany();

    return performance;
  }

  // ============ INSURANCE ENCOUNTERS AWAITING CLAIMS ============
  /**
   * Get encounters for insurance patients that don't have claims created yet.
   * These are encounters where:
   * 1. payerType = 'insurance'
   * 2. Have an associated invoice with items
   * 3. No claim exists for this encounter yet
   */
  async getEncountersAwaitingClaims(facilityId: string, filters?: {
    providerId?: string;
    startDate?: string;
    endDate?: string;
  }, tenantId?: string): Promise<any[]> {
    const qb = this.encounterRepo
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('encounter.insurancePolicy', 'policy')
      .leftJoinAndSelect('policy.provider', 'provider')
      .leftJoin('invoices', 'invoice', 'invoice.encounter_id = encounter.id')
      .leftJoin('invoice_items', 'item', 'item.invoice_id = invoice.id')
      .leftJoin('insurance_claims', 'claim', 'claim.encounter_id = encounter.id')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.payer_type = :payerType', { payerType: PayerType.INSURANCE })
      .andWhere('claim.id IS NULL') // No claim created yet
      .andWhere('invoice.id IS NOT NULL') // Has an invoice
      .select([
        'encounter.id',
        'encounter.visitNumber',
        'encounter.type',
        'encounter.status',
        'encounter.startTime',
        'encounter.endTime',
        'patient.id',
        'patient.mrn',
        'patient.fullName',
        'policy.id',
        'policy.policyNumber',
        'policy.memberNumber',
        'provider.id',
        'provider.name',
        'provider.code',
      ])
      .addSelect('invoice.id', 'invoiceId')
      .addSelect('invoice.invoice_number', 'invoiceNumber')
      .addSelect('invoice.total_amount', 'totalAmount')
      .addSelect('COUNT(item.id)', 'itemCount');
    if (tenantId) qb.andWhere('encounter.tenant_id = :tenantId', { tenantId });

    if (filters?.providerId) {
      qb.andWhere('provider.id = :providerId', { providerId: filters.providerId });
    }

    if (filters?.startDate) {
      qb.andWhere('encounter.start_time >= :startDate', { startDate: new Date(filters.startDate) });
    }

    if (filters?.endDate) {
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      qb.andWhere('encounter.start_time <= :endDate', { endDate });
    }

    qb.groupBy('encounter.id')
      .addGroupBy('patient.id')
      .addGroupBy('policy.id')
      .addGroupBy('provider.id')
      .addGroupBy('invoice.id')
      .orderBy('encounter.start_time', 'DESC');

    const rawResults = await qb.getRawMany();

    // Transform to a cleaner format
    return rawResults.map(r => ({
      encounterId: r.encounter_id,
      visitNumber: r.encounter_visit_number,
      encounterType: r.encounter_type,
      encounterStatus: r.encounter_status,
      serviceDate: r.encounter_start_time,
      endDate: r.encounter_end_time,
      patient: {
        id: r.patient_id,
        mrn: r.patient_mrn,
        fullName: r.patient_full_name,
      },
      insurancePolicy: {
        id: r.policy_id,
        policyNumber: r.policy_policy_number,
        memberNumber: r.policy_member_number,
      },
      provider: {
        id: r.provider_id,
        name: r.provider_name,
        code: r.provider_code,
      },
      invoice: {
        id: r.invoiceId,
        invoiceNumber: r.invoiceNumber,
        totalAmount: parseFloat(r.totalAmount) || 0,
        itemCount: parseInt(r.itemCount) || 0,
      },
    }));
  }

  /**
   * Create a claim from an encounter with all its invoice items
   */
  async createClaimFromEncounter(encounterId: string, facilityId: string, tenantId?: string): Promise<InsuranceClaim> {
    // Get the encounter with policy
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, facilityId , ...(tenantId ? { tenantId } : {}) },
      relations: ['insurancePolicy', 'patient'],
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    if (encounter.payerType !== PayerType.INSURANCE) {
      throw new BadRequestException('This encounter is not an insurance encounter');
    }

    if (!encounter.insurancePolicyId) {
      throw new BadRequestException('No insurance policy associated with this encounter');
    }

    // Check if claim already exists
    const existingClaim = await this.claimRepo.findOne({
      where: { encounterId , ...(tenantId ? { tenantId } : {}) },
    });

    if (existingClaim) {
      throw new BadRequestException('A claim already exists for this encounter');
    }

    // Get the invoice for this encounter
    const invoice = await this.invoiceRepo.findOne({
      where: { encounterId , ...(tenantId ? { tenantId } : {}) },
      relations: ['items'],
    });

    if (!invoice) {
      throw new BadRequestException('No invoice found for this encounter');
    }

    // Generate claim number
    const today = new Date();
    const prefix = `CLM${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await this.claimRepo.count({
      where: { facilityId , ...(tenantId ? { tenantId } : {}) },
    });
    const claimNumber = `${prefix}${String(count + 1).padStart(5, '0')}`;

    // Get the policy to get provider info
    const policy = await this.policyRepo.findOne({
      where: { id: encounter.insurancePolicyId , ...(tenantId ? { tenantId } : {}) },
    });

    if (!policy) {
      throw new BadRequestException('Insurance policy not found');
    }

    // Determine claim type from encounter type
    const claimTypeMap: Record<string, any> = {
      'opd': 'outpatient',
      'ipd': 'inpatient',
      'emergency': 'emergency',
      'surgical': 'surgical',
    };
    const claimType = claimTypeMap[encounter.type] || 'outpatient';

    // Create the claim
    const claim = this.claimRepo.create({
      claimNumber,
      facilityId,
      providerId: policy.providerId,
      policyId: encounter.insurancePolicyId,
      patientId: encounter.patientId,
      encounterId,
      invoiceId: invoice.id,
      claimType,
      primaryDiagnosis: encounter.chiefComplaint || 'General Consultation',
      totalClaimed: invoice.totalAmount,
      status: ClaimStatus.DRAFT,
      serviceDate: encounter.startTime,
      ...(tenantId ? { tenantId } : {}),
    });

    const savedClaim = await this.claimRepo.save(claim);

    // Create claim items from invoice items
    if (invoice.items?.length > 0) {
      const claimItems = invoice.items.map(item => this.claimItemRepo.create({
        claimId: savedClaim.id,
        itemType: ClaimItemType.OTHER,
        serviceCode: item.serviceCode || 'SVC',
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        claimedAmount: item.amount,
        serviceDate: encounter.startTime,
        status: ClaimItemStatus.PENDING,
        ...(tenantId ? { tenantId } : {}),
      }));

      await this.claimItemRepo.save(claimItems);
    }

    return savedClaim;
  }
}
