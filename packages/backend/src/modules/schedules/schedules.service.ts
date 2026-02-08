import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorSchedule } from './entities/doctor-schedule.entity';
import { CreateDoctorScheduleDto, UpdateDoctorScheduleDto, ScheduleQueryDto } from './dto/schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(
    @InjectRepository(DoctorSchedule)
    private scheduleRepository: Repository<DoctorSchedule>,
  ) {}

  async create(dto: CreateDoctorScheduleDto, facilityId: string): Promise<DoctorSchedule> {
    // Check for overlapping schedule
    const existing = await this.scheduleRepository.findOne({
      where: {
        doctorId: dto.doctorId,
        dayOfWeek: dto.dayOfWeek,
        facilityId,
        isActive: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Doctor already has a schedule for ${this.getDayName(dto.dayOfWeek)}. Please edit the existing schedule.`,
      );
    }

    const schedule = this.scheduleRepository.create({
      ...dto,
      facilityId,
    });

    return this.scheduleRepository.save(schedule);
  }

  async findAll(query: ScheduleQueryDto, facilityId: string) {
    const { doctorId, dayOfWeek, department, includeInactive } = query;

    try {
      const qb = this.scheduleRepository
        .createQueryBuilder('schedule')
        .leftJoinAndSelect('schedule.doctor', 'doctor')
        .where('schedule.facilityId = :facilityId', { facilityId });

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

      qb.orderBy('schedule.dayOfWeek', 'ASC')
        .addOrderBy('schedule.startTime', 'ASC');

      const data = await qb.getMany();

      // Group by doctor for easier frontend rendering
      const grouped = data.reduce((acc, schedule) => {
        const docId = schedule.doctorId;
        if (!acc[docId]) {
          acc[docId] = {
            doctor: schedule.doctor,
            schedules: [],
          };
        }
        acc[docId].schedules.push(schedule);
        return acc;
      }, {} as Record<string, { doctor: any; schedules: DoctorSchedule[] }>);

      return {
        data,
        grouped: Object.values(grouped),
      };
    } catch (error) {
      console.error('Error fetching schedules:', error);
      return {
        data: [],
        grouped: [],
      };
    }
  }

  async findOne(id: string, facilityId: string): Promise<DoctorSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, facilityId },
      relations: ['doctor'],
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async update(id: string, dto: UpdateDoctorScheduleDto, facilityId: string): Promise<DoctorSchedule> {
    const schedule = await this.findOne(id, facilityId);
    Object.assign(schedule, dto);
    return this.scheduleRepository.save(schedule);
  }

  async delete(id: string, facilityId: string): Promise<void> {
    const schedule = await this.findOne(id, facilityId);
    await this.scheduleRepository.remove(schedule);
  }

  async getDoctorsWithSchedules(facilityId: string) {
    const result = await this.scheduleRepository
      .createQueryBuilder('schedule')
      .leftJoinAndSelect('schedule.doctor', 'doctor')
      .where('schedule.facilityId = :facilityId', { facilityId })
      .andWhere('schedule.isActive = :isActive', { isActive: true })
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
