import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AntenatalRegistration } from './antenatal-registration.entity';
import { DeliveryOutcome } from './delivery-outcome.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum PNCVisitNumber {
  VISIT_1 = 1, // Within 24 hours
  VISIT_2 = 2, // Day 3
  VISIT_3 = 3, // Day 7-14
  VISIT_4 = 4, // Week 6
}

export enum LochiaType {
  RUBRA = 'rubra',
  SEROSA = 'serosa',
  ALBA = 'alba',
}

export enum BreastCondition {
  NORMAL = 'normal',
  ENGORGED = 'engorged',
  CRACKED_NIPPLES = 'cracked_nipples',
  MASTITIS = 'mastitis',
  ABSCESS = 'abscess',
}

export enum MentalHealthRisk {
  NONE = 'none',
  LOW = 'low',
  MODERATE = 'moderate',
  HIGH = 'high',
}

@Entity('postnatal_visits')
export class PostnatalVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'registration_id' })
  registrationId: string;

  @ManyToOne(() => AntenatalRegistration)
  @JoinColumn({ name: 'registration_id' })
  registration: AntenatalRegistration;

  @Column({ type: 'uuid', name: 'delivery_outcome_id', nullable: true })
  deliveryOutcomeId: string;

  @ManyToOne(() => DeliveryOutcome)
  @JoinColumn({ name: 'delivery_outcome_id' })
  deliveryOutcome: DeliveryOutcome;

  @Column({ type: 'enum', enum: PNCVisitNumber, name: 'visit_number' })
  visitNumber: PNCVisitNumber;

  @Column({ type: 'timestamp', name: 'visit_date' })
  visitDate: Date;

  @Column({ type: 'int', name: 'days_postpartum' })
  daysPostpartum: number;

  // Mother Vitals
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  @Column({ type: 'int', nullable: true, name: 'bp_systolic' })
  bpSystolic: number;

  @Column({ type: 'int', nullable: true, name: 'bp_diastolic' })
  bpDiastolic: number;

  @Column({ type: 'int', nullable: true, name: 'pulse_rate' })
  pulseRate: number;

  @Column({ type: 'int', nullable: true, name: 'respiratory_rate' })
  respiratoryRate: number;

  // Uterine Assessment
  @Column({ type: 'boolean', nullable: true, name: 'uterus_well_contracted' })
  uterusWellContracted: boolean;

  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true, name: 'fundal_height_cm' })
  fundalHeightCm: number;

  // Lochia Assessment
  @Column({ type: 'enum', enum: LochiaType, nullable: true, name: 'lochia_type' })
  lochiaType: LochiaType;

  @Column({ type: 'boolean', nullable: true, name: 'lochia_normal_amount' })
  lochiaNormalAmount: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'lochia_foul_smelling' })
  lochiaFoulSmelling: boolean;

  // Perineum/Wound
  @Column({ type: 'boolean', nullable: true, name: 'perineum_intact' })
  perineumIntact: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'wound_healing_well' })
  woundHealingWell: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'wound_infection_signs' })
  woundInfectionSigns: boolean;

  @Column({ type: 'text', nullable: true, name: 'wound_notes' })
  woundNotes: string;

  // Breast Assessment
  @Column({ type: 'enum', enum: BreastCondition, nullable: true, name: 'breast_condition' })
  breastCondition: BreastCondition;

  @Column({ type: 'boolean', nullable: true, name: 'breastfeeding_established' })
  breastfeedingEstablished: boolean;

  @Column({ type: 'boolean', nullable: true, name: 'breastfeeding_issues' })
  breastfeedingIssues: boolean;

  @Column({ type: 'text', nullable: true, name: 'breastfeeding_notes' })
  breastfeedingNotes: string;

  // Mental Health Screening (Edinburgh Postnatal Depression Scale)
  @Column({ type: 'int', nullable: true, name: 'epds_score' })
  epdsScore: number; // 0-30 scale

  @Column({ type: 'enum', enum: MentalHealthRisk, nullable: true, name: 'mental_health_risk' })
  mentalHealthRisk: MentalHealthRisk;

  @Column({ type: 'boolean', nullable: true, name: 'mental_health_referral' })
  mentalHealthReferral: boolean;

  // Danger Signs
  @Column({ type: 'boolean', default: false, name: 'heavy_bleeding' })
  heavyBleeding: boolean;

  @Column({ type: 'boolean', default: false, name: 'fever' })
  fever: boolean;

  @Column({ type: 'boolean', default: false, name: 'severe_headache' })
  severeHeadache: boolean;

  @Column({ type: 'boolean', default: false, name: 'blurred_vision' })
  blurredVision: boolean;

  @Column({ type: 'boolean', default: false, name: 'convulsions' })
  convulsions: boolean;

  @Column({ type: 'boolean', default: false, name: 'breathing_difficulty' })
  breathingDifficulty: boolean;

  @Column({ type: 'boolean', default: false, name: 'leg_swelling' })
  legSwelling: boolean;

  // Interventions
  @Column({ type: 'boolean', default: false, name: 'iron_folate_given' })
  ironFolateGiven: boolean;

  @Column({ type: 'boolean', default: false, name: 'vitamin_a_given' })
  vitaminAGiven: boolean;

  @Column({ type: 'boolean', default: false, name: 'family_planning_counseling' })
  familyPlanningCounseling: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'contraceptive_method' })
  contraceptiveMethod: string;

  // Notes
  @Column({ type: 'text', nullable: true })
  complaints: string;

  @Column({ type: 'text', nullable: true })
  examination: string;

  @Column({ type: 'text', nullable: true })
  diagnosis: string;

  @Column({ type: 'text', nullable: true })
  treatment: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamp', nullable: true, name: 'next_visit_date' })
  nextVisitDate: Date;

  // Provider
  @Column({ type: 'uuid', name: 'seen_by_id' })
  seenById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'seen_by_id' })
  seenBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
