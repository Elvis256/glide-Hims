import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { DischargeSummary, DischargeType } from '../../database/entities/discharge-summary.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateDischargeSummaryDto, DischargeSummaryFilterDto } from './dto/discharge.dto';
import { VitalsService } from '../vitals/vitals.service';
import { VitalSource } from '../../database/entities/vital.entity';
import { MedicationReconciliationService } from './medication-reconciliation.service';
import { requireTenantId } from '../../common/utils/tenant.util';

const DISCHARGEABLE_STATUSES: EncounterStatus[] = [
  EncounterStatus.ADMITTED,
  EncounterStatus.IN_CONSULTATION,
];

@Injectable()
export class DischargeService {
  private readonly logger = new Logger(DischargeService.name);

  constructor(
    @InjectRepository(DischargeSummary)
    private dischargeSummaryRepository: Repository<DischargeSummary>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    private dataSource: DataSource,
    private vitalsService: VitalsService,
    @Optional()
    private medReconciliationService: MedicationReconciliationService | null,
  ) {}

  async create(
    dto: CreateDischargeSummaryDto,
    userId: string,
    facilityId: string,
    tenantId?: string,
  ): Promise<DischargeSummary> {
    const tid = requireTenantId(tenantId);
    const { savedSummary, encounter } = await this.dataSource.transaction(async (manager) => {
      // Lock the encounter row so concurrent discharges serialize on the
      // status check (two simultaneous requests would otherwise both pass)
      const encounterWhere: any = { id: dto.encounterId, tenantId: tid };
      const encounter = await manager.findOne(Encounter, {
        where: encounterWhere,
        lock: { mode: 'pessimistic_write' },
      });
      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }
      if (!DISCHARGEABLE_STATUSES.includes(encounter.status)) {
        throw new BadRequestException(
          `Cannot discharge encounter with status '${encounter.status}'. Only ACTIVE or IN_PROGRESS encounters can be discharged.`,
        );
      }

      // Check if discharge summary already exists for this encounter
      const existingWhere: any = { encounterId: dto.encounterId, tenantId: tid };
      const existing = await manager.findOne(DischargeSummary, {
        where: existingWhere,
      });

      if (existing) {
        throw new BadRequestException('Discharge summary already exists for this encounter');
      }

      const dischargeNumber = await this.generateDischargeNumber(tid, manager);

      const summary = manager.create(DischargeSummary, {
        ...dto,
        dischargeNumber,
        dischargeDate: new Date(dto.dischargeDate),
        facilityId,
        dischargedById: userId,
        tenantId: tid,
      });

      const savedSummary = await manager.save(DischargeSummary, summary);

      // Update encounter status within same transaction
      await manager.update(
        Encounter,
        { id: dto.encounterId, tenantId: tid },
        {
          status: EncounterStatus.DISCHARGED,
          endTime: new Date(dto.dischargeDate),
        },
      );

      return { savedSummary, encounter };
    });

    // Mirror vitalSignsAtDischarge into the canonical `vitals` timeline.
    // Best-effort, outside the discharge txn: the vitals service uses its own
    // connection, so running it inside would abort the discharge on failure
    // and orphan a vital record if the discharge later rolled back.
    try {
      const v = (dto as any).vitalSignsAtDischarge as
        | {
            temperature?: number;
            pulse?: number;
            bloodPressure?: string;
            respiratoryRate?: number;
            oxygenSaturation?: number;
            weight?: number;
          }
        | undefined;
      if (v && encounter.patientId) {
        let bpSystolic: number | undefined;
        let bpDiastolic: number | undefined;
        if (typeof v.bloodPressure === 'string') {
          const m = v.bloodPressure.match(/^\s*(\d{2,3})\s*\/\s*(\d{2,3})\s*$/);
          if (m) {
            bpSystolic = Number(m[1]);
            bpDiastolic = Number(m[2]);
          }
        }
        await this.vitalsService.recordFromSource({
          source: VitalSource.DISCHARGE,
          sourceRefId: savedSummary.id,
          patientId: encounter.patientId,
          encounterId: dto.encounterId,
          recordedById: userId,
          tenantId,
          facilityId,
          recordedAt: savedSummary.dischargeDate ?? new Date(),
          vitals: {
            temperature: v.temperature,
            pulse: v.pulse,
            bpSystolic,
            bpDiastolic,
            respiratoryRate: v.respiratoryRate,
            oxygenSaturation: v.oxygenSaturation,
            weight: v.weight,
          },
        });
      }
    } catch (err: any) {
      this.logger.warn(`Failed to mirror discharge vitals: ${err?.message}`);
    }

    // Auto-initialize medication reconciliation (best-effort)
    if (this.medReconciliationService && encounter.patientId) {
      try {
        await this.medReconciliationService.initializeReconciliation({
          encounterId: dto.encounterId,
          patientId: encounter.patientId,
          facilityId,
          dischargeSummaryId: savedSummary.id,
          tenantId,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to initialize medication reconciliation: ${err?.message}`);
      }
    }

    return savedSummary;
  }

  async findAll(
    filter: DischargeSummaryFilterDto,
    facilityId: string,
    tenantId?: string,
  ): Promise<DischargeSummary[]> {
    const tid = requireTenantId(tenantId);
    const query = this.dischargeSummaryRepository
      .createQueryBuilder('discharge')
      .leftJoinAndSelect('discharge.patient', 'patient')
      .leftJoinAndSelect('discharge.encounter', 'encounter')
      .leftJoinAndSelect('discharge.dischargedBy', 'dischargedBy')
      .where('discharge.facility_id = :facilityId', { facilityId });

    query.andWhere('discharge.tenant_id = :tenantId', { tenantId: tid });

    if (filter.patientId) {
      query.andWhere('discharge.patient_id = :patientId', { patientId: filter.patientId });
    }
    if (filter.type) {
      query.andWhere('discharge.type = :type', { type: filter.type });
    }
    if (filter.fromDate && filter.toDate) {
      query.andWhere('discharge.discharge_date BETWEEN :fromDate AND :toDate', {
        fromDate: filter.fromDate,
        toDate: filter.toDate,
      });
    }

    query.orderBy('discharge.discharge_date', 'DESC');

    return query.getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<DischargeSummary> {
    const tid = requireTenantId(tenantId);
    const where: any = { id, tenantId: tid };
    const summary = await this.dischargeSummaryRepository.findOne({
      where,
      relations: ['patient', 'encounter', 'facility', 'dischargedBy', 'attendingPhysician'],
    });

    if (!summary) {
      throw new NotFoundException('Discharge summary not found');
    }

    return summary;
  }

  async findByEncounter(encounterId: string, tenantId?: string): Promise<DischargeSummary> {
    const tid = requireTenantId(tenantId);
    const where: any = { encounterId, tenantId: tid };
    const summary = await this.dischargeSummaryRepository.findOne({
      where,
      relations: ['patient', 'dischargedBy', 'attendingPhysician'],
    });

    if (!summary) {
      throw new NotFoundException('Discharge summary not found for this encounter');
    }

    return summary;
  }

  async findByPatient(patientId: string, tenantId?: string): Promise<DischargeSummary[]> {
    const tid = requireTenantId(tenantId);
    const where: any = { patientId, tenantId: tid };
    return this.dischargeSummaryRepository.find({
      where,
      relations: ['encounter', 'dischargedBy'],
      order: { dischargeDate: 'DESC' },
    });
  }

  async update(
    id: string,
    dto: Partial<CreateDischargeSummaryDto>,
    tenantId?: string,
  ): Promise<DischargeSummary> {
    const summary = await this.findOne(id, tenantId);
    // Identity/linkage fields are immutable after creation
    const {
      encounterId: _e,
      patientId: _p,
      dischargeDate,
      ...updatable
    } = dto as any;
    Object.assign(summary, updatable);
    if (dischargeDate) summary.dischargeDate = new Date(dischargeDate);
    return this.dischargeSummaryRepository.save(summary);
  }

  async getStats(facilityId: string, fromDate: Date, toDate: Date, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const total = await this.dischargeSummaryRepository.count({
      where: {
        facilityId,
        dischargeDate: Between(fromDate, toDate),
        tenantId: tid,
      },
    });

    const byTypeQb = this.dischargeSummaryRepository
      .createQueryBuilder('discharge')
      .select('discharge.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('discharge.facility_id = :facilityId', { facilityId })
      .andWhere('discharge.discharge_date BETWEEN :fromDate AND :toDate', { fromDate, toDate });

    byTypeQb.andWhere('discharge.tenant_id = :tenantId', { tenantId: tid });

    const byType = await byTypeQb.groupBy('discharge.type').getRawMany();

    const amaCount = await this.dischargeSummaryRepository.count({
      where: {
        facilityId,
        type: DischargeType.AGAINST_MEDICAL_ADVICE,
        dischargeDate: Between(fromDate, toDate),
        tenantId: tid,
      },
    });

    return {
      total,
      byType,
      amaRate: total > 0 ? ((amaCount / total) * 100).toFixed(2) : 0,
    };
  }

  async printDischargeSummary(id: string, tenantId?: string): Promise<any> {
    const summary = await this.findOne(id, tenantId);

    // Return formatted data for PDF generation
    return {
      patientInfo: {
        name: summary.patient.fullName,
        mrn: summary.patient.mrn,
        dateOfBirth: summary.patient.dateOfBirth,
        gender: summary.patient.gender,
      },
      dischargeInfo: {
        dischargeNumber: summary.dischargeNumber,
        dischargeDate: summary.dischargeDate,
        type: summary.type,
        destination: summary.destination,
      },
      clinicalSummary: {
        chiefComplaint: summary.chiefComplaint,
        finalDiagnosis: summary.finalDiagnosis,
        hospitalCourse: summary.hospitalCourse,
        conditionAtDischarge: summary.conditionAtDischarge,
      },
      medications: summary.dischargeMedications,
      instructions: {
        general: summary.dischargeInstructions,
        diet: summary.dietInstructions,
        activity: summary.activityInstructions,
        woundCare: summary.woundCareInstructions,
        warningSigns: summary.warningSigns,
      },
      followUp: summary.followUpAppointments,
      dischargedBy: summary.dischargedBy?.fullName,
      attendingPhysician: summary.attendingPhysician?.fullName,
    };
  }

  private async generateDischargeNumber(
    tid: string,
    manager: import('typeorm').EntityManager,
  ): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `DC${year}${month}`;

    // Serialize concurrent generation for this tenant+month; released on commit
    await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      `discharge_number:${tid}:${prefix}`,
    ]);

    const lastSummary = await manager
      .createQueryBuilder(DischargeSummary, 'discharge')
      .where('discharge.discharge_number LIKE :prefix', { prefix: `${prefix}%` })
      .andWhere('discharge.tenant_id = :tenantId', { tenantId: tid })
      .orderBy('discharge.discharge_number', 'DESC')
      .getOne();

    let sequence = 1;
    if (lastSummary) {
      const lastSequence = parseInt(lastSummary.dischargeNumber.slice(-5), 10);
      sequence = lastSequence + 1;
    }

    return `${prefix}${String(sequence).padStart(5, '0')}`;
  }
}
