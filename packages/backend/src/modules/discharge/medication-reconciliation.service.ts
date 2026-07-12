import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import {
  MedicationReconciliation,
  MedicationReconciliationItem,
  ReconciliationStatus,
  ReconciliationSourceType,
  ReconciliationItemStatus,
} from '../../database/entities/medication-reconciliation.entity';
import {
  PatientActiveMedication,
  ActiveMedicationStatus,
} from '../../database/entities/patient-active-medication.entity';
import { Prescription, PrescriptionItem } from '../../database/entities/prescription.entity';
import { DischargeSummary } from '../../database/entities/discharge-summary.entity';
import { requireTenantId } from '../../common/utils/tenant.util';

@Injectable()
export class MedicationReconciliationService {
  private readonly logger = new Logger(MedicationReconciliationService.name);

  constructor(
    @InjectRepository(MedicationReconciliation)
    private readonly reconRepo: Repository<MedicationReconciliation>,
    @InjectRepository(MedicationReconciliationItem)
    private readonly itemRepo: Repository<MedicationReconciliationItem>,
    @InjectRepository(PatientActiveMedication)
    private readonly activeMedRepo: Repository<PatientActiveMedication>,
    @InjectRepository(Prescription)
    private readonly prescriptionRepo: Repository<Prescription>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Auto-populate reconciliation from active medications + encounter prescriptions.
   * Called during discharge summary creation.
   */
  async initializeReconciliation(params: {
    encounterId: string;
    patientId: string;
    facilityId: string;
    dischargeSummaryId: string;
    tenantId?: string;
  }): Promise<MedicationReconciliation> {
    const { encounterId, patientId, facilityId, dischargeSummaryId, tenantId } = params;
    const tid = requireTenantId(tenantId);

    // Check for existing reconciliation
    const existing = await this.reconRepo.findOne({
      where: {
        encounterId,
        tenantId: tid,
      },
    });
    if (existing) return existing;

    return this.dataSource.transaction(async (manager) => {
      const recon = manager.create(MedicationReconciliation, {
        encounterId,
        patientId,
        facilityId,
        dischargeSummaryId,
        status: ReconciliationStatus.DRAFT,
        tenantId: tid,
      });
      const savedRecon = await manager.save(recon);

      const items: Partial<MedicationReconciliationItem>[] = [];

      // 1. Pull active medications from prior encounters
      const activeMeds = await manager.find(PatientActiveMedication, {
        where: {
          patientId,
          status: ActiveMedicationStatus.ACTIVE,
          tenantId: tid,
        },
      });

      const seenDrugNames = new Set<string>();
      for (const med of activeMeds) {
        seenDrugNames.add(med.drugName.toLowerCase());
        items.push({
          reconciliationId: savedRecon.id,
          sourceType: ReconciliationSourceType.ACTIVE_MEDICATION,
          sourceId: med.id,
          drugName: med.drugName,
          genericName: med.genericName,
          dose: med.dose,
          frequency: med.frequency,
          route: med.route,
          duration: med.duration,
          reconciliationStatus: ReconciliationItemStatus.PENDING_REVIEW,
          tenantId: tid,
        });
      }

      // 2. Pull prescriptions from the current encounter
      const prescriptions = await manager.find(Prescription, {
        where: {
          encounterId,
          tenantId: tid,
        },
        relations: ['items'],
      });

      for (const rx of prescriptions) {
        for (const item of rx.items || []) {
          // Skip if already covered by an active medication record
          if (seenDrugNames.has(item.drugName.toLowerCase())) continue;
          seenDrugNames.add(item.drugName.toLowerCase());

          items.push({
            reconciliationId: savedRecon.id,
            sourceType: ReconciliationSourceType.ENCOUNTER_PRESCRIPTION,
            sourceId: item.id,
            drugName: item.drugName,
            dose: item.dose,
            frequency: item.frequency,
            duration: item.duration,
            instructions: item.instructions,
            reconciliationStatus: ReconciliationItemStatus.PENDING_REVIEW,
            tenantId: tid,
          });
        }
      }

      if (items.length > 0) {
        const itemEntities = items.map((i) => manager.create(MedicationReconciliationItem, i));
        await manager.save(itemEntities);
      }

      return savedRecon;
    });
  }

  async findByDischarge(
    dischargeSummaryId: string,
    tenantId?: string,
  ): Promise<MedicationReconciliation | null> {
    const tid = requireTenantId(tenantId);
    return this.reconRepo.findOne({
      where: { dischargeSummaryId, tenantId: tid },
      relations: ['items'],
    });
  }

  async findById(
    id: string,
    tenantId?: string,
  ): Promise<MedicationReconciliation> {
    const tid = requireTenantId(tenantId);
    const recon = await this.reconRepo.findOne({
      where: { id, tenantId: tid },
      relations: ['items'],
    });
    if (!recon) throw new NotFoundException('Medication reconciliation not found');
    return recon;
  }

  async updateItem(
    itemId: string,
    dto: {
      reconciliationStatus?: ReconciliationItemStatus;
      dischargeDose?: string;
      dischargeFrequency?: string;
      dischargeDuration?: string;
      dischargeInstructions?: string;
      reason?: string;
    },
    userId: string,
    tenantId?: string,
  ): Promise<MedicationReconciliationItem> {
    const tid = requireTenantId(tenantId);
    const item = await this.itemRepo.findOne({
      where: { id: itemId, tenantId: tid },
    });
    if (!item) throw new NotFoundException('Reconciliation item not found');

    if (dto.reconciliationStatus) item.reconciliationStatus = dto.reconciliationStatus;
    if (dto.dischargeDose !== undefined) item.dischargeDose = dto.dischargeDose;
    if (dto.dischargeFrequency !== undefined) item.dischargeFrequency = dto.dischargeFrequency;
    if (dto.dischargeDuration !== undefined) item.dischargeDuration = dto.dischargeDuration;
    if (dto.dischargeInstructions !== undefined) item.dischargeInstructions = dto.dischargeInstructions;
    if (dto.reason !== undefined) item.reason = dto.reason;
    item.reviewedById = userId;
    item.reviewedAt = new Date();

    return this.itemRepo.save(item);
  }

  /**
   * Complete the reconciliation: validates all items reviewed, stops discontinued
   * active medications, and copies final med list to discharge summary JSONB.
   */
  async completeReconciliation(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<MedicationReconciliation> {
    const tid = requireTenantId(tenantId);
    const recon = await this.findById(id, tenantId);

    if (recon.status === ReconciliationStatus.COMPLETED || recon.status === ReconciliationStatus.SIGNED) {
      throw new BadRequestException('Reconciliation is already completed');
    }

    // Validate all items are reviewed
    const unreviewed = (recon.items || []).filter(
      (i) => i.reconciliationStatus === ReconciliationItemStatus.PENDING_REVIEW,
    );
    if (unreviewed.length > 0) {
      throw new BadRequestException(
        `${unreviewed.length} item(s) still pending review`,
      );
    }

    return this.dataSource.transaction(async (manager) => {
      // Stop discontinued active medications
      const discontinuedItems = (recon.items || []).filter(
        (i) =>
          i.reconciliationStatus === ReconciliationItemStatus.DISCONTINUED &&
          i.sourceType === ReconciliationSourceType.ACTIVE_MEDICATION &&
          i.sourceId,
      );

      if (discontinuedItems.length > 0) {
        const ids = discontinuedItems.map((i) => i.sourceId!);
        const activeMeds = await manager.find(PatientActiveMedication, {
          where: ids.map((sourceId) => ({
            id: sourceId,
            status: ActiveMedicationStatus.ACTIVE,
            tenantId: tid,
          })),
        });

        const now = new Date();
        for (const med of activeMeds) {
          med.status = ActiveMedicationStatus.STOPPED;
          med.stoppedById = userId;
          med.stoppedReason = 'Discontinued at discharge';
          med.actualEndDate = now;
        }
        if (activeMeds.length > 0) {
          await manager.save(activeMeds);
        }
      }

      // Update reconciliation status
      recon.status = ReconciliationStatus.COMPLETED;
      recon.completedById = userId;
      recon.completedAt = new Date();
      const saved = await manager.save(recon);

      // Copy final medication list to discharge summary for backward compat
      try {
        const dischargeMeds = (recon.items || [])
          .filter(
            (i) =>
              i.reconciliationStatus !== ReconciliationItemStatus.DISCONTINUED,
          )
          .map((i) => ({
            drugName: i.drugName,
            dosage: i.dischargeDose || i.dose || '',
            frequency: i.dischargeFrequency || i.frequency || '',
            route: i.route || '',
            duration: i.dischargeDuration || i.duration || '',
            instructions: i.dischargeInstructions || i.instructions || '',
            isNew: i.reconciliationStatus === ReconciliationItemStatus.NEW_AT_DISCHARGE,
          }));

        await manager.update(
          DischargeSummary,
          { id: recon.dischargeSummaryId },
          {
            dischargeMedications: dischargeMeds,
            medicationReconciliationId: saved.id,
          },
        );
      } catch (e: any) {
        this.logger.warn(`Failed to sync discharge meds JSONB: ${e?.message}`);
      }

      return saved;
    });
  }

  /** Physician sign-off on a completed reconciliation. */
  async signReconciliation(
    id: string,
    userId: string,
    tenantId?: string,
  ): Promise<MedicationReconciliation> {
    requireTenantId(tenantId);
    const recon = await this.findById(id, tenantId);

    if (recon.status !== ReconciliationStatus.COMPLETED) {
      throw new BadRequestException('Reconciliation must be completed before signing');
    }

    recon.status = ReconciliationStatus.SIGNED;
    recon.signedById = userId;
    recon.signedAt = new Date();

    return this.reconRepo.save(recon);
  }
}
