import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DischargeSummary, DischargeType } from '../../database/entities/discharge-summary.entity';
import { Encounter, EncounterStatus } from '../../database/entities/encounter.entity';
import { CreateDischargeSummaryDto, DischargeSummaryFilterDto } from './dto/discharge.dto';

@Injectable()
export class DischargeService {
  constructor(
    @InjectRepository(DischargeSummary)
    private dischargeSummaryRepository: Repository<DischargeSummary>,
    @InjectRepository(Encounter)
    private encounterRepository: Repository<Encounter>,
  ) {}

  async create(dto: CreateDischargeSummaryDto, userId: string, facilityId: string): Promise<DischargeSummary> {
    // Check if discharge summary already exists for this encounter
    const existing = await this.dischargeSummaryRepository.findOne({
      where: { encounterId: dto.encounterId },
    });

    if (existing) {
      throw new BadRequestException('Discharge summary already exists for this encounter');
    }

    const dischargeNumber = await this.generateDischargeNumber();

    const summary = this.dischargeSummaryRepository.create({
      ...dto,
      dischargeNumber,
      dischargeDate: new Date(dto.dischargeDate),
      facilityId,
      dischargedById: userId,
    });

    const savedSummary = await this.dischargeSummaryRepository.save(summary);

    // Update encounter status
    await this.encounterRepository.update(dto.encounterId, {
      status: EncounterStatus.DISCHARGED,
      endTime: new Date(dto.dischargeDate),
    });

    return savedSummary;
  }

  async findAll(filter: DischargeSummaryFilterDto, facilityId: string): Promise<DischargeSummary[]> {
    const query = this.dischargeSummaryRepository.createQueryBuilder('discharge')
      .leftJoinAndSelect('discharge.patient', 'patient')
      .leftJoinAndSelect('discharge.encounter', 'encounter')
      .leftJoinAndSelect('discharge.dischargedBy', 'dischargedBy')
      .where('discharge.facility_id = :facilityId', { facilityId });

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

  async findOne(id: string): Promise<DischargeSummary> {
    const summary = await this.dischargeSummaryRepository.findOne({
      where: { id },
      relations: ['patient', 'encounter', 'facility', 'dischargedBy', 'attendingPhysician'],
    });

    if (!summary) {
      throw new NotFoundException('Discharge summary not found');
    }

    return summary;
  }

  async findByEncounter(encounterId: string): Promise<DischargeSummary> {
    const summary = await this.dischargeSummaryRepository.findOne({
      where: { encounterId },
      relations: ['patient', 'dischargedBy', 'attendingPhysician'],
    });

    if (!summary) {
      throw new NotFoundException('Discharge summary not found for this encounter');
    }

    return summary;
  }

  async findByPatient(patientId: string): Promise<DischargeSummary[]> {
    return this.dischargeSummaryRepository.find({
      where: { patientId },
      relations: ['encounter', 'dischargedBy'],
      order: { dischargeDate: 'DESC' },
    });
  }

  async update(id: string, dto: Partial<CreateDischargeSummaryDto>): Promise<DischargeSummary> {
    const summary = await this.findOne(id);
    Object.assign(summary, dto);
    return this.dischargeSummaryRepository.save(summary);
  }

  async getStats(facilityId: string, fromDate: Date, toDate: Date) {
    const total = await this.dischargeSummaryRepository.count({
      where: {
        facilityId,
        dischargeDate: Between(fromDate, toDate),
      },
    });

    const byType = await this.dischargeSummaryRepository
      .createQueryBuilder('discharge')
      .select('discharge.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .where('discharge.facility_id = :facilityId', { facilityId })
      .andWhere('discharge.discharge_date BETWEEN :fromDate AND :toDate', { fromDate, toDate })
      .groupBy('discharge.type')
      .getRawMany();

    const amaCount = await this.dischargeSummaryRepository.count({
      where: {
        facilityId,
        type: DischargeType.AGAINST_MEDICAL_ADVICE,
        dischargeDate: Between(fromDate, toDate),
      },
    });

    return {
      total,
      byType,
      amaRate: total > 0 ? (amaCount / total * 100).toFixed(2) : 0,
    };
  }

  async printDischargeSummary(id: string): Promise<any> {
    const summary = await this.findOne(id);
    
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

  private async generateDischargeNumber(): Promise<string> {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const prefix = `DC${year}${month}`;

    const lastSummary = await this.dischargeSummaryRepository
      .createQueryBuilder('discharge')
      .where('discharge.discharge_number LIKE :prefix', { prefix: `${prefix}%` })
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
