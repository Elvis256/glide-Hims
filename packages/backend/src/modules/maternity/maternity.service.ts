import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, In } from 'typeorm';
import { AntenatalRegistration, PregnancyStatus, RiskLevel } from '../../database/entities/antenatal-registration.entity';
import { AntenatalVisit } from '../../database/entities/antenatal-visit.entity';
import { LabourRecord, LabourStatus, DeliveryMode } from '../../database/entities/labour-record.entity';
import { DeliveryOutcome, BabyStatus } from '../../database/entities/delivery-outcome.entity';
import { PostnatalVisit, PNCVisitNumber, MentalHealthRisk } from '../../database/entities/postnatal-visit.entity';
import { BabyWellnessCheck, BabyWellnessStatus } from '../../database/entities/baby-wellness-check.entity';
import { ImmunizationSchedule, ImmunizationStatus, UGANDA_EPI_SCHEDULE, VaccineName } from '../../database/entities/immunization-schedule.entity';
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
  ) {}

  // ============ ANC REGISTRATION ============

  private async generateAncNumber(facilityId: string, tenantId?: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ancRepo.count({
      where: {
        facilityId,
        createdAt: MoreThanOrEqual(new Date(`${year}-01-01`)),
        ...(tenantId ? { tenantId } : {}),
      },
    });
    return `ANC${year}-${String(count + 1).padStart(5, '0')}`;
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

  async registerAntenatal(dto: RegisterAntenatalDto, userId: string, tenantId?: string): Promise<AntenatalRegistration> {
    const lmpDate = new Date(dto.lmpDate);
    const edd = this.calculateEdd(lmpDate);
    const gestationalAge = this.calculateGestationalAge(lmpDate);

    const ancNumber = await this.generateAncNumber(dto.facilityId, tenantId);

    const registration = this.ancRepo.create({
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
    if (tenantId) (registration as any).tenantId = tenantId;

    return this.ancRepo.save(registration);
  }

  async getRegistrations(facilityId: string, options: { status?: PregnancyStatus; limit?: number; offset?: number }, tenantId?: string) {
    const where: any = { facilityId };
    if (options.status) where.status = options.status;
    if (tenantId) where.tenantId = tenantId;

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

    return { data: enriched, meta: { total, limit: options.limit || 50, offset: options.offset || 0 } };
  }

  async getRegistrationById(id: string, tenantId?: string): Promise<AntenatalRegistration & { currentGestationalAge: number }> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

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

  async getDueSoon(facilityId: string, weeksAhead: number = 4, tenantId?: string): Promise<AntenatalRegistration[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + weeksAhead * 7);

    const where: any = {
      facilityId,
      status: PregnancyStatus.ACTIVE,
      edd: Between(today, futureDate),
    };
    if (tenantId) where.tenantId = tenantId;

    return this.ancRepo.find({
      where,
      relations: ['patient'],
      order: { edd: 'ASC' },
    });
  }

  // ============ ANTENATAL VISITS ============

  async recordVisit(dto: RecordAntenatalVisitDto, userId: string, tenantId?: string): Promise<AntenatalVisit> {
    const regWhere: any = { id: dto.registrationId };
    if (tenantId) regWhere.tenantId = tenantId;

    const registration = await this.ancRepo.findOne({ where: regWhere });
    if (!registration) throw new NotFoundException('ANC registration not found');

    // Get visit number
    const visitCount = await this.visitRepo.count({ where: { registrationId: dto.registrationId, ...(tenantId ? { tenantId } : {}) } });

    const visit = this.visitRepo.create({
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
    if (tenantId) (visit as any).tenantId = tenantId;

    return this.visitRepo.save(visit);
  }

  async getVisits(registrationId: string, tenantId?: string): Promise<AntenatalVisit[]> {
    const where: any = { registrationId };
    if (tenantId) where.tenantId = tenantId;

    return this.visitRepo.find({
      where,
      order: { visitNumber: 'ASC' },
      relations: ['seenBy'],
    });
  }

  // ============ LABOUR & DELIVERY ============

  private async generateLabourNumber(facilityId: string, tenantId?: string): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const count = await this.labourRepo.count({
      where: {
        facilityId,
        createdAt: Between(startOfDay, endOfDay),
        ...(tenantId ? { tenantId } : {}),
      },
    });

    return `LBR${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async admitLabour(dto: AdmitLabourDto, userId: string, tenantId?: string): Promise<LabourRecord> {
    const registration = await this.ancRepo.findOne({ where: { id: dto.registrationId, ...(tenantId ? { tenantId } : {}) } });
    if (!registration) throw new NotFoundException('ANC registration not found');

    const labourNumber = await this.generateLabourNumber(dto.facilityId, tenantId);

    const labour = this.labourRepo.create({
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
    if (tenantId) (labour as any).tenantId = tenantId;

    return this.labourRepo.save(labour);
  }

  async getLabourById(id: string, tenantId?: string): Promise<LabourRecord> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const labour = await this.labourRepo.findOne({
      where,
      relations: ['registration', 'registration.patient', 'facility', 'deliveredBy'],
    });
    if (!labour) throw new NotFoundException('Labour record not found');
    return labour;
  }

  async updateLabourProgress(id: string, dto: UpdateLabourProgressDto, tenantId?: string): Promise<LabourRecord> {
    const labour = await this.getLabourById(id, tenantId);

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

    return this.labourRepo.save(labour);
  }

  async recordDelivery(id: string, dto: RecordDeliveryDto, userId: string, tenantId?: string): Promise<LabourRecord> {
    const labour = await this.getLabourById(id, tenantId);

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

    // Update ANC registration status
    await this.ancRepo.update(labour.registrationId, { status: PregnancyStatus.DELIVERED });

    return this.labourRepo.save(labour);
  }

  async recordBabyOutcome(dto: RecordBabyOutcomeDto, tenantId?: string): Promise<DeliveryOutcome> {
    const labour = await this.labourRepo.findOne({ where: { id: dto.labourRecordId, ...(tenantId ? { tenantId } : {}) } });
    if (!labour) throw new NotFoundException('Labour record not found');

    const outcome = this.outcomeRepo.create({
      labourRecordId: dto.labourRecordId,
      babyNumber: dto.babyNumber || 1,
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
      babyStatus: BabyStatus.ALIVE,
    });
    if (tenantId) (outcome as any).tenantId = tenantId;

    return this.outcomeRepo.save(outcome);
  }

  async getBabyOutcomes(labourRecordId: string, tenantId?: string): Promise<DeliveryOutcome[]> {
    const where: any = { labourRecordId };
    if (tenantId) where.tenantId = tenantId;

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
    if (tenantId) activeRegWhere.tenantId = tenantId;

    const dueSoonWhere: any = {
      facilityId,
      status: PregnancyStatus.ACTIVE,
      edd: Between(today, thirtyDaysAhead),
    };
    if (tenantId) dueSoonWhere.tenantId = tenantId;

    const activeLabourWhere: any = {
      facilityId,
      status: LabourStatus.ADMITTED,
    };
    if (tenantId) activeLabourWhere.tenantId = tenantId;

    const deliveredWhere: any = {
      facilityId,
      status: LabourStatus.DELIVERED,
      deliveryTime: MoreThanOrEqual(startOfMonth),
    };
    if (tenantId) deliveredWhere.tenantId = tenantId;

    const highRiskWhere: any = {
      facilityId,
      status: PregnancyStatus.ACTIVE,
      riskLevel: RiskLevel.HIGH,
    };
    if (tenantId) highRiskWhere.tenantId = tenantId;

    const [
      activeRegistrations,
      dueSoon,
      activeLabours,
      deliveriesThisMonth,
      highRiskCount,
    ] = await Promise.all([
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
      status: LabourStatus.ADMITTED,
    };
    if (tenantId) where.tenantId = tenantId;

    return this.labourRepo.find({
      where,
      relations: ['registration', 'registration.patient'],
      order: { admissionTime: 'ASC' },
    });
  }

  // ============ POSTNATAL CARE (PNC) ============

  async recordPostnatalVisit(dto: RecordPostnatalVisitDto, userId: string, tenantId?: string): Promise<PostnatalVisit> {
    const regWhere: any = { id: dto.registrationId };
    if (tenantId) regWhere.tenantId = tenantId;

    const registration = await this.ancRepo.findOne({
      where: regWhere,
      relations: ['patient'],
    });
    if (!registration) throw new NotFoundException('ANC registration not found');

    // Calculate days postpartum
    const deliveryOutcome = await this.outcomeRepo.findOne({
      where: { id: dto.deliveryOutcomeId, ...(tenantId ? { tenantId } : {}) },
      relations: ['labourRecord'],
    });
    if (!deliveryOutcome) throw new NotFoundException('Delivery outcome not found');

    const deliveryDate = deliveryOutcome.timeOfBirth;
    const visitDate = new Date(dto.visitDate);
    const daysPostpartum = Math.floor((visitDate.getTime() - deliveryDate.getTime()) / (1000 * 60 * 60 * 24));

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
    if (tenantId) (visit as any).tenantId = tenantId;

    return this.pncRepo.save(visit);
  }

  async getPostnatalVisits(registrationId: string, tenantId?: string): Promise<PostnatalVisit[]> {
    const where: any = { registrationId };
    if (tenantId) where.tenantId = tenantId;

    return this.pncRepo.find({
      where,
      relations: ['seenBy', 'deliveryOutcome'],
      order: { visitNumber: 'ASC' },
    });
  }

  async getPostnatalVisitById(id: string, tenantId?: string): Promise<PostnatalVisit> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

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
    if (tenantId) outcomeWhere.tenantId = tenantId;

    const recentDeliveries = await this.outcomeRepo.find({
      where: outcomeWhere,
      relations: ['labourRecord', 'labourRecord.registration', 'labourRecord.registration.patient'],
    });

    const duelist = [];
    for (const delivery of recentDeliveries) {
      const visits = await this.pncRepo.find({
        where: { deliveryOutcomeId: delivery.id, ...(tenantId ? { tenantId } : {}) },
      });
      const completedVisits = visits.map(v => v.visitNumber);
      const daysPostpartum = Math.floor((new Date().getTime() - delivery.timeOfBirth.getTime()) / (1000 * 60 * 60 * 24));

      // Determine which visits are due
      const dueVisits = [];
      if (!completedVisits.includes(PNCVisitNumber.VISIT_1) && daysPostpartum >= 0) dueVisits.push(1);
      if (!completedVisits.includes(PNCVisitNumber.VISIT_2) && daysPostpartum >= 3) dueVisits.push(2);
      if (!completedVisits.includes(PNCVisitNumber.VISIT_3) && daysPostpartum >= 7) dueVisits.push(3);
      if (!completedVisits.includes(PNCVisitNumber.VISIT_4) && daysPostpartum >= 42) dueVisits.push(4);

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

  async recordBabyWellness(dto: RecordBabyWellnessDto, userId: string, tenantId?: string): Promise<BabyWellnessCheck> {
    const delivery = await this.outcomeRepo.findOne({
      where: { id: dto.deliveryOutcomeId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!delivery) throw new NotFoundException('Delivery outcome not found');

    const checkDate = new Date(dto.checkDate);
    const ageInDays = Math.floor((checkDate.getTime() - delivery.timeOfBirth.getTime()) / (1000 * 60 * 60 * 24));

    // Determine status based on danger signs
    let status = BabyWellnessStatus.HEALTHY;
    if (dto.notFeeding || dto.convulsions || dto.noMovement) {
      status = BabyWellnessStatus.CRITICAL;
    } else if (dto.fastBreathing || dto.severeChestIndrawing || dto.hypothermia || dto.hyperthermia) {
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
    if (tenantId) (wellness as any).tenantId = tenantId;

    return this.babyWellnessRepo.save(wellness);
  }

  async getBabyWellnessChecks(deliveryOutcomeId: string, tenantId?: string): Promise<BabyWellnessCheck[]> {
    const where: any = { deliveryOutcomeId };
    if (tenantId) where.tenantId = tenantId;

    return this.babyWellnessRepo.find({
      where,
      relations: ['checkedBy'],
      order: { checkDate: 'ASC' },
    });
  }

  // ============ IMMUNIZATION ============

  async generateImmunizationSchedule(deliveryOutcomeId: string, facilityId: string, tenantId?: string): Promise<ImmunizationSchedule[]> {
    const delivery = await this.outcomeRepo.findOne({
      where: { id: deliveryOutcomeId, ...(tenantId ? { tenantId } : {}) },
    });
    if (!delivery) throw new NotFoundException('Delivery outcome not found');

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
      if (tenantId) (schedule as any).tenantId = tenantId;

      schedules.push(schedule);
    }

    return this.immunizationRepo.save(schedules);
  }

  async getImmunizationSchedule(deliveryOutcomeId: string, tenantId?: string): Promise<ImmunizationSchedule[]> {
    const where: any = { deliveryOutcomeId };
    if (tenantId) where.tenantId = tenantId;

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

  async administerVaccine(id: string, dto: AdministerVaccineDto, userId: string, tenantId?: string): Promise<ImmunizationSchedule> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;

    const schedule = await this.immunizationRepo.findOne({ where });
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

    return this.immunizationRepo.save(schedule);
  }

  async getImmunizationsDue(facilityId: string, tenantId?: string): Promise<ImmunizationSchedule[]> {
    const today = new Date();

    const where: any = {
      facilityId,
      status: In([ImmunizationStatus.DUE, ImmunizationStatus.OVERDUE, ImmunizationStatus.SCHEDULED]),
      dueDate: LessThanOrEqual(today),
    };
    if (tenantId) where.tenantId = tenantId;

    return this.immunizationRepo.find({
      where,
      relations: ['deliveryOutcome', 'deliveryOutcome.labourRecord', 'deliveryOutcome.labourRecord.registration', 'deliveryOutcome.labourRecord.registration.patient'],
      order: { dueDate: 'ASC' },
    });
  }

  async getImmunizationDefaulters(facilityId: string, daysOverdue: number = 14, tenantId?: string): Promise<ImmunizationSchedule[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    const where: any = {
      facilityId,
      status: In([ImmunizationStatus.SCHEDULED, ImmunizationStatus.DUE]),
      gracePeriodEnd: LessThanOrEqual(cutoffDate),
    };
    if (tenantId) where.tenantId = tenantId;

    return this.immunizationRepo.find({
      where,
      relations: ['deliveryOutcome', 'deliveryOutcome.labourRecord', 'deliveryOutcome.labourRecord.registration', 'deliveryOutcome.labourRecord.registration.patient'],
      order: { gracePeriodEnd: 'ASC' },
    });
  }
}
