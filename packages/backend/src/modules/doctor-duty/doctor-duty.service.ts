import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
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
import { localDateString, localTimeString } from '../../common/utils/timezone.util';

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

  /**
   * The role predicate the duty board itself uses. Kept in one place so that
   * "who can be checked in" and "who getAllDoctors lists" cannot drift apart.
   */
  private static readonly DOCTOR_ROLE_MATCH =
    '(LOWER(role.name) LIKE :doctor OR LOWER(role.name) LIKE :consultant OR LOWER(role.name) LIKE :physician)';
  private static readonly DOCTOR_ROLE_PARAMS = {
    doctor: '%doctor%',
    consultant: '%consultant%',
    physician: '%physician%',
  };

  /**
   * Refuse to put somebody on the doctors' duty board who is not a doctor here.
   *
   * `doctorId` was taken on trust: any uuid was written straight into the row.
   * Checking in a lab technician returned 201 and put "Lab Tech 1 — on duty,
   * room LAB" on the doctors' board; an id belonging to no user at all reached
   * Postgres, tripped the foreign key and came back a 500. Because the id was
   * never scoped to the tenant either, a user from another hospital would have
   * been joined and their name rendered on this hospital's board.
   */
  private async assertIsDoctor(doctorId: string, tenantId: string): Promise<void> {
    const doctor = await this.userRepo
      .createQueryBuilder('user')
      .leftJoin('user.userRoles', 'userRoles')
      .leftJoin('userRoles.role', 'role')
      .where('user.id = :doctorId', { doctorId })
      .andWhere('user.tenant_id = :tenantId', { tenantId })
      .andWhere('user.status = :status', { status: 'active' })
      .andWhere(
        DoctorDutyService.DOCTOR_ROLE_MATCH,
        DoctorDutyService.DOCTOR_ROLE_PARAMS,
      )
      .getOne();

    if (!doctor) {
      throw new BadRequestException(
        'That user is not an active doctor at this organisation and cannot be put on the duty roster.',
      );
    }
  }

  async checkIn(
    dto: CheckInDto,
    markedById: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    await this.assertIsDoctor(dto.doctorId, tid);
    const today = localDateString(new Date());

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
        existing.checkInTime = localTimeString(new Date());
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
        checkInTime: localTimeString(new Date()),
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
   *
   * The day this compares against is the WARD'S, not the server's. Every
   * "today" in this service came from `new Date().toISOString()`, which is the
   * UTC date, and the hospital is on UTC+3. So a doctor starting a night shift
   * at 01:00 local was filed under yesterday — and then this sweep, running at
   * 00:30 UTC, which is 03:30 in the ward, saw a duty row dated "before today"
   * and marked them OFF_DUTY two and a half hours into the shift. The doctor
   * who is physically in the building disappears from the duty board, and the
   * board is what the queue, the escalation paths and the on-call lookup all
   * read to decide who is here.
   */
  @Cron('30 0 * * *', { name: 'doctor-duty-auto-checkout' })
  async autoCheckoutStaleDuties(): Promise<void> {
    const today = localDateString(new Date());
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
    duty.checkOutTime = localTimeString(new Date());
    if (notes) duty.notes = notes;

    return this.doctorDutyRepo.save(duty);
  }

  async updateStatus(id: string, status: DutyStatus, tenantId?: string): Promise<DoctorDuty> {
    const tid = requireTenantId(tenantId);
    // The handler pulls a bare @Body('status') with no DTO behind it, so an
    // absent field arrived as undefined, TypeORM skipped it on save, and the
    // caller got a 200 and an unchanged row — "set status" reporting success
    // while doing nothing.
    if (!status || !Object.values(DutyStatus).includes(status)) {
      throw new BadRequestException(
        `status must be one of: ${Object.values(DutyStatus).join(', ')}`,
      );
    }
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
    const date = filter?.date || localDateString(new Date());

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
      .andWhere(DoctorDutyService.DOCTOR_ROLE_MATCH, DoctorDutyService.DOCTOR_ROLE_PARAMS)
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
    const targetDate = date || localDateString(new Date());

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
    const today = localDateString(new Date());
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
    await this.assertIsDoctor(dto.doctorId, tid);
    const date = dto.dutyDate || localDateString(new Date());

    // (doctor, facility, duty_date) is UNIQUE. checkIn takes an advisory lock
    // and updates the existing row; this path did neither, so rostering the
    // same doctor twice for one day hit the constraint and came back a 500 —
    // an unexpected error for what is simply "already rostered".
    const existing = await this.doctorDutyRepo.findOne({
      where: { doctorId: dto.doctorId, facilityId, dutyDate: new Date(date), tenantId: tid },
    });
    if (existing) {
      throw new ConflictException('That doctor is already rostered at this facility for that day.');
    }

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
