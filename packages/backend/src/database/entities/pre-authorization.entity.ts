import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { InsurancePolicy } from './insurance-policy.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

export enum PreAuthStatus {
  PENDING = 'pending',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  PARTIALLY_APPROVED = 'partially_approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum PreAuthType {
  ADMISSION = 'admission',
  SURGERY = 'surgery',
  PROCEDURE = 'procedure',
  INVESTIGATION = 'investigation',
  MATERNITY = 'maternity',
  EXTENSION = 'extension',
}

@Entity('pre_authorizations')
export class PreAuthorization extends BaseEntity {
  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'auth_number', unique: true })
  authNumber: string;

  @Column({ name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => InsurancePolicy)
  @JoinColumn({ name: 'policy_id' })
  policy: InsurancePolicy;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'auth_type', type: 'enum', enum: PreAuthType })
  authType: PreAuthType;

  @Column({ type: 'enum', enum: PreAuthStatus, default: PreAuthStatus.PENDING })
  status: PreAuthStatus;

  @Column({ name: 'requested_by_id' })
  requestedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'requested_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  requestedAt: Date;

  @Column({ name: 'primary_diagnosis' })
  primaryDiagnosis: string;

  @Column({ name: 'diagnosis_code', nullable: true })
  diagnosisCode?: string;

  @Column({ name: 'clinical_justification', type: 'text' })
  clinicalJustification: string;

  @Column({ name: 'proposed_treatment', type: 'text' })
  proposedTreatment: string;

  @Column({ name: 'estimated_cost', type: 'decimal', precision: 15, scale: 2 })
  estimatedCost: number;

  @Column({ name: 'approved_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  approvedAmount: number;

  @Column({ name: 'expected_admission_date', type: 'date', nullable: true })
  expectedAdmissionDate?: Date;

  @Column({ name: 'expected_discharge_date', type: 'date', nullable: true })
  expectedDischargeDate?: Date;

  @Column({ name: 'expected_los_days', nullable: true })
  expectedLosDays?: number;

  @Column({ name: 'valid_from', type: 'date', nullable: true })
  validFrom?: Date;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil?: Date;

  @Column({ name: 'insurer_reference', nullable: true })
  insurerReference?: string;

  @Column({ name: 'approved_by_insurer', nullable: true })
  approvedByInsurer?: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt?: Date;

  @Column({ name: 'denial_reason', nullable: true })
  denialReason?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;
}
