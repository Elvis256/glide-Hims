import { Injectable, NotFoundException } from '@nestjs/common';
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

  private async generateAppointmentNumber(): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await this.appointmentRepository.count({
      where: {
        appointmentNumber: Like(`APT${datePrefix}%`),
      },
    });
    return `APT${datePrefix}${String(count + 1).padStart(4, '0')}`;
  }

  async create(dto: CreateAppointmentDto, facilityId: string, userId: string): Promise<Appointment> {
    const appointmentNumber = await this.generateAppointmentNumber();
    
    const appointment = this.appointmentRepository.create({
      ...dto,
      appointmentNumber,
      facilityId,
      createdBy: userId,
    });

    return this.appointmentRepository.save(appointment);
  }

  async findAll(query: AppointmentQueryDto, facilityId: string) {
    const { date, patientId, doctorId, status, type, search, page = 1, limit = 20 } = query;
    
    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .where('appointment.facilityId = :facilityId', { facilityId });

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

  async findOne(id: string, facilityId: string): Promise<Appointment> {
    const appointment = await this.appointmentRepository.findOne({
      where: { id, facilityId },
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  async update(id: string, dto: UpdateAppointmentDto, facilityId: string): Promise<Appointment> {
    const appointment = await this.findOne(id, facilityId);
    Object.assign(appointment, dto);
    return this.appointmentRepository.save(appointment);
  }

  async updateStatus(id: string, status: AppointmentStatus, facilityId: string, cancellationReason?: string): Promise<Appointment> {
    const appointment = await this.findOne(id, facilityId);
    appointment.status = status;
    if (cancellationReason) {
      appointment.cancellationReason = cancellationReason;
    }
    return this.appointmentRepository.save(appointment);
  }

  async getStats(facilityId: string, date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    
    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.facilityId = :facilityId', { facilityId })
      .andWhere('appointment.appointmentDate = :date', { date: targetDate });

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

  async delete(id: string, facilityId: string): Promise<void> {
    const appointment = await this.findOne(id, facilityId);
    await this.appointmentRepository.remove(appointment);
  }
}
