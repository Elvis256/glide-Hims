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
import { VitalsService } from '../vitals/vitals.service';
import { VitalSource } from '../../database/entities/vital.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';
import { dayBoundsUtc } from '../../common/utils/timezone.util';

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
    const now = new Date();
    const prefix = `EM${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

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
        triageLevel: TriageLevel.LESS_URGENT, // Default, to be updated during triage
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

    Object.assign(emergencyCase, {
      triageLevel: dto.triageLevel,
      bloodPressureSystolic: dto.bloodPressureSystolic,
      bloodPressureDiastolic: dto.bloodPressureDiastolic,
      heartRate: dto.heartRate,
      respiratoryRate: dto.respiratoryRate,
      temperature: dto.temperature,
      oxygenSaturation: dto.oxygenSaturation,
      gcsScore: dto.gcsScore,
      painScore: dto.painScore,
      bloodGlucose: dto.bloodGlucose,
      triageNotes: dto.triageNotes,
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
        newValue: { triageLevel: savedCase.triageLevel, status: savedCase.status },
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
        userId: undefined,
        tenantId,
        oldValue: { status: oldStatus },
        newValue: {
          status: savedCase.status,
          dischargeTime: savedCase.dischargeTime,
          primaryDiagnosis: savedCase.primaryDiagnosis,
        },
      })
      .catch(() => {});

    return savedCase;
  }

  // ========== ADMIT TO IPD ==========
  async admitToWard(
    id: string,
    dto: AdmitFromEmergencyDto,
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

    emergencyCase.status = TriageStatus.ADMITTED;
    emergencyCase.primaryDiagnosis = dto.primaryDiagnosis;
    emergencyCase.dispositionNotes = dto.admissionNotes || `Admitted to ward ${dto.wardId}`;

    // Update encounter to admitted
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(
        { id: emergencyCase.encounterId, tenantId: tid },
        { status: EncounterStatus.ADMITTED },
      );
    }

    // Note: IPD admission should be created via IPD module
    // This just marks the emergency case as admitted
    const savedCase = await this.caseRepo.save(emergencyCase);

    this.logger.log(
      `[AUDIT] Emergency case admitted to IPD: ${emergencyCase.caseNumber}, wardId: ${dto.wardId}, diagnosis: ${dto.primaryDiagnosis}`,
    );

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

    // Critical cases (Level 1 & 2)
    const criticalWhere: any[] = [
      {
        facilityId,
        triageLevel: TriageLevel.RESUSCITATION,
        status: TriageStatus.IN_TREATMENT,
        tenantId: tid,
      },
      {
        facilityId,
        triageLevel: TriageLevel.EMERGENT,
        status: TriageStatus.IN_TREATMENT,
        tenantId: tid,
      },
    ];

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
