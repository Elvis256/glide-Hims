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
import { requireTenantId } from '../../common/utils/tenant.util';

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

  private async generateAppointmentNumber(
    manager: import('typeorm').EntityManager,
    tenantId: string,
  ): Promise<string> {
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await manager.count(Appointment, {
      where: { appointmentNumber: Like(`APT${datePrefix}%`), tenantId },
    });
    return `APT${datePrefix}${String(count + 1).padStart(4, '0')}`;
  }

  async create(
    dto: CreateAppointmentDto,
    facilityId: string,
    userId: string,
    tenantId?: string,
  ): Promise<Appointment> {
    const tid = requireTenantId(tenantId);

    // Serialize same-day bookings per tenant: closes both races at once —
    // two receptionists double-booking the same doctor slot, and two
    // concurrent creates drawing the same count-based appointment number
    // (appointment_number is UNIQUE, so the loser used to get a 500).
    return this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `appt_create_${tid}_${dto.appointmentDate}`,
      ]);

      this.assertNoDoctorConflict(
        await manager.find(Appointment, {
          where: { doctorId: dto.doctorId, appointmentDate: dto.appointmentDate as any, facilityId, tenantId: tid },
        }),
        dto.startTime,
        dto.endTime,
      );

      const appointmentNumber = await this.generateAppointmentNumber(manager, tid);

      const appointment = manager.create(Appointment, {
        ...dto,
        appointmentNumber,
        facilityId,
        createdBy: userId,
        tenantId: tid,
      });

      return manager.save(Appointment, appointment);
    });
  }

  /** Throws if the requested slot overlaps any live appointment in the list. */
  private assertNoDoctorConflict(
    existingAppointments: Appointment[],
    startTime: string,
    endTime?: string,
    excludeId?: string,
  ): void {
    const hasConflict = existingAppointments.some((existing) => {
      if (excludeId && existing.id === excludeId) return false;
      if (
        existing.status === AppointmentStatus.CANCELLED ||
        existing.status === AppointmentStatus.NO_SHOW
      ) {
        return false;
      }
      // Time range overlap: newStart < existingEnd AND newEnd > existingStart
      return startTime < existing.endTime && (endTime ? endTime > existing.startTime : true);
    });

    if (hasConflict) {
      throw new ConflictException(
        'Provider already has an appointment at the requested date and time',
      );
    }
  }

  async findAll(query: AppointmentQueryDto, facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const { date, patientId, doctorId, status, type, search, page = 1, limit = 20 } = query;

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .leftJoinAndSelect('appointment.patient', 'patient')
      .leftJoinAndSelect('appointment.doctor', 'doctor')
      .where('appointment.facilityId = :facilityId', { facilityId });

    qb.andWhere('appointment.tenant_id = :tenantId', { tenantId: tid });

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
      // Patient and User entities store fullName (no firstName/lastName
      // columns) — the old firstName/lastName filter 500'd on every search.
      qb.andWhere(
        '(patient.fullName ILIKE :search OR patient.mrn ILIKE :search OR doctor.fullName ILIKE :search)',
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
    const tid = requireTenantId(tenantId);
    const where: any = { id, facilityId };
    where.tenantId = tid;
    const appointment = await this.appointmentRepository.findOne({
      where,
      relations: ['patient', 'doctor'],
    });

    if (!appointment) {
      throw new NotFoundException('Appointment not found');
    }

    return appointment;
  }

  private static readonly TERMINAL_STATUSES = [
    AppointmentStatus.COMPLETED,
    AppointmentStatus.CANCELLED,
    AppointmentStatus.NO_SHOW,
  ];

  private static readonly ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
    [AppointmentStatus.SCHEDULED]: [
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ],
    [AppointmentStatus.CONFIRMED]: [
      AppointmentStatus.CHECKED_IN,
      AppointmentStatus.CANCELLED,
      AppointmentStatus.NO_SHOW,
    ],
    [AppointmentStatus.CHECKED_IN]: [
      AppointmentStatus.IN_PROGRESS,
      AppointmentStatus.COMPLETED,
      AppointmentStatus.CANCELLED,
    ],
    [AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
    [AppointmentStatus.COMPLETED]: [],
    [AppointmentStatus.CANCELLED]: [],
    [AppointmentStatus.NO_SHOW]: [],
  };

  async update(
    id: string,
    dto: UpdateAppointmentDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<Appointment> {
    const tid = requireTenantId(tenantId);
    const appointment = await this.findOne(id, facilityId, tid);

    if (AppointmentsService.TERMINAL_STATUSES.includes(appointment.status)) {
      throw new BadRequestException(
        `Cannot modify a ${appointment.status} appointment. Create a new booking instead.`,
      );
    }

    // Reschedule / doctor change: re-run the double-booking check against
    // the target slot (excluding this appointment itself).
    const doctorId = dto.doctorId ?? appointment.doctorId;
    const appointmentDate = dto.appointmentDate ?? appointment.appointmentDate;
    const startTime = dto.startTime ?? appointment.startTime;
    const endTime = dto.endTime ?? appointment.endTime;
    const slotChanged =
      doctorId !== appointment.doctorId ||
      String(appointmentDate) !== String(appointment.appointmentDate) ||
      startTime !== appointment.startTime ||
      endTime !== appointment.endTime;

    if (slotChanged) {
      this.assertNoDoctorConflict(
        await this.appointmentRepository.find({
          where: { doctorId, appointmentDate: appointmentDate as any, facilityId, tenantId: tid },
        }),
        startTime,
        endTime,
        appointment.id,
      );
    }

    Object.assign(appointment, dto);
    return this.appointmentRepository.save(appointment);
  }

  async updateStatus(
    id: string,
    status: AppointmentStatus,
    facilityId: string,
    cancellationReason?: string,
    tenantId?: string,
    userId?: string,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id, facilityId, tenantId);

    if (status !== appointment.status) {
      const allowed = AppointmentsService.ALLOWED_TRANSITIONS[appointment.status] ?? [];
      if (!allowed.includes(status)) {
        throw new BadRequestException(
          `Invalid status transition ${appointment.status} → ${status}`,
        );
      }
    }

    if (status === AppointmentStatus.CANCELLED && !cancellationReason) {
      throw new BadRequestException('cancellationReason is required when cancelling');
    }

    appointment.status = status;
    if (cancellationReason) {
      appointment.cancellationReason = cancellationReason;
    }
    const saved = await this.appointmentRepository.save(appointment);

    // Cancelling a checked-in appointment must also pull the patient out of
    // the queue, or they sit in the waiting list forever.
    if (status === AppointmentStatus.CANCELLED && appointment.queueId && this.queueService) {
      try {
        await this.queueService.cancelFromQueue(
          appointment.queueId,
          `Appointment cancelled: ${cancellationReason}`,
          userId || appointment.createdBy,
          tenantId,
        );
      } catch (err) {
        this.logger.warn(
          `Appointment ${id} cancelled but queue ${appointment.queueId} could not be cancelled: ${err.message}`,
        );
      }
    }

    return saved;
  }

  async getStats(facilityId: string, date?: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const qb = this.appointmentRepository
      .createQueryBuilder('appointment')
      .where('appointment.facilityId = :facilityId', { facilityId })
      .andWhere('appointment.appointmentDate = :date', { date: targetDate });

    qb.andWhere('appointment.tenant_id = :tenantId', { tenantId: tid });

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

    // Recovery path: a previous check-in marked the appointment CHECKED_IN but
    // queue creation failed (no queueId). Allow re-running check-in to retry
    // queue creation instead of stranding the patient.
    const isQueueRecovery =
      appointment.status === AppointmentStatus.CHECKED_IN && !appointment.queueId;

    if (
      appointment.status !== AppointmentStatus.SCHEDULED &&
      appointment.status !== AppointmentStatus.CONFIRMED &&
      !isQueueRecovery
    ) {
      throw new BadRequestException(
        `Cannot check in appointment with status "${appointment.status}". Only SCHEDULED or CONFIRMED appointments can be checked in.`,
      );
    }

    // Step 1: Update appointment to CHECKED_IN
    if (!isQueueRecovery) {
      appointment.status = AppointmentStatus.CHECKED_IN;
      appointment.checkedInAt = new Date();
      await this.appointmentRepository.save(appointment);
    }

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
        // Queue creation failed — appointment stays CHECKED_IN without a queueId,
        // which the guard above now accepts for a retry. Surface the failure so
        // the front desk knows the patient has no ticket yet.
        this.logger.warn(
          `Failed to create queue entry for appointment ${appointmentId}: ${err.message}`,
        );
        throw new BadRequestException(
          `Appointment checked in but queue ticket creation failed: ${err.message}. Retry check-in to issue the ticket.`,
        );
      }
    }

    return this.findOne(appointmentId, facilityId, tenantId);
  }

  async delete(id: string, facilityId: string, tenantId?: string): Promise<void> {
    const appointment = await this.findOne(id, facilityId, tenantId);
    // Checked-in/in-progress/completed appointments carry clinical and
    // billing history (queue + encounter links) — cancel instead of delete.
    if (
      [
        AppointmentStatus.CHECKED_IN,
        AppointmentStatus.IN_PROGRESS,
        AppointmentStatus.COMPLETED,
      ].includes(appointment.status)
    ) {
      throw new BadRequestException(
        `Cannot delete a ${appointment.status} appointment — cancel it instead.`,
      );
    }
    await this.appointmentRepository.remove(appointment);
  }
}
