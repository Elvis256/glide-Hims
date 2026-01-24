import { Entity, Column, ManyToOne, JoinColumn, Index, OneToOne } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum ProviderType {
  PHYSICIAN = 'physician',
  SURGEON = 'surgeon',
  NURSE = 'nurse',
  MIDWIFE = 'midwife',
  PHARMACIST = 'pharmacist',
  LAB_TECHNICIAN = 'lab_technician',
  RADIOLOGIST = 'radiologist',
  PHYSIOTHERAPIST = 'physiotherapist',
  DENTIST = 'dentist',
  CLINICAL_OFFICER = 'clinical_officer',
  SPECIALIST = 'specialist',
  CONSULTANT = 'consultant',
  INTERN = 'intern',
  OTHER = 'other',
}

export enum ProviderStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ON_LEAVE = 'on_leave',
  SUSPENDED = 'suspended',
  TERMINATED = 'terminated',
}

@Entity('providers')
@Index(['licenseNumber'], { unique: true, where: 'deleted_at IS NULL AND license_number IS NOT NULL' })
@Index(['registrationNumber'], { unique: true, where: 'deleted_at IS NULL AND registration_number IS NOT NULL' })
export class Provider extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'user_id' })
  userId?: string;

  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', nullable: true, name: 'department_id' })
  departmentId?: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department?: Department;

  @Column({ type: 'varchar', length: 255, name: 'full_name' })
  fullName: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  title?: string;

  @Column({
    type: 'enum',
    enum: ProviderType,
    default: ProviderType.PHYSICIAN,
    name: 'provider_type',
  })
  providerType: ProviderType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  specialty?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'sub_specialty' })
  subSpecialty?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'license_number' })
  licenseNumber?: string;

  @Column({ type: 'date', nullable: true, name: 'license_expiry' })
  licenseExpiry?: Date;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'registration_number' })
  registrationNumber?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'regulatory_body' })
  regulatoryBody?: string;

  @Column({ type: 'jsonb', nullable: true })
  qualifications?: {
    degree: string;
    institution: string;
    year: number;
  }[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  email?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  phone?: string;

  @Column({ type: 'boolean', default: true, name: 'can_prescribe' })
  canPrescribe: boolean;

  @Column({ type: 'boolean', default: true, name: 'can_order_labs' })
  canOrderLabs: boolean;

  @Column({ type: 'boolean', default: true, name: 'can_order_imaging' })
  canOrderImaging: boolean;

  @Column({ type: 'boolean', default: false, name: 'can_admit' })
  canAdmit: boolean;

  @Column({ type: 'boolean', default: false, name: 'can_perform_surgery' })
  canPerformSurgery: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, name: 'consultation_fee' })
  consultationFee?: number;

  @Column({ type: 'jsonb', nullable: true, name: 'available_days' })
  availableDays?: string[];

  @Column({ type: 'time', nullable: true, name: 'available_from' })
  availableFrom?: string;

  @Column({ type: 'time', nullable: true, name: 'available_to' })
  availableTo?: string;

  @Column({ type: 'int', nullable: true, name: 'max_patients_per_day' })
  maxPatientsPerDay?: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  signature?: string;

  @Column({
    type: 'enum',
    enum: ProviderStatus,
    default: ProviderStatus.ACTIVE,
  })
  status: ProviderStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
