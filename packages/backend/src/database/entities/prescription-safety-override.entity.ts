import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export interface SafetyAlert {
  kind: 'allergy' | 'interaction' | 'duplicate-therapy' | 'dose' | 'drug-disease';
  severity: 'moderate' | 'major' | 'severe' | 'contraindicated';
  drugId?: string;
  drugName: string;
  pairedDrugId?: string;
  pairedDrugName?: string;
  matchedAllergen?: string;
  matchedAllergyId?: string;
  diagnosisCode?: string;
  diagnosisName?: string;
  description: string;
  recommendation?: string;
}

/**
 * Audit record for any prescribe-time safety alert (DDI, allergy, duplicate
 * therapy) that a clinician overrides during prescription creation.
 *
 * Sibling of DrugInteractionOverride (which is for POS dispense overrides).
 * Both should be queryable for compliance reports.
 */
@Entity('prescription_safety_overrides')
@Index(['tenantId', 'prescriptionId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'overriddenById'])
export class PrescriptionSafetyOverride extends BaseEntity {
  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId: string;

  @Column({ name: 'patient_id', type: 'uuid', nullable: true })
  patientId?: string;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId?: string;

  @Column({ type: 'jsonb' })
  alerts: SafetyAlert[];

  @Column({ type: 'text' })
  reason: string;

  @Column({ name: 'overridden_by_id', type: 'uuid' })
  overriddenById: string;

  @Column({ name: 'overridden_at', type: 'timestamptz', default: () => 'now()' })
  overriddenAt: Date;

  /** True if a co-signing manager/pharmacist PIN was supplied at override time. */
  @Column({ name: 'cosigned', type: 'boolean', default: false })
  cosigned: boolean;

  @Column({ name: 'cosigner_id', type: 'uuid', nullable: true })
  cosignerId?: string;
}
