import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { Diagnosis } from './diagnosis.entity';

export enum ProblemStatus {
  ACTIVE = 'active',
  CHRONIC = 'chronic',
  RESOLVED = 'resolved',
  INACTIVE = 'inactive',
}

export enum ProblemSeverity {
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
  CRITICAL = 'critical',
}

@Entity('patient_problems')
@Index(['patientId', 'diagnosisId', 'status'], { where: 'deleted_at IS NULL' })
@Index(['facilityId', 'status'])
@Index(['patientId', 'onsetDate'])
export class PatientProblem extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', nullable: true, name: 'diagnosis_id' })
  diagnosisId?: string;

  @ManyToOne(() => Diagnosis, { eager: true, nullable: true })
  @JoinColumn({ name: 'diagnosis_id' })
  diagnosis?: Diagnosis;

  // For custom diagnoses not in the ICD-10 list
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'custom_diagnosis' })
  customDiagnosis?: string;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'custom_icd_code' })
  customIcdCode?: string;

  @Column({
    type: 'enum',
    enum: ProblemStatus,
    default: ProblemStatus.ACTIVE,
  })
  status: ProblemStatus;

  @Column({
    type: 'enum',
    enum: ProblemSeverity,
    nullable: true,
  })
  severity?: ProblemSeverity;

  @Column({ type: 'date', name: 'onset_date' })
  onsetDate: Date;

  @Column({ type: 'date', nullable: true, name: 'resolved_date' })
  resolvedDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'uuid', nullable: true, name: 'diagnosed_by' })
  diagnosedById?: string;

  @Column({ type: 'uuid', nullable: true, name: 'encounter_id' })
  encounterId?: string;

  @Column({ type: 'timestamp', name: 'last_reviewed_at', nullable: true })
  lastReviewedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'last_reviewed_by' })
  lastReviewedById?: string;

  // Helper to get the diagnosis name (from linked diagnosis or custom)
  get diagnosisName(): string {
    return this.diagnosis?.name || this.customDiagnosis || '';
  }

  // Helper to get the ICD code
  get icdCode(): string {
    return this.diagnosis?.icd10Code || this.customIcdCode || '';
  }
}
