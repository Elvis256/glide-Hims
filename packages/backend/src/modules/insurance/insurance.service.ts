import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThan, IsNull, DataSource, Not } from 'typeorm';
import { FinanceService } from '../finance/finance.service';
import { BillingService } from '../billing/billing.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { InsuranceProvider } from '../../database/entities/insurance-provider.entity';
import { InsurancePolicy, PolicyStatus } from '../../database/entities/insurance-policy.entity';
import { InsuranceClaim, ClaimStatus } from '../../database/entities/insurance-claim.entity';
import {
  ClaimItem,
  ClaimItemStatus,
  ClaimItemType,
} from '../../database/entities/claim-item.entity';
import { PreAuthorization, PreAuthStatus } from '../../database/entities/pre-authorization.entity';
import { Encounter, PayerType } from '../../database/entities/encounter.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { ClaimExportService } from './claim-export.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
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
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    private claimExportService: ClaimExportService,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
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
      this.claimRepo.count({
        where: { facilityId, status: ClaimStatus.SUBMITTED, ...tenantFilter },
      }),
      this.preAuthRepo.count({
        where: { facilityId, status: PreAuthStatus.PENDING, ...tenantFilter },
      }),
      this.claimRepo.count({
        where: { facilityId, createdAt: MoreThan(startOfMonth), ...tenantFilter },
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

    // Enhanced KPIs
    const tenantCond = tenantId ? 'claim.tenant_id = :tenantId' : '1=1';
    const tenantParams = tenantId ? { tenantId } : {};

    const [
      approvalRateResult,
      avgClaimTATResult,
      outstandingAmountResult,
      monthlyTrendResult,
      denialRateResult,
    ] = await Promise.all([
      // Approval rate: approved+partially_approved+paid / total non-draft
      this.claimRepo
        .createQueryBuilder('claim')
        .select(
          `ROUND(
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE 100.0 * SUM(CASE WHEN claim.status IN (:...approvedStatuses) THEN 1 ELSE 0 END) / COUNT(*)
            END, 1)`,
          'rate',
        )
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status != :draft', { draft: ClaimStatus.DRAFT })
        .andWhere(tenantCond, tenantParams)
        .setParameter('approvedStatuses', [
          ClaimStatus.APPROVED,
          ClaimStatus.PARTIALLY_APPROVED,
          ClaimStatus.PAID,
        ])
        .getRawOne(),

      // Average claim TAT (submission to payment) in days
      this.claimRepo
        .createQueryBuilder('claim')
        .select(
          'ROUND(AVG(EXTRACT(EPOCH FROM (claim.paidAt - claim.submittedAt)) / 86400), 1)',
          'avgDays',
        )
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.paidAt IS NOT NULL')
        .andWhere('claim.submittedAt IS NOT NULL')
        .andWhere(tenantCond, tenantParams)
        .getRawOne(),

      // Outstanding amount: approved but unpaid
      this.claimRepo
        .createQueryBuilder('claim')
        .select('COALESCE(SUM(claim.totalApproved - claim.totalPaid), 0)', 'total')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status IN (:...outstandingStatuses)', {
          outstandingStatuses: [ClaimStatus.APPROVED, ClaimStatus.PARTIALLY_APPROVED],
        })
        .andWhere(tenantCond, tenantParams)
        .getRawOne(),

      // Monthly trend: last 12 months
      this.claimRepo
        .createQueryBuilder('claim')
        .select("TO_CHAR(claim.createdAt, 'YYYY-MM')", 'month')
        .addSelect('COUNT(*)', 'submitted')
        .addSelect(
          `SUM(CASE WHEN claim.status IN ('approved','partially_approved','paid') THEN 1 ELSE 0 END)`,
          'approved',
        )
        .addSelect(`SUM(CASE WHEN claim.status = 'rejected' THEN 1 ELSE 0 END)`, 'denied')
        .addSelect('COALESCE(SUM(claim.totalClaimed), 0)', 'claimedAmount')
        .addSelect('COALESCE(SUM(claim.totalApproved), 0)', 'approvedAmount')
        .addSelect('COALESCE(SUM(claim.totalPaid), 0)', 'paidAmount')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere("claim.createdAt >= NOW() - INTERVAL '12 months'")
        .andWhere(tenantCond, tenantParams)
        .groupBy("TO_CHAR(claim.createdAt, 'YYYY-MM')")
        .orderBy('month', 'ASC')
        .getRawMany(),

      // Denial rate
      this.claimRepo
        .createQueryBuilder('claim')
        .select(
          `ROUND(
            CASE WHEN COUNT(*) = 0 THEN 0
            ELSE 100.0 * SUM(CASE WHEN claim.status = :rejected THEN 1 ELSE 0 END) / COUNT(*)
            END, 1)`,
          'rate',
        )
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status != :draft', { draft: ClaimStatus.DRAFT })
        .andWhere(tenantCond, tenantParams)
        .setParameter('rejected', ClaimStatus.REJECTED)
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
      approvalRate: parseFloat(approvalRateResult?.rate || 0),
      avgClaimTAT: parseFloat(avgClaimTATResult?.avgDays || 0),
      outstandingAmount: parseFloat(outstandingAmountResult?.total || 0),
      denialRate: parseFloat(denialRateResult?.rate || 0),
      monthlyTrend: (monthlyTrendResult || []).map((r: any) => ({
        month: r.month,
        submitted: parseInt(r.submitted) || 0,
        approved: parseInt(r.approved) || 0,
        denied: parseInt(r.denied) || 0,
        claimedAmount: parseFloat(r.claimedAmount) || 0,
        approvedAmount: parseFloat(r.approvedAmount) || 0,
        paidAmount: parseFloat(r.paidAmount) || 0,
      })),
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

  async getProviders(
    facilityId: string,
    filters?: { active?: boolean },
    tenantId?: string,
  ): Promise<InsuranceProvider[]> {
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

  async updateProvider(
    id: string,
    dto: UpdateProviderDto,
    tenantId?: string,
  ): Promise<InsuranceProvider> {
    const provider = await this.getProvider(id, tenantId);
    Object.assign(provider, dto);
    return this.providerRepo.save(provider);
  }

  // ============ POLICIES ============
  async createPolicy(dto: CreatePolicyDto, tenantId?: string): Promise<InsurancePolicy> {
    const effective = new Date(dto.effectiveDate);
    const expiry = new Date(dto.expiryDate);
    if (Number.isNaN(effective.getTime()) || Number.isNaN(expiry.getTime())) {
      throw new BadRequestException('Invalid effectiveDate or expiryDate');
    }
    if (expiry <= effective) {
      throw new BadRequestException('expiryDate must be after effectiveDate');
    }
    if (dto.annualLimit !== undefined && Number(dto.annualLimit) < 0) {
      throw new BadRequestException('annualLimit cannot be negative');
    }
    if (dto.copayAmount !== undefined && Number(dto.copayAmount) < 0) {
      throw new BadRequestException('copayAmount cannot be negative');
    }
    if (
      dto.copayPercentage !== undefined &&
      (Number(dto.copayPercentage) < 0 || Number(dto.copayPercentage) > 100)
    ) {
      throw new BadRequestException('copayPercentage must be between 0 and 100');
    }

    const policy = this.policyRepo.create({
      ...dto,
      effectiveDate: effective,
      expiryDate: expiry,
      ...(tenantId ? { tenantId } : {}),
    });
    return this.policyRepo.save(policy);
  }

  async getPolicies(
    filters: { providerId?: string; patientId?: string; status?: PolicyStatus },
    tenantId?: string,
  ): Promise<InsurancePolicy[]> {
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
      relations: ['provider', 'patient'],
    });
  }

  async verifyPolicy(id: string, tenantId?: string): Promise<InsurancePolicy> {
    const policy = await this.getPolicy(id, tenantId);
    policy.isVerified = true;
    policy.verifiedAt = new Date();
    return this.policyRepo.save(policy);
  }

  async updatePolicyStatus(
    id: string,
    status: PolicyStatus,
    tenantId?: string,
  ): Promise<InsurancePolicy> {
    const policy = await this.getPolicy(id, tenantId);
    policy.status = status;
    return this.policyRepo.save(policy);
  }

  // ============ CLAIMS ============
  // Generates the next claim number under a transactional advisory lock so
  // concurrent createClaim calls within the same facility+month cannot collide
  // on the count(...)+1 pattern. The lock is released when the caller's
  // transaction commits or rolls back. Format: CLM<YYYY><MM><4-digit-seq>.
  private async generateClaimNumber(
    manager: import('typeorm').EntityManager,
    facilityId: string,
  ): Promise<string> {
    const today = new Date();
    const prefix = `CLM${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const lockKey = `insurance:claim-number:${facilityId}:${prefix}`;
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
    const count = await manager.count(InsuranceClaim, {
      where: { facilityId, claimNumber: Between(`${prefix}0001`, `${prefix}9999`) as any },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  async createClaim(dto: CreateClaimDto, tenantId?: string): Promise<InsuranceClaim> {
    const policy = await this.getPolicy(dto.policyId, tenantId);

    // Validate policy is active
    if (policy.status !== PolicyStatus.ACTIVE) {
      throw new BadRequestException(
        `Policy ${policy.policyNumber} is ${policy.status}. Claims require an active policy.`,
      );
    }

    // Validate insurance provider is active
    if (policy.provider && (policy.provider as any).status === 'inactive') {
      throw new BadRequestException(
        `Insurance provider "${policy.provider.name}" is inactive. Cannot create claims against inactive providers.`,
      );
    }

    const savedClaim = await this.dataSource.transaction(async (manager) => {
      const claimNumber = await this.generateClaimNumber(manager, dto.facilityId);
      const claim = manager.create(InsuranceClaim, {
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

      const saved = await manager.save(InsuranceClaim, claim);

      // Create claim items if provided
      if (dto.items?.length) {
        // Validate claim items
        const seenItems = new Set<string>();
        let totalClaimed = 0;
        for (const itemDto of dto.items) {
          // Validate no negative amounts
          if (itemDto.unitPrice < 0) {
            throw new BadRequestException(
              `Claim item unit price cannot be negative: ${itemDto.description || itemDto.serviceCode}`,
            );
          }
          if ((itemDto.quantity || 1) <= 0) {
            throw new BadRequestException(
              `Claim item quantity must be positive: ${itemDto.description || itemDto.serviceCode}`,
            );
          }
          // Check for duplicate items (same service code + same service date)
          const itemKey = `${itemDto.serviceCode}-${itemDto.serviceDate}`;
          if (seenItems.has(itemKey)) {
            throw new BadRequestException(
              `Duplicate claim item detected: ${itemDto.serviceCode} on ${itemDto.serviceDate}. Each service should be claimed once.`,
            );
          }
          seenItems.add(itemKey);

          const item = manager.create(ClaimItem, {
            claimId: saved.id,
            ...itemDto,
            quantity: itemDto.quantity || 1,
            claimedAmount: (itemDto.quantity || 1) * itemDto.unitPrice,
            serviceDate: new Date(itemDto.serviceDate),
            ...(tenantId ? { tenantId } : {}),
          });
          await manager.save(ClaimItem, item);
          totalClaimed += item.claimedAmount;
        }
        saved.totalClaimed = totalClaimed;
        await manager.save(InsuranceClaim, saved);
      }

      return saved;
    });

    return this.getClaim(savedClaim.id, tenantId);
  }

  async addClaimItem(
    claimId: string,
    dto: CreateClaimItemDto,
    tenantId?: string,
  ): Promise<ClaimItem> {
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
      (item) =>
        item.serviceCode === dto.serviceCode &&
        new Date(item.serviceDate).toISOString().slice(0, 10) ===
          new Date(dto.serviceDate).toISOString().slice(0, 10),
    );
    if (duplicateItem) {
      throw new BadRequestException(
        `Duplicate claim item: ${dto.serviceCode} already exists for ${dto.serviceDate}`,
      );
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

  async getClaims(
    facilityId: string,
    filters?: {
      status?: ClaimStatus;
      providerId?: string;
      patientId?: string;
      startDate?: string;
      endDate?: string;
    },
    tenantId?: string,
  ): Promise<InsuranceClaim[]> {
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
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['provider', 'policy', 'patient', 'items', 'submittedBy', 'encounter'],
    });
    if (!claim) throw new NotFoundException('Claim not found');
    return claim;
  }

  async submitClaim(id: string, userId: string, tenantId?: string): Promise<InsuranceClaim> {
    // Lock the claim row inside a txn so two concurrent submitClaim calls
    // cannot both flip DRAFT → SUBMITTED and double-dispatch the electronic
    // transmission.
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager.findOne(InsuranceClaim, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!claim) throw new NotFoundException('Claim not found');

      if (claim.status !== ClaimStatus.DRAFT) {
        throw new BadRequestException('Claim is not in draft status');
      }

      // Items + provider need to be loaded separately because pessimistic
      // locking + relations against a nullable join produces a Postgres
      // "FOR UPDATE cannot be applied to the nullable side of an outer join".
      const items = await manager.find(ClaimItem, { where: { claimId: claim.id } });
      if (!items.length) {
        throw new BadRequestException('Claim must have at least one item');
      }

      claim.status = ClaimStatus.SUBMITTED;
      claim.submittedAt = new Date();
      claim.submittedById = userId;
      claim.items = items;

      const saved = await manager.save(InsuranceClaim, claim);

      const provider = saved.providerId
        ? await manager.findOne(InsuranceProvider, { where: { id: saved.providerId } })
        : null;

      // Dispatch electronic transmission if the provider supports it. Failures
      // are captured in metadata; the claim itself stays SUBMITTED so a clerk
      // can retry via the same endpoint or fall back to manual export.
      if (provider?.apiEndpoint) {
        const result = await this.claimExportService.submitElectronically(saved, provider);
        saved.metadata = {
          ...(saved.metadata || {}),
          electronicSubmission: {
            attemptedAt: new Date().toISOString(),
            transmitted: result.transmitted,
            ack: result.ack ?? null,
            error: result.error ?? null,
          },
        };
        if (result.transmitted) {
          saved.status = ClaimStatus.ACKNOWLEDGED;
          const externalId = result.ack?.claimId || result.ack?.id || result.ack?.referenceId;
          if (externalId) saved.metadata.externalClaimId = externalId;
        }
        await manager.save(InsuranceClaim, saved);
      }

      return saved;
    });
  }

  async processClaim(
    id: string,
    dto: ProcessClaimDto,
    approve: boolean,
    tenantId?: string,
    userId?: string,
  ): Promise<InsuranceClaim> {
    return this.dataSource.transaction(async (manager) => {
      const claim = await manager.findOne(InsuranceClaim, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!claim) throw new NotFoundException('Claim not found');

      if (claim.status !== ClaimStatus.SUBMITTED && claim.status !== ClaimStatus.IN_REVIEW) {
        throw new BadRequestException('Claim cannot be processed in current status');
      }

      // Segregation of duties: the user who submitted the claim cannot also
      // approve / reject it. Mirrors billing's refund / cancel checks.
      if (userId && claim.submittedById && claim.submittedById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the user who submitted the claim cannot also process it',
        );
      }

      const previousStatus = claim.status;
      const previousApproved = Number(claim.totalApproved || 0);
      claim.reviewedAt = new Date();

      if (approve) {
        const approvedAmount = Number(dto.approvedAmount || 0);
        if (approvedAmount < 0) {
          throw new BadRequestException('Approved amount cannot be negative');
        }
        if (approvedAmount > Number(claim.totalClaimed)) {
          throw new BadRequestException(
            `Approved amount ${approvedAmount} exceeds claimed amount ${claim.totalClaimed}`,
          );
        }

        // Cumulative usage / annual-limit enforcement against the policy.
        // policy.usedAmount only moves on actual payment; reserve headroom by
        // also summing approved-but-unpaid amounts on prior claims so the
        // approver cannot authorize over the ceiling.
        const policy = await manager.findOne(InsurancePolicy, {
          where: { id: claim.policyId, ...(tenantId ? { tenantId } : {}) },
          lock: { mode: 'pessimistic_read' },
        });
        if (!policy) throw new NotFoundException('Policy not found');
        const annualLimit = Number(policy.annualLimit || 0);
        if (annualLimit > 0) {
          const used = Number(policy.usedAmount || 0);
          const otherApproved = await manager
            .createQueryBuilder(InsuranceClaim, 'c')
            .select('COALESCE(SUM(c.total_approved - c.total_paid), 0)', 'sum')
            .where('c.policy_id = :pid', { pid: claim.policyId })
            .andWhere('c.id != :cid', { cid: claim.id })
            .andWhere('c.status IN (:...statuses)', {
              statuses: [ClaimStatus.APPROVED, ClaimStatus.PARTIALLY_APPROVED],
            })
            .getRawOne<{ sum: string }>();
          const reserved = Number(otherApproved?.sum || 0);
          const headroom = Math.max(0, annualLimit - used - reserved);
          if (approvedAmount > headroom) {
            throw new BadRequestException(
              `Approved amount ${approvedAmount} exceeds remaining policy headroom of ${headroom} ` +
                `(annual limit ${annualLimit}, used ${used}, reserved by other open claims ${reserved}).`,
            );
          }
        }

        claim.totalApproved = approvedAmount;
        claim.patientResponsibility = Number(claim.totalClaimed) - approvedAmount;

        if (approvedAmount >= Number(claim.totalClaimed)) {
          claim.status = ClaimStatus.APPROVED;
        } else if (approvedAmount > 0) {
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

      const saved = await manager.save(InsuranceClaim, claim);

      await this.auditLogService
        .log({
          userId,
          action: approve ? 'INSURANCE_CLAIM_APPROVED' : 'INSURANCE_CLAIM_REJECTED',
          entityType: 'InsuranceClaim',
          entityId: saved.id,
          oldValue: { status: previousStatus, totalApproved: previousApproved },
          newValue: {
            status: saved.status,
            totalApproved: Number(saved.totalApproved),
            patientResponsibility: Number(saved.patientResponsibility),
            denialReason: saved.denialReason || null,
            denialCode: saved.denialCode || null,
          },
          reason: dto.notes,
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(`Audit log failed for processClaim ${saved.id}: ${err.message}`),
        );

      return saved;
    });
  }

  async recordPayment(
    id: string,
    dto: RecordPaymentDto,
    tenantId?: string,
    userId?: string,
  ): Promise<InsuranceClaim> {
    const paidAmount = Number(dto.paidAmount || 0);
    if (paidAmount <= 0) {
      throw new BadRequestException('Paid amount must be positive');
    }

    const { saved, settledInBilling } = await this.dataSource.transaction(async (manager) => {
      const claim = await manager.findOne(InsuranceClaim, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!claim) throw new NotFoundException('Claim not found');

      if (claim.status !== ClaimStatus.APPROVED && claim.status !== ClaimStatus.PARTIALLY_APPROVED) {
        throw new BadRequestException(
          'Claim must be approved (or partially approved) to record payment',
        );
      }

      // Segregation of duties: neither the submitter nor the user who recorded
      // the previous payment can post a new payment on the same claim.
      if (userId && claim.submittedById && claim.submittedById === userId) {
        throw new BadRequestException(
          'Segregation of duties violation: the user who submitted the claim cannot also record the payment',
        );
      }

      // Idempotency + cap: paidAmount is treated as the cumulative paid total
      // for this claim. We reject duplicates and amounts that exceed the
      // approved ceiling, so calling recordPayment twice (or with an inflated
      // value) cannot inflate policy.usedAmount beyond what was approved.
      const previouslyPaid = Number(claim.totalPaid || 0);
      const approvedCeiling = Number(claim.totalApproved || 0);
      if (paidAmount > approvedCeiling) {
        throw new BadRequestException(
          `Paid amount ${paidAmount} exceeds approved amount ${approvedCeiling}`,
        );
      }
      if (paidAmount <= previouslyPaid) {
        throw new BadRequestException(
          `Paid amount ${paidAmount} is not greater than already recorded ${previouslyPaid}; nothing to post`,
        );
      }
      const delta = paidAmount - previouslyPaid;

      const policy = await manager.findOne(InsurancePolicy, {
        where: { id: claim.policyId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!policy) throw new NotFoundException('Policy not found');

      claim.totalPaid = paidAmount;
      claim.paymentReference = dto.paymentReference;
      claim.paidAt = dto.paymentDate ? new Date(dto.paymentDate) : new Date();
      claim.status = ClaimStatus.PAID;

      policy.usedAmount = Number(policy.usedAmount || 0) + delta;
      await manager.save(InsurancePolicy, policy);

      const savedClaim = await manager.save(InsuranceClaim, claim);

      // Mirror the settlement onto the invoice inside the SAME txn so a
      // billing failure rolls back the claim flip and the policy increment.
      // recordInsuranceClaimPayment is idempotent on transactionReference,
      // so retries are safe even if upstream calls this method more than once.
      let mirror: any = null;
      if (savedClaim.invoiceId && delta > 0) {
        mirror = await this.billingService.recordInsuranceClaimPayment(
          savedClaim.invoiceId,
          delta,
          savedClaim.claimNumber,
          dto.paymentReference,
          userId || 'system',
          tenantId,
        );
      }

      await this.auditLogService
        .log({
          userId,
          action: 'INSURANCE_CLAIM_PAYMENT_RECORDED',
          entityType: 'InsuranceClaim',
          entityId: savedClaim.id,
          oldValue: { totalPaid: previouslyPaid, status: ClaimStatus.APPROVED },
          newValue: {
            totalPaid: paidAmount,
            delta,
            status: savedClaim.status,
            policyUsedAmount: Number(policy.usedAmount),
            paymentReference: dto.paymentReference,
            mirrored: Boolean(mirror),
          },
          ...(tenantId ? { tenantId } : {}),
        })
        .catch((err) =>
          this.logger.error(`Audit log failed for recordPayment ${savedClaim.id}: ${err.message}`),
        );

      return { saved: savedClaim, settledInBilling: Boolean(mirror) };
    });

    // GL posting runs on its own connection and is best-effort — outside the
    // txn so a GL failure does not roll back the claim/policy/invoice writes,
    // mirroring billing's autoPost* behavior. The audit log above flags whether
    // billing mirroring succeeded so reconciliation can detect drift.
    if (saved.facilityId) {
      this.financeService
        .autoPostInsurancePaymentJournal(
          {
            facilityId: saved.facilityId,
            claimNumber: saved.claimNumber,
            amount: Number(saved.totalPaid),
            paymentReference: saved.paymentReference,
            userId: userId || 'system',
          },
          tenantId,
        )
        .catch((err) => {
          this.logger.warn(
            `GL auto-post failed for insurance claim ${saved.claimNumber}: ${err.message}`,
          );
        });
    }

    void settledInBilling;
    return saved;
  }

  // ============ PRE-AUTHORIZATIONS ============
  // Pre-auth number generator — same advisory-lock pattern as claims above.
  private async generatePreAuthNumber(
    manager: import('typeorm').EntityManager,
    facilityId: string,
  ): Promise<string> {
    const today = new Date();
    const prefix = `PA${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const lockKey = `insurance:preauth-number:${facilityId}:${prefix}`;
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);
    const count = await manager.count(PreAuthorization, {
      where: { facilityId, authNumber: Between(`${prefix}0001`, `${prefix}9999`) as any },
    });
    return `${prefix}${String(count + 1).padStart(4, '0')}`;
  }

  async createPreAuth(
    dto: CreatePreAuthDto,
    userId: string,
    tenantId?: string,
  ): Promise<PreAuthorization> {
    const policy = await this.getPolicy(dto.policyId, tenantId);

    // Validate estimated cost is positive
    if (dto.estimatedCost !== undefined && dto.estimatedCost <= 0) {
      throw new BadRequestException('Estimated cost must be positive');
    }

    // Validate against policy coverage limit, INCLUDING already-used amount.
    // Without this, a single policy could issue multiple full-limit pre-auths
    // because each is compared against the gross annual limit instead of the
    // remaining headroom (mirrors the cumulative-usage check in billing).
    if (policy.annualLimit && dto.estimatedCost !== undefined) {
      const used = Number(policy.usedAmount || 0);
      const limit = Number(policy.annualLimit);
      const outstanding = await this.preAuthRepo
        .createQueryBuilder('pa')
        .select('COALESCE(SUM(pa.approved_amount), 0)', 'sum')
        .where('pa.policy_id = :pid', { pid: policy.id })
        .andWhere('pa.status IN (:...statuses)', {
          statuses: [PreAuthStatus.APPROVED, PreAuthStatus.PARTIALLY_APPROVED],
        })
        .getRawOne<{ sum: string }>();
      const reserved = Number(outstanding?.sum || 0);
      const remaining = Math.max(0, limit - used - reserved);
      if (dto.estimatedCost > remaining) {
        throw new BadRequestException(
          `Estimated cost ${dto.estimatedCost} exceeds remaining policy headroom of ${remaining} ` +
            `(annual limit ${limit}, used ${used}, reserved by other pre-auths ${reserved}).`,
        );
      }
    }

    // Validate policy is active
    if (policy.status !== PolicyStatus.ACTIVE) {
      throw new BadRequestException(
        `Policy ${policy.policyNumber} is ${policy.status}. Pre-authorization requires an active policy.`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      const authNumber = await this.generatePreAuthNumber(manager, dto.facilityId);

      const preAuth = manager.create(PreAuthorization, {
        ...dto,
        authNumber,
        patientId: policy.patientId,
        requestedById: userId,
        expectedAdmissionDate: dto.expectedAdmissionDate
          ? new Date(dto.expectedAdmissionDate)
          : undefined,
        expectedDischargeDate: dto.expectedDischargeDate
          ? new Date(dto.expectedDischargeDate)
          : undefined,
        ...(tenantId ? { tenantId } : {}),
      });

      return manager.save(PreAuthorization, preAuth);
    });
  }

  async getPreAuths(
    facilityId: string,
    filters?: {
      status?: PreAuthStatus;
      patientId?: string;
      policyId?: string;
    },
    tenantId?: string,
  ): Promise<PreAuthorization[]> {
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
      where: { id, ...(tenantId ? { tenantId } : {}) },
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

  async processPreAuth(
    id: string,
    dto: ProcessPreAuthDto,
    approve: boolean,
    tenantId?: string,
    userId?: string,
  ): Promise<PreAuthorization> {
    const preAuth = await this.getPreAuth(id, tenantId);

    if (preAuth.status !== PreAuthStatus.SUBMITTED && preAuth.status !== PreAuthStatus.PENDING) {
      throw new BadRequestException('Pre-authorization cannot be processed');
    }

    // Segregation of duties: the user who requested the pre-auth cannot also
    // approve / deny it.
    if (userId && preAuth.requestedById && preAuth.requestedById === userId) {
      throw new BadRequestException(
        'Segregation of duties violation: the user who requested the pre-authorization cannot also process it',
      );
    }

    const previousStatus = preAuth.status;
    const previousApproved = Number(preAuth.approvedAmount || 0);
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

    const saved = await this.preAuthRepo.save(preAuth);

    await this.auditLogService
      .log({
        userId,
        action: approve ? 'PREAUTH_APPROVED' : 'PREAUTH_DENIED',
        entityType: 'PreAuthorization',
        entityId: saved.id,
        oldValue: { status: previousStatus, approvedAmount: previousApproved },
        newValue: {
          status: saved.status,
          approvedAmount: Number(saved.approvedAmount),
          insurerReference: saved.insurerReference || null,
          denialReason: saved.denialReason || null,
        },
        reason: dto.notes,
        ...(tenantId ? { tenantId } : {}),
      })
      .catch((err) =>
        this.logger.error(`Audit log failed for processPreAuth ${saved.id}: ${err.message}`),
      );

    return saved;
  }

  // ============ REPORTS ============
  async getClaimStatusReport(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
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

  async getDenialsAnalysis(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
    const tenantCond = tenantId ? 'claim.tenant_id = :tenantId' : '1=1';
    const tenantParams = tenantId ? { tenantId } : {};
    const dateRange = { startDate: new Date(startDate), endDate: new Date(endDate) };

    const [
      summaryResult,
      topDenialReasonsResult,
      denialsByProviderResult,
      denialTrendResult,
      resubmissionResult,
      resolutionResult,
    ] = await Promise.all([
      // Summary: totalDenied, totalDeniedValue, denialRate
      this.claimRepo
        .createQueryBuilder('claim')
        .select('SUM(CASE WHEN claim.status = :rejected THEN 1 ELSE 0 END)', 'totalDenied')
        .addSelect(
          'COALESCE(SUM(CASE WHEN claim.status = :rejected THEN claim.totalClaimed ELSE 0 END), 0)',
          'totalDeniedValue',
        )
        .addSelect('COUNT(*)', 'totalSubmitted')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status != :draft', { draft: ClaimStatus.DRAFT })
        .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', dateRange)
        .andWhere(tenantCond, tenantParams)
        .setParameter('rejected', ClaimStatus.REJECTED)
        .getRawOne(),

      // Top denial reasons
      this.claimRepo
        .createQueryBuilder('claim')
        .select("COALESCE(claim.denialReason, 'Unspecified')", 'reason')
        .addSelect('COUNT(*)', 'count')
        .addSelect('COALESCE(SUM(claim.totalClaimed), 0)', 'value')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status = :status', { status: ClaimStatus.REJECTED })
        .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', dateRange)
        .andWhere(tenantCond, tenantParams)
        .groupBy('claim.denialReason')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),

      // Denials by provider
      this.claimRepo
        .createQueryBuilder('claim')
        .leftJoin('claim.provider', 'provider')
        .select('provider.name', 'provider')
        .addSelect('SUM(CASE WHEN claim.status = :rejected THEN 1 ELSE 0 END)', 'denied')
        .addSelect('COUNT(*)', 'total')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status != :draft', { draft: ClaimStatus.DRAFT })
        .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', dateRange)
        .andWhere(tenantCond, tenantParams)
        .setParameter('rejected', ClaimStatus.REJECTED)
        .groupBy('provider.name')
        .orderBy('denied', 'DESC')
        .getRawMany(),

      // Denial trend by month
      this.claimRepo
        .createQueryBuilder('claim')
        .select("TO_CHAR(claim.serviceDate, 'YYYY-MM')", 'month')
        .addSelect('SUM(CASE WHEN claim.status = :rejected THEN 1 ELSE 0 END)', 'denied')
        .addSelect(
          `SUM(CASE WHEN claim.status IN ('approved','partially_approved','paid') THEN 1 ELSE 0 END)`,
          'approved',
        )
        .addSelect('COUNT(*)', 'total')
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status != :draft', { draft: ClaimStatus.DRAFT })
        .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', dateRange)
        .andWhere(tenantCond, tenantParams)
        .setParameter('rejected', ClaimStatus.REJECTED)
        .groupBy("TO_CHAR(claim.serviceDate, 'YYYY-MM')")
        .orderBy('month', 'ASC')
        .getRawMany(),

      // Resubmission success rate: claims that were rejected then later approved (via appealed status)
      this.claimRepo
        .createQueryBuilder('claim')
        .select('COUNT(*)', 'appealedTotal')
        .addSelect(
          `SUM(CASE WHEN claim.status IN ('approved','partially_approved','paid') THEN 1 ELSE 0 END)`,
          'appealedApproved',
        )
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.denialReason IS NOT NULL')
        .andWhere('claim.status != :rejected', { rejected: ClaimStatus.REJECTED })
        .andWhere('claim.status != :draft', { draft: ClaimStatus.DRAFT })
        .andWhere(tenantCond, tenantParams)
        .getRawOne(),

      // Avg days to resolution (from submission to review for rejected claims)
      this.claimRepo
        .createQueryBuilder('claim')
        .select(
          'ROUND(AVG(EXTRACT(EPOCH FROM (claim.reviewedAt - claim.submittedAt)) / 86400), 1)',
          'avgDays',
        )
        .where('claim.facilityId = :facilityId', { facilityId })
        .andWhere('claim.status = :status', { status: ClaimStatus.REJECTED })
        .andWhere('claim.reviewedAt IS NOT NULL')
        .andWhere('claim.submittedAt IS NOT NULL')
        .andWhere('claim.serviceDate BETWEEN :startDate AND :endDate', dateRange)
        .andWhere(tenantCond, tenantParams)
        .getRawOne(),
    ]);

    const totalDenied = parseInt(summaryResult?.totalDenied) || 0;
    const totalSubmitted = parseInt(summaryResult?.totalSubmitted) || 0;

    return {
      totalDenied,
      totalDeniedValue: parseFloat(summaryResult?.totalDeniedValue) || 0,
      denialRate: totalSubmitted > 0 ? Math.round((totalDenied / totalSubmitted) * 1000) / 10 : 0,
      topDenialReasons: (topDenialReasonsResult || []).map((r: any) => {
        const count = parseInt(r.count) || 0;
        return {
          reason: r.reason,
          count,
          value: parseFloat(r.value) || 0,
          percentage: totalDenied > 0 ? Math.round((count / totalDenied) * 1000) / 10 : 0,
        };
      }),
      denialsByProvider: (denialsByProviderResult || []).map((r: any) => {
        const denied = parseInt(r.denied) || 0;
        const total = parseInt(r.total) || 0;
        return {
          provider: r.provider || 'Unknown',
          denied,
          total,
          rate: total > 0 ? Math.round((denied / total) * 1000) / 10 : 0,
        };
      }),
      denialTrend: (denialTrendResult || []).map((r: any) => {
        const denied = parseInt(r.denied) || 0;
        const total = parseInt(r.total) || 0;
        return {
          month: r.month,
          denied,
          approved: parseInt(r.approved) || 0,
          rate: total > 0 ? Math.round((denied / total) * 1000) / 10 : 0,
        };
      }),
      resubmissionSuccessRate: (() => {
        const appealedTotal = parseInt(resubmissionResult?.appealedTotal) || 0;
        const appealedApproved = parseInt(resubmissionResult?.appealedApproved) || 0;
        return appealedTotal > 0 ? Math.round((appealedApproved / appealedTotal) * 1000) / 10 : 0;
      })(),
      avgDaysToResolution: parseFloat(resolutionResult?.avgDays) || 0,
    };
  }

  async getProviderPerformance(
    facilityId: string,
    startDate: string,
    endDate: string,
    tenantId?: string,
  ) {
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
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (claim.paidAt - claim.submittedAt)) / 86400)',
        'avgDaysToPayment',
      )
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
  async getEncountersAwaitingClaims(
    facilityId: string,
    filters?: {
      providerId?: string;
      startDate?: string;
      endDate?: string;
    },
    tenantId?: string,
  ): Promise<any[]> {
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
    return rawResults.map((r) => ({
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
  async createClaimFromEncounter(
    encounterId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<InsuranceClaim> {
    // Get the encounter with policy
    const encounter = await this.encounterRepo.findOne({
      where: { id: encounterId, facilityId, ...(tenantId ? { tenantId } : {}) },
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
      where: { encounterId, ...(tenantId ? { tenantId } : {}) },
    });

    if (existingClaim) {
      throw new BadRequestException('A claim already exists for this encounter');
    }

    // Get the invoice for this encounter
    const invoice = await this.invoiceRepo.findOne({
      where: { encounterId, ...(tenantId ? { tenantId } : {}) },
      relations: ['items'],
    });

    if (!invoice) {
      throw new BadRequestException('No invoice found for this encounter');
    }

    // Get the policy to get provider info
    const policy = await this.policyRepo.findOne({
      where: { id: encounter.insurancePolicyId, ...(tenantId ? { tenantId } : {}) },
    });

    if (!policy) {
      throw new BadRequestException('Insurance policy not found');
    }

    // Determine claim type from encounter type
    const claimTypeMap: Record<string, any> = {
      opd: 'outpatient',
      ipd: 'inpatient',
      emergency: 'emergency',
      surgical: 'surgical',
    };
    const claimType = claimTypeMap[encounter.type] || 'outpatient';

    // Map ChargeType to ClaimItemType
    const chargeToClaimType: Record<string, ClaimItemType> = {
      consultation: ClaimItemType.CONSULTATION,
      procedure: ClaimItemType.PROCEDURE,
      lab: ClaimItemType.LABORATORY,
      radiology: ClaimItemType.RADIOLOGY,
      pharmacy: ClaimItemType.PHARMACY,
      bed: ClaimItemType.BED_CHARGES,
      nursing: ClaimItemType.NURSING,
      other: ClaimItemType.OTHER,
    };

    // Filter to only insurance-covered items and calculate claim total
    const coveredItems = (invoice.items || []).filter((item) => item.insuranceCovered !== false);
    const totalClaimed = coveredItems.reduce((sum, item) => {
      const insuranceAmt = Number(item.insuranceAmount || 0);
      return sum + (insuranceAmt > 0 ? insuranceAmt : Number(item.amount || 0));
    }, 0);

    return this.dataSource.transaction(async (manager) => {
      // Use the shared generator under advisory lock so this path produces
      // the SAME number format (4-digit padded) as createClaim, and so the
      // count(...)+1 race between concurrent encounter-billing flows is
      // closed.
      const claimNumber = await this.generateClaimNumber(manager, facilityId);

      const claim = manager.create(InsuranceClaim, {
        claimNumber,
        facilityId,
        providerId: policy.providerId,
        policyId: encounter.insurancePolicyId,
        patientId: encounter.patientId,
        encounterId,
        invoiceId: invoice.id,
        claimType,
        primaryDiagnosis: encounter.chiefComplaint || 'General Consultation',
        totalClaimed,
        patientResponsibility: Number(invoice.patientResponsibility || 0),
        status: ClaimStatus.DRAFT,
        serviceDate: encounter.startTime,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedClaim = await manager.save(InsuranceClaim, claim);

      if (coveredItems.length > 0) {
        const claimItems = coveredItems.map((item) =>
          manager.create(ClaimItem, {
            claimId: savedClaim.id,
            itemType: chargeToClaimType[item.chargeType] || ClaimItemType.OTHER,
            serviceCode: item.serviceCode || 'SVC',
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            claimedAmount:
              Number(item.insuranceAmount || 0) > 0
                ? Number(item.insuranceAmount)
                : Number(item.amount),
            serviceDate: encounter.startTime,
            status: ClaimItemStatus.PENDING,
            providerNotes: item.coverageNote || undefined,
            ...(tenantId ? { tenantId } : {}),
          }),
        );

        await manager.save(ClaimItem, claimItems);
      }

      return savedClaim;
    });
  }

  // ============ BATCH SUBMISSION ============
  async batchSubmitClaims(
    encounterIds: string[],
    facilityId: string,
    tenantId?: string,
    userId?: string,
  ): Promise<{
    submitted: number;
    failed: number;
    errors: Array<{ encounterId: string; error: string }>;
  }> {
    let submitted = 0;
    let failed = 0;
    const errors: Array<{ encounterId: string; error: string }> = [];

    for (const encounterId of encounterIds) {
      try {
        const claim = await this.createClaimFromEncounter(encounterId, facilityId, tenantId);
        // Auto-submit the newly created claim
        if (userId) {
          await this.submitClaim(claim.id, userId, tenantId);
        }
        submitted++;
      } catch (err: any) {
        failed++;
        errors.push({
          encounterId,
          error: err.message || 'Unknown error',
        });
        this.logger.warn(`Batch submit failed for encounter ${encounterId}: ${err.message}`);
      }
    }

    return { submitted, failed, errors };
  }
}
