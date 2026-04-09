import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, Between } from 'typeorm';
import { Appointment, AppointmentStatus } from './entities/appointment.entity';
import { CreateAppointmentDto, UpdateAppointmentDto, AppointmentQueryDto } from './dto/appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private appointmentRepository: Repository<Appointment>,
  ) {}

  private async generateAppointmentNumber(tenantId?: string): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const where: any = { appointmentNumber: Like(`APT${datePrefix}%`) };
    if (tenantId) where.tenantId = tenantId;
    const count = await this.appointmentRepository.count({ where });
    return `APT${datePrefix}${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateAppointmentDto, facilityId: string, userId: string, tenantId?: string): Promise<Appointment> {
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
      if (existing.status === AppointmentStatus.CANCELLED || existing.status === AppointmentStatus.NO_SHOW) {
        return false;
      }
      // Time range overlap: newStart < existingEnd AND newEnd > existingStart
      return dto.startTime < existing.endTime && dto.endTime > existing.startTime;
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

  async update(id: string, dto: UpdateAppointmentDto, facilityId: string, tenantId?: string): Promise<Appointment> {
    const appointment = await this.findOne(id, facilityId, tenantId);
    Object.assign(appointment, dto);
    return this.appointmentRepository.save(appointment);
  }

  async updateStatus(id: string, status: AppointmentStatus, facilityId: string, cancellationReason?: string, tenantId?: string): Promise<Appointment> {
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

    const scheduled = await qb.clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.SCHEDULED })
      .getCount();

    const confirmed = await qb.clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.CONFIRMED })
      .getCount();

    const completed = await qb.clone()
      .andWhere('appointment.status = :status', { status: AppointmentStatus.COMPLETED })
      .getCount();

    return { total, scheduled, confirmed, completed };
  }

  async delete(id: string, facilityId: string, tenantId?: string): Promise<void> {
    const appointment = await this.findOne(id, facilityId, tenantId);
    await this.appointmentRepository.remove(appointment);
  }
}
