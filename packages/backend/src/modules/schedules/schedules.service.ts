import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import {
  CreateDoctorScheduleDto,
  UpdateDoctorScheduleDto,
  ScheduleQueryDto,
} from './dto/schedule.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class SchedulesService {
  private readonly logger = new Logger(SchedulesService.name);

  constructor(
    @InjectRepository(DoctorSchedule)
    private scheduleRepository: Repository<DoctorSchedule>,
  ) {}

  async create(
    dto: CreateDoctorScheduleDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<DoctorSchedule> {
    const tid = requireTenantId(tenantId);

    // Validate startTime < endTime
    if (dto.startTime >= dto.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }

    // Check for overlapping schedule (same doctor, same day, overlapping time range)
    const qb = this.scheduleRepository
      .createQueryBuilder('schedule')
      .where('schedule.deletedAt IS NULL')
      .andWhere('schedule.doctorId = :doctorId', { doctorId: dto.doctorId })
      .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek: dto.dayOfWeek })
      .andWhere('schedule.facilityId = :facilityId', { facilityId })
      .andWhere('schedule.isActive = :isActive', { isActive: true })
      .andWhere('schedule.startTime < :endTime', { endTime: dto.endTime })
      .andWhere('schedule.endTime > :startTime', { startTime: dto.startTime })
      .andWhere('schedule.tenant_id = :tenantId', { tenantId: tid });

    const existing = await qb.getOne();

    if (existing) {
      throw new ConflictException(
        `Doctor already has an overlapping schedule on ${this.getDayName(dto.dayOfWeek)} (${existing.startTime}–${existing.endTime}). Please edit the existing schedule or choose a non-overlapping time.`,
      );
    }

    const schedule = this.scheduleRepository.create({
      ...dto,
      facilityId,
    });
    (schedule as any).tenantId = tid;

    return this.scheduleRepository.save(schedule);
  }

  async findAll(query: ScheduleQueryDto, facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const { doctorId, dayOfWeek, department, includeInactive } = query;

    try {
      const qb = this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.doctor', 'doctor')
        .where('schedule.deletedAt IS NULL')
        .andWhere('schedule.facilityId = :facilityId', { facilityId })
        .andWhere('schedule.tenant_id = :tenantId', { tenantId: tid });

      if (!includeInactive) {
        qb.andWhere('schedule.isActive = :isActive', { isActive: true });
      }

      if (doctorId) {
        qb.andWhere('schedule.doctorId = :doctorId', { doctorId });
      }

      if (dayOfWeek !== undefined) {
        qb.andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek });
      }

      if (department) {
        qb.andWhere('schedule.department = :department', { department });
      }

      qb.orderBy('schedule.dayOfWeek', 'ASC').addOrderBy('schedule.startTime', 'ASC');

      const data = await qb.getMany();

      // Group by doctor for easier frontend rendering
      const grouped = data.reduce(
        (acc, schedule) => {
          const docId = schedule.doctorId;
          if (!acc[docId]) {
            acc[docId] = {
              doctor: schedule.doctor,
              schedules: [],
            };
          }
          acc[docId].schedules.push(schedule);
          return acc;
        },
        {} as Record<string, { doctor: any; schedules: DoctorSchedule[] }>,
      );

      return {
        data,
        grouped: Object.values(grouped),
      };
    } catch (error) {
      this.logger.error('Error fetching schedules:', error);
      return {
        data: [],
        grouped: [],
      };
    }
  }

  async findOne(id: string, facilityId: string, tenantId?: string): Promise<DoctorSchedule> {
    const tid = requireTenantId(tenantId);
    const where: any = { id, facilityId, tenantId: tid };

    const schedule = await this.scheduleRepository.findOne({
      where,
      relations: ['doctor'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async update(
    id: string,
    dto: UpdateDoctorScheduleDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<DoctorSchedule> {
    const tid = requireTenantId(tenantId);
    const schedule = await this.findOne(id, facilityId, tenantId);
    Object.assign(schedule, dto);

    // Re-run the same validations as create() — updates could previously
    // produce inverted time ranges or overlapping schedules
    if (schedule.startTime >= schedule.endTime) {
      throw new BadRequestException('Start time must be before end time');
    }
    if (schedule.isActive !== false) {
      const overlap = await this.scheduleRepository
        .createQueryBuilder('schedule')
        .where('schedule.deletedAt IS NULL')
        .andWhere('schedule.doctorId = :doctorId', { doctorId: schedule.doctorId })
        .andWhere('schedule.dayOfWeek = :dayOfWeek', { dayOfWeek: schedule.dayOfWeek })
        .andWhere('schedule.facilityId = :facilityId', { facilityId })
        .andWhere('schedule.isActive = :isActive', { isActive: true })
        .andWhere('schedule.id != :id', { id })
        .andWhere('schedule.startTime < :endTime', { endTime: schedule.endTime })
        .andWhere('schedule.endTime > :startTime', { startTime: schedule.startTime })
        .andWhere('schedule.tenant_id = :tenantId', { tenantId: tid })
        .getOne();
      if (overlap) {
        throw new ConflictException(
          `Doctor already has an overlapping schedule on ${this.getDayName(schedule.dayOfWeek)} (${overlap.startTime}–${overlap.endTime}).`,
        );
      }
    }

    return this.scheduleRepository.save(schedule);
  }

  async delete(id: string, facilityId: string, tenantId?: string): Promise<void> {
    requireTenantId(tenantId);
    const schedule = await this.findOne(id, facilityId, tenantId);
    await this.scheduleRepository.softRemove(schedule);
  }

  async getDoctorsWithSchedules(facilityId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const qb = this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.doctor', 'doctor')
      .where('schedule.deletedAt IS NULL')
      .andWhere('schedule.facilityId = :facilityId', { facilityId })
      .andWhere('schedule.isActive = :isActive', { isActive: true })
      .andWhere('schedule.tenant_id = :tenantId', { tenantId: tid });

    const result = await qb
      .select('DISTINCT doctor.id', 'id')
      .addSelect('doctor.firstName', 'firstName')
      .addSelect('doctor.lastName', 'lastName')
      .getRawMany();

    return result;
  }

  private getDayName(day: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day] || 'Unknown';
  }
}
