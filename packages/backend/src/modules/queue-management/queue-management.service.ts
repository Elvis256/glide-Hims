import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, In } from 'typeorm';
import { Queue, QueueDisplay, QueueStatus, QueuePriority, ServicePoint } from '../../database/entities/queue.entity';
import { CreateQueueDto, CallNextDto, TransferQueueDto, SkipQueueDto, QueueFilterDto, CreateQueueDisplayDto } from './dto/queue.dto';

@Injectable()
export class QueueManagementService {
  constructor(
    @InjectRepository(Queue)
    private queueRepository: Repository<Queue>,
    @InjectRepository(QueueDisplay)
    private queueDisplayRepository: Repository<QueueDisplay>,
  ) {}

  async addToQueue(dto: CreateQueueDto, userId: string, facilityId: string): Promise<Queue> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Generate ticket number
    const ticketNumber = await this.generateTicketNumber(facilityId, dto.servicePoint, today);
    const sequenceNumber = await this.getNextSequenceNumber(facilityId, dto.servicePoint, today);

    const queue = this.queueRepository.create({
      ...dto,
      ticketNumber,
      sequenceNumber,
      queueDate: today,
      facilityId,
      createdById: userId,
      status: QueueStatus.WAITING,
      priority: dto.priority || QueuePriority.ROUTINE,
    });

    // Estimate wait time based on current queue
    const waitingCount = await this.getWaitingCount(facilityId, dto.servicePoint, today);
    queue.estimatedWaitMinutes = waitingCount * 10; // Assume 10 min per patient

    return this.queueRepository.save(queue);
  }

  async getQueue(filter: QueueFilterDto, facilityId: string): Promise<Queue[]> {
    const today = filter.date ? new Date(filter.date) : new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = this.queueRepository.createQueryBuilder('queue')
      .leftJoinAndSelect('queue.patient', 'patient')
      .leftJoinAndSelect('queue.servingUser', 'servingUser')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.queue_date >= :today AND queue.queue_date < :tomorrow', { today, tomorrow });

    if (filter.servicePoint) {
      query.andWhere('queue.servicePoint = :servicePoint', { servicePoint: filter.servicePoint });
    }
    if (filter.status) {
      query.andWhere('queue.status = :status', { status: filter.status });
    }
    if (filter.departmentId) {
      query.andWhere('queue.department_id = :departmentId', { departmentId: filter.departmentId });
    }

    // Order by priority first, then by sequence number
    query.orderBy('queue.priority', 'ASC')
      .addOrderBy('queue.sequence_number', 'ASC');

    return query.getMany();
  }

  async getWaitingQueue(servicePoint: ServicePoint, facilityId: string): Promise<Queue[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.queueRepository.find({
      where: {
        facilityId,
        servicePoint,
        status: QueueStatus.WAITING,
        queueDate: MoreThanOrEqual(today),
      },
      relations: ['patient'],
      order: { priority: 'ASC', sequenceNumber: 'ASC' },
    });
  }

  async callNext(dto: CallNextDto, userId: string, facilityId: string): Promise<Queue | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the next patient in queue (respecting priority)
    const nextInQueue = await this.queueRepository.findOne({
      where: {
        facilityId,
        servicePoint: dto.servicePoint,
        status: QueueStatus.WAITING,
        queueDate: MoreThanOrEqual(today),
      },
      relations: ['patient'],
      order: { priority: 'ASC', sequenceNumber: 'ASC' },
    });

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
    if (dto.roomNumber) {
      nextInQueue.roomNumber = dto.roomNumber;
    }

    return this.queueRepository.save(nextInQueue);
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

    return this.queueRepository.find({
      where: {
        patientId,
        facilityId,
        queueDate: MoreThanOrEqual(today),
        status: In([QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async getQueueStats(facilityId: string, servicePoint?: ServicePoint) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const baseQuery = {
      facilityId,
      queueDate: Between(today, tomorrow),
      ...(servicePoint && { servicePoint }),
    };

    const waiting = await this.queueRepository.count({
      where: { ...baseQuery, status: QueueStatus.WAITING },
    });

    const inService = await this.queueRepository.count({
      where: { ...baseQuery, status: QueueStatus.IN_SERVICE },
    });

    const completed = await this.queueRepository.count({
      where: { ...baseQuery, status: QueueStatus.COMPLETED },
    });

    const noShow = await this.queueRepository.count({
      where: { ...baseQuery, status: QueueStatus.NO_SHOW },
    });

    // Get average wait time
    const avgWaitResult = await this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.actual_wait_minutes)', 'avgWait')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.queue_date >= :today AND queue.queue_date < :tomorrow', { today, tomorrow })
      .andWhere('queue.actual_wait_minutes IS NOT NULL')
      .getRawOne();

    // Get average service time
    const avgServiceResult = await this.queueRepository
      .createQueryBuilder('queue')
      .select('AVG(queue.service_duration_minutes)', 'avgService')
      .where('queue.facility_id = :facilityId', { facilityId })
      .andWhere('queue.queue_date >= :today AND queue.queue_date < :tomorrow', { today, tomorrow })
      .andWhere('queue.service_duration_minutes IS NOT NULL')
      .getRawOne();

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

    return this.queueRepository.find({
      where: {
        facilityId: display.facilityId,
        servicePoint: In(display.servicePoints),
        status: In([QueueStatus.CALLED, QueueStatus.IN_SERVICE]),
        queueDate: MoreThanOrEqual(today),
      },
      relations: ['patient'],
      order: { calledAt: 'DESC' },
      take: display.displaySettings?.maxDisplay || 10,
    });
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
}
