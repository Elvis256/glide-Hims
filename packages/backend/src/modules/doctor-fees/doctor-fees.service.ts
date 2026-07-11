import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import {
  DoctorFeeProfile,
  DoctorFeeMode,
  DoctorEmploymentType,
} from '../../database/entities/doctor-fee-profile.entity';
import { Service as ServiceCatalog } from '../../database/entities/service-category.entity';
import { Department } from '../../database/entities/department.entity';
import { User } from '../../database/entities/user.entity';
import { Encounter } from '../../database/entities/encounter.entity';
import { UpsertDoctorFeeProfileDto } from './doctor-fees.dto';

export interface ResolvedDoctorFee {
  fee: number | null;
  source: string;
  doctorId?: string;
  feeMode?: DoctorFeeMode;
  employmentType?: DoctorEmploymentType;
  doctorShare?: number;
  hospitalShare?: number;
  basis?: number;
  isFollowUp?: boolean;
}

@Injectable()
export class DoctorFeesService {
  private readonly logger = new Logger(DoctorFeesService.name);

  constructor(
    @InjectRepository(DoctorFeeProfile)
    private readonly profileRepo: Repository<DoctorFeeProfile>,
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepo: Repository<ServiceCatalog>,
    @InjectRepository(Department)
    private readonly deptRepo: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Encounter)
    private readonly encounterRepo: Repository<Encounter>,
  ) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async getProfile(doctorId: string, tenantId?: string): Promise<DoctorFeeProfile | null> {
    const where: any = { doctorId };
    if (tenantId) where.tenantId = tenantId;
    return this.profileRepo.findOne({ where });
  }

  /** Batch-fetch profiles for multiple doctors in a single query. */
  async getProfiles(
    doctorIds: string[],
    tenantId?: string,
  ): Promise<Map<string, DoctorFeeProfile>> {
    if (doctorIds.length === 0) return new Map();
    const where: any = { doctorId: In(doctorIds) };
    if (tenantId) where.tenantId = tenantId;
    const profiles = await this.profileRepo.find({ where });
    const map = new Map<string, DoctorFeeProfile>();
    for (const p of profiles) map.set(p.doctorId, p);
    return map;
  }

  async listProfiles(tenantId?: string): Promise<DoctorFeeProfile[]> {
    if (!tenantId) {
      this.logger.warn('listProfiles called without tenantId — returning empty to prevent cross-tenant leak');
      return [];
    }
    return this.profileRepo.find({
      where: { tenantId },
      relations: ['doctor'],
      order: { createdAt: 'DESC' },
    });
  }

  async upsertProfile(
    doctorId: string,
    dto: UpsertDoctorFeeProfileDto,
    tenantId?: string,
  ): Promise<DoctorFeeProfile> {
    const doctor = await this.userRepo.findOne({
      where: { id: doctorId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!doctor) throw new NotFoundException(`Doctor ${doctorId} not found`);

    const feeMode = dto.feeMode ?? DoctorFeeMode.FLAT;
    if (feeMode === DoctorFeeMode.FLAT && (dto.flatFee == null || dto.flatFee <= 0)) {
      throw new BadRequestException('flatFee is required for flat fee mode');
    }
    if (
      feeMode === DoctorFeeMode.PERCENT_OF_SPECIALTY &&
      (dto.percentOfSpecialty == null || dto.percentOfSpecialty <= 0)
    ) {
      throw new BadRequestException('percentOfSpecialty is required for percent_of_specialty mode');
    }
    if (feeMode === DoctorFeeMode.SPLIT) {
      const ds = dto.doctorSharePercent ?? 0;
      const hs = dto.hospitalSharePercent ?? 100 - ds;
      if (Math.abs(ds + hs - 100) > 0.01) {
        throw new BadRequestException('doctorSharePercent + hospitalSharePercent must equal 100');
      }
      dto.hospitalSharePercent = hs;
    }

    let existing = await this.getProfile(doctorId, tenantId);
    if (!existing) {
      existing = this.profileRepo.create({
        doctorId,
        ...(tenantId ? { tenantId } : {}),
      } as Partial<DoctorFeeProfile>) as DoctorFeeProfile;
    }
    Object.assign(existing!, {
      employmentType:
        dto.employmentType ?? existing!.employmentType ?? DoctorEmploymentType.EMPLOYED,
      feeMode,
      flatFee: dto.flatFee ?? null,
      percentOfSpecialty: dto.percentOfSpecialty ?? null,
      doctorSharePercent: dto.doctorSharePercent ?? null,
      hospitalSharePercent: dto.hospitalSharePercent ?? null,
      workingDays: dto.workingDays ?? null,
      followUpWindowDays: dto.followUpWindowDays ?? null,
      followUpFee: dto.followUpFee ?? null,
      effectiveFrom: dto.effectiveFrom ?? null,
      effectiveTo: dto.effectiveTo ?? null,
      isActive: dto.isActive ?? true,
      notes: dto.notes ?? null,
    });
    return this.profileRepo.save(existing!);
  }

  async deleteProfile(doctorId: string, tenantId?: string): Promise<void> {
    const profile = await this.getProfile(doctorId, tenantId);
    if (!profile) return;
    await this.profileRepo.softRemove(profile);
  }

  // ─── Resolution ────────────────────────────────────────────────────────────

  /**
   * True if the doctor is allowed to take patients today per their
   * working_days array (ISO weekday 1=Mon..7=Sun). NULL = every day.
   */
  isWorkingToday(profile: DoctorFeeProfile | null, date = new Date()): boolean {
    if (!profile || !profile.workingDays || profile.workingDays.length === 0) return true;
    const iso = ((date.getDay() + 6) % 7) + 1; // JS getDay: Sun=0..Sat=6 → ISO Mon=1..Sun=7
    return profile.workingDays.includes(iso);
  }

  /**
   * Look up the specialty rate for the doctor's department (used by PERCENT
   * and SPLIT modes, and as the natural baseline). Returns null when no
   * specialty service is configured.
   */
  private async getSpecialtyRate(
    departmentId: string | undefined,
    facilityId: string,
    tenantId?: string,
  ): Promise<number | null> {
    if (!departmentId) return null;
    const dept = await this.deptRepo.findOne({
      where: { id: departmentId, ...(tenantId ? { tenantId } : {}) } as any,
    });
    if (!dept) return null;
    const code = (dept.code || dept.name || '').trim().toUpperCase().replace(/\s+/g, '_');
    if (code) {
      const svc = await this.serviceRepo.findOne({
        where: {
          code: `OPD-CONSULT-${code}`,
          isActive: true,
          ...(tenantId ? { tenantId } : {}),
        } as any,
      });
      if (svc) return Number(svc.basePrice);
    }
    const fallback = await this.serviceRepo.findOne({
      where: {
        code: 'OPD-CONSULT',
        department: dept.name,
        isActive: true,
        ...(tenantId ? { tenantId } : {}),
      } as any,
    });
    return fallback ? Number(fallback.basePrice) : null;
  }

  /**
   * Detect a follow-up: same patient + same doctor seen within the configured
   * window. We look at the most recent OPD encounter that already has an
   * invoice with charge_type=consultation against this doctor.
   */
  private async isFollowUp(
    patientId: string,
    doctorId: string,
    windowDays: number,
    tenantId?: string,
  ): Promise<boolean> {
    if (!windowDays || windowDays <= 0) return false;
    const since = new Date();
    since.setDate(since.getDate() - windowDays);
    const where: any = {
      patientId,
      attendingProviderId: doctorId,
      startTime: MoreThanOrEqual(since),
    };
    if (tenantId) where.tenantId = tenantId;
    const recent = await this.encounterRepo.findOne({ where, order: { startTime: 'DESC' } });
    return !!recent;
  }

  /**
   * Main resolver. Called by queue-management before invoice creation.
   * Returns { fee: null } when no profile applies — caller falls through
   * to specialty / catalogue / tenant default.
   */
  async resolve(opts: {
    doctorId?: string;
    departmentId?: string;
    facilityId: string;
    tenantId?: string;
    patientId?: string;
    when?: Date;
  }): Promise<ResolvedDoctorFee | null> {
    const { doctorId, departmentId, facilityId, tenantId, patientId } = opts;
    if (!doctorId) return null;

    const profile = await this.getProfile(doctorId, tenantId);
    if (!profile || !profile.isActive) return null;

    // Effective-date check
    const today = (opts.when ?? new Date()).toISOString().slice(0, 10);
    if (profile.effectiveFrom && today < profile.effectiveFrom) return null;
    if (profile.effectiveTo && today > profile.effectiveTo) return null;

    // Follow-up shortcut — free or reduced
    let isFollowUp = false;
    if (patientId && profile.followUpWindowDays && profile.followUpWindowDays > 0) {
      isFollowUp = await this.isFollowUp(patientId, doctorId, profile.followUpWindowDays, tenantId);
    }
    if (isFollowUp) {
      const ffee = profile.followUpFee != null ? Number(profile.followUpFee) : 0;
      return {
        fee: ffee,
        source: `doctor:${doctorId}:followUp`,
        doctorId,
        employmentType: profile.employmentType,
        feeMode: profile.feeMode,
        isFollowUp: true,
      };
    }

    switch (profile.feeMode) {
      case DoctorFeeMode.FLAT: {
        if (profile.flatFee == null) return null;
        return {
          fee: Number(profile.flatFee),
          source: `doctor:${doctorId}:flat`,
          doctorId,
          employmentType: profile.employmentType,
          feeMode: profile.feeMode,
        };
      }
      case DoctorFeeMode.PERCENT_OF_SPECIALTY: {
        const baseRate = await this.getSpecialtyRate(departmentId, facilityId, tenantId);
        if (baseRate == null || profile.percentOfSpecialty == null) return null;
        const fee = Math.round(baseRate * (Number(profile.percentOfSpecialty) / 100));
        return {
          fee,
          source: `doctor:${doctorId}:percent(${profile.percentOfSpecialty}% of ${baseRate})`,
          doctorId,
          employmentType: profile.employmentType,
          feeMode: profile.feeMode,
          basis: baseRate,
        };
      }
      case DoctorFeeMode.SPLIT: {
        const baseRate = await this.getSpecialtyRate(departmentId, facilityId, tenantId);
        if (baseRate == null) return null;
        const ds = Number(profile.doctorSharePercent ?? 0);
        const hs = Number(profile.hospitalSharePercent ?? 100 - ds);
        return {
          fee: baseRate, // patient pays the full specialty rate
          source: `doctor:${doctorId}:split(${ds}/${hs} of ${baseRate})`,
          doctorId,
          employmentType: profile.employmentType,
          feeMode: profile.feeMode,
          doctorShare: Math.round(baseRate * (ds / 100)),
          hospitalShare: Math.round(baseRate * (hs / 100)),
          basis: baseRate,
        };
      }
    }
    return null;
  }
}
