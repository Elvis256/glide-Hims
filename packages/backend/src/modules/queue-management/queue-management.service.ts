import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Queue, QueueDisplay, QueueStatus, QueuePriority, ServicePoint, VALID_QUEUE_TRANSITIONS, QUEUE_TO_ENCOUNTER_STATUS } from '../../database/entities/queue.entity';
import { Encounter, EncounterType, EncounterStatus } from '../../database/entities/encounter.entity';
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
    private readonly smsService: AfricasTalkingService,
  ) {}

  // ─── Facility Service Config ──────────────────────────────────────────────

  async getServiceConfig(facilityId: string): Promise<Record<string, any>> {
    const setting = await this.systemSettingRepository.findOne({
      where: { key: `${SERVICE_CONFIG_KEY}.${facilityId}` },
    });
    if (!setting) return this.getDefaultServiceConfig();
    return setting.value;
  }

  async upsertServiceConfig(facilityId: string, dto: ServiceConfigDto): Promise<Record<string, any>> {
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

  async addToQueue(dto: CreateQueueDto, userId: string, facilityId: string): Promise<Queue> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if patient is already in an active queue for today
    const existingQueue = await this.queueRepository.findOne({
      where: {
        patientId: dto.patientId,
        facilityId,
        queueDate: today,
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
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

    const ticketNumber = await this.generateTicketNumber(facilityId, dto.servicePoint as ServicePoint, today);
    const sequenceNumber = await this.getNextSequenceNumber(facilityId, dto.servicePoint as ServicePoint, today);

    // Create encounter for this visit
    const visitNumber = `VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
    const encounter = this.encounterRepository.create({
      visitNumber,
      patientId: dto.patientId,
      facilityId,
      departmentId: dto.departmentId,
      createdById: userId,
      type: EncounterType.OPD,
      status: EncounterStatus.REGISTERED,
      chiefComplaint: dto.chiefComplaintAtToken || dto.notes || 'OPD Visit',
      queueNumber: sequenceNumber,
    });
    const savedEncounter = await this.encounterRepository.save(encounter);

    const queue = this.queueRepository.create({
      ...dto,
      servicePoint: dto.servicePoint as ServicePoint,
      ticketNumber,
      sequenceNumber,
      queueDate: today,
      facilityId,
      createdById: userId,
      encounterId: savedEncounter.id,
      status: QueueStatus.WAITING,
      priority: resolvedPriority,
      visitType: dto.visitType,
      chiefComplaintAtToken: dto.chiefComplaintAtToken,
      patientConditionFlags: dto.patientConditionFlags,
    });

    queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(facilityId, dto.servicePoint as ServicePoint, today);

    const saved = await this.queueRepository.save(queue);

    if (dto.assignedDoctorId) {
      await this.updateDoctorQueueCount(dto.assignedDoctorId, facilityId);
    }

    await this.writeAuditLog(saved.id, 'QUEUE_CREATED', userId, null, QueueStatus.WAITING);

    return this.queueRepository.findOne({
      where: { id: saved.id },
      relations: ['patient', 'encounter'],
    }) as Promise<Queue>;
  }

  // ─── Get Queue ────────────────────────────────────────────────────────────

  async getQueue(filter: QueueFilterDto, facilityId: string): Promise<Queue[]> {
    const today = filter.date ? new Date(filter.date) : new Date();
    today.setHours(0, 0, 0, 0);

    const query = this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .leftJoinAndSelect('queue.servingUser', 'servingUser')
      .leftJoinAndSelect('queue.assignedDoctor', 'assignedDoctor')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today });

    if (filter.servicePoint) {
      query.andWhere('queue.servicePoint = :servicePoint', { servicePoint: filter.servicePoint });
    }
    if (filter.status) {
      query.andWhere('queue.status = :status', { status: filter.status });
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

  async getWaitingQueue(servicePoint: ServicePoint, facilityId: string): Promise<Queue[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint })
      .andWhere('queue.on_hold = false')
      .andWhere('queue.status IN (:...statuses)', {
        statuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE],
      })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC')
      .getMany();
  }

  // ─── Call Next / Call ─────────────────────────────────────────────────────

  async callNext(dto: CallNextDto, userId: string, facilityId: string): Promise<Queue | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const nextInQueue = await this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint: dto.servicePoint })
      .andWhere('queue.status = :status', { status: QueueStatus.WAITING })
      .andWhere('queue.on_hold = false')
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC')
      .getOne();

    if (!nextInQueue) return null;

    return this.callPatient(nextInQueue.id, userId, facilityId, dto.counterNumber, dto.roomNumber);
  }

  async callPatient(
    id: string,
    userId: string,
    facilityId: string,
    counterNumber?: string,
    roomNumber?: string,
  ): Promise<Queue> {
    const queue = await this.findOne(id);
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

  async recallPatient(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
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

  async startService(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
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

  async completeService(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
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

  // ─── Transfer ─────────────────────────────────────────────────────────────

  async transferToNextService(id: string, dto: TransferQueueDto, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
    this.assertValidTransition(queue.status, QueueStatus.TRANSFERRED);

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

    // Generate new ticket for new service point, keep encounter and department
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    queue.ticketNumber = await this.generateTicketNumber(queue.facilityId, dto.nextServicePoint as ServicePoint, today);
    queue.sequenceNumber = await this.getNextSequenceNumber(queue.facilityId, dto.nextServicePoint as ServicePoint, today);
    queue.estimatedWaitMinutes = await this.calculateSmartWaitTime(queue.facilityId, dto.nextServicePoint as ServicePoint, today);

    // Reset per-service-point fields; preserve cross-service context
    queue.calledAt = undefined as any;
    queue.serviceStartedAt = undefined as any;
    queue.servingUserId = undefined as any;
    queue.callCount = 0;
    queue.counterNumber = undefined as any;
    queue.roomNumber = undefined as any;

    const saved = await this.queueRepository.save(queue);

    // Sync encounter to correct intermediate status based on destination
    const encounterStatus = this.mapServicePointToEncounterStatus(dto.nextServicePoint);
    await this.syncEncounterStatus(queue.encounterId, encounterStatus);
    await this.writeAuditLog(id, `TRANSFERRED_${prevServicePoint.toUpperCase()}_TO_${dto.nextServicePoint.toUpperCase()}`, userId, prevStatus, QueueStatus.WAITING, dto.transferReason);

    return saved;
  }

  // ─── Skip / No-Show / Cancel / Requeue ───────────────────────────────────

  async skipPatient(id: string, dto: SkipQueueDto, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
    this.assertValidTransition(queue.status, QueueStatus.SKIPPED);
    const prevStatus = queue.status;
    queue.status = QueueStatus.SKIPPED;
    queue.skipReason = dto.skipReason;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_SKIPPED', userId, prevStatus, QueueStatus.SKIPPED, dto.skipReason);
    return saved;
  }

  async markNoShow(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
    this.assertValidTransition(queue.status, QueueStatus.NO_SHOW);
    const prevStatus = queue.status;
    queue.status = QueueStatus.NO_SHOW;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'NO_SHOW', userId, prevStatus, QueueStatus.NO_SHOW);
    return saved;
  }

  async cancelFromQueue(id: string, reason: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
    this.assertValidTransition(queue.status, QueueStatus.CANCELLED);
    const prevStatus = queue.status;
    queue.status = QueueStatus.CANCELLED;
    queue.skipReason = reason;
    const saved = await this.queueRepository.save(queue);
    await this.syncEncounterStatus(queue.encounterId, EncounterStatus.CANCELLED);
    await this.writeAuditLog(id, 'QUEUE_CANCELLED', userId, prevStatus, QueueStatus.CANCELLED, reason);
    return saved;
  }

  async requeuePatient(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
    if (![QueueStatus.SKIPPED, QueueStatus.NO_SHOW].includes(queue.status)) {
      throw new BadRequestException('Only skipped or no-show patients can be requeued');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const prevStatus = queue.status;
    queue.status = QueueStatus.WAITING;
    queue.sequenceNumber = await this.getNextSequenceNumber(queue.facilityId, queue.servicePoint, today);
    queue.calledAt = undefined as any;
    queue.skipReason = undefined as any;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'PATIENT_REQUEUED', userId, prevStatus, QueueStatus.WAITING);
    return saved;
  }

  // ─── Hold / Unhold ────────────────────────────────────────────────────────

  async holdQueue(id: string, dto: HoldQueueDto, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
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

  async unholdQueue(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);
    if (!queue.onHold) throw new BadRequestException('Queue entry is not on hold');
    queue.onHold = false;
    queue.holdReason = undefined as any;
    queue.holdStartedAt = undefined as any;
    const saved = await this.queueRepository.save(queue);
    await this.writeAuditLog(id, 'QUEUE_UNHELD', userId, queue.status, queue.status);
    return saved;
  }

  // ─── Find / Stats ─────────────────────────────────────────────────────────

  async findOne(id: string): Promise<Queue> {
    const queue = await this.queueRepository.findOne({
      where: { id },
      relations: ['patient', 'encounter', 'servingUser', 'department'],
    });
    if (!queue) throw new NotFoundException('Queue entry not found');
    return queue;
  }

  async getPatientQueueStatus(patientId: string, facilityId: string): Promise<Queue[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.queueRepository
      .createQueryBuilder('queue')
      .where('queue.patient_id = :patientId', { patientId })
      .andWhere('queue.facility_id = :facilityId', { facilityId })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .andWhere('queue.status IN (:...statuses)', {
        statuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE],
      })
      .orderBy('queue.created_at', 'DESC')
      .getMany();
  }

  async getQueueStats(facilityId: string, servicePoint?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const buildCountQuery = (status: QueueStatus) => {
      const qb = this.queueRepository
        .createQueryBuilder('queue')
        .where('queue.facility_id = :facilityId', { facilityId })
        .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
        .andWhere('queue.status = :status', { status });
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
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .andWhere('queue.actual_wait_minutes IS NOT NULL');
    if (servicePoint) avgWaitQuery.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
    const avgWaitResult = await avgWaitQuery.getRawOne();

    const avgServiceQuery = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.service_duration_minutes)', 'avgService')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .andWhere('queue.service_duration_minutes IS NOT NULL');
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

  async getQueueAuditLog(queueId: string): Promise<any[]> {
    return this.auditLogRepository.find({
      where: { entityType: 'queue', entityId: queueId },
      order: { createdAt: 'DESC' },
    });
  }

  // ─── Queue Display ────────────────────────────────────────────────────────

  async createDisplay(dto: CreateQueueDisplayDto, facilityId: string): Promise<QueueDisplay> {
    const display = this.queueDisplayRepository.create({ ...dto, facilityId } as any);
    return this.queueDisplayRepository.save(display) as unknown as QueueDisplay;
  }

  async getDisplays(facilityId: string): Promise<QueueDisplay[]> {
    return this.queueDisplayRepository.find({ where: { facilityId, isActive: true } });
  }

  async getDisplayQueue(displayCode: string): Promise<Queue[]> {
    const display = await this.queueDisplayRepository.findOne({
      where: { displayCode, isActive: true },
    });
    if (!display) throw new NotFoundException('Display not found');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .where('queue.facility_id = :facilityId', { facilityId: display.facilityId })
      .andWhere('queue.servicePoint IN (:...servicePoints)', { servicePoints: display.servicePoints })
      .andWhere('queue.status IN (:...statuses)', { statuses: [QueueStatus.CALLED, QueueStatus.IN_SERVICE] })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
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
      this.logger.warn(`Failed to sync encounter ${encounterId} to status ${status}: ${e.message}`);
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
   * Smart wait time: rolling 7-day average for the service point, fallback to 10 min.
   */
  private async calculateSmartWaitTime(facilityId: string, servicePoint: string, today: Date): Promise<number> {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const result = await this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.service_duration_minutes)', 'avgDuration')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint })
      .andWhere('queue.queue_date BETWEEN :from AND :to', { from: sevenDaysAgo, to: today })
      .andWhere('queue.service_duration_minutes IS NOT NULL')
      .getRawOne();

    const avgPerPatient = result?.avgDuration ? Math.ceil(result.avgDuration) : 10;

    const waitingCount = await this.getWaitingCount(facilityId, servicePoint, today);
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

  private async generateTicketNumber(facilityId: string, servicePoint: string, date: Date): Promise<string> {
    const prefix = this.getServicePointPrefix(servicePoint);
    const count = await this.queueRepository.count({
      where: { facilityId, servicePoint: servicePoint as ServicePoint, queueDate: date },
    });
    return `${prefix}${String(count + 1).padStart(3, '0')}`;
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

  private async getNextSequenceNumber(facilityId: string, servicePoint: string, date: Date): Promise<number> {
    const last = await this.queueRepository.findOne({
      where: { facilityId, servicePoint: servicePoint as ServicePoint, queueDate: date },
      order: { sequenceNumber: 'DESC' },
    });
    return (last?.sequenceNumber || 0) + 1;
  }

  private async getWaitingCount(facilityId: string, servicePoint: string, date: Date): Promise<number> {
    return this.queueRepository.count({
      where: { facilityId, servicePoint: servicePoint as ServicePoint, status: QueueStatus.WAITING, queueDate: date },
    });
  }

  private async updateDoctorQueueCount(doctorId: string, facilityId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const waitingCount = await this.queueRepository.count({
      where: { facilityId, assignedDoctorId: doctorId, status: QueueStatus.WAITING, queueDate: today },
    });
    const todayStr = new Date().toISOString().split('T')[0];
    await this.doctorDutyRepository.update(
      { doctorId, facilityId, dutyDate: new Date(todayStr) },
      { currentQueueCount: waitingCount },
    );
  }
}
