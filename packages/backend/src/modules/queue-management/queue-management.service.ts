import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Queue, QueueDisplay, QueueStatus, QueuePriority, ServicePoint } from '../../database/entities/queue.entity';
import { Encounter, EncounterType, EncounterStatus } from '../../database/entities/encounter.entity';
import { DoctorDuty } from '../../database/entities/doctor-duty.entity';
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, QueueFilterDto, CreateQueueDisplayDto } from './dto/queue.dto';

@Injectable()
export class QueueManagementService {
  constructor(
    @InjectRepository(Queue)
    private queueRepository: Repository<Queue>,
    @InjectRepository(QueueDisplay)
    private queueDisplayRepository: Repository<QueueDisplay>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    @InjectRepository(DoctorDuty)
    private doctorDutyRepository: Repository<DoctorDuty>,
  ) {}

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
        `Patient ${existingQueue.patient?.fullName || ''} is already in queue with token ${existingQueue.ticketNumber}`
      );
    }

    // Generate ticket number
    const ticketNumber = await this.generateTicketNumber(facilityId, dto.servicePoint, today);
    const sequenceNumber = await this.getNextSequenceNumber(facilityId, dto.servicePoint, today);

    // Create encounter for this visit (makes patient visible to nurses/doctors)
    const visitNumber = `VN-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString(36).toUpperCase()}`;
    const encounter = this.encounterRepository.create({
      visitNumber,
      patientId: dto.patientId,
      facilityId,
      createdById: userId,
      type: EncounterType.OPD,
      status: EncounterStatus.REGISTERED,
      chiefComplaint: dto.notes || 'OPD Visit',
      queueNumber: sequenceNumber,
    });
    const savedEncounter = await this.encounterRepository.save(encounter);

    const queue = this.queueRepository.create({
      ...dto,
      ticketNumber,
      sequenceNumber,
      queueDate: today,
      facilityId,
      createdById: userId,
      encounterId: savedEncounter.id, // Link queue to encounter
      status: QueueStatus.WAITING,
      priority: dto.priority || QueuePriority.ROUTINE,
    });

    // Estimate wait time based on current queue
    const waitingCount = await this.getWaitingCount(facilityId, dto.servicePoint, today);
    queue.estimatedWaitMinutes = waitingCount * 10; // Assume 10 min per patient

    const saved = await this.queueRepository.save(queue);

    // Update assigned doctor's queue count
    if (dto.assignedDoctorId) {
      await this.updateDoctorQueueCount(dto.assignedDoctorId, facilityId);
    }
    
    // Return with encounter info
    const result = await this.queueRepository.findOne({
      where: { id: saved.id },
      relations: ['patient', 'encounter'],
    });
    return result!;
  }

  async getQueue(filter: QueueFilterDto, facilityId: string): Promise<Queue[]> {
    const today = filter.date ? new Date(filter.date) : new Date();
    today.setHours(0, 0, 0, 0);

    const query = this.queueRepository.createQueryBuilder('queue')
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

    // Order by priority first, then by sequence number
    query.orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC');

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
      .andWhere('queue.status = :status', { status: QueueStatus.WAITING })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC')
      .getMany();
  }

  async callNext(dto: CallNextDto, userId: string, facilityId: string): Promise<Queue | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the next patient in queue (respecting priority)
    const nextInQueue = await this.queueRepository
      .createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.encounter', 'encounter')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.servicePoint = :servicePoint', { servicePoint: dto.servicePoint })
      .andWhere('queue.status = :status', { status: QueueStatus.WAITING })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC')
      .getOne();

    if (!nextInQueue) {
      return null;
    }

    nextInQueue.status = QueueStatus.CALLED;
    nextInQueue.calledAt = new Date();
    nextInQueue.servingUserId = userId;
    nextInQueue.callCount = (nextInQueue.callCount || 0) + 1;
    
    if (dto.counterNumber) {
      nextInQueue.counterNumber = dto.counterNumber;
    }
    
    // If room number provided in DTO, use it; otherwise fetch from doctor's duty record
    if (dto.roomNumber) {
      nextInQueue.roomNumber = dto.roomNumber;
    } else {
      // Auto-fetch room number from the calling doctor's duty record
      const todayStr = new Date().toISOString().split('T')[0];
      const doctorDuty = await this.doctorDutyRepository.findOne({
        where: {
          doctorId: userId,
          facilityId,
          dutyDate: new Date(todayStr),
        },
      });
      if (doctorDuty?.roomNumber) {
        nextInQueue.roomNumber = doctorDuty.roomNumber;
      }
    }

    return this.queueRepository.save(nextInQueue);
  }

  async callPatient(id: string, userId: string, facilityId: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if (queue.status === QueueStatus.IN_SERVICE || queue.status === QueueStatus.COMPLETED) {
      throw new BadRequestException('Cannot call patient - already in service or completed');
    }

    queue.status = QueueStatus.CALLED;
    queue.calledAt = new Date();
    queue.servingUserId = userId;
    queue.callCount = (queue.callCount || 0) + 1;

    // Auto-fetch room number from the calling doctor's duty record if not already set
    if (!queue.roomNumber) {
      const todayStr = new Date().toISOString().split('T')[0];
      const doctorDuty = await this.doctorDutyRepository.findOne({
        where: {
          doctorId: userId,
          facilityId,
          dutyDate: new Date(todayStr),
        },
      });
      if (doctorDuty?.roomNumber) {
        queue.roomNumber = doctorDuty.roomNumber;
      }
    }

    return this.queueRepository.save(queue);
  }

  async recallPatient(id: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if (queue.status !== QueueStatus.CALLED) {
      throw new BadRequestException('Only called patients can be recalled');
    }

    queue.callCount = (queue.callCount || 0) + 1;
    queue.calledAt = new Date();

    return this.queueRepository.save(queue);
  }

  async startService(id: string, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if (queue.status !== QueueStatus.CALLED) {
      throw new BadRequestException('Patient must be called before starting service');
    }

    queue.status = QueueStatus.IN_SERVICE;
    queue.serviceStartedAt = new Date();
    queue.servingUserId = userId;

    // Calculate actual wait time
    if (queue.createdAt) {
      const waitMs = new Date().getTime() - queue.createdAt.getTime();
      queue.actualWaitMinutes = Math.round(waitMs / 60000);
    }

    return this.queueRepository.save(queue);
  }

  async completeService(id: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if (queue.status !== QueueStatus.IN_SERVICE) {
      throw new BadRequestException('Service must be started before completing');
    }

    queue.status = QueueStatus.COMPLETED;
    queue.serviceEndedAt = new Date();

    // Calculate service duration
    if (queue.serviceStartedAt) {
      const durationMs = new Date().getTime() - queue.serviceStartedAt.getTime();
      queue.serviceDurationMinutes = Math.round(durationMs / 60000);
    }

    return this.queueRepository.save(queue);
  }

  async transferToNextService(id: string, dto: TransferQueueDto, userId: string): Promise<Queue> {
    const queue = await this.findOne(id);

    // Complete current service
    queue.status = QueueStatus.TRANSFERRED;
    queue.serviceEndedAt = new Date();
    queue.nextServicePoint = dto.nextServicePoint;
    queue.transferReason = dto.transferReason || '';

    if (queue.serviceStartedAt) {
      const durationMs = new Date().getTime() - queue.serviceStartedAt.getTime();
      queue.serviceDurationMinutes = Math.round(durationMs / 60000);
    }

    await this.queueRepository.save(queue);

    // Create new queue entry for next service
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const newQueue = await this.addToQueue({
      patientId: queue.patientId,
      encounterId: queue.encounterId,
      servicePoint: dto.nextServicePoint,
      priority: queue.priority,
      priorityReason: queue.priorityReason,
      departmentId: queue.departmentId,
      notes: dto.transferReason,
    }, userId, queue.facilityId);

    newQueue.previousQueueId = queue.id;
    return this.queueRepository.save(newQueue);
  }

  async skipPatient(id: string, dto: SkipQueueDto): Promise<Queue> {
    const queue = await this.findOne(id);

    if (![QueueStatus.WAITING, QueueStatus.CALLED].includes(queue.status)) {
      throw new BadRequestException('Only waiting or called patients can be skipped');
    }

    queue.status = QueueStatus.SKIPPED;
    queue.skipReason = dto.skipReason;

    return this.queueRepository.save(queue);
  }

  async markNoShow(id: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if (queue.status !== QueueStatus.CALLED) {
      throw new BadRequestException('Only called patients can be marked as no-show');
    }

    queue.status = QueueStatus.NO_SHOW;

    return this.queueRepository.save(queue);
  }

  async cancelFromQueue(id: string, reason: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if ([QueueStatus.COMPLETED, QueueStatus.IN_SERVICE].includes(queue.status)) {
      throw new BadRequestException('Cannot cancel completed or in-service queue entries');
    }

    queue.status = QueueStatus.CANCELLED;
    queue.skipReason = reason;

    return this.queueRepository.save(queue);
  }

  async requeuePatient(id: string): Promise<Queue> {
    const queue = await this.findOne(id);

    if (![QueueStatus.SKIPPED, QueueStatus.NO_SHOW].includes(queue.status)) {
      throw new BadRequestException('Only skipped or no-show patients can be requeued');
    }

    // Put at end of queue
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newSequence = await this.getNextSequenceNumber(queue.facilityId, queue.servicePoint, today);

    queue.status = QueueStatus.WAITING;
    queue.sequenceNumber = newSequence;
    queue.calledAt = undefined as any;
    queue.skipReason = undefined as any;

    return this.queueRepository.save(queue);
  }

  async findOne(id: string): Promise<Queue> {
    const queue = await this.queueRepository.findOne({
      where: { id },
      relations: ['patient', 'encounter', 'servingUser', 'department'],
    });

    if (!queue) {
      throw new NotFoundException('Queue entry not found');
    }

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
      .andWhere('queue.status IN (:...statuses)', { statuses: [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE] })
      .orderBy('queue.created_at', 'DESC')
      .getMany();
  }

  async getQueueStats(facilityId: string, servicePoint?: ServicePoint) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to build count query with proper date comparison
    const buildCountQuery = (status: QueueStatus) => {
      const qb = this.queueRepository
        .createQueryBuilder('queue')
        .where('queue.facility_id = :facilityId', { facilityId })
        .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
        .andWhere('queue.status = :status', { status });
      
      if (servicePoint) {
        qb.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
      }
      return qb.getCount();
    };

    // Count each status
    const [waitingOnly, called, inService, completed, noShow] = await Promise.all([
      buildCountQuery(QueueStatus.WAITING),
      buildCountQuery(QueueStatus.CALLED),
      buildCountQuery(QueueStatus.IN_SERVICE),
      buildCountQuery(QueueStatus.COMPLETED),
      buildCountQuery(QueueStatus.NO_SHOW),
    ]);

    // Total waiting includes both WAITING and CALLED statuses
    const waiting = waitingOnly + called;

    // Get average wait time (with service point filter if provided)
    const avgWaitQuery = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.actual_wait_minutes)', 'avgWait')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .andWhere('queue.actual_wait_minutes IS NOT NULL');
    
    if (servicePoint) {
      avgWaitQuery.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
    }
    const avgWaitResult = await avgWaitQuery.getRawOne();

    // Get average service time (with service point filter if provided)
    const avgServiceQuery = this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.service_duration_minutes)', 'avgService')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('DATE(queue.queue_date) = DATE(:today)', { today })
      .andWhere('queue.service_duration_minutes IS NOT NULL');
    
    if (servicePoint) {
      avgServiceQuery.andWhere('queue.servicePoint = :servicePoint', { servicePoint });
    }
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

  // Queue Display Management
  async createDisplay(dto: CreateQueueDisplayDto, facilityId: string): Promise<QueueDisplay> {
    const display = this.queueDisplayRepository.create({
      ...dto,
      facilityId,
    });

    return this.queueDisplayRepository.save(display);
  }

  async getDisplays(facilityId: string): Promise<QueueDisplay[]> {
    return this.queueDisplayRepository.find({
      where: { facilityId, isActive: true },
    });
  }

  async getDisplayQueue(displayCode: string): Promise<Queue[]> {
    const display = await this.queueDisplayRepository.findOne({
      where: { displayCode, isActive: true },
    });

    if (!display) {
      throw new NotFoundException('Display not found');
    }

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

  private async generateTicketNumber(facilityId: string, servicePoint: ServicePoint, date: Date): Promise<string> {
    const prefix = this.getServicePointPrefix(servicePoint);
    const count = await this.queueRepository.count({
      where: {
        facilityId,
        servicePoint,
        queueDate: date,
      },
    });

    return `${prefix}${String(count + 1).padStart(3, '0')}`;
  }

  private getServicePointPrefix(servicePoint: ServicePoint): string {
    const prefixes: Record<ServicePoint, string> = {
      [ServicePoint.REGISTRATION]: 'R',
      [ServicePoint.TRIAGE]: 'T',
      [ServicePoint.CONSULTATION]: 'C',
      [ServicePoint.LABORATORY]: 'L',
      [ServicePoint.RADIOLOGY]: 'X',
      [ServicePoint.PHARMACY]: 'P',
      [ServicePoint.BILLING]: 'B',
      [ServicePoint.CASHIER]: 'K',
      [ServicePoint.INJECTION]: 'I',
      [ServicePoint.DRESSING]: 'D',
      [ServicePoint.VITALS]: 'V',
      [ServicePoint.RECORDS]: 'M',
    };

    return prefixes[servicePoint] || 'Q';
  }

  private async getNextSequenceNumber(facilityId: string, servicePoint: ServicePoint, date: Date): Promise<number> {
    const lastQueue = await this.queueRepository.findOne({
      where: {
        facilityId,
        servicePoint,
        queueDate: date,
      },
      order: { sequenceNumber: 'DESC' },
    });

    return (lastQueue?.sequenceNumber || 0) + 1;
  }

  private async getWaitingCount(facilityId: string, servicePoint: ServicePoint, date: Date): Promise<number> {
    return this.queueRepository.count({
      where: {
        facilityId,
        servicePoint,
        status: QueueStatus.WAITING,
        queueDate: date,
      },
    });
  }

  private async updateDoctorQueueCount(doctorId: string, facilityId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count waiting patients assigned to this doctor
    const waitingCount = await this.queueRepository.count({
      where: {
        facilityId,
        assignedDoctorId: doctorId,
        status: QueueStatus.WAITING,
        queueDate: today,
      },
    });

    // Update the doctor's duty record with the current queue count
    const todayStr = new Date().toISOString().split('T')[0];
    await this.doctorDutyRepository.update(
      { doctorId, facilityId, dutyDate: new Date(todayStr) },
      { currentQueueCount: waitingCount },
    );
  }
}
