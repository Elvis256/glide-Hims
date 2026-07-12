import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual, In } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import {
  PatientActiveMedication,
  ActiveMedicationStatus,
} from '../../database/entities/patient-active-medication.entity';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface ActivateFromDispensationParams {
  patientId: string;
  encounterId: string;
  prescriptionId: string;
  prescriptionItemId: string;
  drugId?: string;
  drugCode: string;
  drugName: string;
  genericName?: string;
  dose: string;
  frequency: string;
  route?: string;
  duration?: string;
  facilityId: string;
  tenantId?: string;
}

/** Parse duration strings like "5 days", "2 weeks", "1 month", "14/7" (Uganda shorthand for 14 days). */
function parseDurationToDays(duration: string | undefined | null): number | null {
  if (!duration) return null;
  const trimmed = duration.trim().toLowerCase();

  // Uganda shorthand: "14/7" means 14 days
  const slashMatch = trimmed.match(/^(\d+)\s*\/\s*7$/);
  if (slashMatch) return parseInt(slashMatch[1], 10);

  const numMatch = trimmed.match(/^(\d+)\s*(day|days|week|weeks|month|months)$/);
  if (!numMatch) return null;

  const num = parseInt(numMatch[1], 10);
  const unit = numMatch[2];

  if (unit.startsWith('day')) return num;
  if (unit.startsWith('week')) return num * 7;
  if (unit.startsWith('month')) return num * 30;

  return null;
}

@Injectable()
export class PatientActiveMedicationService {
  private readonly logger = new Logger(PatientActiveMedicationService.name);

  constructor(
    @InjectRepository(PatientActiveMedication)
    private readonly repo: Repository<PatientActiveMedication>,
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Called from PrescriptionsService.dispenseItem() after successful dispensation.
   * Creates an active medication record so the drug appears in cross-encounter DDI checks.
   */
  async activateFromDispensation(params: ActivateFromDispensationParams): Promise<PatientActiveMedication> {
    const tid = requireTenantId(params.tenantId);
    // Avoid duplicates for the same prescription item
    const existing = await this.repo.findOne({
      where: {
        prescriptionItemId: params.prescriptionItemId,
        status: ActiveMedicationStatus.ACTIVE,
        tenantId: tid,
      },
    });
    if (existing) return existing;

    const startDate = new Date();
    const durationDays = parseDurationToDays(params.duration);
    let expectedEndDate: Date | null = null;
    if (durationDays) {
      expectedEndDate = new Date(startDate);
      expectedEndDate.setDate(expectedEndDate.getDate() + durationDays);
    }

    const record = this.repo.create({
      patientId: params.patientId,
      encounterId: params.encounterId,
      prescriptionId: params.prescriptionId,
      prescriptionItemId: params.prescriptionItemId,
      drugId: params.drugId || null,
      drugCode: params.drugCode,
      drugName: params.drugName,
      genericName: params.genericName || null,
      dose: params.dose,
      frequency: params.frequency,
      route: params.route || null,
      duration: params.duration || null,
      startDate,
      expectedEndDate,
      status: ActiveMedicationStatus.ACTIVE,
      facilityId: params.facilityId,
      tenantId: tid,
    });

    return this.repo.save(record);
  }

  /** Returns all active medications for a patient (cross-encounter). */
  async getActiveMedications(
    patientId: string,
    tenantId?: string,
  ): Promise<PatientActiveMedication[]> {
    const tid = requireTenantId(tenantId);
    return this.repo.find({
      where: {
        patientId,
        status: ActiveMedicationStatus.ACTIVE,
        tenantId: tid,
      },
      order: { startDate: 'DESC' },
    });
  }

  /** Returns all medications (any status) for a patient, for history view. */
  async getMedicationHistory(
    patientId: string,
    tenantId?: string,
    page = 1,
    limit = 50,
  ): Promise<{ data: PatientActiveMedication[]; total: number }> {
    const tid = requireTenantId(tenantId);
    const [data, total] = await this.repo.findAndCount({
      where: {
        patientId,
        tenantId: tid,
      },
      order: { startDate: 'DESC' },
      take: Math.min(limit, 200),
      skip: (page - 1) * limit,
    });
    return { data, total };
  }

  /** Manually stop a medication with reason and audit log. */
  async stopMedication(
    id: string,
    userId: string,
    reason: string,
    tenantId?: string,
  ): Promise<PatientActiveMedication> {
    const tid = requireTenantId(tenantId);
    const med = await this.repo.findOne({
      where: { id, tenantId: tid },
    });
    if (!med) throw new NotFoundException('Active medication not found');
    if (med.status !== ActiveMedicationStatus.ACTIVE) {
      throw new NotFoundException('Medication is not active');
    }

    med.status = ActiveMedicationStatus.STOPPED;
    med.stoppedById = userId;
    med.stoppedReason = reason;
    med.actualEndDate = new Date();

    const saved = await this.repo.save(med);

    void this.auditLog
      .log({
        userId,
        tenantId,
        action: 'ACTIVE_MEDICATION_STOPPED',
        entityType: 'patient_active_medications',
        entityId: saved.id,
        newValue: { patientId: med.patientId, drugName: med.drugName, reason },
      })
      .catch((e) => this.logger.warn(`Audit failed: ${e?.message}`));

    return saved;
  }

  /** Cron: every 6 hours, auto-expire medications past their expectedEndDate. */
  @Cron('0 */6 * * *')
  async expireCompletedMedications(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = await this.repo.find({
      where: {
        status: ActiveMedicationStatus.ACTIVE,
        expectedEndDate: LessThanOrEqual(today),
      },
    });

    if (expired.length === 0) return;

    this.logger.log(`Auto-expiring ${expired.length} medication(s) past expected end date`);

    for (const med of expired) {
      med.status = ActiveMedicationStatus.EXPIRED;
      med.actualEndDate = today;
    }

    await this.repo.save(expired);
  }

  /** Bulk-stop active meds (used by medication reconciliation at discharge). */
  async stopMedications(
    ids: string[],
    userId: string,
    reason: string,
    tenantId?: string,
  ): Promise<void> {
    const tid = requireTenantId(tenantId);
    if (ids.length === 0) return;
    const meds = await this.repo.find({
      where: {
        id: In(ids),
        status: ActiveMedicationStatus.ACTIVE,
        tenantId: tid,
      },
    });

    const now = new Date();
    for (const med of meds) {
      med.status = ActiveMedicationStatus.STOPPED;
      med.stoppedById = userId;
      med.stoppedReason = reason;
      med.actualEndDate = now;
    }

    await this.repo.save(meds);
  }
}
