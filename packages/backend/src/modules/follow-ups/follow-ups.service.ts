import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThan, MoreThanOrEqual } from 'typeorm';
import { FollowUp, FollowUpStatus, FollowUpPriority } from '../../database/entities/follow-up.entity';
import { CreateFollowUpDto, RescheduleFollowUpDto, CompleteFollowUpDto, CancelFollowUpDto, FollowUpFilterDto } from './dto/follow-up.dto';

@Injectable()
export class FollowUpsService {
  constructor(
    @InjectRepository(FollowUp)
    private followUpRepository: Repository<FollowUp>,
  ) {}

  async create(dto: CreateFollowUpDto, userId: string, facilityId: string): Promise<FollowUp> {
    const appointmentNumber = await this.generateAppointmentNumber();

    const followUp = this.followUpRepository.create({
      ...dto,
      appointmentNumber,
      scheduledDate: new Date(dto.scheduledDate),
      facilityId,
      scheduledById: userId,
      status: FollowUpStatus.SCHEDULED,
      priority: dto.priority || FollowUpPriority.MEDIUM,
    });

    return this.followUpRepository.save(followUp);
  }

  async findAll(filter: FollowUpFilterDto, facilityId: string): Promise<FollowUp[]> {
    const query = this.followUpRepository.createQueryBuilder('followUp')
      .leftJoinAndSelect('followUp.patient', 'patient')
      .leftJoinAndSelect('followUp.provider', 'provider')
      .leftJoinAndSelect('followUp.department', 'department')
      .where('followUp.facility_id = :facilityId', { facilityId });

    if (filter.patientId) {
      query.andWhere('followUp.patient_id = :patientId', { patientId: filter.patientId });
    }
    if (filter.status) {
      query.andWhere('followUp.status = :status', { status: filter.status });
    }
    if (filter.type) {
      query.andWhere('followUp.type = :type', { type: filter.type });
    }
    if (filter.providerId) {
      query.andWhere('followUp.provider_id = :providerId', { providerId: filter.providerId });
    }
    if (filter.fromDate && filter.toDate) {
      query.andWhere('followUp.scheduled_date BETWEEN :fromDate AND :toDate', {
        fromDate: filter.fromDate,
        toDate: filter.toDate,
      });
    }

    query.orderBy('followUp.scheduled_date', 'ASC');

    return query.getMany();
  }

  async findOne(id: string): Promise<FollowUp> {
    const followUp = await this.followUpRepository.findOne({
      where: { id },
      relations: ['patient', 'provider', 'department', 'facility', 'scheduledBy', 'sourceEncounter', 'followUpEncounter'],
    });

    if (!followUp) {
      throw new NotFoundException('Follow-up appointment not found');
    }

    return followUp;
  }

  async findByPatient(patientId: string): Promise<FollowUp[]> {
    return this.followUpRepository.find({
      where: { patientId },
      relations: ['provider', 'department'],
      order: { scheduledDate: 'DESC' },
    });
  }

  async getUpcoming(patientId: string): Promise<FollowUp[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.followUpRepository.find({
      where: {
        patientId,
        scheduledDate: MoreThanOrEqual(today),
        status: FollowUpStatus.SCHEDULED,
      },
      relations: ['provider', 'department'],
      order: { scheduledDate: 'ASC' },
    });
  }

  async getTodaysAppointments(facilityId: string, departmentId?: string): Promise<FollowUp[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const query = this.followUpRepository.createQueryBuilder('followUp')
      .leftJoinAndSelect('followUp.patient', 'patient')
      .leftJoinAndSelect('followUp.provider', 'provider')
      .where('followUp.facility_id = :facilityId', { facilityId })
      .andWhere('followUp.scheduled_date >= :today AND followUp.scheduled_date < :tomorrow', { today, tomorrow });

    if (departmentId) {
      query.andWhere('followUp.department_id = :departmentId', { departmentId });
    }

    query.orderBy('followUp.scheduled_time', 'ASC');

    return query.getMany();
  }

  async confirm(id: string): Promise<FollowUp> {
    const followUp = await this.findOne(id);

    if (followUp.status !== FollowUpStatus.SCHEDULED) {
      throw new BadRequestException('Only scheduled appointments can be confirmed');
    }

    followUp.status = FollowUpStatus.CONFIRMED;
    followUp.confirmedAt = new Date();

    return this.followUpRepository.save(followUp);
  }

  async checkIn(id: string): Promise<FollowUp> {
    const followUp = await this.findOne(id);

    if (![FollowUpStatus.SCHEDULED, FollowUpStatus.CONFIRMED].includes(followUp.status)) {
      throw new BadRequestException('Only scheduled or confirmed appointments can be checked in');
    }

    followUp.status = FollowUpStatus.CHECKED_IN;
    followUp.checkedInAt = new Date();

    return this.followUpRepository.save(followUp);
  }

  async complete(id: string, dto: CompleteFollowUpDto, userId: string): Promise<FollowUp> {
    const followUp = await this.findOne(id);

    if (followUp.status !== FollowUpStatus.CHECKED_IN) {
      throw new BadRequestException('Only checked-in appointments can be completed');
    }

    followUp.status = FollowUpStatus.COMPLETED;
    followUp.completedAt = new Date();
    followUp.completedById = userId;

    if (dto.followUpEncounterId) {
      followUp.followUpEncounterId = dto.followUpEncounterId;
    }
    if (dto.outcomeNotes) {
      followUp.outcomeNotes = dto.outcomeNotes;
    }

    return this.followUpRepository.save(followUp);
  }

  async reschedule(id: string, dto: RescheduleFollowUpDto, userId: string): Promise<FollowUp> {
    const followUp = await this.findOne(id);

    if ([FollowUpStatus.COMPLETED, FollowUpStatus.CANCELLED].includes(followUp.status)) {
      throw new BadRequestException('Cannot reschedule completed or cancelled appointments');
    }

    // Create new appointment
    const newAppointment = this.followUpRepository.create({
      ...followUp,
      id: undefined,
      appointmentNumber: await this.generateAppointmentNumber(),
      scheduledDate: new Date(dto.newDate),
      scheduledTime: dto.newTime || followUp.scheduledTime,
      status: FollowUpStatus.SCHEDULED,
      rescheduledFromId: followUp.id,
      confirmedAt: undefined,
      checkedInAt: undefined,
      completedAt: undefined,
      scheduledById: userId,
      createdAt: undefined,
      updatedAt: undefined,
    } as any);

    // Mark old as rescheduled
    followUp.status = FollowUpStatus.RESCHEDULED;
    followUp.cancellationReason = dto.reason || 'Rescheduled';
    await this.followUpRepository.save(followUp);

    return this.followUpRepository.save(newAppointment) as unknown as Promise<FollowUp>;
  }

  async cancel(id: string, dto: CancelFollowUpDto): Promise<FollowUp> {
    const followUp = await this.findOne(id);

    if ([FollowUpStatus.COMPLETED, FollowUpStatus.CANCELLED].includes(followUp.status)) {
      throw new BadRequestException('Cannot cancel completed or already cancelled appointments');
    }

    followUp.status = FollowUpStatus.CANCELLED;
    followUp.cancellationReason = dto.cancellationReason;
    followUp.cancelledAt = new Date();

    return this.followUpRepository.save(followUp);
  }

  async markMissed(id: string, reason?: string): Promise<FollowUp> {
    const followUp = await this.findOne(id);

    followUp.status = FollowUpStatus.MISSED;
    followUp.missedReason = reason || '';

    return this.followUpRepository.save(followUp);
  }

  async sendReminders(): Promise<number> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const pendingReminders = await this.followUpRepository.find({
      where: {
        status: FollowUpStatus.SCHEDULED,
        smsReminder: true,
        reminderSent: false,
        scheduledDate: Between(tomorrow, dayAfter),
      },
      relations: ['patient'],
    });

    for (const followUp of pendingReminders) {
      // Here you would integrate with SMS service
      // For now, just mark as sent
      followUp.reminderSent = true;
      followUp.reminderSentAt = new Date();
      await this.followUpRepository.save(followUp);
    }

    return pendingReminders.length;
  }

  async getStats(facilityId: string, fromDate: Date, toDate: Date) {
    const total = await this.followUpRepository.count({
      where: {
        facilityId,
        scheduledDate: Between(fromDate, toDate),
      },
    });

    const completed = await this.followUpRepository.count({
      where: {
        facilityId,
        status: FollowUpStatus.COMPLETED,
        scheduledDate: Between(fromDate, toDate),
      },
    });

    const missed = await this.followUpRepository.count({
      where: {
        facilityId,
        status: FollowUpStatus.MISSED,
        scheduledDate: Between(fromDate, toDate),
      },
    });

    const cancelled = await this.followUpRepository.count({
      where: {
        facilityId,
        status: FollowUpStatus.CANCELLED,
        scheduledDate: Between(fromDate, toDate),
      },
    });

    return {
      total,
      completed,
      missed,
      cancelled,
      completionRate: total > 0 ? (completed / total * 100).toFixed(2) : 0,
      noShowRate: total > 0 ? (missed / total * 100).toFixed(2) : 0,
    };
  }

  private async generateAppointmentNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const prefix = `APT${year}${month}${day}`;

    const lastAppointment = await this.followUpRepository
      .createQueryBuilder('followUp')
      .where('followUp.appointment_number LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('followUp.appointment_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastAppointment) {
      const lastSequence = parseInt(lastAppointment.appointmentNumber.slice(-4), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(4, '0')}`;
  }
}
