import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between, DataSource } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import {
  CreateAppointmentDto,
  UpdateAppointmentDto,
  AppointmentQueryDto,
} from './dto/appointment.dto';
import { QueueManagementService } from '../queue-management/queue-management.service';
import { ServicePoint } from '../../database/entities/queue.entity';

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
    private dataSource: DataSource,
    @Optional()
    @Inject(forwardRef(() => QueueManagementService))
    private queueService?: QueueManagementService,
  ) {}

  private async generateAppointmentNumber(tenantId?: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const where: any = { appointmentNumber: Like(`APT${datePrefix}%`) };
    if (tenantId) where.tenantId = tenantId;
    const count = await this.appointmentRepository.count({ where });
    return `APT${datePrefix}${String(count + 1).padStart(4, '0')}`;
  }

  async create(
    dto: CreateAppointmentDto,
    facilityId: string,
    userId: string,
    tenantId?: string,
  ): Promise<Appointment> {
    // Check for double-booking: provider must not have an overlapping appointment
    const conflictWhere: any = {
      doctorId: dto.doctorId,
      appointmentDate: dto.appointmentDate,
      facilityId,
    };
    if (tenantId) conflictWhere.tenantId = tenantId;

    const existingAppointments = await this.appointmentRepository.find({
      where: conflictWhere,
    });

    const hasConflict = existingAppointments.some((existing) => {
      if (
        existing.status === AppointmentStatus.CANCELLED ||
        existing.status === AppointmentStatus.NO_SHOW
      ) {
        return false;
      }
      // Time range overlap: newStart < existingEnd AND newEnd > existingStart
      return (
        dto.startTime < existing.endTime && (dto.endTime ? dto.endTime > existing.startTime : true)
      );
    });

    if (hasConflict) {
      throw new ConflictException(
        'Provider already has an appointment at the requested date and time',
      );
    }

    const appointmentNumber = await this.generateAppointmentNumber(tenantId);

    const appointment = this.appointmentRepository.create({
      ...dto,
      appointmentNumber,
      facilityId,
      createdBy: userId,
      ...(tenantId ? { tenantId } : {}),
    });

    return this.appointmentRepository.save(appointment);
  }

  async findAll(query: AppointmentQueryDto, facilityId: string, tenantId?: string) {
    const { date, patientId, doctorId, status, type, search, page = 1, limit = 20 } = query;

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .where('appointment.facilityId = :facilityId', { facilityId });

    if (tenantId) {
      qb.andWhere('appointment.tenant_id = :tenantId', { tenantId });
    }

    if (date) {
      qb.andWhere('appointment.appointmentDate = :date', { date });
    }

    if (patientId) {
      qb.andWhere('appointment.patientId = :patientId', { patientId });
    }

    if (doctorId) {
      qb.andWhere('appointment.doctorId = :doctorId', { doctorId });
    }

    if (status) {
      qb.andWhere('appointment.status = :status', { status });
    }

    if (type) {
      qb.andWhere('appointment.type = :type', { type });
    }

    if (search) {
      qb.andWhere(
        '(patient.firstName ILIKE :search OR patient.lastName ILIKE :search OR patient.mrn ILIKE :search OR doctor.firstName ILIKE :search OR doctor.lastName ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.orderBy('appointment.appointmentDate', 'ASC')
      .addOrderBy('appointment.startTime', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, facilityId: string, tenantId?: string): Promise<Appointment> {
    const where: any = { id, facilityId };
    if (tenantId) where.tenantId = tenantId;
    const appointment = await this.appointmentRepository.findOne({
      where,
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id, facilityId, tenantId);
    Object.assign(appointment, dto);
    return this.appointmentRepository.save(appointment);
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    facilityId: string,
    cancellationReason?: string,
    tenantId?: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id, facilityId, tenantId);
    appointment.status = status;
    if (cancellationReason) {
      appointment.cancellationReason = cancellationReason;
    }
    return this.appointmentRepository.save(appointment);
  }

  async getStats(facilityId: string, date?: string, tenantId?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.facilityId = :facilityId', { facilityId })
      .andWhere('appointment.appointmentDate = :date', { date: targetDate });

    if (tenantId) {
      qb.andWhere('appointment.tenant_id = :tenantId', { tenantId });
    }

    const total = await qb.getCount();

    const scheduled = await qb
      .clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.SCHEDULED })
      .getCount();

    const confirmed = await qb
      .clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.CONFIRMED })
      .getCount();

    const completed = await qb
      .clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.COMPLETED })
      .getCount();

    return { total, scheduled, confirmed, completed };
  }

  async checkIn(
    appointmentId: string,
    facilityId: string,
    userId: string,
    tenantId?: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(appointmentId, facilityId, tenantId);

    if (
      appointment.status !== AppointmentStatus.SCHEDULED &&
      appointment.status !== AppointmentStatus.CONFIRMED
    ) {
      throw new BadRequestException(
        `Cannot check in appointment with status "${appointment.status}". Only SCHEDULED or CONFIRMED appointments can be checked in.`,
      );
    }

    // Step 1: Update appointment to CHECKED_IN
    appointment.status = AppointmentStatus.CHECKED_IN;
    appointment.checkedInAt = new Date();
    await this.appointmentRepository.save(appointment);

    // Step 2: Create queue entry via QueueManagementService (has its own transaction)
    if (this.queueService) {
      try {
        const queueEntry = await this.queueService.addToQueue(
          {
            patientId: appointment.patientId,
            servicePoint: ServicePoint.CONSULTATION,
            assignedDoctorId: appointment.doctorId,
            chiefComplaintAtToken: appointment.reasonForVisit,
          },
          userId,
          facilityId,
          tenantId,
        );

        // Step 3: Back-populate appointment with queue and encounter IDs
        appointment.queueId = queueEntry.id;
        appointment.encounterId = queueEntry.encounterId;
        await this.appointmentRepository.save(appointment);

        // Step 4: Link queue entry back to appointment
        await this.dataSource
          .createQueryBuilder()
          .update('queues')
          .set({ appointmentId: appointment.id })
          .where('id = :id', { id: queueEntry.id })
          .execute();
      } catch (err) {
        // Queue creation failed — appointment is still CHECKED_IN, recoverable via retry
        this.logger.warn(
          `Failed to create queue entry for appointment ${appointmentId}: ${err.message}`,
        );
      }
    }

    return this.findOne(appointmentId, facilityId, tenantId);
  }

  async delete(id: string, facilityId: string, tenantId?: string): Promise<void> {
    const appointment = await this.findOne(id, facilityId, tenantId);
    await this.appointmentRepository.remove(appointment);
  }
}
