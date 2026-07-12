import { Injectable, Logger, NotFoundException, BadRequestException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { NotificationsService } from '../notifications/notifications.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In, DataSource } from 'typeorm';
import {
  AntenatalRegistration,
  PregnancyStatus,
  RiskLevel,
} from '../../database/entities/antenatal-registration.entity';
import { AntenatalVisit } from '../../database/entities/antenatal-visit.entity';
import {
  LabourRecord,
  LabourStatus,
  DeliveryMode,
} from '../../database/entities/labour-record.entity';
import { DeliveryOutcome, BabyStatus } from '../../database/entities/delivery-outcome.entity';
import {
  PostnatalVisit,
  PNCVisitNumber,
  MentalHealthRisk,
} from '../../database/entities/postnatal-visit.entity';
import {
  BabyWellnessCheck,
  BabyWellnessStatus,
} from '../../database/entities/baby-wellness-check.entity';
import {
  ImmunizationSchedule,
  ImmunizationStatus,
  UGANDA_EPI_SCHEDULE,
  VaccineName,
} from '../../database/entities/immunization-schedule.entity';
import {
  RegisterAntenatalDto,
  RecordAntenatalVisitDto,
  AdmitLabourDto,
  UpdateLabourProgressDto,
  RecordDeliveryDto,
  RecordBabyOutcomeDto,
  RecordPostnatalVisitDto,
  RecordBabyWellnessDto,
  AdministerVaccineDto,
} from './dto/maternity.dto';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class MaternityService {
  constructor(
    @InjectRepository(AntenatalRegistration)
    private ancRepo: Repository<AntenatalRegistration>,
    @InjectRepository(AntenatalVisit)
    private visitRepo: Repository<AntenatalVisit>,
    @InjectRepository(LabourRecord)
    private labourRepo: Repository<LabourRecord>,
    @InjectRepository(DeliveryOutcome)
    private outcomeRepo: Repository<DeliveryOutcome>,
    @InjectRepository(PostnatalVisit)
    private pncRepo: Repository<PostnatalVisit>,
    @InjectRepository(BabyWellnessCheck)
    private babyWellnessRepo: Repository<BabyWellnessCheck>,
    @InjectRepository(ImmunizationSchedule)
    private immunizationRepo: Repository<ImmunizationSchedule>,
    private readonly auditLogService: AuditLogService,
    private readonly dataSource: DataSource,
    @Optional()
    private readonly notificationsService: NotificationsService | null,
  ) {}

  private readonly cronLogger = new Logger(MaternityService.name);

  /**
   * Daily EPI defaulter SMS reminders. Cross-tenant (system context, like
   * the other maintenance crons); respects patient SMS opt-out; each dose
   * is reminded at most once every 7 days via last_defaulter_reminder_at.
   */
  @Cron('0 9 * * *', { name: 'epi-defaulter-sms' })
  async sendEpiDefaulterReminders(): Promise<void> {
    if (!this.notificationsService) return;
    try {
      const rows: Array<{
        id: string;
        vaccine_name: string;
        dose_number: number;
        due_date: string;
        facility_id: string;
        tenant_id: string;
        phone: string | null;
        sms_opt_out: boolean;
        full_name: string;
      }> = await this.immunizationRepo.query(
        `SELECT s.id, s.vaccine_name, s.dose_number, s.due_date, s.facility_id, s.tenant_id,
                p.phone, p.sms_opt_out, p.full_name
           FROM immunization_schedules s
           JOIN delivery_outcomes d ON d.id = s.delivery_outcome_id
           JOIN labour_records lr ON lr.id = d.labour_record_id
           JOIN antenatal_registrations reg ON reg.id = lr.registration_id
           JOIN patients p ON p.id = reg.patient_id
          WHERE s.status IN ('scheduled', 'due', 'overdue')
            AND s.grace_period_end < CURRENT_DATE
            AND (s.last_defaulter_reminder_at IS NULL
                 OR s.last_defaulter_reminder_at < NOW() - INTERVAL '7 days')
            AND p.phone IS NOT NULL
            AND p.deleted_at IS NULL
          ORDER BY s.grace_period_end ASC
          LIMIT 200`,
      );
      if (rows.length === 0) return;

      let sent = 0;
      for (const row of rows) {
        const message =
          `Reminder: your baby's ${row.vaccine_name} (dose ${row.dose_number}) vaccination ` +
          `was due on ${String(row.due_date).slice(0, 10)}. Please visit the clinic as soon as possible.`;
        const ok = await this.notificationsService.sendSmsToPatient({
          patient: { phone: row.phone || undefined, smsOptOut: row.sms_opt_out, fullName: row.full_name },
          facilityId: row.facility_id,
          message,
          tenantId: row.tenant_id,
        });
        // Stamp even on skip/failure? Only on success — failed sends retry tomorrow
        if (ok) {
          await this.immunizationRepo.update({ id: row.id }, { lastDefaulterReminderAt: new Date() });
          sent++;
        }
      }
      this.cronLogger.log(`EPI defaulter reminders: ${sent}/${rows.length} SMS sent`);
    } catch (err: any) {
      this.cronLogger.error(`EPI defaulter reminder cron failed: ${err.message}`);
    }
  }

  // ============ ANC REGISTRATION ============

  /**
   * MAX+1 per TENANT under an advisory lock. The old version counted per
   * FACILITY but the number carries no facility component — two facilities
   * in one tenant produced the same ANC number.
   */
  private async generateAncNumber(
    tid: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `ANC${year}-`;

    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `anc_number:${tid}:${year}`,
    ]);

    const last = await manager
      .createQueryBuilder(AntenatalRegistration, 'r')
      .where('r.anc_number LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('r.tenant_id = :tid', { tid })
      .orderBy('r.anc_number', 'DESC')
      .getOne();

    const seq = last ? (parseInt(last.ancNumber.slice(prefix.length), 10) || 0) + 1 : 1;
    return `${prefix}${String(seq).padStart(5, '0')}`;
  }

  private calculateEdd(lmpDate: Date): Date {
    const edd = new Date(lmpDate);
    edd.setDate(edd.getDate() + 280); // 40 weeks
    return edd;
  }

  private calculateGestationalAge(lmpDate: Date): number {
    const today = new Date();
    const diffTime = today.getTime() - lmpDate.getTime();
    const diffWeeks = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 7));
    return diffWeeks;
  }

  async registerAntenatal(
    dto: RegisterAntenatalDto,
    userId: string,
    tenantId?: string,
  ): Promise<AntenatalRegistration> {
    const tid = requireTenantId(tenantId);
    const lmpDate = new Date(dto.lmpDate);
    const edd = this.calculateEdd(lmpDate);
    const gestationalAge = this.calculateGestationalAge(lmpDate);

    const saved = await this.dataSource.transaction(async (manager) => {
      // Serialize per patient so two concurrent registrations can't both pass
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `anc_reg:${tid}:${dto.patientId}`,
      ]);

      const activePregnancy = await manager.findOne(AntenatalRegistration, {
        where: { patientId: dto.patientId, status: PregnancyStatus.ACTIVE, tenantId: tid },
      });
      if (activePregnancy) {
        throw new BadRequestException(
          `Patient already has an active pregnancy (${activePregnancy.ancNumber}). Close it before registering a new one.`,
        );
      }

      const ancNumber = await this.generateAncNumber(tid, manager);

      const registration = manager.create(AntenatalRegistration, {
      ancNumber,
      patientId: dto.patientId,
      facilityId: dto.facilityId,
      lmpDate,
      edd,
      gestationalAgeAtBooking: gestationalAge,
      gravida: dto.gravida,
      para: dto.para,
      livingChildren: dto.livingChildren || 0,
      abortions: dto.abortions || 0,
      bloodGroup: dto.bloodGroup,
      rhPositive: dto.rhPositive,
      medicalHistory: dto.medicalHistory,
      allergies: dto.allergies,
      riskLevel: dto.riskLevel || RiskLevel.LOW,
      riskFactors: dto.riskFactors,
      partnerName: dto.partnerName,
      partnerPhone: dto.partnerPhone,
      registeredById: userId,
      registrationDate: new Date(),
      status: PregnancyStatus.ACTIVE,
      });
      registration.tenantId = tid;

      return manager.save(registration);
    });

    this.auditLogService
      .log({
        action: 'REGISTER_ANTENATAL',
        entityType: 'MaternityCase',
        entityId: saved.id,
        userId: userId,
        tenantId: tenantId,
        newValue: { status: saved.status },
      })
      .catch(() => {});

    return saved;
  }

  async getRegistrations(
    facilityId: string,
    options: { status?: PregnancyStatus; limit?: number; offset?: number },
    tenantId?: string,
  ) {
    const where: any = { facilityId };
    if (options.status) where.status = options.status;
    where.tenantId = requireTenantId(tenantId);

    const [data, total] = await this.ancRepo.findAndCount({
      where,
      relations: ['patient'],
      order: { createdAt: 'DESC' },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    // Calculate current gestational age for each
    const enriched = data.map((r) => ({
      ...r,
      currentGestationalAge: this.calculateGestationalAge(r.lmpDate),
    }));

    return {
      data: enriched,
      meta: { total, limit: options.limit || 50, offset: options.offset || 0 },
    };
  }

  async getRegistrationById(
    id: string,
    tenantId?: string,
  ): Promise<AntenatalRegistration & { currentGestationalAge: number }> {
    const where: any = { id };
    where.tenantId = requireTenantId(tenantId);

    const reg = await this.ancRepo.findOne({
      where,
      relations: ['patient', 'facility', 'registeredBy'],
    });
    if (!reg) throw new NotFoundException('ANC registration not found');
    return {
      ...reg,
      currentGestationalAge: this.calculateGestationalAge(reg.lmpDate),
    };
  }

  async getDueSoon(
    facilityId: string,
    weeksAhead: number = 4,
    tenantId?: string,
  ): Promise<AntenatalRegistration[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + weeksAhead * 7);

    const where: any = {
      facilityId,
      status: PregnancyStatus.ACTIVE,
      edd: Between(today, futureDate),
    };
    where.tenantId = requireTenantId(tenantId);

    return this.ancRepo.find({
      where,
      relations: ['patient'],
      order: { edd: 'ASC' },
    });
  }

  // ============ ANTENATAL VISITS ============

  async recordVisit(
    dto: RecordAntenatalVisitDto,
    userId: string,
    tenantId?: string,
  ): Promise<AntenatalVisit> {
    const tid = requireTenantId(tenantId);
    const savedVisit = await this.dataSource.transaction(async (manager) => {
      // Serialize per registration so concurrent visits get distinct numbers
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `anc_visit:${tid}:${dto.registrationId}`,
      ]);

      const registration = await manager.findOne(AntenatalRegistration, {
        where: { id: dto.registrationId, tenantId: tid },
      });
      if (!registration) throw new NotFoundException('ANC registration not found');

      // Get visit number
      const visitCount = await manager.count(AntenatalVisit, {
        where: { registrationId: dto.registrationId, tenantId: tid },
      });

      const visit = manager.create(AntenatalVisit, {
      registrationId: dto.registrationId,
      visitNumber: visitCount + 1,
      visitDate: new Date(dto.visitDate),
      gestationalAge: dto.gestationalAge,
      weight: dto.weight,
      bpSystolic: dto.bpSystolic,
      bpDiastolic: dto.bpDiastolic,
      temperature: dto.temperature,
      pulseRate: dto.pulseRate,
      fundalHeight: dto.fundalHeight,
      fetalPresentation: dto.fetalPresentation,
      fetalHeartRate: dto.fetalHeartRate,
      fetalMovement: dto.fetalMovement,
      edema: dto.edema,
      urineProtein: dto.urineProtein,
      urineGlucose: dto.urineGlucose,
      hemoglobin: dto.hemoglobin,
      ironFolateGiven: dto.ironFolateGiven || false,
      tetanusToxoidGiven: dto.tetanusToxoidGiven || false,
      ttDoseNumber: dto.ttDoseNumber,
      iptGiven: dto.iptGiven || false,
      iptDoseNumber: dto.iptDoseNumber,
      complaints: dto.complaints,
      findings: dto.findings,
      diagnosis: dto.diagnosis,
      plan: dto.plan,
      nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
      seenById: userId,
      });
      visit.tenantId = tid;

      return manager.save(visit);
    });

    this.auditLogService
      .log({
        action: 'RECORD_ANC_VISIT',
        entityType: 'MaternityVisit',
        entityId: savedVisit.id,
        userId: userId,
        tenantId: tenantId,
        newValue: { visitNumber: savedVisit.visitNumber },
      })
      .catch(() => {});

    return savedVisit;
  }

  async getVisits(registrationId: string, tenantId?: string): Promise<AntenatalVisit[]> {
    const where: any = { registrationId };
    where.tenantId = requireTenantId(tenantId);

    return this.visitRepo.find({
      where,
      order: { visitNumber: 'ASC' },
      relations: ['seenBy'],
    });
  }

  // ============ LABOUR & DELIVERY ============

  /**
   * MAX+1 per TENANT under an advisory lock (old version counted per facility
   * with no facility component in the number — same-tenant collision).
   */
  private async generateLabourNumber(
    tid: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
      today.getDate(),
    ).padStart(2, '0')}`;
    const prefix = `LBR${dateStr}-`;

    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `labour_number:${tid}:${dateStr}`,
    ]);

    const last = await manager
      .createQueryBuilder(LabourRecord, 'l')
      .where('l.labour_number LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('l.tenant_id = :tid', { tid })
      .orderBy('l.labour_number', 'DESC')
      .getOne();

    const seq = last ? (parseInt(last.labourNumber.slice(prefix.length), 10) || 0) + 1 : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async admitLabour(dto: AdmitLabourDto, userId: string, tenantId?: string): Promise<LabourRecord> {
    const tid = requireTenantId(tenantId);
    const savedLabour = await this.dataSource.transaction(async (manager) => {
      // Serialize per registration so two concurrent admits can't both pass
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `labour_admit:${tid}:${dto.registrationId}`,
      ]);

      const registration = await manager.findOne(AntenatalRegistration, {
        where: { id: dto.registrationId, tenantId: tid },
      });
      if (!registration) throw new NotFoundException('ANC registration not found');
      if (registration.status !== PregnancyStatus.ACTIVE) {
        throw new BadRequestException(
          `Cannot admit labour: pregnancy status is '${registration.status}'`,
        );
      }

      const existingLabour = await manager.findOne(LabourRecord, {
        where: {
          registrationId: dto.registrationId,
          status: In([
            LabourStatus.ADMITTED,
            LabourStatus.FIRST_STAGE,
            LabourStatus.SECOND_STAGE,
            LabourStatus.THIRD_STAGE,
          ]),
          tenantId: tid,
        },
      });
      if (existingLabour) {
        throw new BadRequestException(
          `An active labour record already exists (${existingLabour.labourNumber})`,
        );
      }

      const labourNumber = await this.generateLabourNumber(tid, manager);

      const labour = manager.create(LabourRecord, {
        labourNumber,
        registrationId: dto.registrationId,
        facilityId: dto.facilityId,
        gestationalAgeAtDelivery: dto.gestationalAgeAtDelivery,
        admissionTime: new Date(),
        admissionNotes: dto.admissionNotes,
        bpSystolic: dto.bpSystolic,
        bpDiastolic: dto.bpDiastolic,
        cervicalDilation: dto.cervicalDilation,
        status: LabourStatus.ADMITTED,
      });
      labour.tenantId = tid;

      return manager.save(labour);
    });

    this.auditLogService
      .log({
        action: 'ADMIT_LABOUR',
        entityType: 'MaternityCase',
        entityId: savedLabour.id,
        userId: userId,
        tenantId: tenantId,
        newValue: { status: savedLabour.status },
      })
      .catch(() => {});

    return savedLabour;
  }

  async getLabourById(id: string, tenantId?: string): Promise<LabourRecord> {
    const where: any = { id };
    where.tenantId = requireTenantId(tenantId);

    const labour = await this.labourRepo.findOne({
      where,
      relations: ['registration', 'registration.patient', 'facility', 'deliveredBy'],
    });
    if (!labour) throw new NotFoundException('Labour record not found');
    return labour;
  }

  async updateLabourProgress(
    id: string,
    dto: UpdateLabourProgressDto,
    tenantId?: string,
  ): Promise<LabourRecord> {
    return this.dataSource.transaction(async (manager) => {
      const labourRepoTx = manager.getRepository(LabourRecord);

      const labour = await labourRepoTx.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!labour) throw new NotFoundException('Labour record not found');
      if (
        labour.status === LabourStatus.DELIVERED ||
        labour.status === LabourStatus.POSTPARTUM ||
        labour.status === LabourStatus.DISCHARGED
      ) {
        throw new BadRequestException(
          `Cannot update labour progress: labour is already '${labour.status}'`,
        );
      }

      if (dto.cervicalDilation !== undefined) labour.cervicalDilation = dto.cervicalDilation;
      if (dto.station !== undefined) labour.station = dto.station;
      if (dto.membranesIntact !== undefined) {
        labour.membranesIntact = dto.membranesIntact;
        if (!dto.membranesIntact && !labour.membraneRuptureTime) {
          labour.membraneRuptureTime = new Date();
        }
      }
      if (dto.liquorColor) labour.liquorColor = dto.liquorColor;

      // Update stage based on dilation
      if (labour.cervicalDilation && labour.cervicalDilation < 10) {
        labour.status = LabourStatus.FIRST_STAGE;
      } else if (labour.cervicalDilation === 10) {
        labour.status = LabourStatus.SECOND_STAGE;
      }

      return labourRepoTx.save(labour);
    });
  }

  async recordDelivery(
    id: string,
    dto: RecordDeliveryDto,
    userId: string,
    tenantId?: string,
  ): Promise<LabourRecord> {
    return this.dataSource.transaction(async (manager) => {
      const labourRepoTx = manager.getRepository(LabourRecord);
      const ancRepoTx = manager.getRepository(AntenatalRegistration);

      // Lock WITHOUT relations (FOR UPDATE cannot be applied to the nullable
      // side of the outer joins the relations would add)
      const labour = await labourRepoTx.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!labour) throw new NotFoundException('Labour record not found');
      if (labour.status === LabourStatus.DELIVERED) {
        throw new BadRequestException('Delivery has already been recorded for this labour');
      }

      labour.deliveryTime = new Date();
      labour.deliveryMode = dto.deliveryMode;
      if (dto.deliveryNotes) labour.deliveryNotes = dto.deliveryNotes;
      if (dto.placentaComplete !== undefined) labour.placentaComplete = dto.placentaComplete;
      labour.placentaDeliveryTime = new Date();
      if (dto.bloodLossMl !== undefined) labour.bloodLossMl = dto.bloodLossMl;
      if (dto.perineumStatus) labour.perineumStatus = dto.perineumStatus;
      if (dto.episiotomyDone !== undefined) labour.episiotomyDone = dto.episiotomyDone;
      if (dto.complications) labour.complications = dto.complications;
      labour.deliveredById = userId;
      labour.status = LabourStatus.DELIVERED;

      // Update ANC registration status (atomic with labour save)
      await ancRepoTx.update(
        { id: labour.registrationId, tenantId: requireTenantId(tenantId) },
        { status: PregnancyStatus.DELIVERED },
      );

      const savedDelivery = await labourRepoTx.save(labour);

      this.auditLogService
        .log({
          action: 'RECORD_DELIVERY',
          entityType: 'MaternityCase',
          entityId: savedDelivery.id,
          userId: userId,
          tenantId: tenantId,
          newValue: { status: savedDelivery.status },
        })
        .catch(() => {});

      return savedDelivery;
    });
  }

  async recordBabyOutcome(
    dto: RecordBabyOutcomeDto,
    userId: string,
    tenantId?: string,
  ): Promise<DeliveryOutcome> {
    const labour = await this.labourRepo.findOne({
      where: { id: dto.labourRecordId, tenantId: requireTenantId(tenantId) },
    });
    if (!labour) throw new NotFoundException('Labour record not found');

    const babyNumber = dto.babyNumber || 1;
    const duplicate = await this.outcomeRepo.findOne({
      where: {
        labourRecordId: dto.labourRecordId,
        babyNumber,
        tenantId: requireTenantId(tenantId),
      },
    });
    if (duplicate) {
      throw new BadRequestException(
        `An outcome for baby #${babyNumber} is already recorded on this labour`,
      );
    }

    const outcome = this.outcomeRepo.create({
      labourRecordId: dto.labourRecordId,
      babyNumber,
      timeOfBirth: labour.deliveryTime || new Date(),
      outcome: dto.outcome,
      sex: dto.sex,
      birthWeight: dto.birthWeight,
      birthLength: dto.birthLength,
      headCircumference: dto.headCircumference,
      apgar1min: dto.apgar1min,
      apgar5min: dto.apgar5min,
      resuscitationNeeded: dto.resuscitationNeeded || false,
      skinToSkin: dto.skinToSkin || false,
      breastfeedingInitiated: dto.breastfeedingInitiated || false,
      vitaminKGiven: dto.vitaminKGiven || false,
      bcgGiven: dto.bcgGiven || false,
      abnormalities: dto.abnormalities,
      notes: dto.notes,
      babyStatus:
        dto.outcome === 'stillbirth' || dto.outcome === 'neonatal_death'
          ? BabyStatus.DECEASED
          : BabyStatus.ALIVE,
    });
    outcome.tenantId = requireTenantId(tenantId);

    const savedOutcome = await this.outcomeRepo.save(outcome);

    this.auditLogService
      .log({
        action: 'RECORD_BABY_OUTCOME',
        entityType: 'BabyOutcome',
        entityId: savedOutcome.id,
        userId: userId,
        tenantId: tenantId,
        newValue: { status: savedOutcome.babyStatus },
      })
      .catch(() => {});

    return savedOutcome;
  }

  async getBabyOutcomes(labourRecordId: string, tenantId?: string): Promise<DeliveryOutcome[]> {
    const where: any = { labourRecordId };
    where.tenantId = requireTenantId(tenantId);

    return this.outcomeRepo.find({
      where,
      order: { babyNumber: 'ASC' },
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string, tenantId?: string) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const activeRegWhere: any = { facilityId, status: PregnancyStatus.ACTIVE };
    activeRegWhere.tenantId = requireTenantId(tenantId);

    const dueSoonWhere: any = {
      facilityId,
      status: PregnancyStatus.ACTIVE,
      edd: Between(today, thirtyDaysAhead),
    };
    dueSoonWhere.tenantId = requireTenantId(tenantId);

    // All pre-delivery stages count as active — filtering only ADMITTED made
    // patients vanish from the board once progress was first recorded
    const activeLabourWhere: any = {
      facilityId,
      status: In([
        LabourStatus.ADMITTED,
        LabourStatus.FIRST_STAGE,
        LabourStatus.SECOND_STAGE,
        LabourStatus.THIRD_STAGE,
      ]),
    };
    activeLabourWhere.tenantId = requireTenantId(tenantId);

    const deliveredWhere: any = {
      facilityId,
      status: LabourStatus.DELIVERED,
      deliveryTime: MoreThanOrEqual(startOfMonth),
    };
    deliveredWhere.tenantId = requireTenantId(tenantId);

    const highRiskWhere: any = {
      facilityId,
      status: PregnancyStatus.ACTIVE,
      riskLevel: RiskLevel.HIGH,
    };
    highRiskWhere.tenantId = requireTenantId(tenantId);

    const [activeRegistrations, dueSoon, activeLabours, deliveriesThisMonth, highRiskCount] =
      await Promise.all([
        this.ancRepo.count({ where: activeRegWhere }),
        this.ancRepo.count({ where: dueSoonWhere }),
        this.labourRepo.find({
          where: activeLabourWhere,
          relations: ['registration', 'registration.patient'],
        }),
        this.labourRepo.count({
          where: deliveredWhere,
        }),
        this.ancRepo.count({ where: highRiskWhere }),
      ]);

    return {
      activeRegistrations,
      dueSoonCount: dueSoon,
      activeLaboursCount: activeLabours.length,
      activeLabours,
      deliveriesThisMonth,
      highRiskCount,
    };
  }

  async getActiveLabours(facilityId: string, tenantId?: string): Promise<LabourRecord[]> {
    const where: any = {
      facilityId,
      status: In([
        LabourStatus.ADMITTED,
        LabourStatus.FIRST_STAGE,
        LabourStatus.SECOND_STAGE,
        LabourStatus.THIRD_STAGE,
      ]),
    };
    where.tenantId = requireTenantId(tenantId);

    return this.labourRepo.find({
      where,
      relations: ['registration', 'registration.patient'],
      order: { admissionTime: 'ASC' },
    });
  }

  // ============ POSTNATAL CARE (PNC) ============

  async recordPostnatalVisit(
    dto: RecordPostnatalVisitDto,
    userId: string,
    tenantId?: string,
  ): Promise<PostnatalVisit> {
    const regWhere: any = { id: dto.registrationId };
    regWhere.tenantId = requireTenantId(tenantId);

    const registration = await this.ancRepo.findOne({
      where: regWhere,
      relations: ['patient'],
    });
    if (!registration) throw new NotFoundException('ANC registration not found');

    // Calculate days postpartum
    const deliveryOutcome = await this.outcomeRepo.findOne({
      where: { id: dto.deliveryOutcomeId, tenantId: requireTenantId(tenantId) },
      relations: ['labourRecord'],
    });
    if (!deliveryOutcome) throw new NotFoundException('Delivery outcome not found');

    const existingVisit = await this.pncRepo.findOne({
      where: {
        deliveryOutcomeId: dto.deliveryOutcomeId,
        visitNumber: dto.visitNumber,
        tenantId: requireTenantId(tenantId),
      },
    });
    if (existingVisit) {
      throw new BadRequestException(
        `PNC visit #${dto.visitNumber} is already recorded for this delivery`,
      );
    }

    const deliveryDate = deliveryOutcome.timeOfBirth;
    const visitDate = new Date(dto.visitDate);
    const daysPostpartum = Math.floor(
      (visitDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Determine mental health risk from EPDS score
    let mentalHealthRisk = MentalHealthRisk.NONE;
    if (dto.epdsScore !== undefined) {
      if (dto.epdsScore >= 13) mentalHealthRisk = MentalHealthRisk.HIGH;
      else if (dto.epdsScore >= 10) mentalHealthRisk = MentalHealthRisk.MODERATE;
      else if (dto.epdsScore >= 5) mentalHealthRisk = MentalHealthRisk.LOW;
    }

    const visit = this.pncRepo.create({
      facilityId: dto.facilityId,
      registrationId: dto.registrationId,
      deliveryOutcomeId: dto.deliveryOutcomeId,
      visitNumber: dto.visitNumber,
      visitDate,
      daysPostpartum,
      temperature: dto.temperature,
      bpSystolic: dto.bpSystolic,
      bpDiastolic: dto.bpDiastolic,
      pulseRate: dto.pulseRate,
      respiratoryRate: dto.respiratoryRate,
      uterusWellContracted: dto.uterusWellContracted,
      fundalHeightCm: dto.fundalHeightCm,
      lochiaType: dto.lochiaType,
      lochiaNormalAmount: dto.lochiaNormalAmount,
      lochiaFoulSmelling: dto.lochiaFoulSmelling,
      perineumIntact: dto.perineumIntact,
      woundHealingWell: dto.woundHealingWell,
      woundInfectionSigns: dto.woundInfectionSigns,
      woundNotes: dto.woundNotes,
      breastCondition: dto.breastCondition,
      breastfeedingEstablished: dto.breastfeedingEstablished,
      breastfeedingIssues: dto.breastfeedingIssues,
      breastfeedingNotes: dto.breastfeedingNotes,
      epdsScore: dto.epdsScore,
      mentalHealthRisk,
      mentalHealthReferral: dto.mentalHealthReferral,
      heavyBleeding: dto.heavyBleeding,
      fever: dto.fever,
      severeHeadache: dto.severeHeadache,
      blurredVision: dto.blurredVision,
      convulsions: dto.convulsions,
      breathingDifficulty: dto.breathingDifficulty,
      legSwelling: dto.legSwelling,
      ironFolateGiven: dto.ironFolateGiven,
      vitaminAGiven: dto.vitaminAGiven,
      familyPlanningCounseling: dto.familyPlanningCounseling,
      contraceptiveMethod: dto.contraceptiveMethod,
      complaints: dto.complaints,
      examination: dto.examination,
      diagnosis: dto.diagnosis,
      treatment: dto.treatment,
      notes: dto.notes,
      nextVisitDate: dto.nextVisitDate ? new Date(dto.nextVisitDate) : undefined,
      seenById: userId,
    });
    visit.tenantId = requireTenantId(tenantId);

    return this.pncRepo.save(visit);
  }

  async getPostnatalVisits(registrationId: string, tenantId?: string): Promise<PostnatalVisit[]> {
    const where: any = { registrationId };
    where.tenantId = requireTenantId(tenantId);

    return this.pncRepo.find({
      where,
      relations: ['seenBy', 'deliveryOutcome'],
      order: { visitNumber: 'ASC' },
    });
  }

  async getPostnatalVisitById(id: string, tenantId?: string): Promise<PostnatalVisit> {
    const where: any = { id };
    where.tenantId = requireTenantId(tenantId);

    const visit = await this.pncRepo.findOne({
      where,
      relations: ['seenBy', 'deliveryOutcome', 'registration', 'registration.patient'],
    });
    if (!visit) throw new NotFoundException('Postnatal visit not found');
    return visit;
  }

  async getPNCDueList(facilityId: string, tenantId?: string): Promise<any[]> {
    // Get all deliveries in last 6 weeks that need PNC follow-up
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

    const outcomeWhere: any = {
      labourRecord: { facilityId },
      timeOfBirth: MoreThanOrEqual(sixWeeksAgo),
    };
    outcomeWhere.tenantId = requireTenantId(tenantId);

    const recentDeliveries = await this.outcomeRepo.find({
      where: outcomeWhere,
      relations: ['labourRecord', 'labourRecord.registration', 'labourRecord.registration.patient'],
    });

    const duelist = [];
    for (const delivery of recentDeliveries) {
      const visits = await this.pncRepo.find({
        where: { deliveryOutcomeId: delivery.id, tenantId: requireTenantId(tenantId) },
      });
      const completedVisits = visits.map((v) => v.visitNumber);
      const daysPostpartum = Math.floor(
        (new Date().getTime() - delivery.timeOfBirth.getTime()) / (1000 * 60 * 60 * 24),
      );

      // Determine which visits are due
      const dueVisits = [];
      if (!completedVisits.includes(PNCVisitNumber.VISIT_1) && daysPostpartum >= 0)
        dueVisits.push(1);
      if (!completedVisits.includes(PNCVisitNumber.VISIT_2) && daysPostpartum >= 3)
        dueVisits.push(2);
      if (!completedVisits.includes(PNCVisitNumber.VISIT_3) && daysPostpartum >= 7)
        dueVisits.push(3);
      if (!completedVisits.includes(PNCVisitNumber.VISIT_4) && daysPostpartum >= 42)
        dueVisits.push(4);

      if (dueVisits.length > 0) {
        duelist.push({
          delivery,
          daysPostpartum,
          completedVisits,
          dueVisits,
          patient: delivery.labourRecord?.registration?.patient,
        });
      }
    }

    return duelist;
  }

  // ============ BABY WELLNESS CHECK ============

  async recordBabyWellness(
    dto: RecordBabyWellnessDto,
    userId: string,
    tenantId?: string,
  ): Promise<BabyWellnessCheck> {
    const delivery = await this.outcomeRepo.findOne({
      where: { id: dto.deliveryOutcomeId, tenantId: requireTenantId(tenantId) },
    });
    if (!delivery) throw new NotFoundException('Delivery outcome not found');

    const checkDate = new Date(dto.checkDate);
    const ageInDays = Math.floor(
      (checkDate.getTime() - delivery.timeOfBirth.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Determine status based on danger signs
    let status = BabyWellnessStatus.HEALTHY;
    if (dto.notFeeding || dto.convulsions || dto.noMovement) {
      status = BabyWellnessStatus.CRITICAL;
    } else if (
      dto.fastBreathing ||
      dto.severeChestIndrawing ||
      dto.hypothermia ||
      dto.hyperthermia
    ) {
      status = BabyWellnessStatus.NEEDS_ATTENTION;
    }

    const wellness = this.babyWellnessRepo.create({
      facilityId: dto.facilityId,
      deliveryOutcomeId: dto.deliveryOutcomeId,
      postnatalVisitId: dto.postnatalVisitId,
      checkDate,
      ageInDays,
      weight: dto.weight,
      temperature: dto.temperature,
      heartRate: dto.heartRate,
      respiratoryRate: dto.respiratoryRate,
      feedingType: dto.feedingType,
      feedingWell: dto.feedingWell,
      feedsPerDay: dto.feedsPerDay,
      feedingNotes: dto.feedingNotes,
      cordStatus: dto.cordStatus,
      cordSeparationDate: dto.cordSeparationDate ? new Date(dto.cordSeparationDate) : undefined,
      jaundiceLevel: dto.jaundiceLevel,
      phototherapyNeeded: dto.phototherapyNeeded,
      eyesNormal: dto.eyesNormal,
      eyeDischarge: dto.eyeDischarge,
      notFeeding: dto.notFeeding,
      convulsions: dto.convulsions,
      fastBreathing: dto.fastBreathing,
      severeChestIndrawing: dto.severeChestIndrawing,
      noMovement: dto.noMovement,
      hypothermia: dto.hypothermia,
      hyperthermia: dto.hyperthermia,
      weightForAge: dto.weightForAge,
      weightChangePercent: dto.weightChangePercent,
      status,
      findings: dto.findings,
      actions: dto.actions,
      referralReason: dto.referralReason,
      notes: dto.notes,
      checkedById: userId,
    });
    wellness.tenantId = requireTenantId(tenantId);

    return this.babyWellnessRepo.save(wellness);
  }

  async getBabyWellnessChecks(
    deliveryOutcomeId: string,
    tenantId?: string,
  ): Promise<BabyWellnessCheck[]> {
    const where: any = { deliveryOutcomeId };
    where.tenantId = requireTenantId(tenantId);

    return this.babyWellnessRepo.find({
      where,
      relations: ['checkedBy'],
      order: { checkDate: 'ASC' },
    });
  }

  // ============ IMMUNIZATION ============

  async generateImmunizationSchedule(
    deliveryOutcomeId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<ImmunizationSchedule[]> {
    const delivery = await this.outcomeRepo.findOne({
      where: { id: deliveryOutcomeId, tenantId: requireTenantId(tenantId) },
    });
    if (!delivery) throw new NotFoundException('Delivery outcome not found');

    // Idempotent: calling twice must not duplicate the EPI schedule
    const existing = await this.immunizationRepo.find({
      where: { deliveryOutcomeId, tenantId: requireTenantId(tenantId) },
      order: { ageInWeeksDue: 'ASC', vaccineName: 'ASC' },
    });
    if (existing.length > 0) return existing;

    const birthDate = delivery.timeOfBirth;
    const schedules: ImmunizationSchedule[] = [];

    for (const vaccine of UGANDA_EPI_SCHEDULE) {
      const scheduledDate = new Date(birthDate);
      scheduledDate.setDate(scheduledDate.getDate() + vaccine.ageWeeks * 7);

      const dueDate = new Date(scheduledDate);
      const gracePeriodEnd = new Date(scheduledDate);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 14); // 2-week grace period

      const schedule = this.immunizationRepo.create({
        facilityId,
        deliveryOutcomeId,
        vaccineName: vaccine.vaccine,
        doseNumber: vaccine.doseNumber,
        ageInWeeksDue: vaccine.ageWeeks,
        scheduledDate,
        dueDate,
        gracePeriodEnd,
        status: ImmunizationStatus.SCHEDULED,
      });
      schedule.tenantId = requireTenantId(tenantId);

      schedules.push(schedule);
    }

    return this.immunizationRepo.save(schedules);
  }

  async getImmunizationSchedule(
    deliveryOutcomeId: string,
    tenantId?: string,
  ): Promise<ImmunizationSchedule[]> {
    const where: any = { deliveryOutcomeId };
    where.tenantId = requireTenantId(tenantId);

    const schedules = await this.immunizationRepo.find({
      where,
      relations: ['administeredBy'],
      order: { ageInWeeksDue: 'ASC', vaccineName: 'ASC' },
    });

    // Update status based on current date
    const today = new Date();
    for (const schedule of schedules) {
      if (schedule.status === ImmunizationStatus.SCHEDULED) {
        if (today >= schedule.dueDate && today <= schedule.gracePeriodEnd) {
          schedule.status = ImmunizationStatus.DUE;
        } else if (today > schedule.gracePeriodEnd) {
          schedule.status = ImmunizationStatus.OVERDUE;
        }
      }
    }

    return schedules;
  }

  async administerVaccine(
    id: string,
    dto: AdministerVaccineDto,
    userId: string,
    tenantId?: string,
  ): Promise<ImmunizationSchedule> {
    return this.dataSource.transaction(async (manager) => {
      const immunizationRepoTx = manager.getRepository(ImmunizationSchedule);

      const schedule = await immunizationRepoTx.findOne({
        where: { id, tenantId: requireTenantId(tenantId) },
        lock: { mode: 'pessimistic_write' },
      });
      if (!schedule) throw new NotFoundException('Immunization schedule not found');

      if (schedule.status === ImmunizationStatus.ADMINISTERED) {
        throw new BadRequestException('Vaccine already administered');
      }

      schedule.status = ImmunizationStatus.ADMINISTERED;
      schedule.administeredAt = new Date();
      schedule.administeredById = userId;
      if (dto.batchNumber) schedule.batchNumber = dto.batchNumber;
      if (dto.expiryDate) schedule.expiryDate = new Date(dto.expiryDate);
      if (dto.manufacturer) schedule.manufacturer = dto.manufacturer;
      if (dto.siteOfAdministration) schedule.siteOfAdministration = dto.siteOfAdministration;
      if (dto.route) schedule.route = dto.route;
      schedule.adverseReaction = dto.adverseReaction || false;
      if (dto.adverseReaction) {
        if (dto.reactionSeverity) schedule.reactionSeverity = dto.reactionSeverity;
        if (dto.reactionDescription) schedule.reactionDescription = dto.reactionDescription;
        if (dto.reactionTreatment) schedule.reactionTreatment = dto.reactionTreatment;
      }
      if (dto.notes) schedule.notes = dto.notes;

      const saved = await immunizationRepoTx.save(schedule);

      this.auditLogService
        .log({
          action: 'VACCINE_ADMINISTERED',
          entityType: 'Immunization',
          entityId: saved.id,
          userId: userId,
          tenantId: tenantId,
          newValue: { vaccine: saved.vaccineName, doseNumber: saved.doseNumber },
        })
        .catch(() => {});

      return saved;
    });
  }

  async getImmunizationsDue(
    facilityId: string,
    tenantId?: string,
  ): Promise<ImmunizationSchedule[]> {
    const today = new Date();

    const where: any = {
      facilityId,
      status: In([
        ImmunizationStatus.DUE,
        ImmunizationStatus.OVERDUE,
        ImmunizationStatus.SCHEDULED,
      ]),
      dueDate: LessThanOrEqual(today),
    };
    where.tenantId = requireTenantId(tenantId);

    return this.immunizationRepo.find({
      where,
      relations: [
        'deliveryOutcome',
        'deliveryOutcome.labourRecord',
        'deliveryOutcome.labourRecord.registration',
        'deliveryOutcome.labourRecord.registration.patient',
      ],
      order: { dueDate: 'ASC' },
    });
  }

  async getImmunizationDefaulters(
    facilityId: string,
    daysOverdue: number = 14,
    tenantId?: string,
  ): Promise<ImmunizationSchedule[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const where: any = {
      facilityId,
      status: In([ImmunizationStatus.SCHEDULED, ImmunizationStatus.DUE]),
      gracePeriodEnd: LessThanOrEqual(cutoffDate),
    };
    where.tenantId = requireTenantId(tenantId);

    return this.immunizationRepo.find({
      where,
      relations: [
        'deliveryOutcome',
        'deliveryOutcome.labourRecord',
        'deliveryOutcome.labourRecord.registration',
        'deliveryOutcome.labourRecord.registration.patient',
      ],
      order: { gracePeriodEnd: 'ASC' },
    });
  }
}
