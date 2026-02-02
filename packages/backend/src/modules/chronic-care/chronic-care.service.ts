import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In, Like, ILike } from 'typeorm';
import { PatientChronicCondition, ChronicStatus } from '../../database/entities/patient-chronic-condition.entity';
import { Patient } from '../../database/entities/patient.entity';
import { Diagnosis } from '../../database/entities/diagnosis.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ReminderType, ReminderChannel } from '../../database/entities/patient-reminder.entity';
import { 
  RegisterChronicConditionDto, 
  UpdateChronicConditionDto, 
  ChronicPatientsQueryDto,
  SendBulkReminderDto 
} from './dto/chronic-care.dto';

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
    private notificationsService: NotificationsService,
  ) {}

  // Register patient with chronic condition
  async registerCondition(facilityId: string, dto: RegisterChronicConditionDto, userId?: string): Promise<PatientChronicCondition> {
    const condition = this.chronicRepo.create({
      facilityId,
      ...dto,
      registeredById: userId,
    });

    return this.chronicRepo.save(condition);
  }

  // Update chronic condition
  async updateCondition(id: string, dto: UpdateChronicConditionDto): Promise<PatientChronicCondition> {
    const condition = await this.chronicRepo.findOne({ where: { id } });
    if (!condition) throw new Error('Chronic condition not found');

    Object.assign(condition, dto);
    return this.chronicRepo.save(condition);
  }

  // Get all chronic patients with contacts
  async getChronicPatients(facilityId: string, query: ChronicPatientsQueryDto) {
    const qb = this.chronicRepo.createQueryBuilder('cc')
      .leftJoinAndSelect('cc.patient', 'patient')
      .leftJoinAndSelect('cc.diagnosis', 'diagnosis')
      .where('cc.facilityId = :facilityId', { facilityId })
      .andWhere('cc.deletedAt IS NULL');

    if (query.diagnosisId) {
      qb.andWhere('cc.diagnosisId = :diagnosisId', { diagnosisId: query.diagnosisId });
    }

    if (query.status) {
      qb.andWhere('cc.status = :status', { status: query.status });
    }

    if (query.search) {
      qb.andWhere('(patient.fullName ILIKE :search OR patient.mrn ILIKE :search OR patient.phone ILIKE :search)',
        { search: `%${query.search}%` });
    }

    if (query.overdueFollowUp) {
      qb.andWhere('cc.nextFollowUp <= :today', { today: new Date() });
    }

    qb.orderBy('cc.nextFollowUp', 'ASC', 'NULLS LAST');

    const page = query.page || 1;
    const limit = query.limit || 50;
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data: data.map(cc => ({
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
  async getDashboardStats(facilityId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalPatients,
      activePatients,
      overdueFollowUps,
      upcomingFollowUps,
      conditionBreakdown,
    ] = await Promise.all([
      this.chronicRepo.count({ where: { facilityId } }),
      this.chronicRepo.count({ where: { facilityId, status: In([ChronicStatus.ACTIVE, ChronicStatus.CONTROLLED, ChronicStatus.UNCONTROLLED]) } }),
      this.chronicRepo.count({ where: { facilityId, nextFollowUp: LessThanOrEqual(today) } }),
      this.chronicRepo.createQueryBuilder('cc')
        .where('cc.facilityId = :facilityId', { facilityId })
        .andWhere('cc.nextFollowUp > :today', { today })
        .andWhere('cc.nextFollowUp <= :nextWeek', { nextWeek: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) })
        .getCount(),
      this.chronicRepo.createQueryBuilder('cc')
        .leftJoin('cc.diagnosis', 'd')
        .select('d.name', 'condition')
        .addSelect('COUNT(*)', 'count')
        .where('cc.facilityId = :facilityId', { facilityId })
        .groupBy('d.name')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany(),
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
  async getChronicConditionsList(): Promise<Diagnosis[]> {
    return this.diagnosisRepo.find({
      where: { isChronic: true, isActive: true },
      order: { name: 'ASC' },
    });
  }

  // Get patient's chronic conditions
  async getPatientConditions(patientId: string): Promise<PatientChronicCondition[]> {
    return this.chronicRepo.find({
      where: { patientId },
      relations: ['diagnosis'],
      order: { diagnosedDate: 'DESC' },
    });
  }

  // Send reminder to single patient
  async sendReminder(facilityId: string, conditionId: string, userId?: string) {
    const condition = await this.chronicRepo.findOne({
      where: { id: conditionId },
      relations: ['patient', 'diagnosis'],
    });

    if (!condition) throw new Error('Condition not found');

    const message = `Dear ${condition.patient.fullName}, this is a reminder for your ${condition.diagnosis.name} follow-up appointment. Please contact us to schedule your next visit.`;

    return this.notificationsService.sendImmediateReminder(facilityId, {
      patientId: condition.patientId,
      type: ReminderType.CHRONIC_CHECKUP,
      channel: ReminderChannel.BOTH,
      subject: `Follow-up Reminder: ${condition.diagnosis.name}`,
      message,
      referenceType: 'chronic_condition',
      referenceId: condition.id,
    }, userId);
  }

  // Send bulk reminders
  async sendBulkReminders(facilityId: string, dto: SendBulkReminderDto, userId?: string) {
    const results = [];

    for (const patientId of dto.patientIds) {
      try {
        const result = await this.notificationsService.sendImmediateReminder(facilityId, {
          patientId,
          type: ReminderType.CHRONIC_CHECKUP,
          channel: (dto.channel as ReminderChannel) || ReminderChannel.BOTH,
          subject: dto.subject,
          message: dto.message,
        }, userId);
        results.push({ patientId, success: true, reminderId: result.id });
      } catch (error) {
        results.push({ patientId, success: false, error: error.message });
      }
    }

    return {
      sent: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      details: results,
    };
  }

  // Record a visit (updates lastVisit and schedules next follow-up)
  async recordVisit(id: string, nextFollowUpDate?: Date): Promise<PatientChronicCondition> {
    const condition = await this.chronicRepo.findOne({ where: { id } });
    if (!condition) throw new Error('Condition not found');

    condition.lastVisit = new Date();
    
    if (nextFollowUpDate) {
      condition.nextFollowUp = nextFollowUpDate;
    } else if (condition.followUpIntervalDays) {
      const next = new Date();
      next.setDate(next.getDate() + condition.followUpIntervalDays);
      condition.nextFollowUp = next;
    }

    return this.chronicRepo.save(condition);
  }

  // Get patients with overdue follow-ups
  async getOverduePatients(facilityId: string, limit = 100) {
    return this.chronicRepo.find({
      where: {
        facilityId,
        nextFollowUp: LessThanOrEqual(new Date()),
        status: In([ChronicStatus.ACTIVE, ChronicStatus.CONTROLLED, ChronicStatus.UNCONTROLLED]),
      },
      relations: ['patient', 'diagnosis'],
      order: { nextFollowUp: 'ASC' },
      take: limit,
    });
  }

  // Auto-schedule reminders for upcoming follow-ups (called by cron)
  async scheduleUpcomingReminders(facilityId: string): Promise<number> {
    const conditions = await this.chronicRepo.createQueryBuilder('cc')
      .leftJoinAndSelect('cc.patient', 'patient')
      .leftJoinAndSelect('cc.diagnosis', 'diagnosis')
      .where('cc.facilityId = :facilityId', { facilityId })
      .andWhere('cc.reminderEnabled = true')
      .andWhere('cc.nextFollowUp IS NOT NULL')
      .andWhere('cc.nextFollowUp > :now', { now: new Date() })
      .getMany();

    let scheduled = 0;

    for (const condition of conditions) {
      const reminderDate = new Date(condition.nextFollowUp!);
      reminderDate.setDate(reminderDate.getDate() - condition.reminderDaysBefore);

      if (reminderDate > new Date()) {
        await this.notificationsService.scheduleReminder(facilityId, {
          patientId: condition.patientId,
          type: ReminderType.CHRONIC_CHECKUP,
          channel: ReminderChannel.BOTH,
          subject: `Upcoming Follow-up: ${condition.diagnosis.name}`,
          message: `Dear ${condition.patient.fullName}, you have an upcoming follow-up for ${condition.diagnosis.name} on ${condition.nextFollowUp?.toLocaleDateString()}. Please ensure to attend.`,
          scheduledFor: reminderDate,
          referenceType: 'chronic_condition',
          referenceId: condition.id,
        });
        scheduled++;
      }
    }

    return scheduled;
  }
}
