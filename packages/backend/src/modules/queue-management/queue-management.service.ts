import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Between, Like, EntityManager } from 'typeorm';
import { Queue, QueueDisplay, QueueStatus, QueuePriority, ServicePoint, VALID_QUEUE_TRANSITIONS, QUEUE_TO_ENCOUNTER_STATUS } from '../../database/entities/queue.entity';
import { Encounter, EncounterType, EncounterStatus, PayerType } from '../../database/entities/encounter.entity';
import { Invoice, InvoiceItem, InvoiceStatus, ChargeType, PaymentType } from '../../database/entities/invoice.entity';
import { Service } from '../../database/entities/service-category.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { SystemSetting } from '../../database/entities/system-setting.entity';
import { AfricasTalkingService } from '../integrations/africas-talking.service';
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, HoldQueueDto, QueueFilterDto, CreateQueueDisplayDto, ServiceConfigDto } from './dto/queue.dto';

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
    private readonly smsService: AfricasTalkingService,
    private dataSource: DataSource,
  ) {}

  // ─── Facility Service Config ──────────────────────────────────────────────

  async getServiceConfig(facilityId: string, tenantId?: string): Promise<Record<string, any>> {
    const setting = await this.systemSettingRepository.findOne({
      where: { key: `${SERVICE_CONFIG_KEY}.${facilityId}` },
    });
    if (!setting) return this.getDefaultServiceConfig();
    return setting.value;
  }

  async upsertServiceConfig(facilityId: string, dto: ServiceConfigDto, tenantId?: string): Promise<Record<string, any>> {
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
        { value: 'emergency', label: 'Emergency Ward', servicePoint: ServicePoint.EMERGENCY, priority: QueuePriority.URGENT },
        { value: 'direct-admit', label: 'Direct Admission (IPD)', servicePoint: ServicePoint.IPD },
        { value: 'observation', label: 'Observation', servicePoint: ServicePoint.CONSULTATION },
        { value: 'lab-only', label: 'Lab Only', servicePoint: ServicePoint.LABORATORY },
        { value: 'pharmacy-only', label: 'Pharmacy Pickup', servicePoint: ServicePoint.PHARMACY },
      ],
    };
  }

  // ─── Add to Queue ─────────────────────────────────────────────────────────

  async addToQueue(dto: CreateQueueDto, userId: string, facilityId: string, tenantId?: string): Promise<Queue> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if patient is already in an active queue (including overnight)
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

    // Enforce per-service-point capacity limits
    const config = await this.getServiceConfig(facilityId);
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

    // Resolve priority from condition flags if not explicitly set
    const resolvedPriority = this.resolvePriority(dto.priority, dto.patientConditionFlags, config);

    const ticketNumber = await this.generateTicketNumber(facilityId, dto.servicePoint as ServicePoint, today, tenantId);
    const sequenceNumber = await this.getNextSequenceNumber(facilityId, dto.servicePoint as ServicePoint, today, tenantId);

    // Determine if payment is required before queueing
    const skipPaymentTypes = ['insurance', 'hospital_scheme', 'staff'];
    const isEmergency = dto.visitType === 'emergency' || dto.priority === QueuePriority.EMERGENCY;
    const requiresPayment = dto.paymentType
      && !skipPaymentTypes.includes(dto.paymentType)
      && !isEmergency;
    const initialQueueStatus = requiresPayment ? QueueStatus.PENDING_PAYMENT : QueueStatus.WAITING;

    // Create encounter, invoice, and queue entry in a transaction
    // so if queue creation fails, encounter is rolled back too
    const { savedEncounter, savedInvoice, saved } = await this.dataSource.transaction(async (manager) => {
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
      const txEncounter = await manager.save(encounter) as Encounter;

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
        );
        this.logger.log(`Invoice ${txInvoice.invoiceNumber} created for token ${ticketNumber}`);
      } catch (err) {
        // Non-blocking: if invoice creation fails, still issue the token
        this.logger.warn(`Failed to auto-create invoice for token ${ticketNumber}: ${err.message}`);
      }

      const queue = this.queueRepository.create({
        ...dto,
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

      queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(facilityId, dto.servicePoint as ServicePoint, today, tenantId);

      const txSaved = await manager.save(queue);

      return { savedEncounter: txEncounter, savedInvoice: txInvoice, saved: txSaved };
    });

    if (dto.assignedDoctorId) {
      await this.updateDoctorQueueCount(dto.assignedDoctorId, facilityId, tenantId);
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
   * Map frontend payment type string to encounter PayerType
   */
  private mapPaymentTypeToPayer(paymentType?: string): PayerType {
    if (!paymentType) return PayerType.CASH;
    switch (paymentType) {
      case 'insurance': return PayerType.INSURANCE;
      case 'hospital_scheme':
      case 'staff':
      case 'membership': return PayerType.CORPORATE;
      default: return PayerType.CASH;
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
  ): Promise<Invoice> {
    // Look up consultation fee from services table
    let fee = feeOverride;
    if (!fee || fee <= 0) {
      const consultService = await this.serviceRepository.findOne({
        where: { code: 'OPD-CONSULT', facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) },
      });
      if (!consultService) {
        // Try global fallback (no facility filter)
        const globalService = await this.serviceRepository.findOne({
          where: { code: 'OPD-CONSULT', isActive: true },
        });
        fee = globalService ? Number(globalService.basePrice) : 50000;
      } else {
        fee = Number(consultService.basePrice);
      }
    }

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
        activeStatuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE, QueueStatus.PENDING_PAYMENT],
      });

    if (tenantId) {
      query.andWhere('queue.tenant_id = :tenantId', { tenantId });
    }

    if (filter.servicePoint) {
      query.andWhere('queue.servicePoint = :servicePoint', { servicePoint: filter.servicePoint });
    }
    if (filter.status) {
      const statuses = filter.status.split(',').map(s => s.trim());
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
      query.andWhere('queue.assigned_doctor_id = :assignedDoctorId', { assignedDoctorId: filter.assignedDoctorId });
    }

    query.orderBy('queue.priority', 'ASC').addOrderBy('queue.sequence_number', 'ASC');
    return query.getMany();
  }

  async getWaitingQueue(servicePoint: ServicePoint, facilityId: string, tenantId?: string): Promise<Queue[]> {
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

    return qb
      .orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC')
      .getMany();
  }

  // ─── Call Next / Call ─────────────────────────────────────────────────────

  async callNext(dto: CallNextDto, userId: string, facilityId: string, tenantId?: string): Promise<Queue | null> {
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
        return this.callPatient(result.id, userId, facilityId, dto.counterNumber, dto.roomNumber, tenantId);
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

    // Payment enforcement: auto-transition pending_payment → waiting if paid
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
          'Cannot call patient: payment is pending. Direct to Billing/Cashier first.',
        );
      }

      queue.status = QueueStatus.WAITING;
      await this.queueRepository.save(queue);
      this.logger.log(`Queue ${id}: PENDING_PAYMENT → WAITING (payment verified on call)`);
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
    this.sendCallNotification(queue).catch((e) => this.logger.warn('SMS notification failed: ' + e.message));

    return saved;
  }

  async recallPatient(id: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    if (queue.status !== QueueStatus.CALLED) {
      throw new BadRequestException('Only called patients can be recalled');
    }
    queue.callCount = (queue.callCount || 0) + 1;
    queue.calledAt = new Date();
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_RECALLED', userId, QueueStatus.CALLED, QueueStatus.CALLED);
    this.sendCallNotification(queue).catch((e) => this.logger.warn('SMS notification failed: ' + e.message));
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
    const dispositions: Array<{ value: string; label: string; servicePoint: string; priority?: number }> =
      config.triageDispositions || this.getDefaultServiceConfig().triageDispositions;
    const disposition = dispositions.find(d => d.value === dispositionValue);

    if (!disposition) {
      throw new BadRequestException(
        `Invalid triage disposition: ${dispositionValue}. Valid: ${dispositions.map(d => d.value).join(', ')}`,
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

  async transferToNextService(id: string, dto: TransferQueueDto, userId: string, tenantId?: string): Promise<Queue> {
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
    queue.ticketNumber = await this.generateTicketNumber(queue.facilityId, dto.nextServicePoint as ServicePoint, today, tenantId);
    queue.sequenceNumber = await this.getNextSequenceNumber(queue.facilityId, dto.nextServicePoint as ServicePoint, today, tenantId);
    queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(queue.facilityId, dto.nextServicePoint as ServicePoint, today, tenantId);

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
      await this.writeAuditLog(id, `TRANSFERRED_${prevServicePoint.toUpperCase()}_TO_${dto.nextServicePoint.toUpperCase()}`, userId, prevStatus, QueueStatus.WAITING, dto.transferReason);

      return saved;
    } catch (error) {
      // Retry once on unique constraint violation (race condition on ticket number)
      if (error?.code === '23505' || error?.message?.includes('duplicate key')) {
        this.logger.warn(`Ticket collision during transfer for queue ${id}, retrying...`);
        queue.ticketNumber = await this.generateTicketNumber(queue.facilityId, dto.nextServicePoint as ServicePoint, today, tenantId);
        queue.sequenceNumber = await this.getNextSequenceNumber(queue.facilityId, dto.nextServicePoint as ServicePoint, today, tenantId);
        const saved = await this.queueRepository.save(queue);
        const encounterStatus = this.mapServicePointToEncounterStatus(dto.nextServicePoint);
        await this.syncEncounterStatus(queue.encounterId, encounterStatus);
        await this.writeAuditLog(id, `TRANSFERRED_${prevServicePoint.toUpperCase()}_TO_${dto.nextServicePoint.toUpperCase()}`, userId, prevStatus, QueueStatus.WAITING, dto.transferReason);
        return saved;
      }
      throw error;
    }
  }

  // ─── System-driven service point move (no transition validation) ─────────

  async moveToServicePoint(encounterId: string, servicePoint: string, reason?: string, tenantId?: string): Promise<Queue | null> {
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

    this.logger.log(`Created new queue entry ${ticketNumber} for encounter ${encounterId} at ${servicePoint}`);

    return saved;
  }

  // ─── Skip / No-Show / Cancel / Requeue ───────────────────────────────────

  async skipPatient(id: string, dto: SkipQueueDto, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.SKIPPED);
    const prevStatus = queue.status;
    queue.status = QueueStatus.SKIPPED;
    queue.skipReason = dto.skipReason;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_SKIPPED', userId, prevStatus, QueueStatus.SKIPPED, dto.skipReason);
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

  async cancelFromQueue(id: string, reason: string, userId: string, tenantId?: string): Promise<Queue> {
    const queue = await this.findOne(id, tenantId);
    this.assertValidTransition(queue.status, QueueStatus.CANCELLED);
    const prevStatus = queue.status;
    queue.status = QueueStatus.CANCELLED;
    queue.skipReason = reason;
    const saved = await this.queueRepository.save(queue);
    await this.syncEncounterStatus(queue.encounterId, EncounterStatus.CANCELLED);
    await this.writeAuditLog(id, 'QUEUE_CANCELLED', userId, prevStatus, QueueStatus.CANCELLED, reason);
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
    queue.sequenceNumber = await this.getNextSequenceNumber(queue.facilityId, queue.servicePoint, today, tenantId);
    queue.calledAt = undefined as any;
    queue.skipReason = undefined as any;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_REQUEUED', userId, prevStatus, QueueStatus.WAITING);
    return saved;
  }

  // ─── Hold / Unhold ────────────────────────────────────────────────────────

  async holdQueue(id: string, dto: HoldQueueDto, userId: string, tenantId?: string): Promise<Queue> {
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

  async getPatientQueueStatus(patientId: string, facilityId: string, tenantId?: string): Promise<Queue[]> {
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
        .andWhere('(DATE(queue.queue_date) = DATE(:today) OR queue.status IN (:...activeStatuses))', {
          today,
          activeStatuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE, QueueStatus.PENDING_PAYMENT],
        })
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
        activeStatuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE, QueueStatus.PENDING_PAYMENT],
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
        activeStatuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE, QueueStatus.PENDING_PAYMENT],
      })
      .andWhere('queue.service_duration_minutes IS NOT NULL');
    if (tenantId) avgServiceQuery.andWhere('queue.tenant_id = :tenantId', { tenantId });
    if (servicePoint) avgServiceQuery.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
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

  async createDisplay(dto: CreateQueueDisplayDto, facilityId: string, tenantId?: string): Promise<QueueDisplay> {
    const display = this.queueDisplayRepository.create({ ...dto, facilityId, ...(tenantId ? { tenantId } : {}) } as any);
    return this.queueDisplayRepository.save(display) as unknown as QueueDisplay;
  }

  async getDisplays(facilityId: string, tenantId?: string): Promise<QueueDisplay[]> {
    return this.queueDisplayRepository.find({ where: { facilityId, isActive: true, ...(tenantId ? { tenantId } : {}) } });
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
      .andWhere('queue.servicePoint IN (:...servicePoints)', { servicePoints: display.servicePoints })
      .andWhere('queue.status IN (:...statuses)', { statuses: [QueueStatus.CALLED, QueueStatus.IN_SERVICE] });
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

  private async syncEncounterStatus(encounterId: string | undefined, status: EncounterStatus): Promise<void> {
    if (!encounterId) return;
    try {
      await this.encounterRepository.update({ id: encounterId }, { status });
    } catch (e) {
      this.logger.error(`Failed to sync encounter ${encounterId} to status ${status}: ${e.message}`);
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
  private async calculateSmartWaitTime(facilityId: string, servicePoint: string, today: Date, tenantId?: string): Promise<number> {
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

    const avgPerPatient = serviceResult?.avgService ? Math.ceil(Number(serviceResult.avgService)) + 5 : 15;
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

  private async generateTicketNumber(facilityId: string, servicePoint: string, date: Date, tenantId?: string): Promise<string> {
    const prefix = this.getServicePointPrefix(servicePoint);
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const last = await this.queueRepository
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
      const exists = await this.queueRepository.count({
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

  private async getNextSequenceNumber(facilityId: string, servicePoint: string, date: Date, tenantId?: string): Promise<number> {
    const maxRetries = 5;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const last = await this.queueRepository.findOne({
        where: { facilityId, servicePoint: servicePoint as ServicePoint, queueDate: date, ...(tenantId ? { tenantId } : {}) },
        order: { sequenceNumber: 'DESC' },
      });
      const nextSeq = (last?.sequenceNumber || 0) + 1 + attempt;

      // Check uniqueness before returning
      const exists = await this.queueRepository.count({
        where: { facilityId, servicePoint: servicePoint as ServicePoint, queueDate: date, sequenceNumber: nextSeq, ...(tenantId ? { tenantId } : {}) },
      });
      if (exists === 0) return nextSeq;
    }

    // Fallback: use timestamp to guarantee uniqueness
    return Math.floor(Date.now() / 1000) % 100000;
  }

  private async getWaitingCount(facilityId: string, servicePoint: string, date: Date, tenantId?: string): Promise<number> {
    return this.queueRepository.count({
      where: { facilityId, servicePoint: servicePoint as ServicePoint, status: QueueStatus.WAITING, queueDate: date, ...(tenantId ? { tenantId } : {}) },
    });
  }

  private async updateDoctorQueueCount(doctorId: string, facilityId: string, tenantId?: string): Promise<void> {
    const waitingCount = await this.queueRepository.count({
      where: { facilityId, assignedDoctorId: doctorId, status: QueueStatus.WAITING, ...(tenantId ? { tenantId } : {}) },
    });
    const todayStr = new Date().toISOString().split('T')[0];
    await this.doctorDutyRepository.update(
      { doctorId, facilityId, dutyDate: new Date(todayStr) },
      { currentQueueCount: waitingCount },
    );
  }
}
