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

  private async generateAncNumber(facilityId: string): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.ancRepo.count({
      where: {
        facilityId,
        createdAt: MoreThanOrEqual(new Date(`${year}-01-01`)),
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

  async registerAntenatal(dto: RegisterAntenatalDto, userId: string): Promise<AntenatalRegistration> {
    const lmpDate = new Date(dto.lmpDate);
    const edd = this.calculateEdd(lmpDate);
    const gestationalAge = this.calculateGestationalAge(lmpDate);

    const ancNumber = await this.generateAncNumber(dto.facilityId);

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

    return this.ancRepo.save(registration);
  }

  async getRegistrations(facilityId: string, options: { status?: PregnancyStatus; limit?: number; offset?: number }) {
    const where: any = { facilityId };
    if (options.status) where.status = options.status;

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

  async getRegistrationById(id: string): Promise<AntenatalRegistration & { currentGestationalAge: number }> {
    const reg = await this.ancRepo.findOne({
      where: { id },
      relations: ['patient', 'facility', 'registeredBy'],
    });
    if (!reg) throw new NotFoundException('ANC registration not found');
    return {
      ...reg,
      currentGestationalAge: this.calculateGestationalAge(reg.lmpDate),
    };
  }

  async getDueSoon(facilityId: string, weeksAhead: number = 4): Promise<AntenatalRegistration[]> {
    const today = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + weeksAhead * 7);

    return this.ancRepo.find({
      where: {
        facilityId,
        status: PregnancyStatus.ACTIVE,
        edd: Between(today, futureDate),
      },
      relations: ['patient'],
      order: { edd: 'ASC' },
    });
  }

  // ============ ANTENATAL VISITS ============

  async recordVisit(dto: RecordAntenatalVisitDto, userId: string): Promise<AntenatalVisit> {
    const registration = await this.ancRepo.findOne({ where: { id: dto.registrationId } });
    if (!registration) throw new NotFoundException('ANC registration not found');

    // Get visit number
    const visitCount = await this.visitRepo.count({ where: { registrationId: dto.registrationId } });

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

    return this.visitRepo.save(visit);
  }

  async getVisits(registrationId: string): Promise<AntenatalVisit[]> {
    return this.visitRepo.find({
      where: { registrationId },
      order: { visitNumber: 'ASC' },
      relations: ['seenBy'],
    });
  }

  // ============ LABOUR & DELIVERY ============

  private async generateLabourNumber(facilityId: string): Promise<string> {
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
      },
    });

    return `LBR${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  async admitLabour(dto: AdmitLabourDto, userId: string): Promise<LabourRecord> {
    const registration = await this.ancRepo.findOne({ where: { id: dto.registrationId } });
    if (!registration) throw new NotFoundException('ANC registration not found');

    const labourNumber = await this.generateLabourNumber(dto.facilityId);

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

    return this.labourRepo.save(labour);
  }

  async getLabourById(id: string): Promise<LabourRecord> {
    const labour = await this.labourRepo.findOne({
      where: { id },
      relations: ['registration', 'registration.patient', 'facility', 'deliveredBy'],
    });
    if (!labour) throw new NotFoundException('Labour record not found');
    return labour;
  }

  async updateLabourProgress(id: string, dto: UpdateLabourProgressDto): Promise<LabourRecord> {
    const labour = await this.getLabourById(id);

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

  async recordDelivery(id: string, dto: RecordDeliveryDto, userId: string): Promise<LabourRecord> {
    const labour = await this.getLabourById(id);

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

  async recordBabyOutcome(dto: RecordBabyOutcomeDto): Promise<DeliveryOutcome> {
    const labour = await this.labourRepo.findOne({ where: { id: dto.labourRecordId } });
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

    return this.outcomeRepo.save(outcome);
  }

  async getBabyOutcomes(labourRecordId: string): Promise<DeliveryOutcome[]> {
    return this.outcomeRepo.find({
      where: { labourRecordId },
      order: { babyNumber: 'ASC' },
    });
  }

  // ============ DASHBOARD ============

  async getDashboard(facilityId: string) {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const [
      activeRegistrations,
      dueSoon,
      activeLabours,
      deliveriesThisMonth,
      highRiskCount,
    ] = await Promise.all([
      this.ancRepo.count({ where: { facilityId, status: PregnancyStatus.ACTIVE } }),
      this.ancRepo.count({
        where: {
          facilityId,
          status: PregnancyStatus.ACTIVE,
          edd: Between(today, thirtyDaysAhead),
        },
      }),
      this.labourRepo.find({
        where: {
          facilityId,
          status: LabourStatus.ADMITTED,
        },
        relations: ['registration', 'registration.patient'],
      }),
      this.labourRepo.count({
        where: {
          facilityId,
          status: LabourStatus.DELIVERED,
          deliveryTime: MoreThanOrEqual(startOfMonth),
        },
      }),
      this.ancRepo.count({
        where: {
          facilityId,
          status: PregnancyStatus.ACTIVE,
          riskLevel: RiskLevel.HIGH,
        },
      }),
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

  async getActiveLabours(facilityId: string): Promise<LabourRecord[]> {
    return this.labourRepo.find({
      where: {
        facilityId,
        status: LabourStatus.ADMITTED,
      },
      relations: ['registration', 'registration.patient'],
      order: { admissionTime: 'ASC' },
    });
  }

  // ============ POSTNATAL CARE (PNC) ============

  async recordPostnatalVisit(dto: RecordPostnatalVisitDto, userId: string): Promise<PostnatalVisit> {
    const registration = await this.ancRepo.findOne({
      where: { id: dto.registrationId },
      relations: ['patient'],
    });
    if (!registration) throw new NotFoundException('ANC registration not found');

    // Calculate days postpartum
    const deliveryOutcome = await this.outcomeRepo.findOne({
      where: { id: dto.deliveryOutcomeId },
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

    return this.pncRepo.save(visit);
  }

  async getPostnatalVisits(registrationId: string): Promise<PostnatalVisit[]> {
    return this.pncRepo.find({
      where: { registrationId },
      relations: ['seenBy', 'deliveryOutcome'],
      order: { visitNumber: 'ASC' },
    });
  }

  async getPostnatalVisitById(id: string): Promise<PostnatalVisit> {
    const visit = await this.pncRepo.findOne({
      where: { id },
      relations: ['seenBy', 'deliveryOutcome', 'registration', 'registration.patient'],
    });
    if (!visit) throw new NotFoundException('Postnatal visit not found');
    return visit;
  }

  async getPNCDueList(facilityId: string): Promise<any[]> {
    // Get all deliveries in last 6 weeks that need PNC follow-up
    const sixWeeksAgo = new Date();
    sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

    const recentDeliveries = await this.outcomeRepo.find({
      where: {
        labourRecord: { facilityId },
        timeOfBirth: MoreThanOrEqual(sixWeeksAgo),
      },
      relations: ['labourRecord', 'labourRecord.registration', 'labourRecord.registration.patient'],
    });

    const duelist = [];
    for (const delivery of recentDeliveries) {
      const visits = await this.pncRepo.find({
        where: { deliveryOutcomeId: delivery.id },
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

  async recordBabyWellness(dto: RecordBabyWellnessDto, userId: string): Promise<BabyWellnessCheck> {
    const delivery = await this.outcomeRepo.findOne({
      where: { id: dto.deliveryOutcomeId },
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

    return this.babyWellnessRepo.save(wellness);
  }

  async getBabyWellnessChecks(deliveryOutcomeId: string): Promise<BabyWellnessCheck[]> {
    return this.babyWellnessRepo.find({
      where: { deliveryOutcomeId },
      relations: ['checkedBy'],
      order: { checkDate: 'ASC' },
    });
  }

  // ============ IMMUNIZATION ============

  async generateImmunizationSchedule(deliveryOutcomeId: string, facilityId: string): Promise<ImmunizationSchedule[]> {
    const delivery = await this.outcomeRepo.findOne({
      where: { id: deliveryOutcomeId },
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

      schedules.push(schedule);
    }

    return this.immunizationRepo.save(schedules);
  }

  async getImmunizationSchedule(deliveryOutcomeId: string): Promise<ImmunizationSchedule[]> {
    const schedules = await this.immunizationRepo.find({
      where: { deliveryOutcomeId },
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

  async administerVaccine(id: string, dto: AdministerVaccineDto, userId: string): Promise<ImmunizationSchedule> {
    const schedule = await this.immunizationRepo.findOne({ where: { id } });
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

  async getImmunizationsDue(facilityId: string): Promise<ImmunizationSchedule[]> {
    const today = new Date();

    return this.immunizationRepo.find({
      where: {
        facilityId,
        status: In([ImmunizationStatus.DUE, ImmunizationStatus.OVERDUE, ImmunizationStatus.SCHEDULED]),
        dueDate: LessThanOrEqual(today),
      },
      relations: ['deliveryOutcome', 'deliveryOutcome.labourRecord', 'deliveryOutcome.labourRecord.registration', 'deliveryOutcome.labourRecord.registration.patient'],
      order: { dueDate: 'ASC' },
    });
  }

  async getImmunizationDefaulters(facilityId: string, daysOverdue: number = 14): Promise<ImmunizationSchedule[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOverdue);

    return this.immunizationRepo.find({
      where: {
        facilityId,
        status: In([ImmunizationStatus.SCHEDULED, ImmunizationStatus.DUE]),
        gracePeriodEnd: LessThanOrEqual(cutoffDate),
      },
      relations: ['deliveryOutcome', 'deliveryOutcome.labourRecord', 'deliveryOutcome.labourRecord.registration', 'deliveryOutcome.labourRecord.registration.patient'],
      order: { gracePeriodEnd: 'ASC' },
    });
  }
}
