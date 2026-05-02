import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, ILike, In, DataSource, EntityManager } from 'typeorm';
import {
  Encounter,
  EncounterStatus,
  EncounterType,
  PayerType,
} from '../../database/entities/encounter.entity';
import { InsurancePolicy } from '../../database/entities/insurance-policy.entity';
import { Invoice } from '../../database/entities/invoice.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Service } from '../../database/entities/service-category.entity';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import {
  CreateEncounterDto,
  UpdateEncounterDto,
  EncounterQueryDto,
  CompleteConsultationDto,
} from './encounters.dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { BillingService } from '../billing/billing.service';
import { QueueManagementService } from '../queue-management/queue-management.service';
import { InsuranceService } from '../insurance/insurance.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';

@Injectable()
export class EncountersService {
  private readonly logger = new Logger(EncountersService.name);

  constructor(
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(Patient)
    private patientRepository: Repository<Patient>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(InsurancePolicy)
    private insurancePolicyRepository: Repository<InsurancePolicy>,
    @Inject(forwardRef(() => InAppNotificationsService))
    private inAppNotificationsService: InAppNotificationsService,
    @Inject(forwardRef(() => BillingService))
    private billingService: BillingService,
    @Inject(forwardRef(() => QueueManagementService))
    private queueService: QueueManagementService,
    @Inject(forwardRef(() => InsuranceService))
    private insuranceService: InsuranceService,
    private dataSource: DataSource,
    private auditLogService: AuditLogService,
  ) {}

  private async generateVisitNumber(manager: EntityManager, tenantId?: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const lockKey = `visit_num_${datePrefix}_${tenantId || 'global'}`;

    // Use advisory lock to prevent concurrent generation collisions
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [lockKey]);

    const lastEncounter = await manager
      .getRepository(Encounter)
      .createQueryBuilder('encounter')
      .where('encounter.visit_number LIKE :prefix', { prefix: `V${datePrefix}%` })
      .andWhere(tenantId ? 'encounter.tenant_id = :tenantId' : '1=1', { tenantId })
      .orderBy('encounter.visit_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastEncounter) {
      const lastSeq = parseInt(lastEncounter.visitNumber.slice(-4), 10);
      if (!isNaN(lastSeq)) {
        sequence = lastSeq + 1;
      }
    }

    return `V${datePrefix}${sequence.toString().padStart(4, '0')}`;
  }

  private async getNextQueueNumber(
    manager: EntityManager,
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<number> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const query = manager
      .getRepository(Encounter)
      .createQueryBuilder('encounter')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today });

    if (tenantId) {
      query.andWhere('encounter.tenant_id = :tenantId', { tenantId });
    }

    if (departmentId) {
      query.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    const count = await query.getCount();
    return count + 1;
  }

  async create(dto: CreateEncounterDto, userId: string, tenantId?: string): Promise<Encounter> {
    // Verify patient exists
    const patient = await this.patientRepository.findOne({
      where: { id: dto.patientId, ...(tenantId ? { tenantId } : {}) },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Validate insurance policy if payer type is insurance
    if (dto.payerType === PayerType.INSURANCE) {
      if (!dto.insurancePolicyId) {
        throw new BadRequestException('Insurance policy is required when payer type is insurance');
      }
      const policy = await this.insurancePolicyRepository.findOne({
        where: { id: dto.insurancePolicyId, patientId: dto.patientId },
        relations: ['provider'],
      });
      if (!policy) {
        throw new NotFoundException('Insurance policy not found for this patient');
      }
      if (policy.status !== 'active') {
        throw new BadRequestException(`Insurance policy is ${policy.status}, not active`);
      }
      if (new Date(policy.expiryDate) < new Date()) {
        throw new BadRequestException('Insurance policy has expired');
      }
    }

    // Check for active encounter (any non-terminal status)
    const activeStatuses = [
      EncounterStatus.REGISTERED,
      EncounterStatus.TRIAGE,
      EncounterStatus.WAITING,
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.PENDING_LAB,
      EncounterStatus.PENDING_PHARMACY,
      EncounterStatus.PENDING_PAYMENT,
      EncounterStatus.RETURN_TO_DOCTOR,
      EncounterStatus.RETURN_TO_PHARMACY,
    ];
    const activeEncounter = await this.encounterRepository.findOne({
      where: {
        patientId: dto.patientId,
        status: In(activeStatuses),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    if (activeEncounter && dto.type === EncounterType.OPD) {
      throw new BadRequestException({
        message: 'Patient already has an active OPD encounter',
        activeEncounterId: activeEncounter.id,
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const visitNumber = await this.generateVisitNumber(manager, tenantId);
      const queueNumber = await this.getNextQueueNumber(
        manager,
        dto.facilityId,
        dto.departmentId,
        tenantId,
      );

      const encounter = manager.create(Encounter, {
        ...dto,
        visitNumber,
        queueNumber,
        createdById: userId,
        status: EncounterStatus.REGISTERED,
        tenantId: tenantId || undefined,
      });

      const saved = await manager.save(Encounter, encounter);

      // Auto-bill consultation fee for OPD encounters
      if (dto.type === EncounterType.OPD) {
        try {
          const consultServiceQb = manager
            .getRepository(Service)
            .createQueryBuilder('service')
            .where([
              { code: 'CON-OPD' },
              { code: 'CONSULTATION' },
              { code: 'OPD' },
              { code: 'OPD-CONSULT' },
              { name: ILike('%opd consultation%') },
            ]);
          if (tenantId)
            consultServiceQb.andWhere(
              '(service.tenant_id = :tenantId OR service.tenant_id IS NULL)',
              { tenantId },
            );
          const consultService = await consultServiceQb.getOne();
          const unitPrice = consultService?.basePrice ? Number(consultService.basePrice) : 0;

          await this.billingService.addBillableItem(
            {
              encounterId: saved.id,
              patientId: dto.patientId,
              serviceCode: consultService?.code || 'CON-OPD',
              description: consultService?.name || 'OPD Consultation',
              quantity: 1,
              unitPrice,
              chargeType: 'consultation',
              referenceType: 'encounter',
              referenceId: saved.id,
              insurancePolicyId: dto.insurancePolicyId,
              paymentType: dto.payerType,
              serviceId: consultService?.id,
            },
            userId,
            tenantId,
          );
        } catch (err) {
          this.logger.warn(
            `Failed to auto-bill consultation fee for encounter ${saved.id}: ${err.message}`,
          );
          // We don't throw here to avoid rolling back the encounter registration if billing fails
          // but in a strict system we might want to. Given it's a try-catch, I'll keep the existing logic
          // but log it properly.
        }
      }

      return saved;
    });
  }

  async findAll(
    query: EncounterQueryDto,
    tenantId?: string,
  ): Promise<{ data: Encounter[]; total: number }> {
    const {
      search,
      status,
      type,
      facilityId,
      departmentId,
      patientId,
      dateFrom,
      dateTo,
      page = 1,
      limit = 20,
    } = query;

    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('encounter.attendingProvider', 'provider')
      .leftJoinAndSelect('encounter.department', 'department');

    if (tenantId) {
      qb.andWhere('encounter.tenant_id = :tenantId', { tenantId });
    }

    if (search) {
      qb.andWhere(
        '(encounter.visit_number ILIKE :search OR patient.full_name ILIKE :search OR patient.mrn ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (status) {
      qb.andWhere('encounter.status = :status', { status });
    }

    if (type) {
      qb.andWhere('encounter.type = :type', { type });
    }

    if (facilityId) {
      qb.andWhere('encounter.facility_id = :facilityId', { facilityId });
    }

    if (departmentId) {
      qb.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    if (patientId) {
      qb.andWhere('encounter.patient_id = :patientId', { patientId });
    }

    if (dateFrom) {
      qb.andWhere('encounter.created_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      // Add 1 day so '2026-03-21' covers the entire day (up to 2026-03-22 00:00:00)
      const endOfDay = new Date(dateTo);
      endOfDay.setDate(endOfDay.getDate() + 1);
      qb.andWhere('encounter.created_at < :dateTo', {
        dateTo: endOfDay.toISOString().slice(0, 10),
      });
    }

    qb.orderBy('encounter.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findOne(id: string, tenantId?: string): Promise<Encounter> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const encounter = await this.encounterRepository.findOne({
      where,
      relations: ['patient', 'facility', 'department', 'attendingProvider', 'createdBy'],
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    return encounter;
  }

  async findByVisitNumber(visitNumber: string, tenantId?: string): Promise<Encounter> {
    const encounter = await this.encounterRepository.findOne({
      where: { visitNumber, ...(tenantId ? { tenantId } : {}) },
      relations: ['patient', 'facility', 'department', 'attendingProvider'],
    });

    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    return encounter;
  }

  private static readonly TERMINAL_STATUSES = [
    EncounterStatus.COMPLETED,
    EncounterStatus.DISCHARGED,
    EncounterStatus.CANCELLED,
  ];

  async update(id: string, dto: UpdateEncounterDto, tenantId?: string): Promise<Encounter> {
    const encounter = await this.findOne(id, tenantId);

    if (EncountersService.TERMINAL_STATUSES.includes(encounter.status)) {
      throw new BadRequestException(`Cannot edit encounter in '${encounter.status}' status`);
    }

    Object.assign(encounter, dto);
    return this.encounterRepository.save(encounter);
  }

  // Valid status transitions
  private static readonly VALID_TRANSITIONS: Partial<Record<EncounterStatus, EncounterStatus[]>> = {
    [EncounterStatus.REGISTERED]: [
      EncounterStatus.TRIAGE,
      EncounterStatus.WAITING,
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.TRIAGE]: [
      EncounterStatus.WAITING,
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.WAITING]: [EncounterStatus.IN_CONSULTATION, EncounterStatus.CANCELLED],
    [EncounterStatus.IN_CONSULTATION]: [
      EncounterStatus.PENDING_LAB,
      EncounterStatus.PENDING_PHARMACY,
      EncounterStatus.PENDING_PAYMENT,
      EncounterStatus.COMPLETED,
      EncounterStatus.RETURN_TO_PHARMACY,
      EncounterStatus.ADMITTED,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.PENDING_LAB]: [
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.RETURN_TO_DOCTOR,
      EncounterStatus.PENDING_PAYMENT,
      EncounterStatus.COMPLETED,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.PENDING_PHARMACY]: [
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.RETURN_TO_DOCTOR,
      EncounterStatus.PENDING_PAYMENT,
      EncounterStatus.COMPLETED,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.PENDING_PAYMENT]: [
      EncounterStatus.RETURN_TO_DOCTOR,
      EncounterStatus.RETURN_TO_PHARMACY,
      EncounterStatus.RETURN_TO_LAB,
      EncounterStatus.COMPLETED,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.RETURN_TO_DOCTOR]: [
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.RETURN_TO_PHARMACY]: [
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.PENDING_PHARMACY,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.RETURN_TO_LAB]: [
      EncounterStatus.PENDING_LAB,
      EncounterStatus.IN_CONSULTATION,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.ADMITTED]: [EncounterStatus.DISCHARGED, EncounterStatus.CANCELLED],
    // Terminal states: COMPLETED, DISCHARGED, CANCELLED — no transitions allowed
  };

  private validateStatusTransition(current: EncounterStatus, target: EncounterStatus): void {
    if (current === target) return; // Self-transition is a no-op, not an error
    const allowed = EncountersService.VALID_TRANSITIONS[current];
    if (!allowed || !allowed.includes(target)) {
      throw new BadRequestException(`Cannot transition encounter from '${current}' to '${target}'`);
    }
  }

  async updateStatus(
    id: string,
    status: EncounterStatus,
    providerId?: string,
    reason?: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // Lock row first without relations (FOR UPDATE can't apply to outer joins)
      const encounter = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      const oldStatus = encounter.status;
      this.validateStatusTransition(encounter.status, status);
      encounter.status = status;

      if (providerId && status === EncounterStatus.IN_CONSULTATION) {
        encounter.attendingProviderId = providerId;
      }

      if (reason && status === EncounterStatus.RETURN_TO_DOCTOR) {
        encounter.metadata = {
          ...encounter.metadata,
          returnReason: reason,
          returnedAt: new Date().toISOString(),
        };
      }

      if (reason && status === EncounterStatus.RETURN_TO_LAB) {
        encounter.metadata = {
          ...encounter.metadata,
          labReturnReason: reason,
          labReturnedAt: new Date().toISOString(),
        };
      }

      if ([EncounterStatus.COMPLETED, EncounterStatus.DISCHARGED].includes(status)) {
        encounter.endTime = new Date();
      }

      const result = await manager.save(Encounter, encounter);

      this.auditLogService
        .log({
          userId: providerId || 'system',
          action: 'STATUS_CHANGE',
          entityType: 'encounter',
          entityId: id,
          oldValue: { status: oldStatus },
          newValue: { status, reason },
        })
        .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

      return result;
    });

    // Auto-generate insurance claim when encounter completes/discharges (non-blocking)
    if (
      [EncounterStatus.COMPLETED, EncounterStatus.DISCHARGED].includes(status) &&
      saved.payerType === PayerType.INSURANCE
    ) {
      this.autoGenerateInsuranceClaim(saved.id, saved.facilityId, saved.tenantId).catch((err) =>
        this.logger.warn(`Auto-claim generation failed for encounter ${id}: ${err.message}`),
      );
    }

    return saved;
  }

  private static readonly MAX_BOUNCE_COUNT = 5;

  async returnToDoctor(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.dataSource.transaction(async (manager) => {
      // Lock row first without relations (FOR UPDATE can't apply to outer joins)
      const encounter = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      // Load patient relation separately
      const full = await manager.findOne(Encounter, {
        where: { id },
        relations: ['patient'],
      });

      const originalStatus = encounter.status;
      this.validateStatusTransition(encounter.status, EncounterStatus.RETURN_TO_DOCTOR);

      const bounceCount = (encounter.metadata?.bounceCount || 0) + 1;
      if (bounceCount > EncountersService.MAX_BOUNCE_COUNT) {
        throw new BadRequestException(
          `Patient has been returned ${bounceCount - 1} times — escalate to supervisor`,
        );
      }

      encounter.status = EncounterStatus.RETURN_TO_DOCTOR;
      encounter.metadata = {
        ...encounter.metadata,
        returnReason: reason,
        returnedAt: new Date().toISOString(),
        previousStatus: originalStatus,
        bounceCount,
      };

      const result = await manager.save(Encounter, encounter);
      if (full?.patient) result.patient = full.patient;
      return result;
    });

    this.auditLogService
      .log({
        userId,
        action: 'RETURN_TO_DOCTOR',
        entityType: 'encounter',
        entityId: id,
        oldValue: { status: saved.metadata?.previousStatus },
        newValue: { status: EncounterStatus.RETURN_TO_DOCTOR, reason },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

    // Notify the attending doctor
    try {
      if (saved.attendingProviderId) {
        const patientName = saved.patient?.fullName || 'Patient';
        await this.inAppNotificationsService.notifyBillReturned(
          saved.attendingProviderId,
          patientName,
          reason,
          saved.id,
          saved.facilityId,
        );
      }
    } catch (err) {
      this.logger.error(`Failed to notify doctor on return for encounter ${id}: ${err}`);
    }

    return saved;
  }

  async returnToPharmacy(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const encounter = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      const originalStatus = encounter.status;
      this.validateStatusTransition(encounter.status, EncounterStatus.RETURN_TO_PHARMACY);

      const bounceCount = (encounter.metadata?.bounceCount || 0) + 1;
      if (bounceCount > EncountersService.MAX_BOUNCE_COUNT) {
        throw new BadRequestException(
          `Patient has been returned ${bounceCount - 1} times — escalate to supervisor`,
        );
      }

      encounter.status = EncounterStatus.RETURN_TO_PHARMACY;
      encounter.metadata = {
        ...encounter.metadata,
        pharmacyReturnReason: reason,
        pharmacyReturnedAt: new Date().toISOString(),
        previousStatus: originalStatus,
        bounceCount,
      };

      return manager.save(Encounter, encounter);
    });

    this.auditLogService
      .log({
        userId,
        action: 'RETURN_TO_PHARMACY',
        entityType: 'encounter',
        entityId: id,
        oldValue: { status: saved.metadata?.previousStatus },
        newValue: { status: EncounterStatus.RETURN_TO_PHARMACY, reason },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

    return saved;
  }

  async returnToLab(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const encounter = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      const originalStatus = encounter.status;
      this.validateStatusTransition(encounter.status, EncounterStatus.RETURN_TO_LAB);

      const bounceCount = (encounter.metadata?.bounceCount || 0) + 1;
      if (bounceCount > EncountersService.MAX_BOUNCE_COUNT) {
        throw new BadRequestException(
          `Patient has been returned ${bounceCount - 1} times — escalate to supervisor`,
        );
      }

      encounter.status = EncounterStatus.RETURN_TO_LAB;
      encounter.metadata = {
        ...encounter.metadata,
        labReturnReason: reason,
        labReturnedAt: new Date().toISOString(),
        previousStatus: originalStatus,
        bounceCount,
      };

      return manager.save(Encounter, encounter);
    });

    this.auditLogService
      .log({
        userId,
        action: 'RETURN_TO_LAB',
        entityType: 'encounter',
        entityId: id,
        oldValue: { status: saved.metadata?.previousStatus },
        newValue: { status: EncounterStatus.RETURN_TO_LAB, reason },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

    return saved;
  }

  async getQueue(
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
    doctorId?: string,
  ): Promise<Encounter[]> {
    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.status IN (:...statuses)', {
        statuses: [
          EncounterStatus.REGISTERED,
          EncounterStatus.TRIAGE,
          EncounterStatus.WAITING,
          EncounterStatus.RETURN_TO_DOCTOR,
        ],
      });

    if (tenantId) {
      qb.andWhere('encounter.tenant_id = :tenantId', { tenantId });
    }

    if (departmentId) {
      qb.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    if (doctorId) {
      // Show patients assigned to this doctor + unassigned waiting patients
      // (so an idle doctor can still see and pick up the unassigned queue).
      qb.andWhere('(encounter.doctor_id = :doctorId OR encounter.doctor_id IS NULL)', { doctorId });
    }

    // Priority: RETURN_TO_DOCTOR patients first, then by queue number
    qb.orderBy(
      `CASE WHEN encounter.status = 'return_to_doctor' THEN 0 ELSE 1 END`,
      'ASC',
    ).addOrderBy('encounter.queue_number', 'ASC');

    return qb.getMany();
  }

  /**
   * Preflight check: returns whether an encounter can be transitioned to
   * COMPLETED. Surfaces blocking reasons (unpaid invoices, missing data) so
   * the UI can warn doctors BEFORE they attempt to complete and hit a 400.
   */
  async canComplete(
    encounterId: string,
    tenantId?: string,
  ): Promise<{
    canComplete: boolean;
    reasons: string[];
    unpaidBalance?: number;
    unpaidInvoiceCount?: number;
  }> {
    const reasons: string[] = [];

    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    if (encounter.status === EncounterStatus.COMPLETED) {
      return {
        canComplete: false,
        reasons: ['Encounter is already completed'],
      };
    }
    if (encounter.status === EncounterStatus.CANCELLED) {
      return {
        canComplete: false,
        reasons: ['Encounter has been cancelled'],
      };
    }
    if (encounter.status === EncounterStatus.ADMITTED) {
      return {
        canComplete: false,
        reasons: ['Encounter is currently ADMITTED — discharge from IPD instead'],
      };
    }

    const unpaidInvoices = await this.dataSource
      .createQueryBuilder(Invoice, 'inv')
      .where('inv.encounter_id = :encounterId', { encounterId })
      .andWhere('inv.status NOT IN (:...paidStatuses)', {
        paidStatuses: ['paid', 'cancelled', 'refunded'],
      })
      .andWhere('inv.balance_due > 0')
      .getMany();

    let unpaidBalance = 0;
    if (unpaidInvoices.length > 0) {
      unpaidBalance = unpaidInvoices.reduce(
        (sum, inv) => sum + Number(inv.balanceDue),
        0,
      );
      reasons.push(
        `Patient has UGX ${unpaidBalance.toLocaleString()} unpaid balance across ${unpaidInvoices.length} invoice(s). Move to pending payment first.`,
      );
    }

    return {
      canComplete: reasons.length === 0,
      reasons,
      unpaidBalance,
      unpaidInvoiceCount: unpaidInvoices.length,
    };
  }

  async getTodayStats(
    facilityId: string,
    tenantId?: string,
  ): Promise<{
    total: number;
    waiting: number;
    inConsultation: number;
    completed: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .select('COUNT(*)', 'total')
      .addSelect(
        `SUM(CASE WHEN encounter.status IN ('registered', 'triage', 'waiting') THEN 1 ELSE 0 END)`,
        'waiting',
      )
      .addSelect(
        `SUM(CASE WHEN encounter.status = 'in_consultation' THEN 1 ELSE 0 END)`,
        'inConsultation',
      )
      .addSelect(
        `SUM(CASE WHEN encounter.status IN ('completed', 'discharged') THEN 1 ELSE 0 END)`,
        'completed',
      )
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today });

    if (tenantId) {
      qb.andWhere('encounter.tenant_id = :tenantId', { tenantId });
    }

    const result = await qb.getRawOne();

    return {
      total: parseInt(result.total, 10) || 0,
      waiting: parseInt(result.waiting, 10) || 0,
      inConsultation: parseInt(result.inConsultation, 10) || 0,
      completed: parseInt(result.completed, 10) || 0,
    };
  }

  async delete(id: string, userId: string, tenantId?: string): Promise<void> {
    const encounter = await this.findOne(id, tenantId);
    await this.encounterRepository.softRemove(encounter);

    this.auditLogService
      .log({
        userId,
        action: 'DELETE',
        entityType: 'encounter',
        entityId: id,
        oldValue: { status: encounter.status, patientId: encounter.patientId },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));
  }

  /**
   * Atomically completes a consultation:
   * 1. Creates clinical note (SOAP + diagnoses)
   * 2. Updates encounter notes + chief complaint
   * 3. Marks encounter as COMPLETED
   * All within a single DB transaction — partial failure rolls back everything.
   */
  async completeConsultation(
    encounterId: string,
    dto: CompleteConsultationDto,
    userId: string,
    tenantId?: string,
  ): Promise<{ encounter: Encounter; clinicalNoteId: string }> {
    const result = await this.dataSource.transaction(async (manager) => {
      // Fetch encounter with pessimistic lock (no relations to avoid FOR UPDATE on outer join)
      const encounter = await manager.findOne(Encounter, {
        where: { id: encounterId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      // Load patient separately (needed for notifications)
      if (encounter.patientId) {
        encounter.patient = (await manager.findOne(Patient, {
          where: { id: encounter.patientId },
        })) as Patient;
      }

      const oldStatus = encounter.status;

      // Check for unpaid invoices — block completion if balance > 0
      const unpaidInvoices = await manager
        .createQueryBuilder(Invoice, 'inv')
        .where('inv.encounter_id = :encounterId', { encounterId })
        .andWhere('inv.status NOT IN (:...paidStatuses)', {
          paidStatuses: ['paid', 'cancelled', 'refunded'],
        })
        .andWhere('inv.balance_due > 0')
        .getMany();

      if (unpaidInvoices.length > 0) {
        const totalOwed = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
        throw new BadRequestException(
          `Cannot complete: patient has UGX ${totalOwed.toLocaleString()} unpaid balance across ${unpaidInvoices.length} invoice(s). Please move to Pending Payment via the status endpoint first.`,
        );
      }

      // Validate status transition to COMPLETED
      this.validateStatusTransition(encounter.status, EncounterStatus.COMPLETED);

      // 1. Create clinical note
      const clinicalNote = manager.create(ClinicalNote, {
        encounterId,
        providerId: userId,
        subjective: dto.subjective,
        objective: dto.objective,
        assessment: dto.assessment,
        plan: dto.plan,
        diagnoses: dto.diagnoses,
        followUpDate: dto.followUpDate ? new Date(dto.followUpDate) : undefined,
        followUpNotes: dto.followUpNotes,
        ...(tenantId ? { tenantId } : {}),
      });
      const savedNote = await manager.save(ClinicalNote, clinicalNote);

      // 2. Update encounter fields
      if (dto.chiefComplaint) encounter.chiefComplaint = dto.chiefComplaint;
      if (dto.notes) encounter.notes = dto.notes;

      // 3. Mark completed
      encounter.status = EncounterStatus.COMPLETED;
      encounter.endTime = new Date();
      const savedEncounter = await manager.save(Encounter, encounter);

      this.logger.log(
        `Consultation completed atomically: encounter=${encounterId}, note=${savedNote.id}, provider=${userId}`,
      );

      return { encounter: savedEncounter, clinicalNoteId: savedNote.id, oldStatus };
    });

    this.auditLogService
      .log({
        userId,
        action: 'COMPLETE_CONSULTATION',
        entityType: 'encounter',
        entityId: encounterId,
        oldValue: { status: result.oldStatus },
        newValue: {
          status: EncounterStatus.COMPLETED,
          clinicalNoteId: result.clinicalNoteId,
          diagnoses: dto.diagnoses?.map((d) => d.code),
        },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

    // Auto-complete the associated queue entry (non-blocking)
    try {
      const queue = await this.queueService.findByEncounterId(encounterId, tenantId);
      if (queue) {
        await this.queueService.completeService(queue.id, userId, tenantId);
        this.logger.log(`Queue ${queue.id} auto-completed for encounter ${encounterId}`);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to auto-complete queue for encounter ${encounterId}: ${err.message}`,
      );
    }

    // Auto-generate insurance claim if this is an insurance encounter (non-blocking)
    if (result.encounter.payerType === PayerType.INSURANCE) {
      this.autoGenerateInsuranceClaim(encounterId, result.encounter.facilityId, tenantId).catch(
        (err) =>
          this.logger.warn(
            `Auto-claim generation failed for encounter ${encounterId}: ${err.message}`,
          ),
      );
    }

    return { encounter: result.encounter, clinicalNoteId: result.clinicalNoteId };
  }

  /**
   * Auto-generate an insurance claim from a completed/discharged encounter.
   * Called non-blocking after encounter status transitions.
   */
  private async autoGenerateInsuranceClaim(
    encounterId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<void> {
    try {
      const claim = await this.insuranceService.createClaimFromEncounter(
        encounterId,
        facilityId,
        tenantId,
      );
      this.logger.log(
        `Auto-generated insurance claim ${claim.claimNumber} for encounter ${encounterId}`,
      );
    } catch (err) {
      // Don't rethrow — claim generation should never block encounter completion
      this.logger.warn(
        `Insurance claim generation failed for encounter ${encounterId}: ${err.message}`,
      );
    }
  }
}
