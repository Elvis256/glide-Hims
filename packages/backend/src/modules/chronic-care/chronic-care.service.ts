import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In, Like, ILike } from 'typeorm';
import {
  PatientChronicCondition,
  ChronicStatus,
} from '../../database/entities/patient-chronic-condition.entity';
import { Patient } from '../../database/entities/patient.entity';
import { hashPii } from '../../common/crypto/pii-crypto';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  ReminderType,
  ReminderChannel,
  ReminderStatus,
  PatientReminder,
} from '../../database/entities/patient-reminder.entity';
import {
  RegisterChronicConditionDto,
  UpdateChronicConditionDto,
  ChronicPatientsQueryDto,
  SendBulkReminderDto,
} from './dto/chronic-care.dto';
import { localCalendarDate, localDateString } from '../../common/utils/timezone.util';

@Injectable()
export class ChronicCareService {
  private readonly logger = new Logger(ChronicCareService.name);

  constructor(
    @InjectRepository(PatientChronicCondition)
    private chronicRepo: Repository<PatientChronicCondition>,
    @InjectRepository(Patient)
    private patientRepo: Repository<Patient>,
    @InjectRepository(Diagnosis)
    private diagnosisRepo: Repository<Diagnosis>,
    @InjectRepository(PatientReminder)
    private reminderRepo: Repository<PatientReminder>,
    private notificationsService: NotificationsService,
  ) {}

  // --- Tenant-isolation helpers ---------------------------------------------
  private requireTenant(tenantId?: string): string {
    if (!tenantId) {
      throw new ForbiddenException('Tenant context required');
    }
    return tenantId;
  }

  private requireFacilityId(facilityId?: string): string {
    if (!facilityId) {
      throw new BadRequestException('facilityId is required');
    }
    return facilityId;
  }

  private async requirePatient(patientId: string, tenantId: string): Promise<Patient> {
    const patient = await this.patientRepo.findOne({ where: { id: patientId, tenantId } });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  private async requireChronicDiagnosis(diagnosisId: string, tenantId: string): Promise<Diagnosis> {
    const diagnosis = await this.diagnosisRepo.findOne({
      where: { id: diagnosisId, tenantId },
    });
    if (!diagnosis) throw new NotFoundException('Diagnosis not found');
    if (!diagnosis.isChronic) {
      throw new BadRequestException('Diagnosis is not a chronic condition');
    }
    return diagnosis;
  }

  private async requireCondition(
    conditionId: string,
    tenantId: string,
    relations: string[] = [],
  ): Promise<PatientChronicCondition> {
    const condition = await this.chronicRepo.findOne({
      where: { id: conditionId, tenantId },
      relations,
    });
    if (!condition) throw new NotFoundException('Chronic condition not found');
    return condition;
  }

  // Register patient with chronic condition
  async registerCondition(
    facilityId: string,
    dto: RegisterChronicConditionDto,
    userId?: string,
    tenantId?: string,
  ): Promise<PatientChronicCondition> {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);
    await this.requirePatient(dto.patientId, tid);
    await this.requireChronicDiagnosis(dto.diagnosisId, tid);

    // Registration is the moment a patient enters the recall system, and it is
    // when they walk out with a follow-up date in mind. Without this the row
    // was saved with next_follow_up NULL, so the patient appeared on the
    // register and in no recall list at all — not overdue, not upcoming, never
    // reminded. recordVisit already derived the date this way; registration
    // did not.
    const nextFollowUp =
      dto.nextFollowUp ??
      (dto.followUpIntervalDays
        ? (() => {
            const d = localCalendarDate();
            d.setUTCDate(d.getUTCDate() + dto.followUpIntervalDays!);
            return d;
          })()
        : undefined);

    const condition = this.chronicRepo.create({
      facilityId: fid,
      ...dto,
      nextFollowUp,
      registeredById: userId,
      tenantId: tid,
    });

    return this.chronicRepo.save(condition);
  }

  // Update chronic condition
  async updateCondition(
    id: string,
    dto: UpdateChronicConditionDto,
    tenantId?: string,
  ): Promise<PatientChronicCondition> {
    const tid = this.requireTenant(tenantId);
    const condition = await this.requireCondition(id, tid);

    Object.assign(condition, dto);
    return this.chronicRepo.save(condition);
  }

  // Get all chronic patients with contacts
  async getChronicPatients(facilityId: string, query: ChronicPatientsQueryDto, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);
    const qb = this.chronicRepo
      .createQueryBuilder('cc')
      .leftJoinAndSelect('cc.patient', 'patient')
      .leftJoinAndSelect('cc.diagnosis', 'diagnosis')
      .where('cc.facilityId = :facilityId', { facilityId: fid })
      .andWhere('cc.deletedAt IS NULL')
      .andWhere('cc.tenant_id = :tenantId', { tenantId: tid });

    if (query.diagnosisId) {
      qb.andWhere('cc.diagnosisId = :diagnosisId', { diagnosisId: query.diagnosisId });
    }

    if (query.status) {
      qb.andWhere('cc.status = :status', { status: query.status });
    }

    if (query.search) {
      // Phone is encrypted; match by deterministic blind index instead of ILIKE.
      qb.andWhere(
        '(patient.fullName ILIKE :search OR patient.mrn ILIKE :search OR patient.phoneHash = :searchPhoneHash)',
        { search: `%${query.search}%`, searchPhoneHash: hashPii(query.search, 'phone') },
      );
    }

    if (query.overdueFollowUp) {
      qb.andWhere('cc.nextFollowUp <= :today', { today: localCalendarDate() });
    }

    qb.orderBy('cc.nextFollowUp', 'ASC', 'NULLS LAST');

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map((cc) => ({
        id: cc.id,
        patientId: cc.patientId,
        patient: {
          id: cc.patient.id,
          mrn: cc.patient.mrn,
          fullName: cc.patient.fullName,
          phone: cc.patient.phone,
          email: cc.patient.email,
          dateOfBirth: cc.patient.dateOfBirth,
          gender: cc.patient.gender,
        },
        diagnosis: {
          id: cc.diagnosis.id,
          icd10Code: cc.diagnosis.icd10Code,
          name: cc.diagnosis.name,
        },
        status: cc.status,
        diagnosedDate: cc.diagnosedDate,
        nextFollowUp: cc.nextFollowUp,
        followUpIntervalDays: cc.followUpIntervalDays,
        reminderEnabled: cc.reminderEnabled,
        lastVisit: cc.lastVisit,
        currentMedications: cc.currentMedications,
        notes: cc.notes,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get dashboard stats
  async getDashboardStats(facilityId: string, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);
    // Kampala is UTC+3 and the server is UTC, so setHours(0,0,0,0) is 03:00
    // local — between midnight and 03:00 a patient due today was not counted.
    const today = localCalendarDate();

    const baseWhere = { facilityId: fid, tenantId: tid };

    const upcomingQb = this.chronicRepo
      .createQueryBuilder('cc')
      .where('cc.facilityId = :facilityId', { facilityId: fid })
      .andWhere('cc.tenant_id = :tenantId', { tenantId: tid })
      .andWhere('cc.nextFollowUp > :today', { today })
      .andWhere('cc.nextFollowUp <= :nextWeek', {
        nextWeek: (() => {
          const d = localCalendarDate();
          d.setUTCDate(d.getUTCDate() + 7);
          return d;
        })(),
      });

    const breakdownQb = this.chronicRepo
      .createQueryBuilder('cc')
      .leftJoin('cc.diagnosis', 'd')
      .select('d.name', 'condition')
      .addSelect('COUNT(*)', 'count')
      .where('cc.facilityId = :facilityId', { facilityId: fid })
      .andWhere('cc.tenant_id = :tenantId', { tenantId: tid })
      .groupBy('d.name')
      .orderBy('count', 'DESC')
      .limit(10);

    const [totalPatients, activePatients, overdueFollowUps, upcomingFollowUps, conditionBreakdown] =
      await Promise.all([
        this.chronicRepo.count({ where: { ...baseWhere } }),
        this.chronicRepo.count({
          where: {
            ...baseWhere,
            status: In([
              ChronicStatus.ACTIVE,
              ChronicStatus.CONTROLLED,
              ChronicStatus.UNCONTROLLED,
            ]),
          },
        }),
        this.chronicRepo.count({ where: { ...baseWhere, nextFollowUp: LessThanOrEqual(today) } }),
        upcomingQb.getCount(),
        breakdownQb.getRawMany(),
      ]);

    return {
      totalPatients,
      activePatients,
      overdueFollowUps,
      upcomingFollowUps,
      conditionBreakdown,
    };
  }

  // Get list of chronic conditions (diagnoses marked as chronic)
  async getChronicConditionsList(tenantId?: string): Promise<Diagnosis[]> {
    const tid = this.requireTenant(tenantId);
    return this.diagnosisRepo.find({
      where: { isChronic: true, isActive: true, tenantId: tid },
      order: { name: 'ASC' },
    });
  }

  // Get patient's chronic conditions
  async getPatientConditions(
    patientId: string,
    tenantId?: string,
  ): Promise<PatientChronicCondition[]> {
    const tid = this.requireTenant(tenantId);
    await this.requirePatient(patientId, tid);
    return this.chronicRepo.find({
      where: { patientId, tenantId: tid },
      relations: ['diagnosis'],
      order: { diagnosedDate: 'DESC' },
    });
  }

  // Send reminder to single patient
  async sendReminder(facilityId: string, conditionId: string, userId?: string, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);
    const condition = await this.requireCondition(conditionId, tid, ['patient', 'diagnosis']);
    if (condition.facilityId !== fid) {
      throw new NotFoundException('Chronic condition not found');
    }

    const message = `Dear ${condition.patient.fullName}, this is a reminder for your ${condition.diagnosis.name} follow-up appointment. Please contact us to schedule your next visit.`;

    return this.notificationsService.sendImmediateReminder(
      fid,
      {
        patientId: condition.patientId,
        type: ReminderType.CHRONIC_CHECKUP,
        channel: ReminderChannel.BOTH,
        subject: `Follow-up Reminder: ${condition.diagnosis.name}`,
        message,
        referenceType: 'chronic_condition',
        referenceId: condition.id,
      },
      userId,
      // tenantId was dropped, so requireTenantId threw and the reminder was
      // never sent — the patient simply never heard from the clinic.
      tid,
    );
  }

  // Send bulk reminders
  async sendBulkReminders(
    facilityId: string,
    dto: SendBulkReminderDto,
    userId?: string,
    tenantId?: string,
  ) {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);

    // Validate all patientIds belong to tenant in one query to prevent cross-tenant blasting
    const patients = await this.patientRepo.find({
      where: { id: In(dto.patientIds), tenantId: tid },
      select: ['id'],
    });
    const validIds = new Set(patients.map((p) => p.id));
    const unknown = dto.patientIds.filter((id) => !validIds.has(id));
    if (unknown.length > 0) {
      throw new NotFoundException(
        `Patient(s) not found in tenant: ${unknown.slice(0, 3).join(', ')}${unknown.length > 3 ? ` (+${unknown.length - 3} more)` : ''}`,
      );
    }

    const results = [];

    for (const patientId of dto.patientIds) {
      try {
        const result = await this.notificationsService.sendImmediateReminder(
          fid,
          {
            patientId,
            type: ReminderType.CHRONIC_CHECKUP,
            channel: (dto.channel as ReminderChannel) || ReminderChannel.BOTH,
            subject: dto.subject,
            message: dto.message,
          },
          userId,
          tid,
        );
        results.push({ patientId, success: true, reminderId: result.id });
      } catch (error) {
        results.push({ patientId, success: false, error: error.message });
      }
    }

    return {
      sent: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      details: results,
    };
  }

  // Record a visit (updates lastVisit and schedules next follow-up)
  async recordVisit(
    id: string,
    nextFollowUpDate?: Date,
    tenantId?: string,
  ): Promise<PatientChronicCondition> {
    const tid = this.requireTenant(tenantId);
    const condition = await this.requireCondition(id, tid);

    condition.lastVisit = new Date();

    if (nextFollowUpDate) {
      const parsed =
        nextFollowUpDate instanceof Date ? nextFollowUpDate : new Date(nextFollowUpDate as any);
      if (isNaN(parsed.getTime())) {
        throw new BadRequestException('Invalid nextFollowUpDate');
      }
      condition.nextFollowUp = parsed;
    } else if (condition.followUpIntervalDays) {
      // next_follow_up is a `date` column — count days from the hospital's
      // calendar day, not the server's UTC instant.
      const next = localCalendarDate();
      next.setUTCDate(next.getUTCDate() + condition.followUpIntervalDays);
      condition.nextFollowUp = next;
    }

    return this.chronicRepo.save(condition);
  }

  // Get patients with overdue follow-ups
  async getOverduePatients(facilityId: string, limit = 100, tenantId?: string) {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);
    const cappedLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
    return this.chronicRepo.find({
      where: {
        facilityId: fid,
        tenantId: tid,
        nextFollowUp: LessThanOrEqual(localCalendarDate()),
        status: In([ChronicStatus.ACTIVE, ChronicStatus.CONTROLLED, ChronicStatus.UNCONTROLLED]),
      },
      relations: ['patient', 'diagnosis'],
      order: { nextFollowUp: 'ASC' },
      take: cappedLimit,
    });
  }

  // Auto-schedule reminders for upcoming follow-ups (called by cron)
  async scheduleUpcomingReminders(facilityId: string, tenantId?: string): Promise<number> {
    const tid = this.requireTenant(tenantId);
    const fid = this.requireFacilityId(facilityId);
    const qb = this.chronicRepo
      .createQueryBuilder('cc')
      .leftJoinAndSelect('cc.patient', 'patient')
      .leftJoinAndSelect('cc.diagnosis', 'diagnosis')
      .where('cc.facilityId = :facilityId', { facilityId: fid })
      .andWhere('cc.tenant_id = :tenantId', { tenantId: tid })
      .andWhere('cc.reminderEnabled = true')
      .andWhere('cc.nextFollowUp IS NOT NULL')
      .andWhere('cc.nextFollowUp > :now', { now: localCalendarDate() });

    const conditions = await qb.getMany();

    // The sweep is re-runnable — a clinic clicks the button twice, or it is put
    // on a schedule — and scheduleReminder just inserts, so every run used to
    // add another SMS for the same patient and the same appointment. Skip the
    // conditions that already have one waiting to go out.
    const alreadyQueued = new Set(
      conditions.length
        ? (
            await this.reminderRepo.find({
              where: {
                tenantId: tid,
                referenceType: 'chronic_condition',
                referenceId: In(conditions.map((c) => c.id)),
                status: In([ReminderStatus.PENDING, ReminderStatus.PROCESSING]),
              },
              select: ['referenceId'],
            })
          ).map((r) => r.referenceId)
        : [],
    );

    const now = new Date();
    let scheduled = 0;
    let failed = 0;

    for (const condition of conditions) {
      // next_follow_up is a `date` column, so TypeORM hands it back as the
      // string '2026-08-31' — not a Date. Calling toLocaleDateString on it
      // threw, and one bad row aborted the whole sweep, so NO chronic patient
      // has ever been sent a follow-up reminder. An earlier fix here restored a
      // dropped tenantId and left this line one below it untouched.
      if (alreadyQueued.has(condition.id)) continue;

      const followUp = new Date(`${String(condition.nextFollowUp)}T00:00:00.000Z`);
      if (isNaN(followUp.getTime())) {
        this.logger.warn(
          `Chronic condition ${condition.id} has an unreadable next follow-up (${String(
            condition.nextFollowUp,
          )}) — skipped`,
        );
        failed++;
        continue;
      }

      const reminderDate = new Date(followUp);
      reminderDate.setDate(reminderDate.getDate() - condition.reminderDaysBefore);

      // A patient due in two days with a three-day reminder window used to get
      // nothing at all — the reminder date had already passed, so the branch
      // was skipped. That is the patient closest to their appointment. Send it
      // now instead; the follow-up itself is still ahead of us.
      const sendAt = reminderDate > now ? reminderDate : now;

      try {
        await this.notificationsService.scheduleReminder(
          fid,
          {
            patientId: condition.patientId,
            type: ReminderType.CHRONIC_CHECKUP,
            channel: ReminderChannel.BOTH,
            subject: `Upcoming Follow-up: ${condition.diagnosis.name}`,
            message:
              `Dear ${condition.patient.fullName}, you have an upcoming follow-up for ` +
              `${condition.diagnosis.name} on ${localDateString(followUp)}. ` +
              `Please ensure to attend.`,
            scheduledFor: sendAt,
            referenceType: 'chronic_condition',
            referenceId: condition.id,
          },
          undefined,
          tid,
        );
        scheduled++;
      } catch (err: any) {
        // One unreachable patient must not cost every other patient their
        // reminder, which is what an unguarded await in this loop did.
        this.logger.error(
          `Chronic reminder for condition ${condition.id} failed: ${err?.message ?? err}`,
        );
        failed++;
      }
    }

    if (failed > 0) {
      this.logger.warn(
        `Chronic reminder sweep for facility ${fid}: ${scheduled} scheduled, ${failed} failed`,
      );
    }

    return scheduled;
  }
}
