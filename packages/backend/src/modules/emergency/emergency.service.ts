import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';
import {
  EmergencyCase,
  TriageLevel,
  TriageStatus,
  ArrivalMode,
} from '../../database/entities/emergency-case.entity';
import {
  Encounter,
  EncounterType,
  EncounterStatus,
} from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import {
  CreateEmergencyCaseDto,
  TriageDto,
  StartTreatmentDto,
  DischargeEmergencyDto,
  AdmitFromEmergencyDto,
  EmergencyQueryDto,
  EmergencyDisposition,
} from './dto/emergency.dto';
import { IpdService } from '../ipd/ipd.service';
import { AdmissionType } from '../../database/entities/admission.entity';
import { VitalsService } from '../vitals/vitals.service';
import { VitalSource } from '../../database/entities/vital.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';
import { dayBoundsUtc, localDateString } from '../../common/utils/timezone.util';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  constructor(
    @InjectRepository(EmergencyCase) private caseRepo: Repository<EmergencyCase>,
    @InjectRepository(Encounter) private encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private dataSource: DataSource,
    private vitalsService: VitalsService,
    private readonly auditLogService: AuditLogService,
    private readonly ipdService: IpdService,
  ) {}

  /**
   * Generate the next case number for today. MUST be invoked from inside an
   * active transaction (`manager` is required): the advisory lock taken below
   * is transaction-scoped, so it is held until the new EmergencyCase is
   * actually inserted — otherwise two concurrent registrations can read the
   * same count and produce duplicate case numbers.
   *
   * NOTE: a row lock (`setLock('pessimistic_write')`) cannot be used here —
   * Postgres rejects FOR UPDATE combined with COUNT(*), which made every
   * registration 500.
   */
  private async generateCaseNumber(
    manager: import('typeorm').EntityManager,
    tenantId?: string,
  ): Promise<string> {
    const tid = requireTenantId(tenantId);
    // The ward's day, not the server's. getFullYear/getMonth/getDate run in the
    // server zone (UTC), so between midnight and 03:00 locally the case number
    // carried yesterday's date and counted against yesterday's cases — while
    // the dashboard, which already uses dayBoundsUtc, called it today.
    const now = new Date();
    const prefix = `EM${localDateString(now).replace(/-/g, '')}`;
    const { start: startOfDay, end: endOfDay } = dayBoundsUtc(now);

    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `emergency_case_number:${tid}:${prefix}`,
    ]);

    const count = await manager
      .createQueryBuilder(EmergencyCase, 'ec')
      .where('ec.arrivalTime BETWEEN :startOfDay AND :endOfDay', { startOfDay, endOfDay })
      .andWhere('ec.tenant_id = :tenantId', { tenantId: tid })
      .getCount();
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  // ========== CASE REGISTRATION ==========
  async registerCase(
    dto: CreateEmergencyCaseDto,
    facilityId: string,
    userId: string,
    tenantId?: string,
  ): Promise<EmergencyCase> {
    const tid = requireTenantId(tenantId);
    // Wrap encounter + case creation in a single transaction so that a failure
    // of either insert rolls both back. Previously the two `save()` calls were
    // independent: a crash between them left an orphaned Encounter with no
    // EmergencyCase, corrupting the ER record on every admission.
    const savedCase = await this.dataSource.transaction(async (manager) => {
      const patientWhere: any = { id: dto.patientId };
      patientWhere.tenantId = tid;
      const patient = await manager.findOne(Patient, { where: patientWhere });
      if (!patient) throw new NotFoundException('Patient not found');

      // One open case per patient. Registering a second one split the record in
      // two — two encounters, two sets of triage vitals, two dispositions — and
      // whichever the clinician happened to open was missing half the story.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `emergency_case:${tid}:${dto.patientId}`,
      ]);
      const openCase = await manager
        .createQueryBuilder(EmergencyCase, 'ec')
        .innerJoin(Encounter, 'enc', 'enc.id = ec.encounter_id')
        .where('enc.patient_id = :patientId', { patientId: dto.patientId })
        .andWhere('ec.tenant_id = :tenantId', { tenantId: tid })
        .andWhere('ec.status IN (:...open)', {
          open: [TriageStatus.PENDING, TriageStatus.TRIAGED, TriageStatus.IN_TREATMENT],
        })
        .getOne();
      if (openCase) {
        throw new BadRequestException(
          `${patient.fullName} already has an open emergency case (${openCase.caseNumber}). Close it before registering a new one.`,
        );
      }

      // Create emergency encounter
      const visitNumber = `EMV-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
      const encounter = manager.create(Encounter, {
        visitNumber,
        type: EncounterType.EMERGENCY,
        status: EncounterStatus.TRIAGE,
        chiefComplaint: dto.chiefComplaint,
        patientId: dto.patientId,
        facilityId,
        createdById: userId,
        startTime: new Date(),
        tenantId: tid,
      });
      await manager.save(encounter);

      // Generate case number using the SAME transaction so the pessimistic
      // lock on today's rows is held until the new case is inserted below.
      const caseNumber = await this.generateCaseNumber(manager, tenantId);
      const emergencyCase = manager.create(EmergencyCase, {
        caseNumber,
        chiefComplaint: dto.chiefComplaint,
        presentingSymptoms: dto.presentingSymptoms,
        mechanismOfInjury: dto.mechanismOfInjury,
        allergies: dto.allergies,
        currentMedications: dto.currentMedications,
        pastMedicalHistory: dto.pastMedicalHistory,
        arrivalMode: dto.arrivalMode || ArrivalMode.WALK_IN,
        arrivalTime: new Date(),
        // No acuity until a nurse assigns one. This used to default to
        // LESS_URGENT, which showed an unassessed patient on the board as a
        // green "Level 4" and sorted them among the triaged.
        triageLevel: null,
        status: TriageStatus.PENDING,
        encounterId: encounter.id,
        facilityId,
        tenantId: tid,
      });

      const savedCase = await manager.save(emergencyCase);

      this.logger.log(
        `[AUDIT] Emergency case registered: ${caseNumber}, patientId: ${dto.patientId}, userId: ${userId}, facilityId: ${facilityId}`,
      );

      return savedCase;
    });

    // Audit after the commit — it writes on its own connection, so inside the
    // transaction the log row committed independently of the case it
    // described. Still best-effort.
    this.auditLogService
      .log({
        action: 'REGISTER_EMERGENCY_CASE',
        entityType: 'EmergencyCase',
        entityId: savedCase.id,
        userId,
        tenantId,
        oldValue: undefined,
        newValue: {
          caseNumber: savedCase.caseNumber,
          patientId: dto.patientId,
          chiefComplaint: savedCase.chiefComplaint,
          arrivalMode: savedCase.arrivalMode,
          status: savedCase.status,
          facilityId: savedCase.facilityId,
        },
      })
      .catch(() => {});

    return savedCase;
  }

  // ========== TRIAGE ==========
  /**
   * The acuity the recorded physiology demands, regardless of what was typed.
   *
   * A nurse could chart GCS 3, SpO2 70% and a systolic of 70 and still assign
   * level 5, "non-urgent" — and because both the treatment queue and the active
   * case list sort by triage level ascending, that patient went to the BOTTOM
   * of the board. Triage now cannot be set below what the numbers say; a case
   * that has to be raised is raised, said so in the notes, and the team is told.
   *
   * Thresholds are the red-flag physiology of the Uganda/WHO emergency triage
   * guidance: any single one of them means resuscitation or emergent.
   */
  /** GCS mapped onto the AVPU scale NEWS2 scores against. */
  private gcsToAvpu(gcs?: number | null): 'A' | 'V' | 'P' | 'U' | undefined {
    if (gcs == null) return undefined;
    if (gcs >= 15) return 'A';
    if (gcs >= 13) return 'V';
    if (gcs >= 9) return 'P';
    return 'U';
  }

  private acuityFloorFromVitals(dto: TriageDto): { level: TriageLevel; reasons: string[] } | null {
    const resus: string[] = [];
    const emergent: string[] = [];

    if (dto.gcsScore != null && dto.gcsScore <= 8) resus.push(`GCS ${dto.gcsScore}`);
    else if (dto.gcsScore != null && dto.gcsScore <= 13) emergent.push(`GCS ${dto.gcsScore}`);

    if (dto.oxygenSaturation != null && dto.oxygenSaturation < 90) {
      (dto.oxygenSaturation < 85 ? resus : emergent).push(`SpO2 ${dto.oxygenSaturation}%`);
    }
    if (dto.bloodPressureSystolic != null && dto.bloodPressureSystolic < 90) {
      (dto.bloodPressureSystolic < 80 ? resus : emergent).push(
        `systolic ${dto.bloodPressureSystolic} mmHg`,
      );
    }
    if (dto.respiratoryRate != null && (dto.respiratoryRate < 8 || dto.respiratoryRate > 30)) {
      (dto.respiratoryRate < 8 || dto.respiratoryRate > 35 ? resus : emergent).push(
        `respiratory rate ${dto.respiratoryRate}/min`,
      );
    }
    if (dto.heartRate != null && (dto.heartRate < 40 || dto.heartRate > 130)) {
      (dto.heartRate < 40 ? resus : emergent).push(`pulse ${dto.heartRate} bpm`);
    }
    if (dto.temperature != null && (dto.temperature >= 40 || dto.temperature <= 35)) {
      emergent.push(`temperature ${dto.temperature} °C`);
    }

    if (resus.length > 0) {
      return { level: TriageLevel.RESUSCITATION, reasons: [...resus, ...emergent] };
    }
    if (emergent.length > 0) return { level: TriageLevel.EMERGENT, reasons: emergent };
    return null;
  }

  async triageCase(
    id: string,
    dto: TriageDto,
    nurseId: string,
    tenantId?: string,
  ): Promise<EmergencyCase> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const emergencyCase = await this.caseRepo.findOne({ where });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');

    if (emergencyCase.status !== TriageStatus.PENDING) {
      throw new BadRequestException('Case has already been triaged');
    }

    const oldTriageLevel = emergencyCase.triageLevel;
    const oldStatus = emergencyCase.status;

    const floor = this.acuityFloorFromVitals(dto);
    let effectiveLevel = dto.triageLevel;
    let escalationNote: string | null = null;
    if (floor && dto.triageLevel > floor.level) {
      effectiveLevel = floor.level;
      escalationNote =
        `Triage raised from level ${dto.triageLevel} to level ${floor.level} ` +
        `on recorded observations: ${floor.reasons.join(', ')}.`;
    }

    Object.assign(emergencyCase, {
      triageLevel: effectiveLevel,
      bloodPressureSystolic: dto.bloodPressureSystolic,
      bloodPressureDiastolic: dto.bloodPressureDiastolic,
      heartRate: dto.heartRate,
      respiratoryRate: dto.respiratoryRate,
      temperature: dto.temperature,
      oxygenSaturation: dto.oxygenSaturation,
      gcsScore: dto.gcsScore,
      painScore: dto.painScore,
      bloodGlucose: dto.bloodGlucose,
      triageNotes: escalationNote
        ? [dto.triageNotes, escalationNote].filter(Boolean).join('\n')
        : dto.triageNotes,
      triageTime: new Date(),
      triageNurseId: nurseId,
      status: TriageStatus.TRIAGED,
    });

    // Update encounter status
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(
        { id: emergencyCase.encounterId, tenantId: tid },
        { status: EncounterStatus.WAITING },
      );
    }

    const savedCase = await this.caseRepo.save(emergencyCase);

    this.logger.log(
      `[AUDIT] Emergency case triaged: ${emergencyCase.caseNumber}, level: ${dto.triageLevel}, nurseId: ${nurseId}`,
    );

    this.auditLogService
      .log({
        action: 'TRIAGE_CASE',
        entityType: 'EmergencyCase',
        entityId: savedCase.id,
        userId: nurseId,
        tenantId,
        oldValue: { triageLevel: oldTriageLevel, status: oldStatus },
        newValue: {
          triageLevel: savedCase.triageLevel,
          status: savedCase.status,
          ...(escalationNote ? { requestedLevel: dto.triageLevel, escalationNote } : {}),
        },
      })
      .catch(() => {});

    // Mirror triage vitals into the canonical `vitals` table so the patient
    // timeline and critical-vital alerting see them. Best-effort: failures
    // are swallowed inside recordFromSource so triage cannot be rolled back
    // by a downstream notification glitch.
    let triagePatientId: string | null = null;
    if (savedCase.encounterId) {
      const enc = await this.encounterRepo.findOne({
        where: { id: savedCase.encounterId, tenantId: tid },
        select: ['id', 'patientId'],
      });
      triagePatientId = enc?.patientId ?? null;
    }
    if (triagePatientId) {
      await this.vitalsService.recordFromSource({
        source: VitalSource.EMERGENCY_TRIAGE,
        sourceRefId: savedCase.id,
        patientId: triagePatientId,
        encounterId: savedCase.encounterId ?? null,
        recordedById: nurseId,
        tenantId,
        facilityId: savedCase.facilityId,
        recordedAt: savedCase.triageTime ?? new Date(),
        vitals: {
          temperature: dto.temperature,
          pulse: dto.heartRate,
          bpSystolic: dto.bloodPressureSystolic,
          bpDiastolic: dto.bloodPressureDiastolic,
          respiratoryRate: dto.respiratoryRate,
          oxygenSaturation: dto.oxygenSaturation,
          bloodGlucose: dto.bloodGlucose,
          painScale: dto.painScore,
          notes: dto.triageNotes,
        },
        // GCS is the only consciousness measure the ED records, and it was not
        // being passed on. NEWS2 defaults a missing AVPU to 'Alert', so an
        // unresponsive patient scored as awake — three points light.
        consciousnessLevel: this.gcsToAvpu(dto.gcsScore),
      });
    }

    return savedCase;
  }

  // ========== START TREATMENT ==========
  async startTreatment(
    id: string,
    dto: StartTreatmentDto,
    doctorId?: string,
    tenantId?: string,
  ): Promise<EmergencyCase> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const emergencyCase = await this.caseRepo.findOne({ where });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');

    if (emergencyCase.status !== TriageStatus.TRIAGED) {
      throw new BadRequestException('Case must be triaged before treatment');
    }

    emergencyCase.status = TriageStatus.IN_TREATMENT;
    emergencyCase.treatmentStartTime = new Date();
    if (dto.attendingDoctorId) emergencyCase.attendingDoctorId = dto.attendingDoctorId;
    else if (doctorId) emergencyCase.attendingDoctorId = doctorId;
    if (dto.treatmentNotes) emergencyCase.treatmentNotes = dto.treatmentNotes;

    // Update encounter status
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(
        { id: emergencyCase.encounterId, tenantId: tid },
        {
          status: EncounterStatus.IN_CONSULTATION,
          attendingProviderId: emergencyCase.attendingDoctorId,
        },
      );
    }

    const savedCase = await this.caseRepo.save(emergencyCase);

    this.logger.log(
      `[AUDIT] Treatment started: ${emergencyCase.caseNumber}, doctorId: ${emergencyCase.attendingDoctorId}`,
    );

    this.auditLogService
      .log({
        action: 'START_TREATMENT',
        entityType: 'EmergencyCase',
        entityId: savedCase.id,
        userId: doctorId,
        tenantId,
        oldValue: { status: TriageStatus.TRIAGED },
        newValue: {
          status: savedCase.status,
          attendingDoctorId: savedCase.attendingDoctorId,
          treatmentStartTime: savedCase.treatmentStartTime,
        },
      })
      .catch(() => {});

    return savedCase;
  }

  // ========== DISCHARGE ==========
  async dischargeCase(
    id: string,
    dto: DischargeEmergencyDto,
    userId: string | undefined,
    tenantId?: string,
  ): Promise<EmergencyCase> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const emergencyCase = await this.caseRepo.findOne({ where });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');

    const disposition = dto.disposition || EmergencyDisposition.DISCHARGED;
    const targetStatus =
      disposition === EmergencyDisposition.LEFT_AMA
        ? TriageStatus.LEFT_AMA
        : disposition === EmergencyDisposition.DECEASED
          ? TriageStatus.DECEASED
          : TriageStatus.DISCHARGED;

    // A normal discharge requires treatment to have started; leaving against
    // medical advice or dying in the department can happen at any active stage
    // (including while still waiting for triage).
    const allowedStatuses =
      disposition === EmergencyDisposition.DISCHARGED
        ? [TriageStatus.IN_TREATMENT, TriageStatus.ADMITTED, TriageStatus.TRANSFERRED]
        : [TriageStatus.PENDING, TriageStatus.TRIAGED, TriageStatus.IN_TREATMENT];
    if (!allowedStatuses.includes(emergencyCase.status as TriageStatus)) {
      throw new BadRequestException(
        `Cannot record '${disposition}' for a case in '${emergencyCase.status}' status.`,
      );
    }

    if (!dto.primaryDiagnosis && disposition !== EmergencyDisposition.LEFT_AMA) {
      throw new BadRequestException('Primary diagnosis is required');
    }

    const oldStatus = emergencyCase.status;

    emergencyCase.status = targetStatus;
    emergencyCase.dischargeTime = new Date();
    // Who sent this patient home — or recorded them as leaving against advice,
    // or as having died in the department. The audit row logged `undefined`
    // because the controller never passed the caller down.
    emergencyCase.dischargedById = userId ?? null;
    if (dto.primaryDiagnosis) emergencyCase.primaryDiagnosis = dto.primaryDiagnosis;
    if (dto.dispositionNotes) emergencyCase.dispositionNotes = dto.dispositionNotes;
    if (dto.treatmentNotes)
      emergencyCase.treatmentNotes =
        (emergencyCase.treatmentNotes || '') + '\n' + dto.treatmentNotes;

    // Update encounter
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(
        { id: emergencyCase.encounterId, tenantId: tid },
        {
          status: EncounterStatus.DISCHARGED,
          endTime: new Date(),
        },
      );
    }

    const savedCase = await this.caseRepo.save(emergencyCase);

    this.logger.log(
      `[AUDIT] Emergency case closed (${disposition}): ${emergencyCase.caseNumber}, diagnosis: ${dto.primaryDiagnosis ?? 'n/a'}`,
    );

    this.auditLogService
      .log({
        action: 'DISCHARGE_EMERGENCY_CASE',
        entityType: 'EmergencyCase',
        entityId: savedCase.id,
        userId,
        tenantId,
        oldValue: { status: oldStatus },
        newValue: {
          status: savedCase.status,
          dischargeTime: savedCase.dischargeTime,
          primaryDiagnosis: savedCase.primaryDiagnosis,
          dischargedById: savedCase.dischargedById,
        },
      })
      .catch(() => {});

    return savedCase;
  }

  // ========== ADMIT TO IPD ==========
  /**
   * Admit out of the department — and actually admit them.
   *
   * This used to flip the case status to 'admitted', write
   * "Admitted to ward <uuid>" into a free-text note and stop. `bedId` was
   * accepted by the DTO and thrown away. No IPD admission existed, no bed was
   * occupied and no ward worklist showed the patient; the only thing that made
   * a real admission was the browser making a second, separate call first — so
   * the patient's ward stay depended on which client was used, and on the two
   * calls both surviving. The admission is created here now, in one place.
   */
  async admitToWard(
    id: string,
    dto: AdmitFromEmergencyDto,
    userId: string,
    tenantId?: string,
  ): Promise<EmergencyCase> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const emergencyCase = await this.caseRepo.findOne({ where, relations: ['encounter'] });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');

    if (
      ![TriageStatus.TRIAGED, TriageStatus.IN_TREATMENT].includes(
        emergencyCase.status as TriageStatus,
      )
    ) {
      throw new BadRequestException(
        `Cannot admit a case in '${emergencyCase.status}' status. The case must be triaged or in treatment.`,
      );
    }

    if (!dto.bedId) {
      throw new BadRequestException(
        'A bed is required to admit from the emergency department — without one the patient reaches no ward worklist.',
      );
    }

    const patientId = emergencyCase.encounter?.patientId;
    if (!patientId) {
      throw new BadRequestException('This case has no linked patient record');
    }

    // The IPD admission is the real event: it locks and occupies the bed,
    // refuses a duplicate admission and puts the patient on the ward board.
    // If it throws — bed taken, patient already admitted — the emergency case
    // stays where it was, which is the honest outcome.
    const admission = await this.ipdService.createAdmission(
      {
        patientId,
        encounterId: emergencyCase.encounterId ?? undefined,
        wardId: dto.wardId,
        bedId: dto.bedId,
        type: AdmissionType.EMERGENCY,
        admissionDiagnosis: dto.primaryDiagnosis,
        admissionReason: dto.admissionNotes || emergencyCase.chiefComplaint,
        attendingDoctorId: emergencyCase.attendingDoctorId || undefined,
      } as any,
      userId,
      tenantId,
    );

    emergencyCase.status = TriageStatus.ADMITTED;
    emergencyCase.primaryDiagnosis = dto.primaryDiagnosis;
    emergencyCase.dispositionNotes =
      dto.admissionNotes || `Admitted as ${admission.admissionNumber}`;
    emergencyCase.admissionId = admission.id;
    emergencyCase.admittedById = userId;
    emergencyCase.admittedAt = new Date();

    // Update encounter to admitted
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(
        { id: emergencyCase.encounterId, tenantId: tid },
        { status: EncounterStatus.ADMITTED },
      );
    }

    const savedCase = await this.caseRepo.save(emergencyCase);

    this.logger.log(
      `[AUDIT] Emergency case admitted to IPD: ${emergencyCase.caseNumber}, admission: ${admission.admissionNumber}, wardId: ${dto.wardId}, diagnosis: ${dto.primaryDiagnosis}`,
    );

    this.auditLogService
      .log({
        action: 'ADMIT_FROM_EMERGENCY',
        entityType: 'EmergencyCase',
        entityId: savedCase.id,
        userId,
        tenantId,
        oldValue: { status: TriageStatus.IN_TREATMENT },
        newValue: {
          status: savedCase.status,
          admissionId: admission.id,
          admissionNumber: admission.admissionNumber,
          wardId: dto.wardId,
          bedId: dto.bedId,
          admittedById: userId,
        },
      })
      .catch(() => {});

    return savedCase;
  }

  // ========== QUERIES ==========
  async getCases(
    query: EmergencyQueryDto,
    tenantId?: string,
  ): Promise<{ data: EmergencyCase[]; meta: any }> {
    const { status, triageLevel, facilityId, fromDate, toDate, limit = 50, offset = 0 } = query;

    const activeStatuses = [TriageStatus.PENDING, TriageStatus.TRIAGED, TriageStatus.IN_TREATMENT];
    // Closed-case views (discharged/admitted/…) are history lookups — show the
    // most recent first. Active worklists keep acuity-then-arrival ordering so
    // sickest/longest-waiting patients can never be pushed off the page.
    const isClosedView = status && !activeStatuses.includes(status as TriageStatus);

    const qb = this.caseRepo
      .createQueryBuilder('ec')
      .leftJoinAndSelect('ec.encounter', 'enc')
      .leftJoinAndSelect('enc.patient', 'patient')
      .leftJoinAndSelect('ec.triageNurse', 'nurse')
      .leftJoinAndSelect('ec.attendingDoctor', 'doctor');

    if (isClosedView) {
      qb.orderBy('ec.arrivalTime', 'DESC');
    } else {
      qb.orderBy('ec.triageLevel', 'ASC').addOrderBy('ec.arrivalTime', 'ASC');
    }

    qb.andWhere('ec.tenant_id = :tenantId', { tenantId: requireTenantId(tenantId) });
    if (status) qb.andWhere('ec.status = :status', { status });
    else if (query.active === 'true')
      qb.andWhere('ec.status IN (:...activeStatuses)', { activeStatuses });
    if (triageLevel) qb.andWhere('ec.triageLevel = :triageLevel', { triageLevel });
    if (facilityId) qb.andWhere('ec.facilityId = :facilityId', { facilityId });
    if (fromDate) qb.andWhere('ec.arrivalTime >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('ec.arrivalTime <= :toDate', { toDate });

    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { data, meta: { total, limit, offset } };
  }

  async getCase(id: string, tenantId?: string): Promise<EmergencyCase> {
    const tid = requireTenantId(tenantId);
    const where: any = { id };
    where.tenantId = tid;
    const emergencyCase = await this.caseRepo.findOne({
      where,
      relations: ['encounter', 'encounter.patient', 'triageNurse', 'attendingDoctor'],
    });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');
    return emergencyCase;
  }

  // ========== DASHBOARD ==========
  async getEmergencyDashboard(facilityId: string, tenantId?: string): Promise<any> {
    const tid = requireTenantId(tenantId);
    // The ward's today, not the server's: setHours works in the server zone,
    // which is UTC, so "today" began at 03:00 locally and cases registered
    // overnight were counted against yesterday.
    const { start: today } = dayBoundsUtc(new Date());

    // Count by triage level (active cases)
    const byTriageLevelQb = this.caseRepo
      .createQueryBuilder('ec')
      .select('ec.triageLevel', 'level')
      .addSelect('COUNT(*)', 'count')
      .where('ec.facilityId = :facilityId', { facilityId })
      .andWhere('ec.status NOT IN (:...completed)', {
        completed: [
          TriageStatus.DISCHARGED,
          TriageStatus.ADMITTED,
          TriageStatus.LEFT_AMA,
          TriageStatus.DECEASED,
        ],
      });

    byTriageLevelQb.andWhere('ec.tenant_id = :tenantId', { tenantId: tid });

    const byTriageLevel = await byTriageLevelQb.groupBy('ec.triageLevel').getRawMany();

    // Count by status
    const byStatusQb = this.caseRepo
      .createQueryBuilder('ec')
      .select('ec.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('ec.facilityId = :facilityId', { facilityId })
      .andWhere('ec.arrivalTime >= :today', { today });

    byStatusQb.andWhere('ec.tenant_id = :tenantId', { tenantId: tid });

    const byStatus = await byStatusQb.groupBy('ec.status').getRawMany();

    // Total today
    const todayTotalWhere: any = {
      facilityId,
      arrivalTime: MoreThanOrEqual(today),
    };
    todayTotalWhere.tenantId = tid;

    const todayTotal = await this.caseRepo.count({
      where: todayTotalWhere,
    });

    // Average wait times
    const avgWaitQb = this.caseRepo
      .createQueryBuilder('ec')
      .select(
        'AVG(EXTRACT(EPOCH FROM (ec.triageTime - ec.arrivalTime))/60)',
        'avgTriageWaitMinutes',
      )
      .addSelect(
        'AVG(EXTRACT(EPOCH FROM (ec.treatmentStartTime - ec.triageTime))/60)',
        'avgTreatmentWaitMinutes',
      )
      .where('ec.facilityId = :facilityId', { facilityId })
      .andWhere('ec.arrivalTime >= :today', { today })
      .andWhere('ec.triageTime IS NOT NULL');

    avgWaitQb.andWhere('ec.tenant_id = :tenantId', { tenantId: tid });

    const avgWaitTime = await avgWaitQb.getRawOne();

    // Critical cases (Level 1 & 2). Counting only those already IN_TREATMENT
    // hid the dangerous ones: a resuscitation patient who has been triaged and
    // is still WAITING is exactly what this tile exists to surface.
    const criticalWhere: any[] = [TriageStatus.TRIAGED, TriageStatus.IN_TREATMENT].flatMap(
      (status) => [
        { facilityId, triageLevel: TriageLevel.RESUSCITATION, status, tenantId: tid },
        { facilityId, triageLevel: TriageLevel.EMERGENT, status, tenantId: tid },
      ],
    );

    const criticalCases = await this.caseRepo.count({
      where: criticalWhere,
    });

    return {
      todayTotal,
      criticalCases,
      byTriageLevel: byTriageLevel.reduce((acc, item) => {
        acc[`level${item.level}`] = parseInt(item.count);
        return acc;
      }, {}),
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = parseInt(item.count);
        return acc;
      }, {}),
      avgWaitTimes: {
        triageMinutes: Math.round(avgWaitTime?.avgTriageWaitMinutes || 0),
        treatmentMinutes: Math.round(avgWaitTime?.avgTreatmentWaitMinutes || 0),
      },
    };
  }

  // ========== QUEUE - sorted by triage priority ==========
  async getTriageQueue(facilityId: string, tenantId?: string): Promise<EmergencyCase[]> {
    const tid = requireTenantId(tenantId);
    return this.caseRepo.find({
      where: {
        facilityId,
        status: TriageStatus.PENDING,
        tenantId: tid,
      },
      relations: ['encounter', 'encounter.patient'],
      order: { arrivalTime: 'ASC' },
    });
  }

  async getTreatmentQueue(facilityId: string, tenantId?: string): Promise<EmergencyCase[]> {
    const tid = requireTenantId(tenantId);
    return this.caseRepo.find({
      where: {
        facilityId,
        status: TriageStatus.TRIAGED,
        tenantId: tid,
      },
      relations: ['encounter', 'encounter.patient', 'triageNurse'],
      order: { triageLevel: 'ASC', triageTime: 'ASC' }, // Critical first
    });
  }
}
