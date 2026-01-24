import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum PregnancyStatus {
  ACTIVE = 'active',
  DELIVERED = 'delivered',
  MISCARRIAGE = 'miscarriage',
  STILLBIRTH = 'stillbirth',
  ECTOPIC = 'ectopic',
  TRANSFERRED = 'transferred',
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

@Entity('antenatal_registrations')
export class AntenatalRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true, name: 'anc_number' })
  ancNumber: string;

  // Patient
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  // Obstetric history
  @Column({ type: 'int', default: 1 })
  gravida: number; // Total pregnancies

  @Column({ type: 'int', default: 0 })
  para: number; // Deliveries after 28 weeks

  @Column({ type: 'int', default: 0, name: 'living_children' })
  livingChildren: number;

  @Column({ type: 'int', default: 0 })
  abortions: number;

  // Current pregnancy
  @Column({ type: 'date', name: 'lmp_date' })
  lmpDate: Date; // Last menstrual period

  @Column({ type: 'date', name: 'edd' })
  edd: Date; // Expected delivery date

  @Column({ type: 'int', nullable: true, name: 'gestational_age_at_booking' })
  gestationalAgeAtBooking: number; // weeks

  @Column({ type: 'enum', enum: RiskLevel, default: RiskLevel.LOW, name: 'risk_level' })
  riskLevel: RiskLevel;

  @Column({ type: 'text', nullable: true, name: 'risk_factors' })
  riskFactors: string;

  @Column({ type: 'enum', enum: PregnancyStatus, default: PregnancyStatus.ACTIVE, name: 'status' })
  status: PregnancyStatus;

  // Blood group & Rh
  @Column({ length: 5, nullable: true, name: 'blood_group' })
  bloodGroup: string;

  @Column({ type: 'boolean', nullable: true, name: 'rh_positive' })
  rhPositive: boolean;

  // Medical history
  @Column({ type: 'text', nullable: true, name: 'medical_history' })
  medicalHistory: string;

  @Column({ type: 'text', nullable: true, name: 'surgical_history' })
  surgicalHistory: string;

  @Column({ type: 'text', nullable: true })
  allergies: string;

  @Column({ type: 'text', nullable: true, name: 'current_medications' })
  currentMedications: string;

  // Partner info
  @Column({ length: 100, nullable: true, name: 'partner_name' })
  partnerName: string;

  @Column({ length: 20, nullable: true, name: 'partner_phone' })
  partnerPhone: string;

  @Column({ type: 'boolean', nullable: true, name: 'partner_hiv_tested' })
  partnerHivTested: boolean;

  // Facility
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Registration
  @Column({ type: 'uuid', nullable: true, name: 'registered_by_id' })
  registeredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'registered_by_id' })
  registeredBy: User;

  @Column({ type: 'date', name: 'registration_date' })
  registrationDate: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
