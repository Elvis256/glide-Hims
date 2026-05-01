import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, Like, EntityManager } from 'typeorm';
import {
  Queue,
  QueueDisplay,
  QueueStatus,
  QueuePriority,
  ServicePoint,
  VALID_QUEUE_TRANSITIONS,
  QUEUE_TO_ENCOUNTER_STATUS,
} from '../../database/entities/queue.entity';
import {
  Encounter,
  EncounterType,
  EncounterStatus,
  PayerType,
} from '../../database/entities/encounter.entity';
import {
  Invoice,
  InvoiceItem,
  InvoiceStatus,
  ChargeType,
  PaymentType,
} from '../../database/entities/invoice.entity';
import { Service } from '../../database/entities/service-category.entity';
import { Department } from '../../database/entities/department.entity';
import { DoctorDuty, DutyStatus } from '../../database/entities/doctor-duty.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { AfricasTalkingService } from '../integrations/africas-talking.service';
import {
  CreateQueueDto,
  CallNextDto,
  TransferQueueDto,
  SkipQueueDto,
  HoldQueueDto,
  QueueFilterDto,
  CreateQueueDisplayDto,
  ServiceConfigDto,
} from './dto/queue.dto';

const SERVICE_CONFIG_KEY = 'queue.serviceConfig';

@Injectable()
export class QueueManagementService {
  private readonly logger = new Logger(QueueManagementService.name);

  constructor(
    @InjectRepository(Queue)
    private queueRepository: Repository<Queue>,
    @InjectRepository(QueueDisplay)
    private queueDisplayRepository: Repository<QueueDisplay>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(DoctorDuty)
    private doctorDutyRepository: Repository<DoctorDuty>,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(SystemSetting)
    private systemSettingRepository: Repository<SystemSetting>,
    @InjectRepository(Invoice)
    private invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private invoiceItemRepository: Repository<InvoiceItem>,
    @InjectRepository(Service)
    private serviceRepository: Repository<Service>,
    @InjectRepository(Department)
    private departmentRepository: Repository<Department>,
    private readonly smsService: AfricasTalkingService,
    private dataSource: DataSource,
  ) {}

  // ─── Facility Service Config ──────────────────────────────────────────────

  async validateQueueRequest(
    dto: CreateQueueDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<{
    valid: true;
    resolvedPriority: QueuePriority;
    requiresPayment: boolean;
    initialQueueStatus: QueueStatus;
    servicePointCapacityLimit: number | null;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (dto.departmentId) {
      const department = await this.departmentRepository.findOne({
        where: {
          id: dto.departmentId,
          facilityId,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (!department) {
        throw new BadRequestException(
          'Selected department is invalid for this facility. Please reselect department and try again.',
        );
      }

      if (department.status !== 'active') {
        throw new BadRequestException(
          `Department ${department.name} is currently ${department.status}. Please select an active department.`,
        );
      }
    }

    if (dto.assignedDoctorId) {
      const doctorDuty = await this.doctorDutyRepository.findOne({
        where: {
          doctorId: dto.assignedDoctorId,
          facilityId,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (!doctorDuty || doctorDuty.status === 'off_duty') {
        throw new BadRequestException(
          'Selected doctor is not currently checked in. Please choose another doctor or set Any Available Doctor.',
        );
      }
    }

    const existingQueue = await this.queueRepository.findOne({
      where: {
        patientId: dto.patientId,
        facilityId,
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
        ...(tenantId ? { tenantId } : {}),
      },
      relations: ['patient'],
    });

    if (existingQueue) {
      throw new BadRequestException(
        `Patient ${existingQueue.patient?.fullName || ''} is already in queue with token ${existingQueue.ticketNumber}`,
      );
    }

    const config = await this.getServiceConfig(facilityId, tenantId);
    const capacityLimits: Record<string, number> = config.capacityLimits || {};
    const limit = capacityLimits[dto.servicePoint];

    if (limit) {
      const activeCount = await this.queueRepository.count({
        where: {
          facilityId,
          servicePoint: dto.servicePoint as ServicePoint,
          status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
          queueDate: today,
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (activeCount >= limit) {
        throw new BadRequestException(
          `Queue at ${dto.servicePoint} is at capacity (${limit} patients). Please try again later or redirect to another service point.`,
        );
      }
    }

    const resolvedPriority = this.resolvePriority(dto.priority, dto.patientConditionFlags, config);
    const skipPaymentTypes = ['insurance', 'hospital_scheme', 'staff'];
    const isEmergency =
      dto.visitType === 'emergency' || resolvedPriority === QueuePriority.EMERGENCY;

    // Resolve billing mode: per-visit override > tenant default > 'post_pay'
    const billingDefaults = await this.getBillingDefaults(tenantId);
    const billingMode = dto.billingMode || billingDefaults.mode;

    // Pre-pay: patient must settle consultation at billing counter before being seen.
    // Post-pay: patient is seen first; consultation is added to running tab and settled at checkout.
    // Emergencies and covered payment types always skip billing-first regardless of mode.
    const requiresPayment =
      billingMode === 'pre_pay' &&
      !!dto.paymentType &&
      !skipPaymentTypes.includes(dto.paymentType) &&
      !isEmergency;
    const initialQueueStatus = requiresPayment ? QueueStatus.PENDING_PAYMENT : QueueStatus.WAITING;

    return {
      valid: true,
      resolvedPriority,
      requiresPayment,
      initialQueueStatus,
      servicePointCapacityLimit: limit || null,
    };
  }

  async getServiceConfig(facilityId: string, tenantId?: string): Promise<Record<string, any>> {
    const setting = await this.systemSettingRepository.findOne({
      where: { key: `${SERVICE_CONFIG_KEY}.${facilityId}` },
    });
    if (!setting) return this.getDefaultServiceConfig();
    return setting.value;
  }

  /**
   * Read tenant-level billing defaults from system_settings.
   *   billing.mode                    -> 'pre_pay' | 'post_pay'  (default: 'post_pay')
   *   billing.consultationFee         -> number                  (default: null = use service catalog)
   *   billing.mode.<payerType>        -> 'pre_pay' | 'post_pay'  per-payer override
   *      payerType ∈ cash | mobile_money | card | insurance | hospital_scheme | staff | membership
   * These values can be set per-tenant in Admin → System Settings.
   */
  async getBillingDefaults(
    tenantId?: string,
  ): Promise<{
    mode: 'pre_pay' | 'post_pay';
    consultationFee: number | null;
    modeByPayer: Record<string, 'pre_pay' | 'post_pay'>;
  }> {
    const baseKeys = ['billing.mode', 'billing.consultationFee'];
    const payerKeys = [
      'cash',
      'mobile_money',
      'card',
      'insurance',
      'hospital_scheme',
      'staff',
      'membership',
    ].map((p) => `billing.mode.${p}`);
    const allKeys = [...baseKeys, ...payerKeys];
    const where = tenantId
      ? { tenantId, key: In(allKeys) }
      : { key: In(allKeys) };
    const rows = await this.systemSettingRepository.find({ where: where as any });
    const map = new Map<string, any>();
    for (const r of rows) map.set(r.key, r.value);
    const rawMode = map.get('billing.mode');
    const mode: 'pre_pay' | 'post_pay' =
      rawMode === 'pre_pay' || rawMode === 'post_pay' ? rawMode : 'post_pay';
    const rawFee = map.get('billing.consultationFee');
    const fee = rawFee != null && !isNaN(Number(rawFee)) ? Number(rawFee) : null;
    const modeByPayer: Record<string, 'pre_pay' | 'post_pay'> = {};
    for (const pk of payerKeys) {
      const v = map.get(pk);
      if (v === 'pre_pay' || v === 'post_pay') {
        modeByPayer[pk.replace('billing.mode.', '')] = v;
      }
    }
    return { mode, consultationFee: fee, modeByPayer };
  }

  async upsertServiceConfig(
    facilityId: string,
    dto: ServiceConfigDto,
    tenantId?: string,
  ): Promise<Record<string, any>> {
    const existing = await this.systemSettingRepository.findOne({
      where: { key: `${SERVICE_CONFIG_KEY}.${facilityId}` },
    });
    const merged = { ...(existing?.value || this.getDefaultServiceConfig()), ...dto };
    if (existing) {
      existing.value = merged;
      await this.systemSettingRepository.save(existing);
    } else {
      await this.systemSettingRepository.save(
        this.systemSettingRepository.create({
          key: `${SERVICE_CONFIG_KEY}.${facilityId}`,
          value: merged,
          description: 'Queue management service configuration for facility',
        }),
      );
    }
    return merged;
  }

  private getDefaultServiceConfig(): Record<string, any> {
    return {
      opdEntryPoint: ServicePoint.TRIAGE,
      capacityLimits: {},
      priorityRules: [
        { condition: 'elderly', priority: QueuePriority.ELDERLY, label: 'Elderly (65+)' },
        { condition: 'pregnant', priority: QueuePriority.PREGNANT, label: 'Pregnant' },
        { condition: 'child', priority: QueuePriority.PEDIATRIC, label: 'Child (<12)' },
        { condition: 'disabled', priority: QueuePriority.DISABLED, label: 'Disabled / Wheelchair' },
        { condition: 'appears_unwell', priority: QueuePriority.URGENT, label: 'Appears Unwell' },
        { condition: 'emergency', priority: QueuePriority.EMERGENCY, label: 'Emergency' },
      ],
      triageDispositions: [
        { value: 'opd', label: 'OPD Consultation', servicePoint: ServicePoint.CONSULTATION },
        {
          value: 'emergency',
          label: 'Emergency Ward',
          servicePoint: ServicePoint.EMERGENCY,
          priority: QueuePriority.URGENT,
        },
        { value: 'direct-admit', label: 'Direct Admission (IPD)', servicePoint: ServicePoint.IPD },
        { value: 'observation', label: 'Observation', servicePoint: ServicePoint.CONSULTATION },
        { value: 'lab-only', label: 'Lab Only', servicePoint: ServicePoint.LABORATORY },
        { value: 'pharmacy-only', label: 'Pharmacy Pickup', servicePoint: ServicePoint.PHARMACY },
      ],
    };
  }

  // ─── Add to Queue ─────────────────────────────────────────────────────────

  async addToQueue(
    dto: CreateQueueDto,
    userId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<Queue> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const validation = await this.validateQueueRequest(dto, facilityId, tenantId);
    const resolvedPriority = validation.resolvedPriority;

    // Determine if payment is required before queueing
    const initialQueueStatus = validation.initialQueueStatus;
    const isEmergency =
      dto.visitType === 'emergency' || resolvedPriority === QueuePriority.EMERGENCY;

    const servicePointPrefix = this.getServicePointPrefix(dto.servicePoint as string);
    const queueDateKey = today.toISOString().slice(0, 10);

    // Ticket-number generation + queue insert is racy under concurrent requests:
    // two writers can read the same MAX(ticket_number) and collide on the unique
    // index IDX_queue_facility_ticket_date. Two layers of protection:
    //   1) Inside the transaction, take a pg_advisory_xact_lock keyed by
    //      (facility, servicePoint, date) so ticket generation is serialised.
    //   2) Wrap the whole transaction in a retry on Postgres unique_violation
    //      (SQLSTATE 23505) as defence-in-depth.
    const maxTicketAttempts = 3;
    let ticketAttempt = 0;
    let txResult!: {
      savedEncounter: Encounter;
      savedInvoice: Invoice | null;
      saved: Queue;
      ticketNumber: string;
      assignedDoctorId?: string;
    };
    // eslint-disable-next-line no-constant-condition
    while (true) {
      try {
        txResult = await this.dataSource.transaction(async (manager) => {
          await manager.query(
            'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
            [`queue:${facilityId}:${servicePointPrefix}:${queueDateKey}`],
          );

          const ticketNumber = await this.generateTicketNumber(
            facilityId,
            dto.servicePoint as ServicePoint,
            today,
            tenantId,
            manager,
          );
          const sequenceNumber = await this.getNextSequenceNumber(
            facilityId,
            dto.servicePoint as ServicePoint,
            today,
            tenantId,
            manager,
          );

          const visitNumber = `VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
          const encounter = this.encounterRepository.create({
            visitNumber,
            patientId: dto.patientId,
            facilityId,
            departmentId: dto.departmentId,
            createdById: userId,
            type: isEmergency ? EncounterType.EMERGENCY : EncounterType.OPD,
            status: EncounterStatus.REGISTERED,
            chiefComplaint: dto.chiefComplaintAtToken || 'OPD Visit',
            queueNumber: sequenceNumber,
            payerType: this.mapPaymentTypeToPayer(dto.paymentType),
            ...(tenantId ? { tenantId } : {}),
          });
          const txEncounter = (await manager.save(encounter)) as Encounter;

          // R3: Auto-assign least-loaded on-duty doctor when none explicitly chosen
          // and the patient is heading to consultation. Done BEFORE invoice creation so
          // the per-doctor fee override can be applied during fee resolution.
          let resolvedAssignedDoctorId = dto.assignedDoctorId;
          if (
            !resolvedAssignedDoctorId &&
            (dto.servicePoint as ServicePoint) === ServicePoint.CONSULTATION &&
            process.env.QUEUE_AUTO_ASSIGN_DOCTOR !== 'false'
          ) {
            resolvedAssignedDoctorId =
              (await this.pickAvailableDoctor(facilityId, dto.departmentId, tenantId)) || undefined;
            if (resolvedAssignedDoctorId) {
              this.logger.log(
                `Auto-assigned doctor ${resolvedAssignedDoctorId} to queue ticket ${ticketNumber} (least-loaded on-duty)`,
              );
            }
          }

          // Auto-create consultation invoice (non-blocking within the transaction)
          let txInvoice: Invoice | null = null;
          try {
            txInvoice = await this.createConsultationInvoice(
              dto.patientId,
              txEncounter.id,
              facilityId,
              userId,
              dto.paymentType,
              dto.consultationFee,
              dto.insurancePolicyId,
              tenantId,
              manager,
              resolvedAssignedDoctorId,
              dto.departmentId,
            );
            this.logger.log(`Invoice ${txInvoice.invoiceNumber} created for token ${ticketNumber}`);
          } catch (err) {
            // Non-blocking: if invoice creation fails, still issue the token
            this.logger.warn(
              `Failed to auto-create invoice for token ${ticketNumber}: ${err.message}`,
            );
          }

          const queue = this.queueRepository.create({
            ...dto,
            assignedDoctorId: resolvedAssignedDoctorId,
            servicePoint: dto.servicePoint as ServicePoint,
            ticketNumber,
            sequenceNumber,
            queueDate: today,
            facilityId,
            createdById: userId,
            encounterId: txEncounter.id,
            status: initialQueueStatus,
            priority: resolvedPriority,
            visitType: dto.visitType,
            chiefComplaintAtToken: dto.chiefComplaintAtToken,
            patientConditionFlags: dto.patientConditionFlags,
            ...(tenantId ? { tenantId } : {}),
          });

          queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(
            facilityId,
            dto.servicePoint as ServicePoint,
            today,
            tenantId,
          );

          const txSaved = await manager.save(queue);

          return {
            savedEncounter: txEncounter,
            savedInvoice: txInvoice,
            saved: txSaved,
            ticketNumber,
            assignedDoctorId: resolvedAssignedDoctorId,
          };
        });
        break;
      } catch (err: any) {
        const code = (err && (err.code || (err.driverError && err.driverError.code))) as
          | string
          | undefined;
        const constraint = (err &&
          (err.constraint || (err.driverError && err.driverError.constraint))) as
          | string
          | undefined;
        const detail = ((err && (err.detail || (err.driverError && err.driverError.detail))) ||
          '') as string;
        const isTicketConflict =
          code === '23505' &&
          ((constraint || '').includes('queue_facility_ticket_date') ||
            detail.includes('ticket_number'));
        if (!isTicketConflict || ticketAttempt >= maxTicketAttempts - 1) {
          throw err;
        }
        ticketAttempt += 1;
        this.logger.warn(
          `Queue ticket race detected (attempt ${ticketAttempt}/${maxTicketAttempts}); retrying...`,
        );
        await new Promise((r) => setTimeout(r, 25 + Math.floor(Math.random() * 50)));
      }
    }

    const { savedEncounter, savedInvoice, saved } = txResult;

    const finalAssignedDoctorId = txResult.assignedDoctorId || dto.assignedDoctorId;
    if (finalAssignedDoctorId) {
      await this.updateDoctorQueueCount(finalAssignedDoctorId, facilityId, tenantId);
    }

    await this.writeAuditLog(saved.id, 'QUEUE_CREATED', userId, null, initialQueueStatus);

    const result = await this.queueRepository.findOne({
      where: { id: saved.id, ...(tenantId ? { tenantId } : {}) },
      relations: ['patient', 'encounter'],
    });

    // Attach invoice info to the response for the frontend
    if (result && savedInvoice) {
      (result as any).invoiceId = savedInvoice.id;
      (result as any).invoiceNumber = savedInvoice.invoiceNumber;
      (result as any).invoiceAmount = savedInvoice.totalAmount;
    }

    return result as Queue;
  }

  /**
   * Resolve consultation fee using a most-specific-wins chain:
   *   1. Per-doctor override → system_setting key `billing.consultationFee.doctor.<doctorId>` (number)
   *   2. Per-department service code → service `OPD-CONSULT-{DEPT_CODE}` (uppercased, spaces→`_`)
   *   3. Per-department service.department field → service with code `OPD-CONSULT` whose `department` matches
   *   4. Generic facility-scoped service `OPD-CONSULT`
   *   5. Generic global service `OPD-CONSULT`
   *   6. Tenant `billing.consultationFee` system_setting
   * Returns { fee: null } when nothing is configured so the caller can decide.
   */
  async resolveConsultationFee(opts: {
    facilityId: string;
    tenantId?: string;
    doctorId?: string;
    departmentId?: string;
  }): Promise<{ fee: number | null; source: string }> {
    const { facilityId, tenantId, doctorId, departmentId } = opts;

    // 1. Per-doctor override
    if (doctorId) {
      const where: any = { key: `billing.consultationFee.doctor.${doctorId}` };
      if (tenantId) where.tenantId = tenantId;
      const setting = await this.systemSettingRepository.findOne({ where });
      const raw = setting?.value;
      const num = raw != null && !isNaN(Number(raw)) ? Number(raw) : null;
      if (num != null && num > 0) return { fee: num, source: `doctor:${doctorId}` };
    }

    // 2 & 3. Per-department resolution
    if (departmentId) {
      const dept = await this.departmentRepository.findOne({
        where: { id: departmentId, ...(tenantId ? { tenantId } : {}) } as any,
      });
      if (dept) {
        const deptCode = (dept.code || dept.name || '')
          .toString()
          .trim()
          .toUpperCase()
          .replace(/\s+/g, '_');
        if (deptCode) {
          // 2. dedicated specialty service code
          const specialtyService = await this.serviceRepository.findOne({
            where: {
              code: `OPD-CONSULT-${deptCode}`,
              isActive: true,
              ...(tenantId ? { tenantId } : {}),
            } as any,
          });
          if (specialtyService) {
            return {
              fee: Number(specialtyService.basePrice),
              source: `service:OPD-CONSULT-${deptCode}`,
            };
          }
        }
        // 3. generic OPD-CONSULT scoped to this department via the `department` column
        const deptScopedService = await this.serviceRepository.findOne({
          where: {
            code: 'OPD-CONSULT',
            department: dept.name,
            isActive: true,
            ...(tenantId ? { tenantId } : {}),
          } as any,
        });
        if (deptScopedService) {
          return {
            fee: Number(deptScopedService.basePrice),
            source: `service:OPD-CONSULT[dept=${dept.name}]`,
          };
        }
      }
    }

    // 4. Facility-scoped OPD-CONSULT
    const facilityService = await this.serviceRepository.findOne({
      where: {
        code: 'OPD-CONSULT',
        facilityId,
        isActive: true,
        ...(tenantId ? { tenantId } : {}),
      } as any,
    });
    if (facilityService) {
      return { fee: Number(facilityService.basePrice), source: 'service:OPD-CONSULT[facility]' };
    }

    // 5. Global OPD-CONSULT
    const globalService = await this.serviceRepository.findOne({
      where: { code: 'OPD-CONSULT', isActive: true },
    });
    if (globalService) {
      return { fee: Number(globalService.basePrice), source: 'service:OPD-CONSULT[global]' };
    }

    // 6. Tenant default
    const billingDefaults = await this.getBillingDefaults(tenantId);
    if (billingDefaults.consultationFee != null) {
      return { fee: billingDefaults.consultationFee, source: 'system_setting:billing.consultationFee' };
    }
    return { fee: null, source: 'unresolved' };
  }

  /**
   * Map frontend payment type string to encounter PayerType
   */
  private mapPaymentTypeToPayer(paymentType?: string): PayerType {
    if (!paymentType) return PayerType.CASH;
    switch (paymentType) {
      case 'insurance':
        return PayerType.INSURANCE;
      case 'hospital_scheme':
      case 'staff':
      case 'membership':
        return PayerType.CORPORATE;
      default:
        return PayerType.CASH;
    }
  }

  /**
   * Auto-create a consultation invoice when a token is issued
   */
  private async createConsultationInvoice(
    patientId: string,
    encounterId: string,
    facilityId: string,
    userId: string,
    paymentType?: string,
    feeOverride?: number,
    insurancePolicyId?: string,
    tenantId?: string,
    manager?: EntityManager,
    assignedDoctorId?: string,
    departmentId?: string,
  ): Promise<Invoice> {
    let fee = feeOverride;
    let feeSource = 'override';
    if (!fee || fee <= 0) {
      const resolved = await this.resolveConsultationFee({
        facilityId,
        tenantId,
        doctorId: assignedDoctorId,
        departmentId,
      });
      fee = resolved.fee ?? undefined;
      feeSource = resolved.source;
      if (fee == null) {
        throw new BadRequestException(
          'Consultation fee is not configured. Set a per-doctor override, an OPD-CONSULT-{DEPT} service, the OPD-CONSULT service, or system_setting `billing.consultationFee`.',
        );
      }
    }
    this.logger.log(
      `Consultation fee resolved to ${fee} via ${feeSource} (doctor=${assignedDoctorId ?? '-'}, dept=${departmentId ?? '-'})`,
    );

    // Generate invoice number
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const lastInvoice = await this.invoiceRepository
      .createQueryBuilder('inv')
      .where('inv.invoice_number LIKE :prefix', { prefix: `INV${datePrefix}%` })
      .orderBy('inv.invoice_number', 'DESC')
      .getOne();
    let seq = 1;
    if (lastInvoice) {
      seq = parseInt(lastInvoice.invoiceNumber.slice(-4), 10) + 1;
    }
    const invoiceNumber = `INV${datePrefix}${seq.toString().padStart(4, '0')}`;

    // Map payment type
    let invoicePaymentType = PaymentType.CASH;
    if (paymentType === 'insurance') invoicePaymentType = PaymentType.INSURANCE;
    else if (['hospital_scheme', 'staff', 'membership'].includes(paymentType || ''))
      invoicePaymentType = PaymentType.CORPORATE;

    // Create the invoice item
    const item = this.invoiceItemRepository.create({
      serviceCode: 'OPD-CONSULT',
      description: 'OPD Consultation Fee',
      chargeType: ChargeType.CONSULTATION,
      quantity: 1,
      unitPrice: fee,
      amount: fee,
      ...(tenantId ? { tenantId } : {}),
    });

    // Create the invoice
    const invoice = this.invoiceRepository.create({
      invoiceNumber,
      patientId,
      encounterId,
      createdById: userId,
      subtotal: fee,
      taxAmount: 0,
      discountAmount: 0,
      totalAmount: fee,
      amountPaid: 0,
      balanceDue: fee,
      paymentType: invoicePaymentType,
      insurancePolicyId: insurancePolicyId || undefined,
      status: InvoiceStatus.PENDING,
      items: [item],
      ...(tenantId ? { tenantId } : {}),
    });

    return manager ? manager.save(invoice) : this.invoiceRepository.save(invoice);
  }

  // ─── Get Queue ────────────────────────────────────────────────────────────

  async getQueue(filter: QueueFilterDto, facilityId: string, tenantId?: string): Promise<Queue[]> {
    const today = filter.date ? new Date(filter.date) : new Date();
    today.setHours(0, 0, 0, 0);

    const query = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .leftJoinAndSelect('encounter.department', 'department')
      .leftJoinAndSelect('queue.servingUser', 'servingUser')
      .leftJoinAndSelect('queue.assignedDoctor', 'assignedDoctor')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('(DATE(queue.queue_date) = DATE(:today) OR queue.status IN (:...activeStatuses))', {
        today,
        activeStatuses: [
          QueueStatus.WAITING,
          QueueStatus.CALLED,
          QueueStatus.IN_SERVICE,
          QueueStatus.PENDING_PAYMENT,
        ],
      });

    if (tenantId) {
      query.andWhere('queue.tenant_id = :tenantId', { tenantId });
    }

    if (filter.servicePoint) {
      query.andWhere('queue.servicePoint = :servicePoint', { servicePoint: filter.servicePoint });
    }
    if (filter.status) {
      const statuses = filter.status.split(',').map((s) => s.trim());
      if (statuses.length === 1) {
        query.andWhere('queue.status = :status', { status: statuses[0] });
      } else {
        query.andWhere('queue.status IN (:...statuses)', { statuses });
      }
    }
    if (filter.departmentId) {
      query.andWhere('queue.department_id = :departmentId', { departmentId: filter.departmentId });
    }
    if (filter.assignedDoctorId) {
      query.andWhere('queue.assigned_doctor_id = :assignedDoctorId', {
        assignedDoctorId: filter.assignedDoctorId,
      });
    }

    query.orderBy('queue.priority', 'ASC').addOrderBy('queue.sequence_number', 'ASC');
    return query.getMany();
  }

  async getWaitingQueue(
    servicePoint: ServicePoint,
    facilityId: string,
    tenantId?: string,
  ): Promise<Queue[]> {
    const qb = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .leftJoinAndSelect('encounter.department', 'department')
      .leftJoinAndSelect('queue.assignedDoctor', 'assignedDoctor')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint })
      .andWhere('queue.on_hold = false')
      .andWhere('queue.status IN (:...statuses)', {
        statuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE],
      });

    if (tenantId) {
      qb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    }

    return qb.orderBy('queue.priority', 'ASC').addOrderBy('queue.sequence_number', 'ASC').getMany();
  }

  /**
   * Get the doctor's queue: patients assigned to this doctor (any service point)
   * OR unassigned patients at the consultation service point.
   */
  async getDoctorQueue(
    doctorId: string,
    facilityId: string,
    tenantId?: string,
    myOnly = false,
  ): Promise<Queue[]> {
    const qb = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .leftJoinAndSelect('encounter.department', 'department')
      .leftJoinAndSelect('queue.assignedDoctor', 'assignedDoctor')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.on_hold = false')
      .andWhere('queue.status IN (:...statuses)', {
        statuses: [
          QueueStatus.WAITING,
          QueueStatus.CALLED,
          QueueStatus.IN_SERVICE,
          QueueStatus.PENDING_PAYMENT,
        ],
      });

    if (tenantId) {
      qb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    }

    if (myOnly) {
      // Only patients explicitly assigned to this doctor
      qb.andWhere('queue.assigned_doctor_id = :doctorId', { doctorId });
    } else {
      // Patients assigned to this doctor (any SP) OR unassigned at consultation
      qb.andWhere(
        '(queue.assigned_doctor_id = :doctorId OR (queue.assigned_doctor_id IS NULL AND queue.servicePoint = :consultation))',
        { doctorId, consultation: ServicePoint.CONSULTATION },
      );
    }

    return qb.orderBy('queue.priority', 'ASC').addOrderBy('queue.sequence_number', 'ASC').getMany();
  }

  // ─── Call Next / Call ─────────────────────────────────────────────────────

  async callNext(
    dto: CallNextDto,
    userId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<Queue | null> {
    // Prefer WAITING patients first, then fall back to CALLED (re-call) and PENDING_PAYMENT
    for (const statuses of [
      [QueueStatus.WAITING],
      [QueueStatus.CALLED, QueueStatus.PENDING_PAYMENT],
    ]) {
      const qb = this.queueRepository
        .createQueryBuilder('queue')
        .leftJoinAndSelect('queue.patient', 'patient')
        .leftJoinAndSelect('queue.encounter', 'encounter')
        .leftJoinAndSelect('encounter.department', 'department')
        .where('queue.facility_id = :facilityId', { facilityId })
        .andWhere('queue.servicePoint = :servicePoint', { servicePoint: dto.servicePoint })
        .andWhere('queue.status IN (:...statuses)', { statuses })
        .andWhere('queue.on_hold = false');
      if (tenantId) qb.andWhere('queue.tenant_id = :tenantId', { tenantId });
      const result = await qb
        .orderBy('queue.priority', 'ASC')
        .addOrderBy('queue.sequence_number', 'ASC')
        .getOne();

      if (result) {
        return this.callPatient(
          result.id,
          userId,
          facilityId,
          dto.counterNumber,
          dto.roomNumber,
          tenantId,
        );
      }
    }

    return null;
  }

  async callPatient(
    id: string,
    userId: string,
    facilityId: string,
    counterNumber?: string,
    roomNumber?: string,
    tenantId?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);

    // If already called, treat as recall (re-call) instead of rejecting
    if (queue.status === QueueStatus.CALLED) {
      return this.recallPatient(id, userId, tenantId);
    }

    // If already in service, just return the current queue entry
    if (queue.status === QueueStatus.IN_SERVICE) {
      this.logger.log(`Queue ${id}: already IN_SERVICE, returning current entry`);
      return queue;
    }

    // Auto-transition pending_payment → waiting so patient can be called
    if (queue.status === QueueStatus.PENDING_PAYMENT) {
      queue.status = QueueStatus.WAITING;
      await this.queueRepository.save(queue);
      this.logger.log(`Queue ${id}: PENDING_PAYMENT → WAITING (auto-transition on call)`);
    }

    // Auto-transition transferred → waiting so patient can be called at new service point
    if (queue.status === QueueStatus.TRANSFERRED) {
      queue.status = QueueStatus.WAITING;
      await this.queueRepository.save(queue);
      this.logger.log(`Queue ${id}: TRANSFERRED → WAITING (auto-transition on call)`);
    }

    this.assertValidTransition(queue.status, QueueStatus.CALLED);

    const prevStatus = queue.status;
    queue.status = QueueStatus.CALLED;
    queue.calledAt = new Date();
    queue.servingUserId = userId;
    queue.callCount = (queue.callCount || 0) + 1;

    if (counterNumber) queue.counterNumber = counterNumber;

    if (roomNumber) {
      queue.roomNumber = roomNumber;
    } else if (!queue.roomNumber) {
      const todayStr = new Date().toISOString().split('T')[0];
      const duty = await this.doctorDutyRepository.findOne({
        where: { doctorId: userId, facilityId, dutyDate: new Date(todayStr) },
      });
      if (duty?.roomNumber) queue.roomNumber = duty.roomNumber;
    }

    const saved = await this.queueRepository.save(queue);

    // Sync encounter
    await this.syncEncounterStatus(queue.encounterId, EncounterStatus.WAITING);
    await this.writeAuditLog(id, 'PATIENT_CALLED', userId, prevStatus, QueueStatus.CALLED);

    // SMS notification if patient has a phone number
    this.sendCallNotification(queue).catch((e) =>
      this.logger.warn('SMS notification failed: ' + e.message),
    );

    return saved;
  }

  async recallPatient(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    const recallableStatuses = [
      QueueStatus.CALLED,
      QueueStatus.IN_SERVICE,
      QueueStatus.COMPLETED,
      QueueStatus.NO_SHOW,
      QueueStatus.SKIPPED,
    ];
    if (!recallableStatuses.includes(queue.status)) {
      throw new BadRequestException('Patient cannot be recalled from current status');
    }
    const prevStatus = queue.status;
    queue.status = QueueStatus.CALLED;
    queue.callCount = (queue.callCount || 0) + 1;
    queue.calledAt = new Date();
    queue.servingUserId = userId;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_RECALLED', userId, prevStatus, QueueStatus.CALLED);
    this.sendCallNotification(queue).catch((e) =>
      this.logger.warn('SMS notification failed: ' + e.message),
    );
    return saved;
  }

  // ─── Start / Complete Service ─────────────────────────────────────────────

  async startService(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);

    // Payment enforcement: block service start for unpaid patients
    if (queue.status === QueueStatus.PENDING_PAYMENT) {
      const paidInvoice = await this.invoiceRepository.findOne({
        where: {
          encounterId: queue.encounterId,
          status: In([InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID]),
          ...(tenantId ? { tenantId } : {}),
        },
      });

      if (!paidInvoice) {
        throw new BadRequestException(
          'Cannot start service: patient has pending payment. Direct to Billing/Cashier first.',
        );
      }

      // Payment verified — auto-transition to WAITING so normal flow continues
      queue.status = QueueStatus.WAITING;
      await this.queueRepository.save(queue);
      this.logger.log(`Queue ${id}: PENDING_PAYMENT → WAITING (payment verified)`);
    }

    this.assertValidTransition(queue.status, QueueStatus.IN_SERVICE);

    const prevStatus = queue.status;
    queue.status = QueueStatus.IN_SERVICE;
    queue.serviceStartedAt = new Date();
    queue.servingUserId = userId;

    if (queue.createdAt) {
      queue.actualWaitMinutes = Math.round((Date.now() - queue.createdAt.getTime()) / 60000);
    }

    const saved = await this.queueRepository.save(queue);
    await this.syncEncounterStatus(queue.encounterId, EncounterStatus.IN_CONSULTATION);
    await this.writeAuditLog(id, 'SERVICE_STARTED', userId, prevStatus, QueueStatus.IN_SERVICE);
    return saved;
  }

  async completeService(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.COMPLETED);

    const prevStatus = queue.status;
    queue.status = QueueStatus.COMPLETED;
    queue.serviceEndedAt = new Date();

    if (queue.serviceStartedAt) {
      queue.serviceDurationMinutes = Math.round(
        (queue.serviceEndedAt.getTime() - queue.serviceStartedAt.getTime()) / 60000,
      );
    }

    const saved = await this.queueRepository.save(queue);
    await this.syncEncounterStatus(queue.encounterId, EncounterStatus.COMPLETED);
    await this.writeAuditLog(id, 'SERVICE_COMPLETED', userId, prevStatus, QueueStatus.COMPLETED);
    return saved;
  }

  // ─── Find by Encounter ID ────────────────────────────────────────────────

  async findByEncounterId(encounterId: string, tenantId?: string): Promise<Queue | null> {
    return this.queueRepository.findOne({
      where: {
        encounterId,
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Triage Disposition → Auto-route to downstream service ───────────────

  async completeTriageWithDisposition(
    id: string,
    dispositionValue: string,
    userId: string,
    tenantId?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);

    if (queue.servicePoint !== ServicePoint.TRIAGE) {
      throw new BadRequestException('Queue is not at Triage service point');
    }

    const config = await this.getServiceConfig(queue.facilityId, tenantId);
    const dispositions: Array<{
      value: string;
      label: string;
      servicePoint: string;
      priority?: number;
    }> = config.triageDispositions || this.getDefaultServiceConfig().triageDispositions;
    const disposition = dispositions.find((d) => d.value === dispositionValue);

    if (!disposition) {
      throw new BadRequestException(
        `Invalid triage disposition: ${dispositionValue}. Valid: ${dispositions.map((d) => d.value).join(', ')}`,
      );
    }

    // If triage hasn't started service yet, start it first so transfer is valid
    if (queue.status === QueueStatus.WAITING || queue.status === QueueStatus.CALLED) {
      queue.status = QueueStatus.IN_SERVICE;
      queue.serviceStartedAt = new Date();
      queue.servingUserId = userId;
      await this.queueRepository.save(queue);
    }

    this.logger.log(
      `Triage disposition: queue=${id}, disposition=${dispositionValue}, next=${disposition.servicePoint}`,
    );

    return this.transferToNextService(
      id,
      {
        nextServicePoint: disposition.servicePoint as ServicePoint,
        transferReason: `Triage disposition: ${disposition.label}`,
      },
      userId,
      tenantId,
    );
  }

  // ─── Transfer ─────────────────────────────────────────────────────────────

  async transferToNextService(
    id: string,
    dto: TransferQueueDto,
    userId: string,
    tenantId?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.TRANSFERRED);

    if (!Object.values(ServicePoint).includes(dto.nextServicePoint as ServicePoint)) {
      throw new BadRequestException(`Invalid service point: ${dto.nextServicePoint}`);
    }

    const prevServicePoint = queue.servicePoint;
    const prevStatus = queue.status;

    if (queue.serviceStartedAt) {
      queue.serviceDurationMinutes = Math.round(
        (Date.now() - queue.serviceStartedAt.getTime()) / 60000,
      );
    }

    // Preserve patient context across the transfer
    queue.previousServicePoint = prevServicePoint;
    queue.servicePoint = dto.nextServicePoint as ServicePoint;
    queue.status = QueueStatus.WAITING;
    queue.transferReason = dto.transferReason || '';
    queue.serviceEndedAt = new Date();

    // Carry forward assigned doctor if provided in DTO, else keep existing
    if (dto.assignedDoctorId) {
      queue.assignedDoctorId = dto.assignedDoctorId;
    }

    // Update queueDate to today so ticket generation and unique constraint are aligned
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    queue.queueDate = today;
    queue.ticketNumber = await this.generateTicketNumber(
      queue.facilityId,
      dto.nextServicePoint as ServicePoint,
      today,
      tenantId,
    );
    queue.sequenceNumber = await this.getNextSequenceNumber(
      queue.facilityId,
      dto.nextServicePoint as ServicePoint,
      today,
      tenantId,
    );
    queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(
      queue.facilityId,
      dto.nextServicePoint as ServicePoint,
      today,
      tenantId,
    );

    // Reset per-service-point fields; preserve cross-service context (use null, not undefined)
    queue.calledAt = null as any;
    queue.serviceStartedAt = null as any;
    queue.servingUserId = null as any;
    queue.callCount = 0;
    queue.counterNumber = null as any;
    queue.roomNumber = null as any;

    try {
      const saved = await this.queueRepository.save(queue);

      // Sync encounter to correct intermediate status based on destination
      const encounterStatus = this.mapServicePointToEncounterStatus(dto.nextServicePoint);
      await this.syncEncounterStatus(queue.encounterId, encounterStatus);
      await this.writeAuditLog(
        id,
        `TRANSFERRED_${prevServicePoint.toUpperCase()}_TO_${dto.nextServicePoint.toUpperCase()}`,
        userId,
        prevStatus,
        QueueStatus.WAITING,
        dto.transferReason,
      );

      return saved;
    } catch (error) {
      // Retry once on unique constraint violation (race condition on ticket number)
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        this.logger.warn(`Ticket collision during transfer for queue ${id}, retrying...`);
        queue.ticketNumber = await this.generateTicketNumber(
          queue.facilityId,
          dto.nextServicePoint as ServicePoint,
          today,
          tenantId,
        );
        queue.sequenceNumber = await this.getNextSequenceNumber(
          queue.facilityId,
          dto.nextServicePoint as ServicePoint,
          today,
          tenantId,
        );
        const saved = await this.queueRepository.save(queue);
        const encounterStatus = this.mapServicePointToEncounterStatus(dto.nextServicePoint);
        await this.syncEncounterStatus(queue.encounterId, encounterStatus);
        await this.writeAuditLog(
          id,
          `TRANSFERRED_${prevServicePoint.toUpperCase()}_TO_${dto.nextServicePoint.toUpperCase()}`,
          userId,
          prevStatus,
          QueueStatus.WAITING,
          dto.transferReason,
        );
        return saved;
      }
      throw error;
    }
  }

  // ─── System-driven service point move (no transition validation) ─────────

  async moveToServicePoint(
    encounterId: string,
    servicePoint: string,
    reason?: string,
    tenantId?: string,
  ): Promise<Queue | null> {
    const queue = await this.queueRepository.findOne({
      where: {
        encounterId,
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
        ...(tenantId ? { tenantId } : {}),
      },
      order: { createdAt: 'DESC' },
    });

    if (queue) {
      queue.previousServicePoint = queue.servicePoint;
      queue.servicePoint = servicePoint as ServicePoint;
      queue.transferReason = reason || '';

      const saved = await this.queueRepository.save(queue);

      // Sync encounter status
      const encounterStatus = this.mapServicePointToEncounterStatus(servicePoint);
      await this.syncEncounterStatus(encounterId, encounterStatus);

      return saved;
    }

    // No active queue entry — create one from the encounter so the patient
    // appears in the target service point's queue (e.g. laboratory, radiology).
    const encounter = await this.encounterRepository.findOne({
      where: { id: encounterId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!encounter) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const ticketNumber = await this.generateTicketNumber(
      encounter.facilityId,
      servicePoint as ServicePoint,
      today,
      tenantId,
    );
    const sequenceNumber = await this.getNextSequenceNumber(
      encounter.facilityId,
      servicePoint as ServicePoint,
      today,
      tenantId,
    );

    const newQueue = this.queueRepository.create({
      ticketNumber,
      sequenceNumber,
      queueDate: today,
      servicePoint: servicePoint as ServicePoint,
      status: QueueStatus.WAITING,
      priority: QueuePriority.ROUTINE,
      patientId: encounter.patientId,
      encounterId,
      facilityId: encounter.facilityId,
      createdById: encounter.createdById,
      transferReason: reason || '',
      ...(tenantId ? { tenantId } : {}),
    });

    const saved = await this.queueRepository.save(newQueue);

    const encounterStatus = this.mapServicePointToEncounterStatus(servicePoint);
    await this.syncEncounterStatus(encounterId, encounterStatus);

    this.logger.log(
      `Created new queue entry ${ticketNumber} for encounter ${encounterId} at ${servicePoint}`,
    );

    return saved;
  }

  // ─── Skip / No-Show / Cancel / Requeue ───────────────────────────────────

  async skipPatient(
    id: string,
    dto: SkipQueueDto,
    userId: string,
    tenantId?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.SKIPPED);
    const prevStatus = queue.status;
    queue.status = QueueStatus.SKIPPED;
    queue.skipReason = dto.skipReason;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(
      id,
      'PATIENT_SKIPPED',
      userId,
      prevStatus,
      QueueStatus.SKIPPED,
      dto.skipReason,
    );
    return saved;
  }

  async markNoShow(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.NO_SHOW);
    const prevStatus = queue.status;
    queue.status = QueueStatus.NO_SHOW;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'NO_SHOW', userId, prevStatus, QueueStatus.NO_SHOW);
    return saved;
  }

  async cancelFromQueue(
    id: string,
    reason: string,
    userId: string,
    tenantId?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.CANCELLED);
    const prevStatus = queue.status;
    queue.status = QueueStatus.CANCELLED;
    queue.skipReason = reason;
    const saved = await this.queueRepository.save(queue);
    await this.syncEncounterStatus(queue.encounterId, EncounterStatus.CANCELLED);
    await this.writeAuditLog(
      id,
      'QUEUE_CANCELLED',
      userId,
      prevStatus,
      QueueStatus.CANCELLED,
      reason,
    );
    return saved;
  }

  async requeuePatient(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    if (![QueueStatus.SKIPPED, QueueStatus.NO_SHOW].includes(queue.status)) {
      throw new BadRequestException('Only skipped or no-show patients can be requeued');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check capacity before requeuing
    const config = await this.getServiceConfig(queue.facilityId);
    const capacityLimits: Record<string, number> = config.capacityLimits || {};
    const limit = capacityLimits[queue.servicePoint];
    if (limit) {
      const activeCount = await this.queueRepository.count({
        where: {
          facilityId: queue.facilityId,
          servicePoint: queue.servicePoint,
          queueDate: today,
          status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (activeCount >= limit) {
        throw new BadRequestException(`Queue at ${queue.servicePoint} is at capacity (${limit})`);
      }
    }

    const prevStatus = queue.status;
    queue.status = QueueStatus.WAITING;
    queue.sequenceNumber = await this.getNextSequenceNumber(
      queue.facilityId,
      queue.servicePoint,
      today,
      tenantId,
    );
    queue.calledAt = undefined as any;
    queue.skipReason = undefined as any;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_REQUEUED', userId, prevStatus, QueueStatus.WAITING);
    return saved;
  }

  // ─── Hold / Unhold ────────────────────────────────────────────────────────

  async holdQueue(
    id: string,
    dto: HoldQueueDto,
    userId: string,
    tenantId?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    if (queue.onHold) throw new BadRequestException('Queue entry is already on hold');
    if (queue.status === QueueStatus.COMPLETED || queue.status === QueueStatus.CANCELLED) {
      throw new BadRequestException('Cannot hold a completed or cancelled queue entry');
    }
    queue.onHold = true;
    queue.holdReason = dto.holdReason;
    queue.holdStartedAt = new Date();
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'QUEUE_HELD', userId, queue.status, queue.status, dto.holdReason);
    return saved;
  }

  async unholdQueue(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    if (!queue.onHold) throw new BadRequestException('Queue entry is not on hold');
    queue.onHold = false;
    queue.holdReason = undefined as any;
    queue.holdStartedAt = undefined as any;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'QUEUE_UNHELD', userId, queue.status, queue.status);
    return saved;
  }

  // ─── Find / Stats ─────────────────────────────────────────────────────────

  async findOne(id: string, tenantId?: string): Promise<Queue> {
    const queue = await this.queueRepository.findOne({
      where: { id, ...(tenantId ? { tenantId } : {}) },
      relations: ['patient', 'encounter', 'servingUser', 'department'],
    });
    if (!queue) throw new NotFoundException('Queue entry not found');
    return queue;
  }

  async getPatientQueueStatus(
    patientId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<Queue[]> {
    const qb = this.queueRepository
      .createQueryBuilder('queue')
      .where('queue.patient_id = :patientId', { patientId })
      .andWhere('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.status IN (:...statuses)', {
        statuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE],
      });
    if (tenantId) qb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    return qb.orderBy('queue.created_at', 'DESC').getMany();
  }

  async getQueueStats(facilityId: string, servicePoint?: string, tenantId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buildCountQuery = (status: QueueStatus) => {
      const qb = this.queueRepository
        .createQueryBuilder('queue')
        .where('queue.facility_id = :facilityId', { facilityId })
        .andWhere(
          '(DATE(queue.queue_date) = DATE(:today) OR queue.status IN (:...activeStatuses))',
          {
            today,
            activeStatuses: [
              QueueStatus.WAITING,
              QueueStatus.CALLED,
              QueueStatus.IN_SERVICE,
              QueueStatus.PENDING_PAYMENT,
            ],
          },
        )
        .andWhere('queue.status = :status', { status });
      if (tenantId) qb.andWhere('queue.tenant_id = :tenantId', { tenantId });
      if (servicePoint) qb.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
      return qb.getCount();
    };

    const [waitingOnly, called, inService, completed, noShow] = await Promise.all([
      buildCountQuery(QueueStatus.WAITING),
      buildCountQuery(QueueStatus.CALLED),
      buildCountQuery(QueueStatus.IN_SERVICE),
      buildCountQuery(QueueStatus.COMPLETED),
      buildCountQuery(QueueStatus.NO_SHOW),
    ]);

    const waiting = waitingOnly + called;

    const avgWaitQuery = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.actual_wait_minutes)', 'avgWait')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('(DATE(queue.queue_date) = DATE(:today) OR queue.status IN (:...activeStatuses))', {
        today,
        activeStatuses: [
          QueueStatus.WAITING,
          QueueStatus.CALLED,
          QueueStatus.IN_SERVICE,
          QueueStatus.PENDING_PAYMENT,
        ],
      })
      .andWhere('queue.actual_wait_minutes IS NOT NULL');
    if (tenantId) avgWaitQuery.andWhere('queue.tenant_id = :tenantId', { tenantId });
    if (servicePoint) avgWaitQuery.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
    const avgWaitResult = await avgWaitQuery.getRawOne();

    const avgServiceQuery = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.service_duration_minutes)', 'avgService')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('(DATE(queue.queue_date) = DATE(:today) OR queue.status IN (:...activeStatuses))', {
        today,
        activeStatuses: [
          QueueStatus.WAITING,
          QueueStatus.CALLED,
          QueueStatus.IN_SERVICE,
          QueueStatus.PENDING_PAYMENT,
        ],
      })
      .andWhere('queue.service_duration_minutes IS NOT NULL');
    if (tenantId) avgServiceQuery.andWhere('queue.tenant_id = :tenantId', { tenantId });
    if (servicePoint)
      avgServiceQuery.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
    const avgServiceResult = await avgServiceQuery.getRawOne();

    return {
      waiting,
      inService,
      completed,
      noShow,
      total: waiting + inService + completed + noShow,
      averageWaitMinutes: Math.round(avgWaitResult?.avgWait || 0),
      averageServiceMinutes: Math.round(avgServiceResult?.avgService || 0),
    };
  }

  async getQueueAuditLog(queueId: string, tenantId?: string): Promise<any[]> {
    return this.auditLogRepository.find({
      where: { entityType: 'queue', entityId: queueId, ...(tenantId ? { tenantId } : {}) },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Queue Display ────────────────────────────────────────────────────────

  async createDisplay(
    dto: CreateQueueDisplayDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<QueueDisplay> {
    const display = this.queueDisplayRepository.create({
      ...dto,
      facilityId,
      ...(tenantId ? { tenantId } : {}),
    } as any);
    return this.queueDisplayRepository.save(display) as unknown as QueueDisplay;
  }

  async getDisplays(facilityId: string, tenantId?: string): Promise<QueueDisplay[]> {
    return this.queueDisplayRepository.find({
      where: { facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) },
    });
  }

  async getDisplayQueue(displayCode: string, tenantId?: string): Promise<Queue[]> {
    const display = await this.queueDisplayRepository.findOne({
      where: { displayCode, isActive: true, ...(tenantId ? { tenantId } : {}) },
    });
    if (!display) throw new NotFoundException('Display not found');
    const displayQb = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .where('queue.facility_id = :facilityId', { facilityId: display.facilityId })
      .andWhere('queue.servicePoint IN (:...servicePoints)', {
        servicePoints: display.servicePoints,
      })
      .andWhere('queue.status IN (:...statuses)', {
        statuses: [QueueStatus.CALLED, QueueStatus.IN_SERVICE],
      });
    if (tenantId) displayQb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    return displayQb
      .orderBy('queue.called_at', 'DESC')
      .take(display.displaySettings?.maxDisplay || 10)
      .getMany();
  }

  // ─── Private Helpers ──────────────────────────────────────────────────────

  private assertValidTransition(from: QueueStatus, to: QueueStatus): void {
    const allowed = VALID_QUEUE_TRANSITIONS[from] || [];
    if (!allowed.includes(to)) {
      throw new BadRequestException(
        `Invalid queue transition: cannot move from '${from}' to '${to}'. Allowed next states: ${allowed.join(', ') || 'none'}`,
      );
    }
  }

  private async syncEncounterStatus(
    encounterId: string | undefined,
    status: EncounterStatus,
  ): Promise<void> {
    if (!encounterId) return;
    try {
      await this.encounterRepository.update({ id: encounterId }, { status });
    } catch (e) {
      this.logger.error(
        `Failed to sync encounter ${encounterId} to status ${status}: ${e.message}`,
      );
    }
  }

  private mapServicePointToEncounterStatus(servicePoint: string): EncounterStatus {
    const map: Record<string, EncounterStatus> = {
      consultation: EncounterStatus.WAITING,
      laboratory: EncounterStatus.PENDING_LAB,
      pharmacy: EncounterStatus.PENDING_PHARMACY,
      billing: EncounterStatus.PENDING_PAYMENT,
      cashier: EncounterStatus.PENDING_PAYMENT,
      ipd: EncounterStatus.ADMITTED,
      emergency: EncounterStatus.WAITING,
    };
    return map[servicePoint] || EncounterStatus.WAITING;
  }

  private resolvePriority(
    explicit?: QueuePriority,
    flags?: string[],
    config?: Record<string, any>,
  ): QueuePriority {
    if (explicit) return explicit;
    if (!flags || flags.length === 0) return QueuePriority.ROUTINE;

    const rules: Array<{ condition: string; priority: number }> =
      config?.priorityRules || this.getDefaultServiceConfig().priorityRules;

    let highestPriority = QueuePriority.ROUTINE;
    for (const flag of flags) {
      const rule = rules.find((r) => r.condition === flag);
      if (rule && rule.priority < highestPriority) {
        highestPriority = rule.priority as QueuePriority;
      }
    }
    return highestPriority;
  }

  /**
   * Smart wait time: prefer actual_wait_minutes (real measured wait) over
   * service_duration_minutes (consultation time only, which underestimates).
   * Rolling 7-day average for the service point, fallback to 15 min.
   */
  private async calculateSmartWaitTime(
    facilityId: string,
    servicePoint: string,
    today: Date,
    tenantId?: string,
  ): Promise<number> {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const waitingCount = await this.getWaitingCount(facilityId, servicePoint, today, tenantId);

    // Derive per-patient throughput from actual_wait_minutes / queue position
    const actualWaitQb = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.actual_wait_minutes / NULLIF(queue.sequence_number, 0))', 'avgPerPatient')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint })
      .andWhere('queue.queue_date BETWEEN :from AND :to', { from: sevenDaysAgo, to: today })
      .andWhere('queue.actual_wait_minutes IS NOT NULL')
      .andWhere('queue.sequence_number > 0');
    if (tenantId) actualWaitQb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    const actualResult = await actualWaitQb.getRawOne();

    if (actualResult?.avgPerPatient && Number(actualResult.avgPerPatient) > 0) {
      return Math.max(1, waitingCount * Math.ceil(Number(actualResult.avgPerPatient)));
    }

    // Fallback: service_duration + 5 min buffer to account for inter-patient
    // overhead (calling, preparation, gaps between patients)
    const serviceQb = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.service_duration_minutes)', 'avgService')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint })
      .andWhere('queue.queue_date BETWEEN :from AND :to', { from: sevenDaysAgo, to: today })
      .andWhere('queue.service_duration_minutes IS NOT NULL');
    if (tenantId) serviceQb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    const serviceResult = await serviceQb.getRawOne();

    const avgPerPatient = serviceResult?.avgService
      ? Math.ceil(Number(serviceResult.avgService)) + 5
      : 15;
    return waitingCount * avgPerPatient;
  }

  private async sendCallNotification(queue: Queue): Promise<void> {
    if (!this.smsService.isConfigured()) return;
    const phone = queue.patient?.phone;
    if (!phone) return;
    const message = `Hello ${queue.patient.fullName}, your token ${queue.ticketNumber} has been called at ${queue.servicePoint.toUpperCase()}${queue.roomNumber ? ` - Room ${queue.roomNumber}` : ''}. Please proceed.`;
    await this.smsService.sendSMS(phone, message);
  }

  private async writeAuditLog(
    queueId: string,
    action: string,
    userId: string,
    fromStatus: QueueStatus | null,
    toStatus: QueueStatus,
    reason?: string,
  ): Promise<void> {
    try {
      const log = this.auditLogRepository.create({
        userId,
        action,
        entityType: 'queue',
        entityId: queueId,
        oldValue: fromStatus ? { status: fromStatus } : undefined,
        newValue: { status: toStatus },
        ...(reason ? { ipAddress: undefined, userAgent: reason } : {}),
      });
      await this.auditLogRepository.save(log);
    } catch (e) {
      this.logger.warn(`Audit log write failed for queue ${queueId}: ${e.message}`);
    }
  }

  private async generateTicketNumber(
    facilityId: string,
    servicePoint: string,
    date: Date,
    tenantId?: string,
    manager?: EntityManager,
  ): Promise<string> {
    const prefix = this.getServicePointPrefix(servicePoint);
    const maxRetries = 5;
    const repo = manager ? manager.getRepository(Queue) : this.queueRepository;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const last = await repo
        .createQueryBuilder('queue')
        .select('MAX(queue.ticketNumber)', 'maxTicket')
        .where('queue.facility_id = :facilityId', { facilityId })
        .andWhere('queue.ticketNumber LIKE :prefix', { prefix: `${prefix}%` })
        .andWhere('queue.queue_date = :date', { date })
        .andWhere(tenantId ? 'queue.tenant_id = :tenantId' : '1=1', { tenantId })
        .getRawOne();

      const lastNum = last?.maxTicket ? parseInt(last.maxTicket.replace(prefix, ''), 10) : 0;
      const nextNum = lastNum + 1 + attempt;
      const ticketNumber = `${prefix}${String(nextNum).padStart(3, '0')}`;

      // Check uniqueness before returning
      const exists = await repo.count({
        where: { facilityId, ticketNumber, queueDate: date, ...(tenantId ? { tenantId } : {}) },
      });
      if (exists === 0) return ticketNumber;
    }

    // Final fallback: use timestamp-based suffix to guarantee uniqueness
    return `${prefix}${Date.now().toString(36).toUpperCase().slice(-4)}`;
  }

  private getServicePointPrefix(servicePoint: string): string {
    const prefixes: Record<string, string> = {
      registration: 'R',
      triage: 'T',
      consultation: 'C',
      laboratory: 'L',
      radiology: 'X',
      pharmacy: 'P',
      billing: 'B',
      cashier: 'K',
      injection: 'I',
      dressing: 'D',
      vitals: 'V',
      records: 'M',
      ipd: 'A',
      emergency: 'E',
      theatre: 'TH',
      physiotherapy: 'PH',
      dental: 'DN',
      optical: 'OP',
      nutrition: 'NT',
      counselling: 'CN',
    };
    return prefixes[servicePoint] || 'Q';
  }

  private async getNextSequenceNumber(
    facilityId: string,
    servicePoint: string,
    date: Date,
    tenantId?: string,
    manager?: EntityManager,
  ): Promise<number> {
    const maxRetries = 5;
    const repo = manager ? manager.getRepository(Queue) : this.queueRepository;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const last = await repo.findOne({
        where: {
          facilityId,
          servicePoint: servicePoint as ServicePoint,
          queueDate: date,
          ...(tenantId ? { tenantId } : {}),
        },
        order: { sequenceNumber: 'DESC' },
      });
      const nextSeq = (last?.sequenceNumber || 0) + 1 + attempt;

      // Check uniqueness before returning
      const exists = await repo.count({
        where: {
          facilityId,
          servicePoint: servicePoint as ServicePoint,
          queueDate: date,
          sequenceNumber: nextSeq,
          ...(tenantId ? { tenantId } : {}),
        },
      });
      if (exists === 0) return nextSeq;
    }

    // Fallback: use timestamp to guarantee uniqueness
    return Math.floor(Date.now() / 1000) % 100000;
  }

  private async getWaitingCount(
    facilityId: string,
    servicePoint: string,
    date: Date,
    tenantId?: string,
  ): Promise<number> {
    return this.queueRepository.count({
      where: {
        facilityId,
        servicePoint: servicePoint as ServicePoint,
        status: QueueStatus.WAITING,
        queueDate: date,
        ...(tenantId ? { tenantId } : {}),
      },
    });
  }

  /**
   * R3: Pick the best on-duty doctor at this facility for an unassigned
   * consultation queue entry. Strategy: least-loaded (lowest currentQueueCount)
   * who is below maxPatients. Tie-breaker: earliest checkInTime (round-robin
   * — whoever started shift first gets the next patient). Department match is
   * preferred but not required (so OPD walk-ins still get a doctor when only
   * out-of-department doctors are on duty).
   *
   * Returns the doctorId or null if nobody is available — in which case the
   * queue entry stays unassigned and is visible to the whole pool.
   */
  private async pickAvailableDoctor(
    facilityId: string,
    departmentId?: string,
    tenantId?: string,
  ): Promise<string | null> {
    const today = new Date().toISOString().split('T')[0];
    const baseWhere = `duty.facility_id = :facilityId
        AND duty.duty_date = :today
        AND duty.status IN (:...activeStatuses)
        AND duty.current_queue_count < duty.max_patients`;

    const buildQb = () => {
      const qb = this.doctorDutyRepository
        .createQueryBuilder('duty')
        .where(baseWhere, {
          facilityId,
          today,
          activeStatuses: [
            DutyStatus.ON_DUTY,
            DutyStatus.IN_CONSULTATION,
            DutyStatus.ON_BREAK,
          ],
        })
        .orderBy('duty.current_queue_count', 'ASC')
        .addOrderBy('duty.check_in_time', 'ASC')
        .limit(1);
      if (tenantId) qb.andWhere('duty.tenant_id = :tenantId', { tenantId });
      return qb;
    };

    if (departmentId) {
      const matched = await buildQb()
        .andWhere('duty.department_id = :departmentId', { departmentId })
        .getOne();
      if (matched) return matched.doctorId;
    }

    const fallback = await buildQb().getOne();
    return fallback ? fallback.doctorId : null;
  }

  private async updateDoctorQueueCount(
    doctorId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<void> {
    const waitingCount = await this.queueRepository.count({
      where: {
        facilityId,
        assignedDoctorId: doctorId,
        status: QueueStatus.WAITING,
        ...(tenantId ? { tenantId } : {}),
      },
    });
    const todayStr = new Date().toISOString().split('T')[0];
    await this.doctorDutyRepository.update(
      { doctorId, facilityId, dutyDate: new Date(todayStr) },
      { currentQueueCount: waitingCount },
    );
  }

  // ─── Patient Journey Tracker ─────────────────────────────────────────────

  async getPatientJourneys(facilityId: string, tenantId?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Get all queue entries for today (including overnight active ones)
    const qb = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('(DATE(queue.queue_date) = DATE(:today) OR queue.status IN (:...activeStatuses))', {
        today,
        activeStatuses: [
          QueueStatus.WAITING,
          QueueStatus.CALLED,
          QueueStatus.IN_SERVICE,
          QueueStatus.PENDING_PAYMENT,
        ],
      });
    if (tenantId) qb.andWhere('queue.tenant_id = :tenantId', { tenantId });
    qb.orderBy('queue.created_at', 'ASC');

    const allEntries = await qb.getMany();

    if (allEntries.length === 0) return [];

    // 2. Group by patient+encounter to build journeys
    const journeyMap = new Map<
      string,
      {
        patient: any;
        encounter: any;
        currentEntry: Queue;
        entries: Queue[];
      }
    >();

    for (const entry of allEntries) {
      const key = `${entry.patientId}_${entry.encounterId || 'no-encounter'}`;
      const existing = journeyMap.get(key);
      if (!existing) {
        journeyMap.set(key, {
          patient: entry.patient,
          encounter: entry.encounter,
          currentEntry: entry,
          entries: [entry],
        });
      } else {
        existing.entries.push(entry);
        // The "current" entry is the most recent active one, or fallback to last entry
        const activeStatuses = [
          QueueStatus.WAITING,
          QueueStatus.CALLED,
          QueueStatus.IN_SERVICE,
          QueueStatus.PENDING_PAYMENT,
        ];
        if (activeStatuses.includes(entry.status)) {
          existing.currentEntry = entry;
        }
      }
    }

    // 3. Collect unique encounter IDs for batch queries
    const encounterIds = [...new Set(allEntries.map((e) => e.encounterId).filter(Boolean))];

    // 4. Batch-fetch pending orders, prescriptions, and invoice balances via raw SQL
    const pendingLabMap = new Map<string, number>();
    const pendingImagingMap = new Map<string, number>();
    const pendingRxMap = new Map<string, number>();
    const invoiceBalanceMap = new Map<string, number>();

    if (encounterIds.length > 0) {
      const [pendingCounts, pendingRx, invoiceBalances] = await Promise.all([
        this.dataSource.query(
          `SELECT
             e.id as encounter_id,
             COALESCE(SUM(CASE WHEN o.order_type = 'lab' AND o.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_labs,
             COALESCE(SUM(CASE WHEN o.order_type = 'radiology' AND o.status = 'pending' THEN 1 ELSE 0 END), 0) as pending_imaging
           FROM encounters e
           LEFT JOIN orders o ON o.encounter_id = e.id AND o.status = 'pending'
           WHERE e.id = ANY($1) AND e.tenant_id = $2
           GROUP BY e.id`,
          [encounterIds, tenantId],
        ),
        this.dataSource.query(
          `SELECT encounter_id, COUNT(*) as pending_count
           FROM prescriptions
           WHERE encounter_id = ANY($1) AND status IN ('pending', 'partially_dispensed')
             AND tenant_id = $2
           GROUP BY encounter_id`,
          [encounterIds, tenantId],
        ),
        this.dataSource.query(
          `SELECT encounter_id, COALESCE(SUM(balance_due), 0) as balance
           FROM invoices
           WHERE encounter_id = ANY($1) AND status NOT IN ('cancelled', 'refunded')
             AND tenant_id = $2
           GROUP BY encounter_id`,
          [encounterIds, tenantId],
        ),
      ]);

      for (const row of pendingCounts) {
        pendingLabMap.set(row.encounter_id, Number(row.pending_labs));
        pendingImagingMap.set(row.encounter_id, Number(row.pending_imaging));
      }
      for (const row of pendingRx) {
        pendingRxMap.set(row.encounter_id, Number(row.pending_count));
      }
      for (const row of invoiceBalances) {
        invoiceBalanceMap.set(row.encounter_id, Number(row.balance));
      }
    }

    // 5. Build response array
    const journeys = [];
    for (const [, data] of journeyMap) {
      const { patient, encounter, currentEntry, entries } = data;
      const encId = currentEntry.encounterId;

      const journeySteps = entries.map((e) => {
        const waitMinutes =
          e.calledAt && e.serviceStartedAt
            ? Math.round(
                (new Date(e.serviceStartedAt).getTime() - new Date(e.calledAt).getTime()) / 60000,
              )
            : (e.actualWaitMinutes ?? undefined);
        const serviceMinutes =
          e.serviceStartedAt && e.serviceEndedAt
            ? Math.round(
                (new Date(e.serviceEndedAt).getTime() - new Date(e.serviceStartedAt).getTime()) /
                  60000,
              )
            : (e.serviceDurationMinutes ?? undefined);

        return {
          servicePoint: e.servicePoint,
          status: e.status,
          ticketNumber: e.ticketNumber,
          calledAt: e.calledAt ?? undefined,
          serviceStartedAt: e.serviceStartedAt ?? undefined,
          serviceEndedAt: e.serviceEndedAt ?? undefined,
          waitMinutes,
          serviceMinutes,
        };
      });

      // Determine the earliest registration timestamp
      const earliestCreated = entries.reduce(
        (min, e) => (e.createdAt < min ? e.createdAt : min),
        entries[0].createdAt,
      );
      const registeredAt = encounter?.startTime
        ? new Date(encounter.startTime) < new Date(earliestCreated)
          ? encounter.startTime
          : earliestCreated
        : earliestCreated;

      journeys.push({
        patientId: patient?.id ?? currentEntry.patientId,
        patientName: patient?.fullName ?? 'Unknown',
        mrn: patient?.mrn ?? '',
        encounterId: encId ?? null,
        encounterStatus: encounter?.status ?? null,
        encounterType: encounter?.type ?? null,
        currentServicePoint: currentEntry.servicePoint,
        currentQueueStatus: currentEntry.status,
        ticketNumber: currentEntry.ticketNumber,
        priority: currentEntry.priority,
        priorityReason: currentEntry.priorityReason ?? undefined,
        visitType: currentEntry.visitType ?? encounter?.type ?? '',
        chiefComplaint:
          currentEntry.chiefComplaintAtToken ?? encounter?.chiefComplaint ?? undefined,
        registeredAt,
        currentStepStartedAt: currentEntry.calledAt ?? currentEntry.serviceStartedAt ?? undefined,
        pendingLabOrders: encId ? (pendingLabMap.get(encId) ?? 0) : 0,
        pendingImagingOrders: encId ? (pendingImagingMap.get(encId) ?? 0) : 0,
        pendingPrescriptions: encId ? (pendingRxMap.get(encId) ?? 0) : 0,
        invoiceBalance: encId ? (invoiceBalanceMap.get(encId) ?? 0) : 0,
        journeySteps,
      });
    }

    return journeys;
  }
}
