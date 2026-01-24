import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DeliveryOutcome } from './delivery-outcome.entity';
import { PostnatalVisit } from './postnatal-visit.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum FeedingType {
  EXCLUSIVE_BREASTFEEDING = 'exclusive_breastfeeding',
  MIXED_FEEDING = 'mixed_feeding',
  FORMULA_ONLY = 'formula_only',
}

export enum CordStatus {
  CLEAN_DRY = 'clean_dry',
  SLIGHTLY_WET = 'slightly_wet',
  INFECTED = 'infected',
  FALLEN_OFF = 'fallen_off',
}

export enum JaundiceLevel {
  NONE = 'none',
  MILD = 'mild',
  MODERATE = 'moderate',
  SEVERE = 'severe',
}

export enum BabyWellnessStatus {
  HEALTHY = 'healthy',
  NEEDS_ATTENTION = 'needs_attention',
  REFERRED = 'referred',
  CRITICAL = 'critical',
}

@Entity('baby_wellness_checks')
export class BabyWellnessCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'delivery_outcome_id' })
  deliveryOutcomeId: string;

  @ManyToOne(() => DeliveryOutcome)
  @JoinColumn({ name: 'delivery_outcome_id' })
  deliveryOutcome: DeliveryOutcome;

  @Column({ type: 'uuid', name: 'postnatal_visit_id', nullable: true })
  postnatalVisitId: string;

  @ManyToOne(() => PostnatalVisit)
  @JoinColumn({ name: 'postnatal_visit_id' })
  postnatalVisit: PostnatalVisit;

  @Column({ type: 'timestamp', name: 'check_date' })
  checkDate: Date;

  @Column({ type: 'int', name: 'age_in_days' })
  ageInDays: number;

  // Vitals
  @Column({ type: 'decimal', precision: 5, scale: 3, nullable: true })
  weight: number; // kg

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number; // °C

  @Column({ type: 'int', nullable: true, name: 'heart_rate' })
  heartRate: number;

  @Column({ type: 'int', nullable: true, name: 'respiratory_rate' })
  respiratoryRate: number;

  // Feeding Assessment
  @Column({ type: 'enum', enum: FeedingType, nullable: true, name: 'feeding_type' })
  feedingType: FeedingType;

  @Column({ type: 'boolean', nullable: true, name: 'feeding_well' })
  feedingWell: boolean;

  @Column({ type: 'int', nullable: true, name: 'feeds_per_day' })
  feedsPerDay: number;

  @Column({ type: 'text', nullable: true, name: 'feeding_notes' })
  feedingNotes: string;

  // Cord Care
  @Column({ type: 'enum', enum: CordStatus, nullable: true, name: 'cord_status' })
  cordStatus: CordStatus;

  @Column({ type: 'date', nullable: true, name: 'cord_separation_date' })
  cordSeparationDate: Date;

  // Jaundice
  @Column({ type: 'enum', enum: JaundiceLevel, nullable: true, name: 'jaundice_level' })
  jaundiceLevel: JaundiceLevel;

  @Column({ type: 'boolean', nullable: true, name: 'phototherapy_needed' })
  phototherapyNeeded: boolean;

  // Eyes
  @Column({ type: 'boolean', nullable: true, name: 'eyes_normal' })
  eyesNormal: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'eye_discharge' })
  eyeDischarge: boolean;

  // Danger Signs
  @Column({ type: 'boolean', default: false, name: 'not_feeding' })
  notFeeding: boolean;

  @Column({ type: 'boolean', default: false, name: 'convulsions' })
  convulsions: boolean;

  @Column({ type: 'boolean', default: false, name: 'fast_breathing' })
  fastBreathing: boolean;

  @Column({ type: 'boolean', default: false, name: 'severe_chest_indrawing' })
  severeChestIndrawing: boolean;

  @Column({ type: 'boolean', default: false, name: 'no_movement' })
  noMovement: boolean;

  @Column({ type: 'boolean', default: false })
  hypothermia: boolean;

  @Column({ type: 'boolean', default: false })
  hyperthermia: boolean;

  // Growth Assessment
  @Column({ type: 'varchar', length: 50, nullable: true, name: 'weight_for_age' })
  weightForAge: string; // Normal, Underweight, Severely Underweight

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, name: 'weight_change_percent' })
  weightChangePercent: number;

  // Status & Outcome
  @Column({ type: 'enum', enum: BabyWellnessStatus, default: BabyWellnessStatus.HEALTHY })
  status: BabyWellnessStatus;

  @Column({ type: 'text', nullable: true })
  findings: string;

  @Column({ type: 'text', nullable: true })
  actions: string;

  @Column({ type: 'text', nullable: true, name: 'referral_reason' })
  referralReason: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Provider
  @Column({ type: 'uuid', name: 'checked_by_id' })
  checkedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'checked_by_id' })
  checkedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
