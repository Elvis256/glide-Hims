import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, LessThan, Repository } from 'typeorm';
import { DoctorDuty, DutyStatus } from '../../database/entities/doctor-duty.entity';
import { User } from '../../database/entities/user.entity';
import {
  CreateDoctorDutyDto,
  UpdateDoctorDutyDto,
  CheckInDto,
  DoctorDutyFilterDto,
} from './dto/doctor-duty.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class DoctorDutyService {
  private readonly logger = new Logger(DoctorDutyService.name);

  constructor(
    @InjectRepository(DoctorDuty)
    private readonly doctorDutyRepo: Repository<DoctorDuty>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async checkIn(
    dto: CheckInDto,
    markedById: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    const today = new Date().toISOString().split('T')[0];

    return this.dataSource.transaction(async (manager) => {
      // Serialize per doctor+day — the check-then-insert below raced,
      // producing duplicate duty rows that double-list on the duty board
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `doctor_duty:${tid}:${dto.doctorId}:${today}`,
      ]);

      // Check if already checked in today
      const existing = await manager.findOne(DoctorDuty, {
        where: {
          doctorId: dto.doctorId,
          facilityId,
          dutyDate: new Date(today),
          tenantId: tid,
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
        if (dto.maxPatients != null) existing.maxPatients = dto.maxPatients;
        return manager.save(DoctorDuty, existing);
      }

      // Create new duty record
      const duty = manager.create(DoctorDuty, {
        doctorId: dto.doctorId,
        facilityId,
        departmentId: dto.departmentId,
        dutyDate: new Date(today),
        status: DutyStatus.ON_DUTY,
        checkInTime: new Date().toTimeString().split(' ')[0],
        roomNumber: dto.roomNumber,
        ...(dto.maxPatients != null ? { maxPatients: dto.maxPatients } : {}),
        markedById,
        tenantId: tid,
      });

      return manager.save(DoctorDuty, duty);
    });
  }

  /**
   * Nightly sweep: duty rows from previous days left ON_DUTY (doctor forgot
   * to check out) stayed on the duty board forever. Runs cross-tenant in
   * system context by design (same as the other maintenance crons).
   */
  @Cron('30 0 * * *', { name: 'doctor-duty-auto-checkout' })
  async autoCheckoutStaleDuties(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const stale = await this.doctorDutyRepo.find({
      where: {
        status: In([DutyStatus.ON_DUTY, DutyStatus.ON_BREAK, DutyStatus.IN_CONSULTATION]),
        dutyDate: LessThan(new Date(today)),
      },
    });
    if (stale.length === 0) return;

    for (const duty of stale) {
      duty.status = DutyStatus.OFF_DUTY;
      duty.checkOutTime = duty.checkOutTime || '23:59:59';
      duty.notes = `${duty.notes || ''} [auto-checkout]`.trim();
    }
    await this.doctorDutyRepo.save(stale);
    this.logger.log(`Auto-checked-out ${stale.length} stale doctor duty record(s)`);
  }

  async checkOut(id: string, notes?: string, tenantId?: string): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    const duty = await this.doctorDutyRepo.findOne({
      where: { id, tenantId: tid },
    });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }

    duty.status = DutyStatus.OFF_DUTY;
    duty.checkOutTime = new Date().toTimeString().split(' ')[0];
    if (notes) duty.notes = notes;

    return this.doctorDutyRepo.save(duty);
  }

  async updateStatus(id: string, status: DutyStatus, tenantId?: string): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    const duty = await this.doctorDutyRepo.findOne({
      where: { id, tenantId: tid },
    });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }

    duty.status = status;
    return this.doctorDutyRepo.save(duty);
  }

  async getDoctorsOnDuty(
    facilityId: string,
    filter?: DoctorDutyFilterDto,
    tenantId?: string,
  ): Promise<DoctorDuty[]> {
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

    query.andWhere('duty.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });

    return query.orderBy('duty.checkInTime', 'ASC').getMany();
  }

  async getAllDoctors(facilityId: string, tenantId?: string): Promise<User[]> {
    // Get all users with doctor role
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userRoles', 'userRoles')
      .leftJoinAndSelect('userRoles.role', 'role')
      .where('(userRoles.facilityId = :facilityId OR userRoles.facilityId IS NULL)', { facilityId })
      .andWhere(
        '(LOWER(role.name) LIKE :doctor OR LOWER(role.name) LIKE :consultant OR LOWER(role.name) LIKE :physician)',
        { doctor: '%doctor%', consultant: '%consultant%', physician: '%physician%' },
      )
      .andWhere('user.status = :status', { status: 'active' })
      .orderBy('user.fullName', 'ASC');

    qb.andWhere('user.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });

    return qb.getMany();
  }

  async getDoctorsWithDutyStatus(
    facilityId: string,
    date?: string,
    tenantId?: string,
  ): Promise<any[]> {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Get all doctors
    const doctors = await this.getAllDoctors(facilityId, tenantId);

    // Get today's duty records
    const duties = await this.doctorDutyRepo.find({
      where: {
        facilityId,
        dutyDate: new Date(targetDate),
        tenantId: requireTenantId(tenantId),
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

  async updateQueueCount(
    doctorId: string,
    facilityId: string,
    count: number,
    tenantId?: string,
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    const today = new Date().toISOString().split('T')[0];
    await this.doctorDutyRepo.update(
      { doctorId, facilityId, dutyDate: new Date(today), tenantId: tid },
      { currentQueueCount: count },
    );
  }

  async create(
    dto: CreateDoctorDutyDto,
    markedById: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    const date = dto.dutyDate || new Date().toISOString().split('T')[0];

    const duty = this.doctorDutyRepo.create({
      ...dto,
      dutyDate: new Date(date),
      facilityId,
      markedById,
      tenantId: tid,
    });

    return this.doctorDutyRepo.save(duty);
  }

  async update(id: string, dto: UpdateDoctorDutyDto, tenantId?: string): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    const duty = await this.doctorDutyRepo.findOne({
      where: { id, tenantId: tid },
    });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }

    Object.assign(duty, dto);
    return this.doctorDutyRepo.save(duty);
  }

  async findOne(id: string, tenantId?: string): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    const duty = await this.doctorDutyRepo.findOne({
      where: { id, tenantId: tid },
      relations: ['doctor', 'department'],
    });
    if (!duty) {
      throw new NotFoundException('Duty record not found');
    }
    return duty;
  }
}
