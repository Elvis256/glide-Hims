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
import { InsurancePolicy, CoverageType } from '../../database/entities/insurance-policy.entity';
import { Invoice, InvoiceStatus } from '../../database/entities/invoice.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Facility } from '../../database/entities/facility.entity';
import { InAppNotificationType } from '../../database/entities/in-app-notification.entity';
import { Department } from '../../database/entities/department.entity';
import { Service } from '../../database/entities/service-category.entity';
import { ClinicalNote } from '../../database/entities/clinical-note.entity';
import { Prescription, PrescriptionStatus } from '../../database/entities/prescription.entity';
import { Order, OrderType, OrderStatus } from '../../database/entities/order.entity';
import {
  CreateEncounterDto,
  UpdateEncounterDto,
  EncounterQueryDto,
  CompleteConsultationDto,
  QueueItem,
} from './encounters.dto';
import { InAppNotificationsService } from '../in-app-notifications/in-app-notifications.service';
import { BillingService } from '../billing/billing.service';
import { QueueManagementService } from '../queue-management/queue-management.service';
import { InsuranceService } from '../insurance/insurance.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { IdentityGuardService } from '../../common/services/identity-guard.service';
import { FollowUpsService } from '../follow-ups/follow-ups.service';
import { FollowUpType } from '../../database/entities/follow-up.entity';
import { StateMachine } from '../../common/fsm/state-machine';

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
    @InjectRepository(Facility)
    private facilityRepository: Repository<Facility>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
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
    private identityGuard: IdentityGuardService,
    private followUpsService: FollowUpsService,
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

  /**
   * Service-code lookup map for auto-billing consultation fees per encounter
   * type. Each entry lists codes to try in order; the first match wins.
   * If no match is found, billing is skipped (not failed) and a warning is logged.
   */
  private static readonly CONSULT_SERVICE_CODES: Partial<
    Record<
      EncounterType,
      { codes: string[]; namePattern: string; fallbackCode: string; fallbackName: string }
    >
  > = {
    [EncounterType.OPD]: {
      codes: ['CON-OPD', 'CONSULTATION', 'OPD', 'OPD-CONSULT'],
      namePattern: '%opd consultation%',
      fallbackCode: 'CON-OPD',
      fallbackName: 'OPD Consultation',
    },
    [EncounterType.EMERGENCY]: {
      codes: ['CON-EMERGENCY', 'EMERGENCY-CONSULT', 'EMERGENCY'],
      namePattern: '%emergency consult%',
      fallbackCode: 'CON-EMERGENCY',
      fallbackName: 'Emergency Consultation',
    },
    [EncounterType.DENTAL]: {
      codes: ['CON-DENTAL', 'DENTAL-CONSULT', 'DENTAL'],
      namePattern: '%dental consult%',
      fallbackCode: 'CON-DENTAL',
      fallbackName: 'Dental Consultation',
    },
    [EncounterType.ANC]: {
      codes: ['CON-ANC', 'ANC-CONSULT', 'ANC'],
      namePattern: '%anc consult%',
      fallbackCode: 'CON-ANC',
      fallbackName: 'Antenatal Consultation',
    },
    [EncounterType.PNC]: {
      codes: ['CON-PNC', 'PNC-CONSULT', 'PNC'],
      namePattern: '%pnc consult%',
      fallbackCode: 'CON-PNC',
      fallbackName: 'Postnatal Consultation',
    },
    [EncounterType.OPTICAL]: {
      codes: ['CON-OPTICAL', 'OPTICAL-CONSULT', 'OPTICAL'],
      namePattern: '%optical consult%',
      fallbackCode: 'CON-OPTICAL',
      fallbackName: 'Optical Consultation',
    },
    [EncounterType.MENTAL_HEALTH]: {
      codes: ['CON-MENTAL', 'MENTAL-CONSULT', 'MENTAL_HEALTH'],
      namePattern: '%mental health consult%',
      fallbackCode: 'CON-MENTAL',
      fallbackName: 'Mental Health Consultation',
    },
    [EncounterType.PHYSIOTHERAPY]: {
      codes: ['CON-PHYSIO', 'PHYSIO-CONSULT', 'PHYSIOTHERAPY'],
      namePattern: '%physiotherapy consult%',
      fallbackCode: 'CON-PHYSIO',
      fallbackName: 'Physiotherapy Consultation',
    },
  };

  /**
   * Maps encounter types to compatible insurance coverage types.
   * COMPREHENSIVE and BOTH always match any encounter type (handled in validation logic).
   */
  private static readonly COVERAGE_TYPE_MAP: Partial<Record<EncounterType, CoverageType[]>> = {
    [EncounterType.OPD]: [CoverageType.OUTPATIENT],
    [EncounterType.IPD]: [CoverageType.INPATIENT],
    [EncounterType.EMERGENCY]: [CoverageType.OUTPATIENT, CoverageType.INPATIENT],
    [EncounterType.ANC]: [CoverageType.MATERNITY],
    [EncounterType.PNC]: [CoverageType.MATERNITY],
    [EncounterType.DENTAL]: [CoverageType.DENTAL],
    [EncounterType.OPTICAL]: [CoverageType.OPTICAL],
  };

  async create(dto: CreateEncounterDto, userId: string, tenantId?: string): Promise<Encounter> {
    // Verify patient exists
    const patient = await this.patientRepository.findOne({
      where: { id: dto.patientId, ...(tenantId ? { tenantId } : {}) },
    });

    if (!patient) {
      throw new NotFoundException('Patient not found');
    }

    // Fix 1: Validate facility exists and is active
    const facility = await this.facilityRepository.findOne({
      where: { id: dto.facilityId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!facility) {
      throw new NotFoundException('Facility not found');
    }
    if (facility.status !== 'active') {
      throw new BadRequestException(`Facility is ${facility.status}, not active`);
    }

    // Fix 2: Validate department belongs to facility (if provided)
    if (dto.departmentId) {
      const department = await this.departmentRepository.findOne({
        where: { id: dto.departmentId, facilityId: dto.facilityId },
      });
      if (!department) {
        throw new BadRequestException(
          'Department not found or does not belong to the specified facility',
        );
      }
      if (department.status !== 'active') {
        throw new BadRequestException(`Department is ${department.status}, not active`);
      }
    }

    // Fix 3: Validate attending provider if pre-assigned at registration
    if (dto.attendingProviderId) {
      await this.identityGuard.assertAssignableProvider(dto.attendingProviderId, tenantId);
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

      // A.5: Validate coverage type matches encounter type
      const encounterType = dto.type || EncounterType.OPD;
      const policyCoverage = policy.coverageType;
      if (policyCoverage !== CoverageType.COMPREHENSIVE && policyCoverage !== CoverageType.BOTH) {
        const compatibleTypes = EncountersService.COVERAGE_TYPE_MAP[encounterType] || [];
        if (compatibleTypes.length > 0 && !compatibleTypes.includes(policyCoverage)) {
          throw new BadRequestException(
            `Insurance policy coverage type '${policyCoverage}' does not cover '${encounterType}' encounters`,
          );
        }
      }
    }

    // Corporate account validation
    if (dto.payerType === PayerType.CORPORATE) {
      if (!dto.corporateAccountId) {
        throw new BadRequestException('corporateAccountId is required when payerType is CORPORATE');
      }
    }

    return this.dataSource.transaction(async (manager) => {
      // Active-encounter check INSIDE the transaction with pessimistic lock so
      // two concurrent registration submits for the same patient cannot both
      // pass the check. Without this, double-clicking the Register button (or
      // two reception tabs) yields two encounters + two consultation invoices.
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

      // Fix 4: Check for duplicate active encounters of the SAME type (not just OPD).
      // A patient should not have two active encounters of the same type, but can
      // have different-type encounters simultaneously (e.g. OPD + ANC).
      const encounterType = dto.type || EncounterType.OPD;
      const activeEncounter = await manager.findOne(Encounter, {
        where: {
          patientId: dto.patientId,
          type: encounterType,
          status: In(activeStatuses),
          ...(tenantId ? { tenantId } : {}),
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (activeEncounter) {
        throw new BadRequestException({
          message: `Patient already has an active ${encounterType.toUpperCase()} encounter`,
          activeEncounterId: activeEncounter.id,
        });
      }

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

      // Fix 5: Auto-bill consultation fee for all mapped encounter types (not just OPD)
      const consultConfig = EncountersService.CONSULT_SERVICE_CODES[encounterType];
      if (consultConfig) {
        try {
          const consultServiceQb = manager
            .getRepository(Service)
            .createQueryBuilder('service')
            .where([
              ...consultConfig.codes.map((code) => ({ code })),
              { name: ILike(consultConfig.namePattern) },
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
              serviceCode: consultService?.code || consultConfig.fallbackCode,
              description: consultService?.name || consultConfig.fallbackName,
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
        }
      } else {
        this.logger.log(
          `No consultation service mapping defined for encounter type '${encounterType}' — skipping auto-billing`,
        );
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
      attendingProviderId,
      payerType,
      dateFrom,
      dateTo,
      page = 1,
      limit: rawLimit = 20,
    } = query;
    const limit = Math.min(rawLimit, 200);

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

    if (attendingProviderId) {
      qb.andWhere('encounter.attending_provider_id = :attendingProviderId', {
        attendingProviderId,
      });
    }

    if (payerType) {
      qb.andWhere('encounter.payer_type = :payerType', { payerType });
    }

    if (dateFrom) {
      qb.andWhere('encounter.created_at >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      if (dateFrom) {
        const f = new Date(dateFrom).getTime();
        const t = new Date(dateTo).getTime();
        if (Number.isFinite(f) && Number.isFinite(t) && f > t) {
          throw new BadRequestException('dateFrom must be on or before dateTo.');
        }
      }
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

  async update(
    id: string,
    dto: UpdateEncounterDto,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    // Validate provider before transaction (cheap fail-fast)
    if (dto.attendingProviderId) {
      await this.identityGuard.assertAssignableProvider(dto.attendingProviderId, tenantId);
    }

    // Validate department belongs to the encounter's facility (if changing)
    if (dto.departmentId) {
      // Need encounter's facilityId — we'll validate inside the transaction
      // after we have the locked row, but we can pre-check the department exists
      const department = await this.departmentRepository.findOne({
        where: { id: dto.departmentId },
      });
      if (!department) {
        throw new BadRequestException('Department not found');
      }
      if (department.status !== 'active') {
        throw new BadRequestException(`Department is ${department.status}, not active`);
      }
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const encounter = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      if (EncountersService.TERMINAL_STATUSES.includes(encounter.status)) {
        throw new BadRequestException(`Cannot edit encounter in '${encounter.status}' status`);
      }

      // Validate department belongs to this encounter's facility
      if (dto.departmentId && dto.departmentId !== encounter.departmentId) {
        const dept = await manager.findOne(Department, {
          where: { id: dto.departmentId, facilityId: encounter.facilityId },
        });
        if (!dept) {
          throw new BadRequestException("Department does not belong to this encounter's facility");
        }
      }

      // Build change diff for audit trail
      const changes: Record<string, { old: any; new: any }> = {};
      const trackableFields: (keyof UpdateEncounterDto)[] = [
        'chiefComplaint',
        'notes',
        'departmentId',
        'attendingProviderId',
      ];
      for (const field of trackableFields) {
        if (dto[field] !== undefined && dto[field] !== (encounter as unknown as Record<string, unknown>)[field]) {
          changes[field] = { old: (encounter as unknown as Record<string, unknown>)[field], new: dto[field] };
        }
      }

      Object.assign(encounter, dto);
      const saved = await manager.save(Encounter, encounter);

      return { saved, changes };
    });

    // Audit log field changes (non-blocking)
    if (Object.keys(result.changes).length > 0) {
      this.auditLogService
        .log({
          userId,
          action: 'UPDATE',
          entityType: 'encounter',
          entityId: id,
          oldValue: Object.fromEntries(Object.entries(result.changes).map(([k, v]) => [k, v.old])),
          newValue: Object.fromEntries(Object.entries(result.changes).map(([k, v]) => [k, v.new])),
        })
        .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));
    }

    return result.saved;
  }

  // Encounter status FSM — defines all legal transitions.
  // Terminal states (COMPLETED, DISCHARGED, CANCELLED) have no outgoing edges.
  private static readonly statusFsm = new StateMachine<EncounterStatus>({
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
    [EncounterStatus.ADMITTED]: [
      EncounterStatus.READY_FOR_DISCHARGE,
      EncounterStatus.DISCHARGED,
      EncounterStatus.CANCELLED,
    ],
    [EncounterStatus.READY_FOR_DISCHARGE]: [
      EncounterStatus.DISCHARGED,
      EncounterStatus.ADMITTED,
      EncounterStatus.CANCELLED,
    ],
  });

  private validateStatusTransition(current: EncounterStatus, target: EncounterStatus): void {
    EncountersService.statusFsm.validate(current, target);
  }

  async updateStatus(
    id: string,
    status: EncounterStatus,
    actorUserId: string,
    attendingProviderId?: string,
    reason?: string,
    tenantId?: string,
  ): Promise<Encounter> {
    // Enhancement: cancellation always requires a reason
    if (status === EncounterStatus.CANCELLED && !reason?.trim()) {
      throw new BadRequestException('A reason is required when cancelling an encounter');
    }

    // If a different provider is being assigned, validate they exist + are a doctor
    // before opening the transaction (cheap fail-fast).
    if (attendingProviderId && attendingProviderId !== actorUserId) {
      await this.identityGuard.assertAssignableProvider(attendingProviderId, tenantId);
    }

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

      // Enhancement: block raw COMPLETED transition without a clinical note.
      // Doctors must use POST /:id/complete (completeConsultation) which
      // atomically creates the note. This prevents undocumented completions.
      if (status === EncounterStatus.COMPLETED) {
        const noteExists = await manager.findOne(ClinicalNote, {
          where: { encounterId: id },
          select: ['id'],
        });
        if (!noteExists) {
          throw new BadRequestException(
            'Cannot complete encounter without a clinical note. Use the "Complete Consultation" endpoint (POST /encounters/:id/complete) to create the clinical note and complete atomically.',
          );
        }
      }

      // Enhancement: enforce billing mode on COMPLETED via raw status change,
      // mirroring the same check in completeConsultation.
      if (status === EncounterStatus.COMPLETED) {
        const isPostPay = encounter.billingMode === 'post_pay';
        if (!isPostPay) {
          const unpaidInvoice = await manager
            .createQueryBuilder(Invoice, 'inv')
            .where('inv.encounter_id = :encounterId', { encounterId: id })
            .andWhere('inv.status NOT IN (:...paidStatuses)', {
              paidStatuses: ['paid', 'cancelled', 'refunded'],
            })
            .andWhere('inv.balance_due > 0')
            .select('inv.id')
            .getOne();
          if (unpaidInvoice) {
            throw new BadRequestException(
              'Cannot complete: patient has unpaid invoices in pre-pay mode. Move to Pending Payment first.',
            );
          }
        }
      }

      encounter.status = status;

      // Resolve assignee: explicit attendingProviderId wins; otherwise default to
      // the acting user when transitioning into IN_CONSULTATION (doctor self-pickup).
      const assignee = attendingProviderId || actorUserId;
      if (assignee && status === EncounterStatus.IN_CONSULTATION) {
        encounter.attendingProviderId = assignee;
      }

      if (reason && status === EncounterStatus.RETURN_TO_DOCTOR) {
        encounter.metadata = {
          ...encounter.metadata,
          returnReason: reason,
          returnedAt: new Date().toISOString(),
        };
      }

      if (reason && status === EncounterStatus.RETURN_TO_PHARMACY) {
        encounter.metadata = {
          ...encounter.metadata,
          pharmacyReturnReason: reason,
          pharmacyReturnedAt: new Date().toISOString(),
        };
      }

      if (reason && status === EncounterStatus.RETURN_TO_LAB) {
        encounter.metadata = {
          ...encounter.metadata,
          labReturnReason: reason,
          labReturnedAt: new Date().toISOString(),
        };
      }

      // Enhancement: store cancellation reason + timestamp in metadata
      if (status === EncounterStatus.CANCELLED && reason) {
        encounter.metadata = {
          ...encounter.metadata,
          cancellationReason: reason,
          cancelledAt: new Date().toISOString(),
          cancelledBy: actorUserId,
        };
      }

      if ([EncounterStatus.COMPLETED, EncounterStatus.DISCHARGED].includes(status)) {
        encounter.endTime = new Date();
      }

      // Enhancement: record every status transition in metadata.statusHistory
      // for SLA monitoring and wait-time analytics.
      const historyEntry = {
        from: oldStatus,
        to: status,
        at: new Date().toISOString(),
        actorUserId,
      };
      const statusHistory = encounter.metadata?.statusHistory || [];
      statusHistory.push(historyEntry);
      encounter.metadata = {
        ...encounter.metadata,
        statusHistory,
      };

      const result = await manager.save(Encounter, encounter);

      this.auditLogService
        .log({
          userId: actorUserId || 'system',
          action: 'STATUS_CHANGE',
          entityType: 'encounter',
          entityId: id,
          oldValue: { status: oldStatus },
          newValue: {
            status,
            reason,
            attendingProviderId: encounter.attendingProviderId,
            patientId: encounter.patientId,
          },
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
  private static readonly ESCALATION_THRESHOLD = 3;

  /**
   * Shared transaction logic for all three return flows.
   * - Per-type bounce counting (doctor / pharmacy / lab tracked independently)
   * - Full bounce history array per type (not just latest reason)
   * - Status transition history (matches updateStatus pattern)
   */
  private async executeReturn(
    id: string,
    reason: string,
    userId: string,
    targetStatus:
      | EncounterStatus.RETURN_TO_DOCTOR
      | EncounterStatus.RETURN_TO_PHARMACY
      | EncounterStatus.RETURN_TO_LAB,
    bounceCountKey: 'doctorBounceCount' | 'pharmacyBounceCount' | 'labBounceCount',
    bounceHistoryKey: 'doctorBounceHistory' | 'pharmacyBounceHistory' | 'labBounceHistory',
    reasonKey: string,
    timestampKey: string,
    tenantId?: string,
  ): Promise<Encounter> {
    return this.dataSource.transaction(async (manager) => {
      const encounter = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      // Load patient separately (needed for notifications)
      const full = await manager.findOne(Encounter, {
        where: { id },
        relations: ['patient'],
      });

      const originalStatus = encounter.status;
      this.validateStatusTransition(encounter.status, targetStatus);

      // Per-type bounce count (tracked independently per return type)
      const typeBounceCount = (encounter.metadata?.[bounceCountKey] || 0) + 1;
      if (typeBounceCount > EncountersService.MAX_BOUNCE_COUNT) {
        throw new BadRequestException(
          `Patient has been returned to ${targetStatus.replace('return_to_', '')} ${typeBounceCount - 1} times — escalate to supervisor`,
        );
      }

      const now = new Date().toISOString();

      // Full bounce history per type (array, not just latest)
      const bounceHistory: Array<{ reason: string; at: string; from: string; by: string }> =
        encounter.metadata?.[bounceHistoryKey] || [];
      bounceHistory.push({ reason, at: now, from: originalStatus, by: userId });

      // Status transition history (matches updateStatus pattern)
      const statusHistory = encounter.metadata?.statusHistory || [];
      statusHistory.push({ from: originalStatus, to: targetStatus, at: now, actorUserId: userId });

      encounter.status = targetStatus;
      encounter.metadata = {
        ...encounter.metadata,
        [reasonKey]: reason,
        [timestampKey]: now,
        previousStatus: originalStatus,
        [bounceCountKey]: typeBounceCount,
        [bounceHistoryKey]: bounceHistory,
        statusHistory,
      };

      const result = await manager.save(Encounter, encounter);
      if (full?.patient) result.patient = full.patient;
      return result;
    });
  }

  /**
   * Shared post-transaction side-effects for return flows:
   * audit log, notifications, supervisor escalation.
   */
  private async handleReturnSideEffects(
    saved: Encounter,
    reason: string,
    userId: string,
    action: string,
    targetStatus: EncounterStatus,
    bounceCountKey: 'doctorBounceCount' | 'pharmacyBounceCount' | 'labBounceCount',
    notifyRoles: string[],
    returnLabel: string,
  ): Promise<void> {
    // Audit log
    this.auditLogService
      .log({
        userId,
        action,
        entityType: 'encounter',
        entityId: saved.id,
        oldValue: { status: saved.metadata?.previousStatus },
        newValue: { status: targetStatus, reason },
      })
      .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));

    // Notify target role(s)
    const patientName = saved.patient?.fullName || 'Patient';
    try {
      await this.inAppNotificationsService.notifyMany(
        await this.inAppNotificationsService.getUserIdsByRole(
          notifyRoles,
          saved.facilityId,
          saved.tenantId,
        ),
        {
          facilityId: saved.facilityId,
          type: InAppNotificationType.GENERAL,
          title: `Patient Returned to ${returnLabel}`,
          message: `${patientName} (${saved.visitNumber}) returned to ${returnLabel.toLowerCase()}: ${reason}`,
          metadata: { referenceType: 'encounter', referenceId: saved.id },
        },
        saved.tenantId,
      );
    } catch (err) {
      this.logger.error(
        `Failed to notify ${returnLabel} on return for encounter ${saved.id}: ${err}`,
      );
    }

    // Additionally notify the attending doctor directly (for returnToDoctor)
    if (targetStatus === EncounterStatus.RETURN_TO_DOCTOR && saved.attendingProviderId) {
      try {
        await this.inAppNotificationsService.notifyBillReturned(
          saved.attendingProviderId,
          patientName,
          reason,
          saved.id,
          saved.facilityId,
          saved.tenantId,
        );
      } catch (err) {
        this.logger.error(`Failed to notify attending doctor for encounter ${saved.id}: ${err}`);
      }
    }

    // Escalate to supervisors when per-type bounce count reaches threshold
    const typeBounceCount = saved.metadata?.[bounceCountKey] || 0;
    if (typeBounceCount >= EncountersService.ESCALATION_THRESHOLD) {
      this.inAppNotificationsService
        .getUserIdsByRole(
          ['supervisor', 'head of department', 'medical director'],
          saved.facilityId,
          saved.tenantId,
        )
        .then((supervisorIds) => {
          if (supervisorIds.length > 0) {
            return this.inAppNotificationsService.notifyMany(
              supervisorIds,
              {
                facilityId: saved.facilityId,
                type: InAppNotificationType.GENERAL,
                title: `${returnLabel} Bounce Alert (${typeBounceCount}x)`,
                message: `${patientName} (${saved.visitNumber}) has been returned to ${returnLabel.toLowerCase()} ${typeBounceCount} times. Reason: ${reason}. Please review.`,
                metadata: {
                  referenceType: 'encounter',
                  referenceId: saved.id,
                  bounceCount: typeBounceCount,
                },
              },
              saved.tenantId,
            );
          }
        })
        .catch((err) =>
          this.logger.warn(`Supervisor escalation notification failed: ${err.message}`),
        );
    }
  }

  async returnToDoctor(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.executeReturn(
      id,
      reason,
      userId,
      EncounterStatus.RETURN_TO_DOCTOR,
      'doctorBounceCount',
      'doctorBounceHistory',
      'returnReason',
      'returnedAt',
      tenantId,
    );

    await this.handleReturnSideEffects(
      saved,
      reason,
      userId,
      'RETURN_TO_DOCTOR',
      EncounterStatus.RETURN_TO_DOCTOR,
      'doctorBounceCount',
      ['doctor', 'physician', 'medical officer'],
      'Doctor',
    );

    return saved;
  }

  async returnToPharmacy(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.executeReturn(
      id,
      reason,
      userId,
      EncounterStatus.RETURN_TO_PHARMACY,
      'pharmacyBounceCount',
      'pharmacyBounceHistory',
      'pharmacyReturnReason',
      'pharmacyReturnedAt',
      tenantId,
    );

    await this.handleReturnSideEffects(
      saved,
      reason,
      userId,
      'RETURN_TO_PHARMACY',
      EncounterStatus.RETURN_TO_PHARMACY,
      'pharmacyBounceCount',
      ['pharmacist', 'pharmacy'],
      'Pharmacy',
    );

    return saved;
  }

  async returnToLab(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Encounter> {
    const saved = await this.executeReturn(
      id,
      reason,
      userId,
      EncounterStatus.RETURN_TO_LAB,
      'labBounceCount',
      'labBounceHistory',
      'labReturnReason',
      'labReturnedAt',
      tenantId,
    );

    await this.handleReturnSideEffects(
      saved,
      reason,
      userId,
      'RETURN_TO_LAB',
      EncounterStatus.RETURN_TO_LAB,
      'labBounceCount',
      ['lab technician', 'laboratory', 'lab'],
      'Lab',
    );

    return saved;
  }

  /**
   * Appends computed queue-display fields (waitMinutes, isUrgent) to each
   * encounter. Keeps the entity shape intact via intersection type so
   * existing consumers can spread or destructure as before.
   */
  private enrichQueueItems(encounters: Encounter[]): (Encounter & QueueItem)[] {
    const now = Date.now();
    return encounters.map((e) =>
      Object.assign(e, {
        waitMinutes: Math.round((now - new Date(e.startTime).getTime()) / 60000),
        isUrgent: e.type === EncounterType.EMERGENCY,
      }),
    );
  }

  /**
   * Doctor / reception queue — patients waiting to be seen.
   *
   * Priority order:
   *  1. EMERGENCY encounters (type = emergency) — always first
   *  2. RETURN_TO_DOCTOR status — returning patients before new ones
   *  3. Queue number ASC (FIFO)
   *
   * Includes department + provider relations for richer display.
   */
  async getQueue(
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
    doctorId?: string,
    encounterType?: EncounterType,
  ): Promise<(Encounter & QueueItem)[]> {
    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('encounter.department', 'department')
      .leftJoinAndSelect('encounter.attendingProvider', 'provider')
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

    if (encounterType) {
      qb.andWhere('encounter.type = :encounterType', { encounterType });
    }

    if (doctorId) {
      // Show patients assigned to this doctor + unassigned waiting patients
      // (so an idle doctor can still see and pick up the unassigned queue).
      qb.andWhere(
        '(encounter.attending_provider_id = :doctorId OR encounter.attending_provider_id IS NULL)',
        { doctorId },
      );
    }

    qb.limit(500);

    // Priority: EMERGENCY first, then RETURN_TO_DOCTOR, then FIFO by queue number
    qb.orderBy(`CASE WHEN encounter.type = 'emergency' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy(`CASE WHEN encounter.status = 'return_to_doctor' THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('encounter.queue_number', 'ASC');

    const encounters = await qb.getMany();
    return this.enrichQueueItems(encounters);
  }

  /**
   * Pharmacy queue — patients waiting for medication dispensing.
   * Shows PENDING_PHARMACY and RETURN_TO_PHARMACY encounters.
   */
  async getPharmacyQueue(
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<(Encounter & QueueItem)[]> {
    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('encounter.department', 'department')
      .leftJoinAndSelect('encounter.attendingProvider', 'provider')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.status IN (:...statuses)', {
        statuses: [EncounterStatus.PENDING_PHARMACY, EncounterStatus.RETURN_TO_PHARMACY],
      });

    if (tenantId) {
      qb.andWhere('encounter.tenant_id = :tenantId', { tenantId });
    }

    if (departmentId) {
      qb.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    qb.limit(500);

    // RETURN_TO_PHARMACY first (re-work), then FIFO
    qb.orderBy(
      `CASE WHEN encounter.status = 'return_to_pharmacy' THEN 0 ELSE 1 END`,
      'ASC',
    ).addOrderBy('encounter.queue_number', 'ASC');

    const encounters = await qb.getMany();
    return this.enrichQueueItems(encounters);
  }

  /**
   * Lab queue — patients waiting for lab sample collection / results.
   * Shows PENDING_LAB and RETURN_TO_LAB encounters.
   */
  async getLabQueue(
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<(Encounter & QueueItem)[]> {
    const qb = this.encounterRepository
      .createQueryBuilder('encounter')
      .leftJoinAndSelect('encounter.patient', 'patient')
      .leftJoinAndSelect('encounter.department', 'department')
      .leftJoinAndSelect('encounter.attendingProvider', 'provider')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.status IN (:...statuses)', {
        statuses: [EncounterStatus.PENDING_LAB, EncounterStatus.RETURN_TO_LAB],
      });

    if (tenantId) {
      qb.andWhere('encounter.tenant_id = :tenantId', { tenantId });
    }

    if (departmentId) {
      qb.andWhere('encounter.department_id = :departmentId', { departmentId });
    }

    qb.limit(500);

    // RETURN_TO_LAB first (re-work), then FIFO
    qb.orderBy(`CASE WHEN encounter.status = 'return_to_lab' THEN 0 ELSE 1 END`, 'ASC').addOrderBy(
      'encounter.queue_number',
      'ASC',
    );

    const encounters = await qb.getMany();
    return this.enrichQueueItems(encounters);
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
    warnings: string[];
    unpaidBalance?: number;
    unpaidInvoiceCount?: number;
    pendingLabCount?: number;
    undispensedPrescriptionCount?: number;
    hasClinicalNote?: boolean;
  }> {
    const reasons: string[] = []; // blockers — prevent completion
    const warnings: string[] = []; // non-blocking — surface to UI but allow completion

    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!encounter) {
      throw new NotFoundException('Encounter not found');
    }

    // --- Terminal / incompatible statuses ---
    if (encounter.status === EncounterStatus.COMPLETED) {
      return { canComplete: false, reasons: ['Encounter is already completed'], warnings };
    }
    if (encounter.status === EncounterStatus.DISCHARGED) {
      return { canComplete: false, reasons: ['Encounter is already discharged'], warnings };
    }
    if (encounter.status === EncounterStatus.CANCELLED) {
      return { canComplete: false, reasons: ['Encounter has been cancelled'], warnings };
    }
    if (encounter.status === EncounterStatus.ADMITTED) {
      return {
        canComplete: false,
        reasons: ['Encounter is currently ADMITTED — discharge from IPD instead'],
        warnings,
      };
    }

    // Run remaining checks in parallel for efficiency
    const [unpaidInvoices, clinicalNote, pendingLabOrders, undispensedRx] = await Promise.all([
      // 1. Unpaid invoices
      this.dataSource
        .createQueryBuilder(Invoice, 'inv')
        .where('inv.encounter_id = :encounterId', { encounterId })
        .andWhere('inv.status NOT IN (:...paidStatuses)', {
          paidStatuses: ['paid', 'cancelled', 'refunded'],
        })
        .andWhere('inv.balance_due > 0')
        .getMany(),

      // 2. Clinical note existence
      this.dataSource
        .getRepository(ClinicalNote)
        .findOne({ where: { encounterId }, select: ['id'] }),

      // 3. Pending / in-progress lab orders
      this.dataSource
        .createQueryBuilder(Order, 'ord')
        .where('ord.encounter_id = :encounterId', { encounterId })
        .andWhere('ord.order_type = :labType', { labType: OrderType.LAB })
        .andWhere('ord.status IN (:...pendingStatuses)', {
          pendingStatuses: [OrderStatus.PENDING, OrderStatus.IN_PROGRESS],
        })
        .getCount(),

      // 4. Undispensed prescriptions
      this.dataSource
        .createQueryBuilder(Prescription, 'rx')
        .where('rx.encounter_id = :encounterId', { encounterId })
        .andWhere('rx.status IN (:...activeStatuses)', {
          activeStatuses: [
            PrescriptionStatus.PENDING,
            PrescriptionStatus.DISPENSING,
            PrescriptionStatus.READY,
            PrescriptionStatus.PARTIALLY_DISPENSED,
          ],
        })
        .getCount(),
    ]);

    const hasClinicalNote = !!clinicalNote;

    // --- Blocker: clinical note is required ---
    if (!hasClinicalNote) {
      reasons.push(
        'No clinical note found. Use "Complete Consultation" (POST /encounters/:id/complete) to create the note and complete atomically.',
      );
    }

    // --- Blocker (pre_pay) / Info (post_pay): unpaid invoices ---
    let unpaidBalance = 0;
    if (unpaidInvoices.length > 0) {
      unpaidBalance = unpaidInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
      const isPostPay = encounter.billingMode === 'post_pay';
      if (!isPostPay) {
        reasons.push(
          `Patient has UGX ${unpaidBalance.toLocaleString()} unpaid balance across ${unpaidInvoices.length} invoice(s). Move to pending payment first.`,
        );
      }
    }

    // --- Warning: pending lab results ---
    if (pendingLabOrders > 0) {
      warnings.push(
        `${pendingLabOrders} lab order(s) still pending or in progress. Results may not be available yet.`,
      );
    }

    // --- Warning: undispensed prescriptions ---
    if (undispensedRx > 0) {
      warnings.push(`${undispensedRx} prescription(s) not yet dispensed/collected.`);
    }

    return {
      canComplete: reasons.length === 0,
      reasons,
      warnings,
      unpaidBalance,
      unpaidInvoiceCount: unpaidInvoices.length,
      pendingLabCount: pendingLabOrders,
      undispensedPrescriptionCount: undispensedRx,
      hasClinicalNote,
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
    cancelled: number;
    pendingPayment: number;
    pendingLab: number;
    pendingPharmacy: number;
    averageWaitMinutes: number | null;
    departmentBreakdown: Array<{ departmentId: string; departmentName: string; total: number }>;
    bouncedEncounters: number;
    totalBounces: number;
    bounceRate: number;
    /** @deprecated Use inConsultation */
    inProgress: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tenantFilter = tenantId ? 'encounter.tenant_id = :tenantId' : '1=1';

    // Main summary query — single pass over today's encounters
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
      .addSelect(`SUM(CASE WHEN encounter.status = 'cancelled' THEN 1 ELSE 0 END)`, 'cancelled')
      .addSelect(
        `SUM(CASE WHEN encounter.status = 'pending_payment' THEN 1 ELSE 0 END)`,
        'pendingPayment',
      )
      .addSelect(
        `SUM(CASE WHEN encounter.status IN ('pending_lab', 'return_to_lab') THEN 1 ELSE 0 END)`,
        'pendingLab',
      )
      .addSelect(
        `SUM(CASE WHEN encounter.status IN ('pending_pharmacy', 'return_to_pharmacy') THEN 1 ELSE 0 END)`,
        'pendingPharmacy',
      )
      // Average wait: time from start_time to end_time for completed encounters today.
      // This approximates total visit duration; true wait-to-consultation requires
      // statusHistory timestamps (available after Step 3 enhancements).
      .addSelect(
        `AVG(CASE WHEN encounter.end_time IS NOT NULL THEN EXTRACT(EPOCH FROM (encounter.end_time - encounter.start_time)) / 60 END)`,
        'averageWaitMinutes',
      )
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today })
      .andWhere(tenantFilter, { tenantId });

    // Department breakdown query — grouped counts
    const deptQb = this.encounterRepository
      .createQueryBuilder('encounter')
      .select('encounter.department_id', 'departmentId')
      .addSelect('department.name', 'departmentName')
      .addSelect('COUNT(*)', 'total')
      .leftJoin('encounter.department', 'department')
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today })
      .andWhere('encounter.department_id IS NOT NULL')
      .andWhere(tenantFilter, { tenantId })
      .groupBy('encounter.department_id')
      .addGroupBy('department.name')
      .orderBy('total', 'DESC');

    // Bounce rate query — counts encounters with any bounce metadata
    const bounceQb = this.encounterRepository
      .createQueryBuilder('encounter')
      .select('COUNT(*)', 'bouncedEncounters')
      .addSelect(
        `COALESCE(SUM(COALESCE((encounter.metadata->>'doctorBounceCount')::int, 0) + COALESCE((encounter.metadata->>'pharmacyBounceCount')::int, 0) + COALESCE((encounter.metadata->>'labBounceCount')::int, 0)), 0)`,
        'totalBounces',
      )
      .where('encounter.facility_id = :facilityId', { facilityId })
      .andWhere('encounter.created_at >= :today', { today })
      .andWhere(tenantFilter, { tenantId })
      .andWhere(
        `(COALESCE((encounter.metadata->>'doctorBounceCount')::int, 0) + COALESCE((encounter.metadata->>'pharmacyBounceCount')::int, 0) + COALESCE((encounter.metadata->>'labBounceCount')::int, 0)) > 0`,
      );

    // Run all in parallel
    const [result, deptResults, bounceResult] = await Promise.all([
      qb.getRawOne(),
      deptQb.getRawMany(),
      bounceQb.getRawOne(),
    ]);

    const inConsultation = parseInt(result.inConsultation, 10) || 0;
    const avgWait = result.averageWaitMinutes
      ? Math.round(parseFloat(result.averageWaitMinutes))
      : null;
    const total = parseInt(result.total, 10) || 0;
    const bouncedEncounters = parseInt(bounceResult?.bouncedEncounters, 10) || 0;
    const totalBounces = parseInt(bounceResult?.totalBounces, 10) || 0;
    const bounceRate = total > 0 ? Math.round((bouncedEncounters / total) * 10000) / 100 : 0;

    return {
      total,
      waiting: parseInt(result.waiting, 10) || 0,
      inConsultation,
      inProgress: inConsultation,
      completed: parseInt(result.completed, 10) || 0,
      cancelled: parseInt(result.cancelled, 10) || 0,
      pendingPayment: parseInt(result.pendingPayment, 10) || 0,
      pendingLab: parseInt(result.pendingLab, 10) || 0,
      pendingPharmacy: parseInt(result.pendingPharmacy, 10) || 0,
      averageWaitMinutes: avgWait,
      bouncedEncounters,
      totalBounces,
      bounceRate,
      departmentBreakdown: deptResults.map((r) => ({
        departmentId: r.departmentId,
        departmentName: r.departmentName || 'Unassigned',
        total: parseInt(r.total, 10) || 0,
      })),
    };
  }

  async delete(id: string, userId: string, tenantId?: string): Promise<void> {
    const encounter = await this.findOne(id, tenantId);

    // Refuse to delete terminal encounters — they have downstream foreign
    // references (clinical notes, invoices, claims) and soft-removing them
    // silently breaks audit trails. Cancellation is the correct path.
    if (EncountersService.TERMINAL_STATUSES.includes(encounter.status)) {
      throw new BadRequestException(
        `Cannot delete encounter in terminal status '${encounter.status}'. Cancel via status update or contact a system administrator.`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      // Re-fetch with lock inside the transaction
      const locked = await manager.findOne(Encounter, {
        where: { id, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException('Encounter not found');
      }

      // Block deletion if active prescriptions exist
      const activeRxCount = await manager
        .createQueryBuilder(Prescription, 'rx')
        .where('rx.encounter_id = :id', { id })
        .andWhere('rx.status NOT IN (:...terminalStatuses)', {
          terminalStatuses: [
            PrescriptionStatus.DISPENSED,
            PrescriptionStatus.COLLECTED,
            PrescriptionStatus.CANCELLED,
          ],
        })
        .getCount();
      if (activeRxCount > 0) {
        throw new BadRequestException(
          `Cannot delete: ${activeRxCount} active prescription(s) linked to this encounter. Cancel them first.`,
        );
      }

      // Block deletion if active lab/radiology orders exist
      const activeOrderCount = await manager
        .createQueryBuilder(Order, 'ord')
        .where('ord.encounter_id = :id', { id })
        .andWhere('ord.status NOT IN (:...terminalStatuses)', {
          terminalStatuses: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
        })
        .getCount();
      if (activeOrderCount > 0) {
        throw new BadRequestException(
          `Cannot delete: ${activeOrderCount} active order(s) (lab/radiology) linked to this encounter. Cancel them first.`,
        );
      }

      // Auto-cancel unpaid invoices linked to this encounter (system action).
      // Paid/refunded invoices are left untouched — they are financial records.
      const unpaidInvoices = await manager
        .createQueryBuilder(Invoice, 'inv')
        .where('inv.encounter_id = :id', { id })
        .andWhere('inv.status NOT IN (:...finalStatuses)', {
          finalStatuses: ['paid', 'cancelled', 'refunded'],
        })
        .getMany();

      for (const inv of unpaidInvoices) {
        inv.status = InvoiceStatus.CANCELLED;
        (inv as any).cancellationReason = 'Auto-cancelled: linked encounter deleted';
        await manager.save(Invoice, inv);
      }

      await manager.softRemove(Encounter, locked);

      // Audit log (inside transaction so it reflects the final state)
      this.auditLogService
        .log({
          userId,
          action: 'DELETE',
          entityType: 'encounter',
          entityId: id,
          oldValue: {
            status: locked.status,
            patientId: locked.patientId,
            visitNumber: locked.visitNumber,
          },
          newValue: {
            cancelledInvoices: unpaidInvoices.length,
            cancelledInvoiceIds: unpaidInvoices.map((inv) => inv.id),
          },
        })
        .catch((err) => this.logger.warn(`Audit log failed: ${err.message}`));
    });
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
  ): Promise<{
    encounter: Encounter;
    clinicalNoteId: string;
    followUpId?: string;
    clinicalNoteScore: number;
  }> {
    const clinicalNoteScore = this.computeNoteCompletenessScore(dto);

    const result = await this.dataSource.transaction(async (manager) => {
      // Fetch encounter with pessimistic lock (no relations to avoid FOR UPDATE on outer join)
      const encounter = await manager.findOne(Encounter, {
        where: { id: encounterId, ...(tenantId ? { tenantId } : {}) },
        lock: { mode: 'pessimistic_write' },
      });

      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }

      // Load patient separately (needed for notifications / follow-up creation)
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
        const isPostPay = encounter.billingMode === 'post_pay';
        if (!isPostPay) {
          throw new BadRequestException(
            `Cannot complete: patient has UGX ${totalOwed.toLocaleString()} unpaid balance across ${unpaidInvoices.length} invoice(s). Please move to Pending Payment via the status endpoint first.`,
          );
        }
        this.logger.log(
          `Encounter ${encounterId} completing with UGX ${totalOwed.toLocaleString()} pending (post-pay flow)`,
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

      // 3. Mark completed + record status transition history
      encounter.status = EncounterStatus.COMPLETED;
      encounter.endTime = new Date();

      const statusHistory = encounter.metadata?.statusHistory || [];
      statusHistory.push({
        from: oldStatus,
        to: EncounterStatus.COMPLETED,
        at: new Date().toISOString(),
        actorUserId: userId,
      });
      encounter.metadata = { ...encounter.metadata, statusHistory, clinicalNoteScore };

      const savedEncounter = await manager.save(Encounter, encounter);

      this.logger.log(
        `Consultation completed atomically: encounter=${encounterId}, note=${savedNote.id}, provider=${userId}, noteScore=${clinicalNoteScore}`,
      );

      return { encounter: savedEncounter, clinicalNoteId: savedNote.id, oldStatus };
    });

    // --- Post-transaction side-effects (non-blocking) ---

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

    // Auto-complete the associated queue entry
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

    // Auto-generate insurance claim if this is an insurance encounter
    if (result.encounter.payerType === PayerType.INSURANCE) {
      this.autoGenerateInsuranceClaim(encounterId, result.encounter.facilityId, tenantId).catch(
        (err) =>
          this.logger.warn(
            `Auto-claim generation failed for encounter ${encounterId}: ${err.message}`,
          ),
      );
    }

    // Auto-create FollowUp record when doctor specifies a followUpDate
    let followUpId: string | undefined;
    if (dto.followUpDate) {
      try {
        const followUp = await this.followUpsService.create(
          {
            patientId: result.encounter.patientId,
            sourceEncounterId: encounterId,
            type: FollowUpType.ROUTINE,
            scheduledDate: dto.followUpDate,
            reason: dto.followUpNotes || `Follow-up from encounter ${result.encounter.visitNumber}`,
            providerId: result.encounter.attendingProviderId || userId,
            departmentId: result.encounter.departmentId,
          },
          userId,
          result.encounter.facilityId,
          tenantId,
        );
        followUpId = followUp.id;
        this.logger.log(
          `Auto-created follow-up ${followUp.appointmentNumber} for encounter ${encounterId} on ${dto.followUpDate}`,
        );
      } catch (err) {
        this.logger.warn(
          `Failed to auto-create follow-up for encounter ${encounterId}: ${err.message}`,
        );
      }
    }

    return {
      encounter: result.encounter,
      clinicalNoteId: result.clinicalNoteId,
      followUpId,
      clinicalNoteScore,
    };
  }

  /**
   * Compute a clinical note completeness score (0-100) based on SOAP fields,
   * diagnoses coverage, and follow-up documentation.
   */
  private computeNoteCompletenessScore(dto: CompleteConsultationDto): number {
    let score = 0;

    if (dto.subjective) score += 15;
    if (dto.objective) score += 15;
    if (dto.assessment) score += 20;
    if (dto.plan) score += 20;

    const diagCount = dto.diagnoses?.length || 0;
    if (diagCount >= 3) score += 20;
    else if (diagCount >= 2) score += 15;
    else if (diagCount >= 1) score += 10;

    if (dto.followUpDate) score += 5;
    if (dto.followUpNotes) score += 5;

    return score;
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
