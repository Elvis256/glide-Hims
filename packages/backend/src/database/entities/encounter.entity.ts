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
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';
import { InsurancePolicy } from './insurance-policy.entity';

export enum EncounterType {
  OPD = 'opd',
  IPD = 'ipd',
  EMERGENCY = 'emergency',
  ANC = 'anc',           // Antenatal Care
  PNC = 'pnc',           // Postnatal Care
  ART = 'art',           // Antiretroviral Therapy
  TB = 'tb',             // Tuberculosis
  DENTAL = 'dental',
  OPTICAL = 'optical',
  MENTAL_HEALTH = 'mental_health',
  VACCINATION = 'vaccination',
  WELL_CHILD = 'well_child',
  FAMILY_PLANNING = 'family_planning',
  SURGICAL = 'surgical',
  DIALYSIS = 'dialysis',
  ONCOLOGY = 'oncology',
  PHYSIOTHERAPY = 'physiotherapy',
}

export enum EncounterStatus {
  REGISTERED = 'registered',
  TRIAGE = 'triage',
  WAITING = 'waiting',
  IN_CONSULTATION = 'in_consultation',
  PENDING_LAB = 'pending_lab',
  PENDING_PHARMACY = 'pending_pharmacy',
  PENDING_PAYMENT = 'pending_payment',
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum PayerType {
  CASH = 'cash',
  INSURANCE = 'insurance',
  CORPORATE = 'corporate',
}

@Entity('encounters')
@Index(['visitNumber'], { unique: true })
@Index(['patient', 'status'])
@Index(['facility', 'createdAt'])
export class Encounter extends BaseEntity {
  @Column({ name: 'visit_number', unique: true })
  visitNumber: string;

  @Column({
    type: 'enum',
    enum: EncounterType,
    default: EncounterType.OPD,
  })
  type: EncounterType;

  @Column({
    type: 'enum',
    enum: EncounterStatus,
    default: EncounterStatus.REGISTERED,
  })
  status: EncounterStatus;

  @Column({ name: 'chief_complaint', type: 'text', nullable: true })
  chiefComplaint: string;

  @Column({ name: 'start_time', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  startTime: Date;

  @Column({ name: 'end_time', type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({ name: 'queue_number', nullable: true })
  queueNumber: number;

  @Column({
    name: 'payer_type',
    type: 'enum',
    enum: PayerType,
    default: PayerType.CASH,
  })
  payerType: PayerType;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Relationships
  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => InsurancePolicy, { nullable: true })
  @JoinColumn({ name: 'insurance_policy_id' })
  insurancePolicy: InsurancePolicy;

  @Column({ name: 'insurance_policy_id', nullable: true })
  insurancePolicyId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attending_provider_id' })
  attendingProvider: User;

  @Column({ name: 'attending_provider_id', nullable: true })
  attendingProviderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;
}
