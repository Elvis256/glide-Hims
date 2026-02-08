import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DoctorDuty, DutyStatus } from '../../database/entities/doctor-duty.entity';
import { User } from '../../database/entities/user.entity';
import {
  CreateDoctorDutyDto,
  UpdateDoctorDutyDto,
  CheckInDto,
  DoctorDutyFilterDto,
} from './dto/doctor-duty.dto';

@Injectable()
export class DoctorDutyService {
  constructor(
    @InjectRepository(DoctorDuty)
    private readonly doctorDutyRepo: Repository<DoctorDuty>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async checkIn(dto: CheckInDto, markedById: string, facilityId: string): Promise<DoctorDuty> {
    const today = new Date().toISOString().split('T')[0];

    // Check if already checked in today
    const existing = await this.doctorDutyRepo.findOne({
      where: {
        doctorId: dto.doctorId,
        facilityId,
        dutyDate: new Date(today),
      },
    });

    if (existing && existing.status === DutyStatus.ON_DUTY) {
      throw new ConflictException('Doctor is already on duty');
    }

    if (existing) {
      // Update existing record
      existing.status = DutyStatus.ON_DUTY;
      existing.checkInTime = new Date().toTimeString().split(' ')[0];
      existing.roomNumber = dto.roomNumber || existing.roomNumber;
      existing.departmentId = dto.departmentId || existing.departmentId;
      return this.doctorDutyRepo.save(existing);
    }

    // Create new duty record
    const duty = this.doctorDutyRepo.create({
      doctorId: dto.doctorId,
      facilityId,
      departmentId: dto.departmentId,
      dutyDate: new Date(today),
      status: DutyStatus.ON_DUTY,
      checkInTime: new Date().toTimeString().split(' ')[0],
      roomNumber: dto.roomNumber,
      markedById,
    });

    return this.doctorDutyRepo.save(duty);
  }

  async checkOut(id: string, notes?: string): Promise<DoctorDuty> {
    const duty = await this.doctorDutyRepo.findOne({ where: { id } });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }

    duty.status = DutyStatus.OFF_DUTY;
    duty.checkOutTime = new Date().toTimeString().split(' ')[0];
    if (notes) duty.notes = notes;

    return this.doctorDutyRepo.save(duty);
  }

  async updateStatus(id: string, status: DutyStatus): Promise<DoctorDuty> {
    const duty = await this.doctorDutyRepo.findOne({ where: { id } });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }

    duty.status = status;
    return this.doctorDutyRepo.save(duty);
  }

  async getDoctorsOnDuty(facilityId: string, filter?: DoctorDutyFilterDto): Promise<DoctorDuty[]> {
    const date = filter?.date || new Date().toISOString().split('T')[0];

    const query = this.doctorDutyRepo
      .createQueryBuilder('duty')
      .leftJoinAndSelect('duty.doctor', 'doctor')
      .leftJoinAndSelect('doctor.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .leftJoinAndSelect('duty.department', 'department')
      .where('duty.facilityId = :facilityId', { facilityId })
      .andWhere('duty.dutyDate = :date', { date });

    if (filter?.onlyOnDuty === 'true') {
      query.andWhere('duty.status IN (:...statuses)', {
        statuses: [DutyStatus.ON_DUTY, DutyStatus.IN_CONSULTATION, DutyStatus.ON_BREAK],
      });
    }

    if (filter?.departmentId) {
      query.andWhere('duty.departmentId = :departmentId', { departmentId: filter.departmentId });
    }

    if (filter?.status) {
      query.andWhere('duty.status = :status', { status: filter.status });
    }

    return query.orderBy('duty.checkInTime', 'ASC').getMany();
  }

  async getAllDoctors(facilityId: string): Promise<User[]> {
    // Get all users with doctor role
    return this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .where('userRoles.facilityId = :facilityId', { facilityId })
      .andWhere('LOWER(role.name) LIKE :doctor', { doctor: '%doctor%' })
      .andWhere('user.status = :status', { status: 'active' })
      .orderBy('user.fullName', 'ASC')
      .getMany();
  }

  async getDoctorsWithDutyStatus(facilityId: string, date?: string): Promise<any[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get all doctors
    const doctors = await this.getAllDoctors(facilityId);

    // Get today's duty records
    const duties = await this.doctorDutyRepo.find({
      where: {
        facilityId,
        dutyDate: new Date(targetDate),
      },
    });

    const dutyMap = new Map(duties.map((d) => [d.doctorId, d]));

    return doctors.map((doctor) => {
      const duty = dutyMap.get(doctor.id);
      return {
        id: doctor.id,
        fullName: doctor.fullName,
        email: doctor.email,
        phone: doctor.phone,
        roles: doctor.userRoles?.map((ur) => ur.role?.name).filter(Boolean),
        dutyId: duty?.id,
        status: duty?.status || DutyStatus.OFF_DUTY,
        checkInTime: duty?.checkInTime,
        checkOutTime: duty?.checkOutTime,
        roomNumber: duty?.roomNumber,
        departmentId: duty?.departmentId,
        currentQueueCount: duty?.currentQueueCount || 0,
        maxPatients: duty?.maxPatients || 20,
      };
    });
  }

  async updateQueueCount(doctorId: string, facilityId: string, count: number): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    await this.doctorDutyRepo.update(
      { doctorId, facilityId, dutyDate: new Date(today) },
      { currentQueueCount: count },
    );
  }

  async create(dto: CreateDoctorDutyDto, markedById: string, facilityId: string): Promise<DoctorDuty> {
    const date = dto.dutyDate || new Date().toISOString().split('T')[0];

    const duty = this.doctorDutyRepo.create({
      ...dto,
      dutyDate: new Date(date),
      facilityId,
      markedById,
    });

    return this.doctorDutyRepo.save(duty);
  }

  async update(id: string, dto: UpdateDoctorDutyDto): Promise<DoctorDuty> {
    const duty = await this.doctorDutyRepo.findOne({ where: { id } });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }

    Object.assign(duty, dto);
    return this.doctorDutyRepo.save(duty);
  }

  async findOne(id: string): Promise<DoctorDuty> {
    const duty = await this.doctorDutyRepo.findOne({
      where: { id },
      relations: ['doctor', 'department'],
    });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }
    return duty;
  }
}
