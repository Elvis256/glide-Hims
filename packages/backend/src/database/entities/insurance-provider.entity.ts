import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

export enum ProviderType {
  NHIS = 'nhis',          // National Health Insurance Scheme
  PRIVATE = 'private',
  CORPORATE = 'corporate',
  GOVERNMENT = 'government',
}

export enum ClaimSubmissionMethod {
  ELECTRONIC = 'electronic',
  MANUAL = 'manual',
  PORTAL = 'portal',
}

@Entity('insurance_providers')
export class InsuranceProvider extends BaseEntity {
  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column()
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ name: 'provider_type', type: 'enum', enum: ProviderType, default: ProviderType.PRIVATE })
  providerType: ProviderType;

  @Column({ name: 'contact_person', nullable: true })
  contactPerson?: string;

  @Column({ nullable: true })
  email?: string;

  @Column({ nullable: true })
  phone?: string;

  @Column({ nullable: true })
  address?: string;

  @Column({ name: 'claim_submission_method', type: 'enum', enum: ClaimSubmissionMethod, default: ClaimSubmissionMethod.MANUAL })
  claimSubmissionMethod: ClaimSubmissionMethod;

  @Column({ name: 'api_endpoint', nullable: true })
  apiEndpoint?: string;

  @Column({ name: 'api_key', nullable: true })
  apiKey?: string;

  @Column({ name: 'payment_terms_days', default: 30 })
  paymentTermsDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @OneToMany('InsurancePolicy', 'provider')
  policies: any[];

  @OneToMany('InsuranceClaim', 'provider')
  claims: any[];
}
