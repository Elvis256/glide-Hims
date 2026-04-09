import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource } from 'typeorm';
import { DischargeSummary, DischargeType } from '../../database/entities/discharge-summary.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateDischargeSummaryDto, DischargeSummaryFilterDto } from './dto/discharge.dto';

const DISCHARGEABLE_STATUSES: EncounterStatus[] = [
  EncounterStatus.ACTIVE,
  EncounterStatus.IN_PROGRESS,
];

@Injectable()
export class DischargeService {
  constructor(
    @InjectRepository(DischargeSummary)
    private dischargeSummaryRepository: Repository<DischargeSummary>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
    private dataSource: DataSource,
  ) {}

  async create(dto: CreateDischargeSummaryDto, userId: string, facilityId: string, tenantId?: string): Promise<DischargeSummary> {
    return this.dataSource.transaction(async (manager) => {
      // Validate encounter status — only ACTIVE/IN_PROGRESS encounters can be discharged
      const encounterWhere: any = { id: dto.encounterId };
      if (tenantId) encounterWhere.tenantId = tenantId;
      const encounter = await manager.findOne(Encounter, { where: encounterWhere });
      if (!encounter) {
        throw new NotFoundException('Encounter not found');
      }
      if (!DISCHARGEABLE_STATUSES.includes(encounter.status)) {
        throw new BadRequestException(
          `Cannot discharge encounter with status '${encounter.status}'. Only ACTIVE or IN_PROGRESS encounters can be discharged.`,
        );
      }

      // Check if discharge summary already exists for this encounter
      const existingWhere: any = { encounterId: dto.encounterId };
      if (tenantId) existingWhere.tenantId = tenantId;
      const existing = await manager.findOne(DischargeSummary, {
        where: existingWhere,
      });

      if (existing) {
        throw new BadRequestException('Discharge summary already exists for this encounter');
      }

      const dischargeNumber = await this.generateDischargeNumber(tenantId);

      const summary = manager.create(DischargeSummary, {
        ...dto,
        dischargeNumber,
        dischargeDate: new Date(dto.dischargeDate),
        facilityId,
        dischargedById: userId,
        ...(tenantId ? { tenantId } : {}),
      });

      const savedSummary = await manager.save(DischargeSummary, summary);

      // Update encounter status within same transaction
      await manager.update(
        Encounter,
        { id: dto.encounterId, ...(tenantId ? { tenantId } : {}) },
        {
          status: EncounterStatus.DISCHARGED,
          endTime: new Date(dto.dischargeDate),
        },
      );

      return savedSummary;
    });
  }

  async findAll(filter: DischargeSummaryFilterDto, facilityId: string, tenantId?: string): Promise<DischargeSummary[]> {
    const query = this.dischargeSummaryRepository.createQueryBuilder('discharge')
      .leftJoinAndSelect('discharge.patient', 'patient')
      .leftJoinAndSelect('discharge.encounter', 'encounter')
      .leftJoinAndSelect('discharge.dischargedBy', 'dischargedBy')
      .where('discharge.facility_id = :facilityId', { facilityId });

    if (tenantId) {
      query.andWhere('discharge.tenant_id = :tenantId', { tenantId });
    }

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
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
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
    const where: any = { encounterId };
    if (tenantId) where.tenantId = tenantId;
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
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;
    return this.dischargeSummaryRepository.find({
      where,
      relations: ['encounter', 'dischargedBy'],
      order: { dischargeDate: 'DESC' },
    });
  }

  async update(id: string, dto: Partial<CreateDischargeSummaryDto>, tenantId?: string): Promise<DischargeSummary> {
    const summary = await this.findOne(id, tenantId);
    Object.assign(summary, dto);
    return this.dischargeSummaryRepository.save(summary);
  }

  async getStats(facilityId: string, fromDate: Date, toDate: Date, tenantId?: string) {
    const tenantFilter = tenantId ? { tenantId } : {};
    const total = await this.dischargeSummaryRepository.count({
      where: {
        facilityId,
        dischargeDate: Between(fromDate, toDate),
        ...tenantFilter,
      },
    });

    const byTypeQb = this.dischargeSummaryRepository
      .createQueryBuilder('discharge')
      .select('discharge.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('discharge.facility_id = :facilityId', { facilityId })
      .andWhere('discharge.discharge_date BETWEEN :fromDate AND :toDate', { fromDate, toDate });

    if (tenantId) {
      byTypeQb.andWhere('discharge.tenant_id = :tenantId', { tenantId });
    }

    const byType = await byTypeQb
      .groupBy('discharge.type')
      .getRawMany();

    const amaCount = await this.dischargeSummaryRepository.count({
      where: {
        facilityId,
        type: DischargeType.AGAINST_MEDICAL_ADVICE,
        dischargeDate: Between(fromDate, toDate),
        ...tenantFilter,
      },
    });

    return {
      total,
      byType,
      amaRate: total > 0 ? (amaCount / total * 100).toFixed(2) : 0,
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

  private async generateDischargeNumber(tenantId?: string): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `DC${year}${month}`;

    const qb = this.dischargeSummaryRepository
      .createQueryBuilder('discharge')
      .where('discharge.discharge_number LIKE :prefix', { prefix: `${prefix}%` });

    if (tenantId) {
      qb.andWhere('discharge.tenant_id = :tenantId', { tenantId });
    }

    const lastSummary = await qb
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
