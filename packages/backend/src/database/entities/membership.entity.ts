import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

export enum MembershipType {
  REGULAR = 'regular',
  VIP = 'vip',
  STAFF = 'staff',
  CORPORATE = 'corporate',
  INSURANCE = 'insurance',
  CHARITY = 'charity',
}

@Entity('membership_schemes')
@Index(['code'], { unique: true })
export class MembershipScheme extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: MembershipType,
    default: MembershipType.REGULAR,
  })
  type: MembershipType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ name: 'credit_limit', type: 'decimal', precision: 12, scale: 2, default: 0 })
  creditLimit: number;

  @Column({ name: 'requires_approval', default: false })
  requiresApproval: boolean;

  @Column({ name: 'valid_days', default: 365 })
  validDays: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  benefits: Record<string, any>; // e.g., { freeConsultations: 2, priorityQueue: true }

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id', nullable: true })
  facilityId: string;
}

@Entity('patient_memberships')
@Index(['patientId', 'schemeId'])
@Index(['membershipNumber'], { unique: true })
export class PatientMembership extends BaseEntity {
  @Column({ name: 'membership_number', unique: true })
  membershipNumber: string;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => MembershipScheme, { nullable: true })
  @JoinColumn({ name: 'scheme_id' })
  scheme: MembershipScheme;

  @Column({ name: 'scheme_id' })
  schemeId: string;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ default: 'active' })
  status: string; // active, expired, suspended, cancelled

  @Column({ name: 'corporate_name', nullable: true })
  corporateName: string;

  @Column({ name: 'employee_id', nullable: true })
  employeeId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
