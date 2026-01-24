import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { LabourRecord, LabourOutcome } from './labour-record.entity';

export enum BabySex {
  MALE = 'male',
  FEMALE = 'female',
  AMBIGUOUS = 'ambiguous',
}

export enum BabyStatus {
  ALIVE = 'alive',
  NICU = 'nicu',
  DECEASED = 'deceased',
  DISCHARGED = 'discharged',
}

@Entity('delivery_outcomes')
export class DeliveryOutcome {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'labour_record_id' })
  labourRecordId: string;

  @ManyToOne(() => LabourRecord)
  @JoinColumn({ name: 'labour_record_id' })
  labourRecord: LabourRecord;

  @Column({ type: 'int', default: 1, name: 'baby_number' })
  babyNumber: number; // For multiple births

  // Birth details
  @Column({ type: 'timestamp', name: 'time_of_birth' })
  timeOfBirth: Date;

  @Column({ type: 'enum', enum: LabourOutcome, name: 'outcome' })
  outcome: LabourOutcome;

  @Column({ type: 'enum', enum: BabySex, name: 'sex' })
  sex: BabySex;

  @Column({ type: 'decimal', precision: 5, scale: 3, name: 'birth_weight' })
  birthWeight: number; // kg

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'birth_length' })
  birthLength: number; // cm

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'head_circumference' })
  headCircumference: number; // cm

  // APGAR scores
  @Column({ type: 'int', nullable: true, name: 'apgar_1min' })
  apgar1min: number;

  @Column({ type: 'int', nullable: true, name: 'apgar_5min' })
  apgar5min: number;

  @Column({ type: 'int', nullable: true, name: 'apgar_10min' })
  apgar10min: number;

  // Resuscitation
  @Column({ type: 'boolean', default: false, name: 'resuscitation_needed' })
  resuscitationNeeded: boolean;

  @Column({ type: 'text', nullable: true, name: 'resuscitation_details' })
  resuscitationDetails: string;

  // Initial care
  @Column({ type: 'boolean', default: false, name: 'skin_to_skin' })
  skinToSkin: boolean;

  @Column({ type: 'boolean', default: false, name: 'breastfeeding_initiated' })
  breastfeedingInitiated: boolean;

  @Column({ type: 'boolean', default: false, name: 'vitamin_k_given' })
  vitaminKGiven: boolean;

  @Column({ type: 'boolean', default: false, name: 'eye_prophylaxis' })
  eyeProphylaxis: boolean;

  @Column({ type: 'boolean', default: false, name: 'bcg_given' })
  bcgGiven: boolean;

  @Column({ type: 'boolean', default: false, name: 'opv0_given' })
  opv0Given: boolean;

  // Status
  @Column({ type: 'enum', enum: BabyStatus, default: BabyStatus.ALIVE, name: 'baby_status' })
  babyStatus: BabyStatus;

  @Column({ type: 'text', nullable: true })
  abnormalities: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
