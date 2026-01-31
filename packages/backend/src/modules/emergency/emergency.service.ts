import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, LessThanOrEqual, MoreThanOrEqual, DataSource } from 'typeorm';
import { EmergencyCase, TriageLevel, TriageStatus, ArrivalMode } from '../../database/entities/emergency-case.entity';
import { Encounter, EncounterType, EncounterStatus } from '../../database/entities/encounter.entity';
import { Patient } from '../../database/entities/patient.entity';
import {
  CreateEmergencyCaseDto, TriageDto, StartTreatmentDto,
  DischargeEmergencyDto, AdmitFromEmergencyDto, EmergencyQueryDto
} from './dto/emergency.dto';

@Injectable()
export class EmergencyService {
  private readonly logger = new Logger(EmergencyService.name);

  constructor(
    @InjectRepository(EmergencyCase) private caseRepo: Repository<EmergencyCase>,
    @InjectRepository(Encounter) private encounterRepo: Repository<Encounter>,
    @InjectRepository(Patient) private patientRepo: Repository<Patient>,
    private dataSource: DataSource,
  ) {}

  private async generateCaseNumber(): Promise<string> {
    const now = new Date();
    const prefix = `EM${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    
    // Use a transaction with pessimistic locking to prevent race conditions
    const result = await this.dataSource.transaction(async (manager) => {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      
      // Lock the table for counting to prevent race conditions
      const count = await manager
        .createQueryBuilder(EmergencyCase, 'ec')
        .setLock('pessimistic_write')
        .where('ec.arrivalTime BETWEEN :startOfDay AND :endOfDay', { startOfDay, endOfDay })
        .getCount();
      
      return `${prefix}-${String(count + 1).padStart(4, '0')}`;
    });
    
    return result;
  }

  // ========== CASE REGISTRATION ==========
  async registerCase(dto: CreateEmergencyCaseDto, facilityId: string, userId: string): Promise<EmergencyCase> {
    const patient = await this.patientRepo.findOne({ where: { id: dto.patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    // Create emergency encounter
    const visitNumber = `EMV-${Date.now()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
    const encounter = this.encounterRepo.create({
      visitNumber,
      type: EncounterType.EMERGENCY,
      status: EncounterStatus.TRIAGE,
      chiefComplaint: dto.chiefComplaint,
      patientId: dto.patientId,
      facilityId,
      createdById: userId,
      startTime: new Date(),
    });
    await this.encounterRepo.save(encounter);

    // Create emergency case
    const caseNumber = await this.generateCaseNumber();
    const emergencyCase = this.caseRepo.create({
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
    });

    const savedCase = await this.caseRepo.save(emergencyCase);
    
    this.logger.log(`[AUDIT] Emergency case registered: ${caseNumber}, patientId: ${dto.patientId}, userId: ${userId}, facilityId: ${facilityId}`);
    
    return savedCase;
  }

  // ========== TRIAGE ==========
  async triageCase(id: string, dto: TriageDto, nurseId: string): Promise<EmergencyCase> {
    const emergencyCase = await this.caseRepo.findOne({ where: { id } });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');
    
    if (emergencyCase.status !== TriageStatus.PENDING) {
      throw new BadRequestException('Case has already been triaged');
    }

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
      await this.encounterRepo.update(emergencyCase.encounterId, {
        status: EncounterStatus.WAITING,
      });
    }

    const savedCase = await this.caseRepo.save(emergencyCase);
    
    this.logger.log(`[AUDIT] Emergency case triaged: ${emergencyCase.caseNumber}, level: ${dto.triageLevel}, nurseId: ${nurseId}`);
    
    return savedCase;
  }

  // ========== START TREATMENT ==========
  async startTreatment(id: string, dto: StartTreatmentDto, doctorId?: string): Promise<EmergencyCase> {
    const emergencyCase = await this.caseRepo.findOne({ where: { id } });
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
      await this.encounterRepo.update(emergencyCase.encounterId, {
        status: EncounterStatus.IN_CONSULTATION,
        attendingProviderId: emergencyCase.attendingDoctorId,
      });
    }

    const savedCase = await this.caseRepo.save(emergencyCase);
    
    this.logger.log(`[AUDIT] Treatment started: ${emergencyCase.caseNumber}, doctorId: ${emergencyCase.attendingDoctorId}`);
    
    return savedCase;
  }

  // ========== DISCHARGE ==========
  async dischargeCase(id: string, dto: DischargeEmergencyDto): Promise<EmergencyCase> {
    const emergencyCase = await this.caseRepo.findOne({ where: { id } });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');

    emergencyCase.status = TriageStatus.DISCHARGED;
    emergencyCase.dischargeTime = new Date();
    emergencyCase.primaryDiagnosis = dto.primaryDiagnosis;
    if (dto.dispositionNotes) emergencyCase.dispositionNotes = dto.dispositionNotes;
    if (dto.treatmentNotes) emergencyCase.treatmentNotes = (emergencyCase.treatmentNotes || '') + '\n' + dto.treatmentNotes;

    // Update encounter
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(emergencyCase.encounterId, {
        status: EncounterStatus.DISCHARGED,
        endTime: new Date(),
      });
    }

    const savedCase = await this.caseRepo.save(emergencyCase);
    
    this.logger.log(`[AUDIT] Emergency case discharged: ${emergencyCase.caseNumber}, diagnosis: ${dto.primaryDiagnosis}`);
    
    return savedCase;
  }

  // ========== ADMIT TO IPD ==========
  async admitToWard(id: string, dto: AdmitFromEmergencyDto): Promise<EmergencyCase> {
    const emergencyCase = await this.caseRepo.findOne({ where: { id }, relations: ['encounter'] });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');

    emergencyCase.status = TriageStatus.ADMITTED;
    emergencyCase.primaryDiagnosis = dto.primaryDiagnosis;
    emergencyCase.dispositionNotes = dto.admissionNotes || `Admitted to ward ${dto.wardId}`;

    // Update encounter to admitted
    if (emergencyCase.encounterId) {
      await this.encounterRepo.update(emergencyCase.encounterId, {
        status: EncounterStatus.ADMITTED,
      });
    }

    // Note: IPD admission should be created via IPD module
    // This just marks the emergency case as admitted
    const savedCase = await this.caseRepo.save(emergencyCase);
    
    this.logger.log(`[AUDIT] Emergency case admitted to IPD: ${emergencyCase.caseNumber}, wardId: ${dto.wardId}, diagnosis: ${dto.primaryDiagnosis}`);
    
    return savedCase;
  }

  // ========== QUERIES ==========
  async getCases(query: EmergencyQueryDto): Promise<{ data: EmergencyCase[]; meta: any }> {
    const { status, triageLevel, facilityId, fromDate, toDate, limit = 50, offset = 0 } = query;

    const qb = this.caseRepo.createQueryBuilder('ec')
      .leftJoinAndSelect('ec.encounter', 'enc')
      .leftJoinAndSelect('enc.patient', 'patient')
      .leftJoinAndSelect('ec.triageNurse', 'nurse')
      .leftJoinAndSelect('ec.attendingDoctor', 'doctor')
      .orderBy('ec.triageLevel', 'ASC')
      .addOrderBy('ec.arrivalTime', 'ASC');

    if (status) qb.andWhere('ec.status = :status', { status });
    if (triageLevel) qb.andWhere('ec.triageLevel = :triageLevel', { triageLevel });
    if (facilityId) qb.andWhere('ec.facilityId = :facilityId', { facilityId });
    if (fromDate) qb.andWhere('ec.arrivalTime >= :fromDate', { fromDate });
    if (toDate) qb.andWhere('ec.arrivalTime <= :toDate', { toDate });

    const [data, total] = await qb.skip(offset).take(limit).getManyAndCount();
    return { data, meta: { total, limit, offset } };
  }

  async getCase(id: string): Promise<EmergencyCase> {
    const emergencyCase = await this.caseRepo.findOne({
      where: { id },
      relations: ['encounter', 'encounter.patient', 'triageNurse', 'attendingDoctor'],
    });
    if (!emergencyCase) throw new NotFoundException('Emergency case not found');
    return emergencyCase;
  }

  // ========== DASHBOARD ==========
  async getEmergencyDashboard(facilityId: string): Promise<any> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Count by triage level (active cases)
    const byTriageLevel = await this.caseRepo
      .createQueryBuilder('ec')
      .select('ec.triageLevel', 'level')
      .addSelect('COUNT(*)', 'count')
      .where('ec.facilityId = :facilityId', { facilityId })
      .andWhere('ec.status NOT IN (:...completed)', { 
        completed: [TriageStatus.DISCHARGED, TriageStatus.ADMITTED, TriageStatus.LEFT_AMA, TriageStatus.DECEASED] 
      })
      .groupBy('ec.triageLevel')
      .getRawMany();

    // Count by status
    const byStatus = await this.caseRepo
      .createQueryBuilder('ec')
      .select('ec.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('ec.facilityId = :facilityId', { facilityId })
      .andWhere('ec.arrivalTime >= :today', { today })
      .groupBy('ec.status')
      .getRawMany();

    // Total today
    const todayTotal = await this.caseRepo.count({
      where: {
        facilityId,
        arrivalTime: MoreThanOrEqual(today),
      },
    });

    // Average wait times
    const avgWaitTime = await this.caseRepo
      .createQueryBuilder('ec')
      .select('AVG(EXTRACT(EPOCH FROM (ec.triageTime - ec.arrivalTime))/60)', 'avgTriageWaitMinutes')
      .addSelect('AVG(EXTRACT(EPOCH FROM (ec.treatmentStartTime - ec.triageTime))/60)', 'avgTreatmentWaitMinutes')
      .where('ec.facilityId = :facilityId', { facilityId })
      .andWhere('ec.arrivalTime >= :today', { today })
      .andWhere('ec.triageTime IS NOT NULL')
      .getRawOne();

    // Critical cases (Level 1 & 2)
    const criticalCases = await this.caseRepo.count({
      where: [
        { facilityId, triageLevel: TriageLevel.RESUSCITATION, status: TriageStatus.IN_TREATMENT },
        { facilityId, triageLevel: TriageLevel.EMERGENT, status: TriageStatus.IN_TREATMENT },
      ],
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
  async getTriageQueue(facilityId: string): Promise<EmergencyCase[]> {
    return this.caseRepo.find({
      where: { 
        facilityId, 
        status: TriageStatus.PENDING 
      },
      relations: ['encounter', 'encounter.patient'],
      order: { arrivalTime: 'ASC' },
    });
  }

  async getTreatmentQueue(facilityId: string): Promise<EmergencyCase[]> {
    return this.caseRepo.find({
      where: { 
        facilityId, 
        status: TriageStatus.TRIAGED 
      },
      relations: ['encounter', 'encounter.patient', 'triageNurse'],
      order: { triageLevel: 'ASC', triageTime: 'ASC' },  // Critical first
    });
  }
}
