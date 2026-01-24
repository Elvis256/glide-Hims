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
import { AntenatalRegistration } from './antenatal-registration.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum LabourStatus {
  ADMITTED = 'admitted',
  FIRST_STAGE = 'first_stage',
  SECOND_STAGE = 'second_stage',
  THIRD_STAGE = 'third_stage',
  DELIVERED = 'delivered',
  POSTPARTUM = 'postpartum',
  DISCHARGED = 'discharged',
}

export enum DeliveryMode {
  SVD = 'svd', // Spontaneous vaginal delivery
  ASSISTED = 'assisted', // Vacuum/forceps
  CAESAREAN = 'caesarean',
  BREECH = 'breech',
}

export enum LabourOutcome {
  LIVE_BIRTH = 'live_birth',
  STILLBIRTH = 'stillbirth',
  NEONATAL_DEATH = 'neonatal_death',
}

@Entity('labour_records')
export class LabourRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true, name: 'labour_number' })
  labourNumber: string;

  @Column({ type: 'uuid', name: 'registration_id' })
  registrationId: string;

  @ManyToOne(() => AntenatalRegistration)
  @JoinColumn({ name: 'registration_id' })
  registration: AntenatalRegistration;

  @Column({ type: 'enum', enum: LabourStatus, default: LabourStatus.ADMITTED, name: 'status' })
  status: LabourStatus;

  // Admission
  @Column({ type: 'timestamp', name: 'admission_time' })
  admissionTime: Date;

  @Column({ type: 'int', name: 'gestational_age_at_delivery' })
  gestationalAgeAtDelivery: number;

  @Column({ type: 'text', nullable: true, name: 'admission_notes' })
  admissionNotes: string;

  // Vitals on admission
  @Column({ type: 'int', nullable: true, name: 'bp_systolic' })
  bpSystolic: number;

  @Column({ type: 'int', nullable: true, name: 'bp_diastolic' })
  bpDiastolic: number;

  @Column({ type: 'int', nullable: true, name: 'pulse_rate' })
  pulseRate: number;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  // Labour progress
  @Column({ type: 'int', nullable: true, name: 'cervical_dilation' })
  cervicalDilation: number; // cm

  @Column({ type: 'int', nullable: true, name: 'station' })
  station: number; // -5 to +5

  @Column({ type: 'boolean', nullable: true, name: 'membranes_intact' })
  membranesIntact: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'membrane_rupture_time' })
  membraneRuptureTime: Date;

  @Column({ length: 50, nullable: true, name: 'liquor_color' })
  liquorColor: string; // clear, meconium stained

  // Delivery
  @Column({ type: 'timestamp', nullable: true, name: 'delivery_time' })
  deliveryTime: Date;

  @Column({ type: 'enum', enum: DeliveryMode, nullable: true, name: 'delivery_mode' })
  deliveryMode: DeliveryMode;

  @Column({ type: 'text', nullable: true, name: 'delivery_notes' })
  deliveryNotes: string;

  // Placenta
  @Column({ type: 'timestamp', nullable: true, name: 'placenta_delivery_time' })
  placentaDeliveryTime: Date;

  @Column({ type: 'boolean', nullable: true, name: 'placenta_complete' })
  placentaComplete: boolean;

  @Column({ type: 'int', nullable: true, name: 'blood_loss_ml' })
  bloodLossMl: number;

  // Perineum
  @Column({ length: 50, nullable: true, name: 'perineum_status' })
  perineumStatus: string; // intact, 1st degree tear, 2nd degree, episiotomy

  @Column({ type: 'boolean', nullable: true, name: 'episiotomy_done' })
  episiotomyDone: boolean;

  // Complications
  @Column({ type: 'jsonb', nullable: true })
  complications: string[];

  @Column({ type: 'text', nullable: true, name: 'complication_notes' })
  complicationNotes: string;

  // Facility & Staff
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', nullable: true, name: 'delivered_by_id' })
  deliveredById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'delivered_by_id' })
  deliveredBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
