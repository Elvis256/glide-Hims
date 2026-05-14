import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';

/**
 * FHIR AllergyIntolerance-aligned allergy record.
 * One row per allergen per patient. Replaces the legacy
 * `patient.allergies: string[]` blob (which is retained for backward
 * compatibility but no longer authoritative).
 */
export type AllergyType = 'allergy' | 'intolerance';
export type AllergyCategory = 'medication' | 'food' | 'environment' | 'biologic' | 'other';
export type AllergyCriticality = 'low' | 'high' | 'unable-to-assess';
export type AllergySeverity = 'mild' | 'moderate' | 'severe';
export type AllergyStatus = 'active' | 'inactive' | 'resolved' | 'entered-in-error';
export type AllergyVerification = 'unconfirmed' | 'confirmed' | 'refuted';
export type AllergySource = 'patient-reported' | 'family-reported' | 'observed' | 'imported';

@Entity('patient_allergies')
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'patientId', 'allergenNormalized'])
@Index(['tenantId', 'status'])
export class PatientAllergy extends BaseEntity {
  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  /** Free-text allergen name as recorded (e.g. "Penicillin", "Peanuts"). */
  @Column({ type: 'varchar', length: 255 })
  allergen: string;

  /** Lower-cased trimmed allergen for fast equality lookup. */
  @Column({ name: 'allergen_normalized', type: 'varchar', length: 255 })
  allergenNormalized: string;

  /** Coded allergen identifier (SNOMED CT, RxNorm, ATC, etc.). */
  @Column({ name: 'allergen_code', type: 'varchar', length: 100, nullable: true })
  allergenCode?: string;

  @Column({ name: 'code_system', type: 'varchar', length: 50, nullable: true })
  codeSystem?: string;

  @Column({ type: 'varchar', length: 20, default: 'allergy' })
  type: AllergyType;

  @Column({ type: 'varchar', length: 20, default: 'medication' })
  category: AllergyCategory;

  @Column({ type: 'varchar', length: 20, default: 'unable-to-assess' })
  criticality: AllergyCriticality;

  @Column({ type: 'varchar', length: 20, nullable: true })
  severity?: AllergySeverity;

  /** Free-text reaction description (e.g. "anaphylaxis", "rash"). */
  @Column({ type: 'text', nullable: true })
  reaction?: string;

  @Column({ type: 'varchar', length: 30, default: 'active' })
  status: AllergyStatus;

  @Column({ type: 'varchar', length: 30, default: 'unconfirmed' })
  verification: AllergyVerification;

  @Column({ type: 'varchar', length: 30, default: 'patient-reported' })
  source: AllergySource;

  @Column({ name: 'onset_date', type: 'date', nullable: true })
  onsetDate?: Date;

  @Column({ name: 'recorded_by_id', type: 'uuid', nullable: true })
  recordedById?: string;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'now()' })
  recordedAt: Date;

  @Column({ name: 'last_reaction_at', type: 'timestamptz', nullable: true })
  lastReactionAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
