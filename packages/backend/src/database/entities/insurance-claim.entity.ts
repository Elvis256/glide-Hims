import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { InsuranceProvider } from './insurance-provider.entity';
import { InsurancePolicy } from './insurance-policy.entity';
import { Patient } from './patient.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';

export enum ClaimStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  ACKNOWLEDGED = 'acknowledged',
  IN_REVIEW = 'in_review',
  APPROVED = 'approved',
  PARTIALLY_APPROVED = 'partially_approved',
  REJECTED = 'rejected',
  PAID = 'paid',
  APPEALED = 'appealed',
  CANCELLED = 'cancelled',
}

export enum ClaimType {
  OUTPATIENT = 'outpatient',
  INPATIENT = 'inpatient',
  MATERNITY = 'maternity',
  EMERGENCY = 'emergency',
  SURGICAL = 'surgical',
  DIAGNOSTIC = 'diagnostic',
}

@Entity('insurance_claims')
export class InsuranceClaim extends BaseEntity {
  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'claim_number', unique: true })
  claimNumber: string;

  @Column({ name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => InsuranceProvider)
  @JoinColumn({ name: 'provider_id' })
  provider: InsuranceProvider;

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

  @Column({ name: 'encounter_id', nullable: true })
  encounterId?: string;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter?: Encounter;

  @Column({ name: 'pre_auth_id', nullable: true })
  preAuthId?: string;

  @Column({ name: 'claim_type', type: 'enum', enum: ClaimType })
  claimType: ClaimType;

  @Column({ type: 'enum', enum: ClaimStatus, default: ClaimStatus.DRAFT })
  status: ClaimStatus;

  @Column({ name: 'service_date', type: 'date' })
  serviceDate: Date;

  @Column({ name: 'admission_date', type: 'date', nullable: true })
  admissionDate?: Date;

  @Column({ name: 'discharge_date', type: 'date', nullable: true })
  dischargeDate?: Date;

  @Column({ name: 'primary_diagnosis' })
  primaryDiagnosis: string;

  @Column({ name: 'diagnosis_code', nullable: true })
  diagnosisCode?: string;

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', nullable: true })
  secondaryDiagnoses?: string[];

  @Column({ name: 'total_claimed', type: 'decimal', precision: 15, scale: 2 })
  totalClaimed: number;

  @Column({ name: 'total_approved', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalApproved: number;

  @Column({ name: 'total_paid', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalPaid: number;

  @Column({ name: 'patient_responsibility', type: 'decimal', precision: 15, scale: 2, default: 0 })
  patientResponsibility: number;

  @Column({ name: 'submitted_at', type: 'timestamp', nullable: true })
  submittedAt?: Date;

  @Column({ name: 'submitted_by_id', nullable: true })
  submittedById?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by_id' })
  submittedBy?: User;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt?: Date;

  @Column({ name: 'payment_reference', nullable: true })
  paymentReference?: string;

  @Column({ name: 'denial_reason', nullable: true })
  denialReason?: string;

  @Column({ name: 'denial_code', nullable: true })
  denialCode?: string;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany('ClaimItem', 'claim')
  items: any[];
}
