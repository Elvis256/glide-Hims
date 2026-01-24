import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { InsuranceProvider } from './insurance-provider.entity';
import { Patient } from './patient.entity';

export enum PolicyStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export enum CoverageType {
  INPATIENT = 'inpatient',
  OUTPATIENT = 'outpatient',
  BOTH = 'both',
  MATERNITY = 'maternity',
  DENTAL = 'dental',
  OPTICAL = 'optical',
  COMPREHENSIVE = 'comprehensive',
}

export enum MemberType {
  PRINCIPAL = 'principal',
  SPOUSE = 'spouse',
  CHILD = 'child',
  DEPENDENT = 'dependent',
}

@Entity('insurance_policies')
export class InsurancePolicy extends BaseEntity {
  @Column({ name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => InsuranceProvider)
  @JoinColumn({ name: 'provider_id' })
  provider: InsuranceProvider;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'policy_number' })
  policyNumber: string;

  @Column({ name: 'member_number' })
  memberNumber: string;

  @Column({ name: 'member_type', type: 'enum', enum: MemberType, default: MemberType.PRINCIPAL })
  memberType: MemberType;

  @Column({ name: 'principal_member_number', nullable: true })
  principalMemberNumber?: string;

  @Column({ name: 'employer_name', nullable: true })
  employerName?: string;

  @Column({ name: 'employer_code', nullable: true })
  employerCode?: string;

  @Column({ name: 'coverage_type', type: 'enum', enum: CoverageType, default: CoverageType.BOTH })
  coverageType: CoverageType;

  @Column({ name: 'annual_limit', type: 'decimal', precision: 15, scale: 2, default: 0 })
  annualLimit: number;

  @Column({ name: 'used_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  usedAmount: number;

  @Column({ name: 'copay_percentage', type: 'decimal', precision: 5, scale: 2, default: 0 })
  copayPercentage: number;

  @Column({ name: 'copay_amount', type: 'decimal', precision: 10, scale: 2, default: 0 })
  copayAmount: number;

  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: Date;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ type: 'enum', enum: PolicyStatus, default: PolicyStatus.ACTIVE })
  status: PolicyStatus;

  @Column({ name: 'is_verified', default: false })
  isVerified: boolean;

  @Column({ name: 'verified_at', type: 'timestamp', nullable: true })
  verifiedAt?: Date;

  @Column({ type: 'jsonb', nullable: true })
  exclusions?: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany('InsuranceClaim', 'policy')
  claims: any[];

  @OneToMany('PreAuthorization', 'policy')
  preAuthorizations: any[];
}
