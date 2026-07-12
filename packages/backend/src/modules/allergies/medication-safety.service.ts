import { Injectable, Logger, Inject, Optional, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AllergiesService } from './allergies.service';
import { DrugManagementService } from '../drug-management/drug-management.service';
import { DoseCheckService } from './dose-check.service';
import { DrugDiseaseService } from './drug-disease.service';
import { AuditLogService } from '../../common/interceptors/audit-log.service';
import {
  PrescriptionSafetyOverride,
  SafetyAlert,
} from '../../database/entities/prescription-safety-override.entity';
import { PatientActiveMedicationService } from '../prescriptions/patient-active-medication.service';
import { requireTenantId } from '../../common/utils/tenant.util';

export interface PrescriptionLineLite {
  drugId?: string;
  drugCode?: string;
  drugName: string;
  dose?: string;
  frequency?: string;
}

export interface RunSafetyChecksInput {
  patientId?: string;
  encounterId?: string;
  drugIds: string[];
  lines: PrescriptionLineLite[];
  tenantId?: string;
}

export interface SafetyResult {
  blocked: boolean;
  alerts: SafetyAlert[];
  /** Sub-set of alerts that are blocking (severity major/severe/contraindicated). */
  blockingAlerts: SafetyAlert[];
  /** True if a check failed unexpectedly (used for fail-closed behaviour). */
  degraded: boolean;
  degradedReasons: string[];
}

export interface RecordOverrideInput {
  prescriptionId: string;
  patientId?: string;
  encounterId?: string;
  alerts: SafetyAlert[];
  reason: string;
  overriddenById: string;
  cosignerId?: string;
  tenantId?: string;
}

/**
 * Central medication-safety helper.
 *
 * Single source of truth for DDI + allergy checks at any point in the
 * medication lifecycle (prescribe, dispense, administration). Behaviour:
 *
 *  • Alerts of severity major/severe/contraindicated are BLOCKING — caller
 *    must throw unless an override is supplied.
 *  • If an underlying check throws AND the patient has any active allergy or
 *    multiple drugs, the helper FAILS CLOSED (`degraded: true`, blocked) so
 *    we never silently dispense a potentially fatal combination.
 */
@Injectable()
export class MedicationSafetyService {
  private readonly logger = new Logger(MedicationSafetyService.name);

  constructor(
    @InjectRepository(PrescriptionSafetyOverride)
    private readonly overrideRepo: Repository<PrescriptionSafetyOverride>,
    private readonly allergiesService: AllergiesService,
    private readonly drugManagementService: DrugManagementService,
    private readonly doseCheckService: DoseCheckService,
    private readonly auditLog: AuditLogService,
    @Optional()
    @Inject(forwardRef(() => PatientActiveMedicationService))
    private readonly activeMedService: PatientActiveMedicationService | null,
    @Optional()
    private readonly drugDiseaseService: DrugDiseaseService | null,
  ) {}

  async runSafetyChecks(input: RunSafetyChecksInput): Promise<SafetyResult> {
    const { patientId, encounterId, drugIds, lines, tenantId } = input;
    const tid = requireTenantId(tenantId);
    const alerts: SafetyAlert[] = [];
    const degradedReasons: string[] = [];

    const drugIdToName = new Map<string, string>();
    for (let i = 0; i < drugIds.length && i < lines.length; i++) {
      drugIdToName.set(drugIds[i], lines[i]?.drugName || 'drug');
    }

    // ─── Cross-encounter active medication merge ─────────────────────────
    // Fetch the patient's active medications from prior encounters and merge
    // their drug IDs into the DDI check so we catch cross-encounter interactions.
    const allDrugIds = [...drugIds];
    if (patientId && this.activeMedService) {
      try {
        const activeMeds = await this.activeMedService.getActiveMedications(patientId, tenantId);
        for (const med of activeMeds) {
          if (med.drugId && !allDrugIds.includes(med.drugId)) {
            allDrugIds.push(med.drugId);
            drugIdToName.set(med.drugId, med.drugName);
          }
        }
      } catch (err: any) {
        this.logger.error(`Active medication lookup failed: ${err?.message}`, err?.stack);
        degradedReasons.push(`active medication lookup unavailable: ${err?.message}`);
      }
    }

    // ─── DDI ───────────────────────────────────────────────────────────────
    if (allDrugIds.length >= 2) {
      try {
        const r = await this.drugManagementService.checkInteractions(allDrugIds, tenantId);
        for (const i of r.interactions) {
          const sev = i.severity;
          if (sev === 'minor') continue;
          alerts.push({
            kind: 'interaction',
            severity: sev as SafetyAlert['severity'],
            drugId: i.drug1Id,
            drugName: drugIdToName.get(i.drug1Id) || 'drug',
            pairedDrugId: i.drug2Id,
            pairedDrugName: drugIdToName.get(i.drug2Id) || 'drug',
            description: i.description,
            recommendation: i.management,
          });
        }
      } catch (err: any) {
        this.logger.error(`DDI check failed: ${err?.message}`, err?.stack);
        degradedReasons.push(`drug-interaction check unavailable: ${err?.message}`);
      }
    }

    // ─── Allergy ───────────────────────────────────────────────────────────
    let activeAllergens: string[] = [];
    if (patientId) {
      try {
        activeAllergens = await this.allergiesService.getActiveAllergens(patientId, tenantId);
      } catch (err: any) {
        this.logger.error(`Allergy lookup failed: ${err?.message}`, err?.stack);
        degradedReasons.push(`allergy lookup unavailable: ${err?.message}`);
      }
    }

    if (activeAllergens.length > 0) {
      for (const drugId of drugIds) {
        try {
          const r = await this.drugManagementService.checkAllergyRisk(
            drugId,
            activeAllergens,
            tenantId,
          );
          if (r.hasRisk) {
            alerts.push({
              kind: 'allergy',
              severity: r.directMatch ? 'severe' : 'major',
              drugId,
              drugName: drugIdToName.get(drugId) || 'drug',
              matchedAllergen: r.matchedClasses.join(', ') || activeAllergens[0],
              description: r.directMatch
                ? `Drug matches recorded patient allergy (${r.matchedClasses.join(', ') || activeAllergens.join(', ')}).`
                : `Drug is cross-reactive with recorded allergy (${r.matchedClasses.join(', ')}).`,
              recommendation: 'Cancel order or document override with reason.',
            });
          }
        } catch (err: any) {
          this.logger.error(`Allergy check failed: ${err?.message}`, err?.stack);
          degradedReasons.push(
            `allergy check failed for drug ${drugIdToName.get(drugId) || drugId}: ${err?.message}`,
          );
        }
      }
    }

    // ─── Dose-range (CDS) ─────────────────────────────────────────────────
    try {
      const doseAlerts = await this.doseCheckService.runDoseChecks({
        patientId,
        tenantId,
        lines: lines.map((l) => ({
          drugId: l.drugId,
          drugName: l.drugName,
          dose: l.dose,
          frequency: l.frequency,
        })),
      });
      alerts.push(...doseAlerts);
    } catch (err: any) {
      this.logger.error(`Dose check failed: ${err?.message}`, err?.stack);
      degradedReasons.push(`dose-range check unavailable: ${err?.message}`);
    }

    // ─── Drug-Disease Contraindication ───────────────────────────────────
    if (patientId && this.drugDiseaseService) {
      try {
        const ddAlerts = await this.drugDiseaseService.checkDrugDiseaseInteractions({
          patientId,
          drugIds: allDrugIds,
          drugIdToName,
          encounterId,
          tenantId,
        });
        alerts.push(...ddAlerts);
      } catch (err: any) {
        this.logger.error(`Drug-disease check failed: ${err?.message}`, err?.stack);
        degradedReasons.push(`drug-disease check unavailable: ${err?.message}`);
      }
    }

    const blockingAlerts = alerts.filter(
      (a) => a.severity === 'major' || a.severity === 'severe' || a.severity === 'contraindicated',
    );

    // Fail-closed: degraded checks block when patient has known allergies
    // or is being prescribed multiple drugs (where DDI matters).
    const degraded = degradedReasons.length > 0;
    const failClosed = degraded && (activeAllergens.length > 0 || drugIds.length >= 2);

    return {
      blocked: blockingAlerts.length > 0 || failClosed,
      alerts,
      blockingAlerts,
      degraded,
      degradedReasons,
    };
  }

  async recordOverride(input: RecordOverrideInput): Promise<PrescriptionSafetyOverride> {
    const tid = requireTenantId(input.tenantId);
    const row = this.overrideRepo.create({
      prescriptionId: input.prescriptionId,
      patientId: input.patientId,
      encounterId: input.encounterId,
      alerts: input.alerts,
      reason: input.reason,
      overriddenById: input.overriddenById,
      cosignerId: input.cosignerId,
      cosigned: !!input.cosignerId,
      overriddenAt: new Date(),
      tenantId: tid,
    });
    const saved = await this.overrideRepo.save(row);

    void this.auditLog
      .log({
        userId: input.overriddenById,
        tenantId: input.tenantId,
        action: 'RX_SAFETY_OVERRIDE',
        entityType: 'prescription_safety_overrides',
        entityId: saved.id,
        newValue: {
          patientId: input.patientId,
          prescriptionId: input.prescriptionId,
          encounterId: input.encounterId,
          alertCount: input.alerts?.length ?? 0,
          alertSeverities: (input.alerts || []).map((a) => a.severity),
          alertKinds: (input.alerts || []).map((a) => a.kind),
          cosignerId: input.cosignerId,
        },
        reason: input.reason,
      })
      .catch((e) => this.logger.warn(`Audit (Rx override) failed: ${e?.message}`));

    return saved;
  }
}
