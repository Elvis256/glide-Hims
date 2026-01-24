import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';

export enum TreatmentPlanStatus {
  DRAFT = 'draft',
  ACTIVE = 'active',
  ON_HOLD = 'on_hold',
  COMPLETED = 'completed',
  DISCONTINUED = 'discontinued',
  REVISED = 'revised',
}

export enum TreatmentPlanType {
  ACUTE = 'acute',
  CHRONIC = 'chronic',
  PREVENTIVE = 'preventive',
  PALLIATIVE = 'palliative',
  REHABILITATION = 'rehabilitation',
  SURGICAL = 'surgical',
  MENTAL_HEALTH = 'mental_health',
}

export enum TreatmentGoalStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  ACHIEVED = 'achieved',
  PARTIALLY_ACHIEVED = 'partially_achieved',
  NOT_ACHIEVED = 'not_achieved',
}

@Entity('treatment_plans')
@Index(['planNumber'], { unique: true })
@Index(['patient', 'status'])
@Index(['createdAt'])
export class TreatmentPlan extends BaseEntity {
  @Column({ name: 'plan_number', unique: true })
  planNumber: string;

  @Column({ name: 'plan_name' })
  planName: string;

  @Column({
    type: 'enum',
    enum: TreatmentPlanType,
    default: TreatmentPlanType.ACUTE,
  })
  type: TreatmentPlanType;

  @Column({
    type: 'enum',
    enum: TreatmentPlanStatus,
    default: TreatmentPlanStatus.DRAFT,
  })
  status: TreatmentPlanStatus;

  @Column({ name: 'primary_diagnosis', type: 'text' })
  primaryDiagnosis: string;

  @Column({ name: 'diagnosis_codes', type: 'jsonb', nullable: true })
  diagnosisCodes: { code: string; name: string; type: 'primary' | 'secondary' }[];

  @Column({ name: 'clinical_summary', type: 'text', nullable: true })
  clinicalSummary: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'expected_end_date', type: 'date', nullable: true })
  expectedEndDate: Date;

  @Column({ name: 'actual_end_date', type: 'date', nullable: true })
  actualEndDate: Date;

  @Column({ type: 'jsonb', nullable: true })
  goals: {
    id: string;
    description: string;
    targetDate: string;
    status: TreatmentGoalStatus;
    measurementCriteria: string;
    notes: string;
  }[];

  @Column({ type: 'jsonb', nullable: true })
  interventions: {
    id: string;
    type: 'medication' | 'procedure' | 'therapy' | 'lifestyle' | 'monitoring' | 'referral';
    description: string;
    frequency: string;
    startDate: string;
    endDate?: string;
    responsibleProvider?: string;
    status: 'active' | 'completed' | 'discontinued';
    notes?: string;
  }[];

  @Column({ name: 'medications', type: 'jsonb', nullable: true })
  medications: {
    drugName: string;
    dosage: string;
    frequency: string;
    route: string;
    duration: string;
    specialInstructions?: string;
  }[];

  @Column({ name: 'monitoring_parameters', type: 'jsonb', nullable: true })
  monitoringParameters: {
    parameter: string;
    frequency: string;
    targetRange?: string;
    lastValue?: string;
    lastDate?: string;
  }[];

  @Column({ name: 'lifestyle_modifications', type: 'jsonb', nullable: true })
  lifestyleModifications: {
    category: 'diet' | 'exercise' | 'smoking' | 'alcohol' | 'sleep' | 'stress' | 'other';
    recommendation: string;
    details?: string;
  }[];

  @Column({ name: 'patient_education', type: 'text', nullable: true })
  patientEducation: string;

  @Column({ name: 'follow_up_schedule', type: 'jsonb', nullable: true })
  followUpSchedule: {
    date: string;
    purpose: string;
    provider?: string;
    status: 'scheduled' | 'completed' | 'missed' | 'cancelled';
  }[];

  @Column({ name: 'precautions', type: 'text', nullable: true })
  precautions: string;

  @Column({ name: 'contraindications', type: 'text', nullable: true })
  contraindications: string;

  @Column({ name: 'allergies_considered', type: 'jsonb', nullable: true })
  allergiesConsidered: string[];

  @Column({ name: 'patient_consent_obtained', default: false })
  patientConsentObtained: boolean;

  @Column({ name: 'consent_date', type: 'timestamptz', nullable: true })
  consentDate: Date;

  @Column({ name: 'revision_number', default: 1 })
  revisionNumber: number;

  @Column({ name: 'revision_reason', type: 'text', nullable: true })
  revisionReason: string;

  @Column({ name: 'previous_plan_id', nullable: true })
  previousPlanId: string;

  @Column({ type: 'jsonb', nullable: true })
  progressNotes: {
    date: string;
    note: string;
    provider: string;
  }[];

  // Relationships
  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id', nullable: true })
  encounterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'primary_provider_id' })
  primaryProvider: User;

  @Column({ name: 'primary_provider_id', nullable: true })
  primaryProviderId: string;

  @Column({ name: 'care_team', type: 'jsonb', nullable: true })
  careTeam: {
    providerId: string;
    name: string;
    role: string;
    specialty?: string;
  }[];
}
