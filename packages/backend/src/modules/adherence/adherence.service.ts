import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import {
  MedicationAdherenceRecord,
  AdherenceStatus,
} from '../../database/entities/medication-adherence.entity';
import { Prescription, PrescriptionItem } from '../../database/entities/prescription.entity';
import { RecordAdherenceDto } from './dto/adherence.dto';

// Map common frequency codes to number of daily doses
const FREQUENCY_MAP: Record<string, string[]> = {
  OD: ['08:00'],
  BD: ['08:00', '20:00'],
  BID: ['08:00', '20:00'],
  TDS: ['08:00', '14:00', '20:00'],
  TID: ['08:00', '14:00', '20:00'],
  QDS: ['06:00', '12:00', '18:00', '22:00'],
  QID: ['06:00', '12:00', '18:00', '22:00'],
  STAT: ['08:00'],
  PRN: ['08:00'],
  NOCTE: ['22:00'],
  MANE: ['08:00'],
};

function parseDurationDays(duration: string): number {
  const match = duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  if (!match) return 7; // default 7 days
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('week')) return num * 7;
  if (unit.startsWith('month')) return num * 30;
  return num;
}

function getTimeSlotsForFrequency(frequency: string): string[] {
  const upper = frequency.toUpperCase().trim();
  return FREQUENCY_MAP[upper] || ['08:00'];
}

@Injectable()
export class AdherenceService {
  private readonly logger = new Logger(AdherenceService.name);

  constructor(
    @InjectRepository(MedicationAdherenceRecord)
    private adherenceRepo: Repository<MedicationAdherenceRecord>,
    @InjectRepository(Prescription)
    private prescriptionRepo: Repository<Prescription>,
    @InjectRepository(PrescriptionItem)
    private prescriptionItemRepo: Repository<PrescriptionItem>,
  ) {}

  async generateSchedule(prescriptionId: string, tenantId?: string) {
    const where: any = { id: prescriptionId };
    if (tenantId) where.tenantId = tenantId;

    const prescription = await this.prescriptionRepo.findOne({
      where,
      relations: ['items', 'encounter'],
    });

    if (!prescription) {
      throw new NotFoundException('Prescription not found');
    }

    const records: MedicationAdherenceRecord[] = [];
    const startDate = new Date();

    for (const item of prescription.items) {
      const durationDays = parseDurationDays(item.duration);
      const timeSlots = getTimeSlotsForFrequency(item.frequency);

      // Check if schedule already exists for this item
      const existingCount = await this.adherenceRepo.count({
        where: { prescriptionItemId: item.id, ...(tenantId ? { tenantId } : {}) },
      });
      if (existingCount > 0) continue;

      for (let day = 0; day < durationDays; day++) {
        const scheduledDate = new Date(startDate);
        scheduledDate.setDate(scheduledDate.getDate() + day);

        for (const time of timeSlots) {
          const record = this.adherenceRepo.create({
            patientId: prescription.encounter
              ? (prescription.encounter as any).patientId
              : '',
            prescriptionItemId: item.id,
            scheduledDate,
            scheduledTime: time,
            status: AdherenceStatus.PENDING,
            ...(tenantId ? { tenantId } : {}),
          });
          records.push(record);
        }
      }
    }

    if (records.length > 0) {
      await this.adherenceRepo.save(records);
    }

    return { generated: records.length, prescriptionId };
  }

  async recordAdherence(recordId: string, dto: RecordAdherenceDto, tenantId?: string) {
    const where: any = { id: recordId };
    if (tenantId) where.tenantId = tenantId;

    const record = await this.adherenceRepo.findOne({ where });
    if (!record) {
      throw new NotFoundException('Adherence record not found');
    }

    if (record.status !== AdherenceStatus.PENDING) {
      throw new BadRequestException('Record has already been updated');
    }

    if (dto.status === 'taken') {
      record.status = AdherenceStatus.TAKEN;
      record.takenAt = new Date();
    } else if (dto.status === 'skipped') {
      record.status = AdherenceStatus.SKIPPED;
      record.skippedAt = new Date();
      record.skipReason = dto.skipReason || undefined;
    }

    return this.adherenceRepo.save(record);
  }

  async getPatientAdherence(
    patientId: string,
    dateFrom?: string,
    dateTo?: string,
    tenantId?: string,
  ) {
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;

    if (dateFrom && dateTo) {
      where.scheduledDate = Between(new Date(dateFrom), new Date(dateTo));
    } else if (dateFrom) {
      where.scheduledDate = MoreThanOrEqual(new Date(dateFrom));
    } else if (dateTo) {
      where.scheduledDate = LessThanOrEqual(new Date(dateTo));
    }

    return this.adherenceRepo.find({
      where,
      relations: ['prescriptionItem'],
      order: { scheduledDate: 'ASC', scheduledTime: 'ASC' },
    });
  }

  async getAdherenceSummary(patientId: string, tenantId?: string) {
    const where: any = { patientId };
    if (tenantId) where.tenantId = tenantId;

    const totalRecords = await this.adherenceRepo.count({ where });
    const takenRecords = await this.adherenceRepo.count({
      where: { ...where, status: AdherenceStatus.TAKEN },
    });
    const skippedRecords = await this.adherenceRepo.count({
      where: { ...where, status: AdherenceStatus.SKIPPED },
    });
    const missedRecords = await this.adherenceRepo.count({
      where: { ...where, status: AdherenceStatus.MISSED },
    });
    const pendingRecords = await this.adherenceRepo.count({
      where: { ...where, status: AdherenceStatus.PENDING },
    });

    // Adherence rate = taken / (taken + skipped + missed)
    const completedDoses = takenRecords + skippedRecords + missedRecords;
    const adherenceRate = completedDoses > 0
      ? Math.round((takenRecords / completedDoses) * 100)
      : 0;

    // Get current medications (items with pending adherence records)
    const currentMedications = await this.adherenceRepo
      .createQueryBuilder('ar')
      .select('DISTINCT ar.prescription_item_id', 'prescriptionItemId')
      .where('ar.patient_id = :patientId', { patientId })
      .andWhere('ar.status = :status', { status: AdherenceStatus.PENDING })
      .andWhere(tenantId ? 'ar.tenant_id = :tenantId' : '1=1', tenantId ? { tenantId } : {})
      .getRawMany();

    return {
      adherenceRate,
      totalScheduled: totalRecords,
      taken: takenRecords,
      skipped: skippedRecords,
      missed: missedRecords,
      pending: pendingRecords,
      currentMedicationsCount: currentMedications.length,
    };
  }
}
