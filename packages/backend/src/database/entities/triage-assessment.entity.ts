import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum ESILevel {
  ONE = '1',
  TWO = '2',
  THREE = '3',
  FOUR = '4',
  FIVE = '5',
}

export enum TriageAcuityColor {
  RED = 'red',
  ORANGE = 'orange',
  YELLOW = 'yellow',
  GREEN = 'green',
  BLUE = 'blue',
}

export enum TriageDisposition {
  CONSULTATION = 'consultation',
  EMERGENCY_RESUSCITATION = 'emergency_resuscitation',
  OBSERVATION = 'observation',
  REFERRAL = 'referral',
  DISCHARGE = 'discharge',
  ADMIT = 'admit',
}

export enum MobilityStatus {
  AMBULATORY = 'ambulatory',
  WHEELCHAIR = 'wheelchair',
  STRETCHER = 'stretcher',
  CARRIED = 'carried',
}

export enum MentalStatus {
  ALERT = 'alert',
  CONFUSED = 'confused',
  AGITATED = 'agitated',
  LETHARGIC = 'lethargic',
  UNRESPONSIVE = 'unresponsive',
}

export enum ConsciousnessLevel {
  A = 'A', // Alert
  V = 'V', // Voice
  P = 'P', // Pain
  U = 'U', // Unresponsive
}

@Entity('triage_assessments')
export class TriageAssessment extends BaseEntity {
  @Column({ type: 'uuid', name: 'queue_id' })
  queueId: string;

  @Column({ type: 'uuid', name: 'encounter_id', nullable: true })
  encounterId: string | null;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ name: 'chief_complaint', type: 'text' })
  chiefComplaint: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  onset: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  duration: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  severity: string | null;

  @Column({ name: 'esi_level', type: 'enum', enum: ESILevel, nullable: true })
  esiLevel: ESILevel | null;

  @Column({ name: 'acuity_color', type: 'enum', enum: TriageAcuityColor, nullable: true })
  acuityColor: TriageAcuityColor | null;

  @Column({ name: 'pain_score', type: 'smallint', nullable: true })
  painScore: number | null;

  @Column({ type: 'varchar', length: 255, name: 'pain_location', nullable: true })
  painLocation: string | null;

  @Column({ type: 'varchar', length: 255, name: 'pain_character', nullable: true })
  painCharacter: string | null;

  @Column({ name: 'mobility_status', type: 'enum', enum: MobilityStatus, nullable: true })
  mobilityStatus: MobilityStatus | null;

  @Column({ name: 'mental_status', type: 'enum', enum: MentalStatus, nullable: true })
  mentalStatus: MentalStatus | null;

  @Column({
    name: 'consciousness_level',
    type: 'enum',
    enum: ConsciousnessLevel,
    nullable: true,
  })
  consciousnessLevel: ConsciousnessLevel | null;

  @Column({ name: 'supplemental_oxygen', default: false })
  supplementalOxygen: boolean;

  // Vital snapshot
  @Column({ type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number | null;

  @Column({ type: 'int', nullable: true })
  pulse: number | null;

  @Column({ type: 'int', name: 'bp_systolic', nullable: true })
  bpSystolic: number | null;

  @Column({ type: 'int', name: 'bp_diastolic', nullable: true })
  bpDiastolic: number | null;

  @Column({ type: 'int', name: 'respiratory_rate', nullable: true })
  respiratoryRate: number | null;

  @Column({ name: 'oxygen_saturation', type: 'decimal', precision: 5, scale: 2, nullable: true })
  oxygenSaturation: number | null;

  @Column({ name: 'blood_glucose', type: 'decimal', precision: 6, scale: 2, nullable: true })
  bloodGlucose: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  weight: number | null;

  @Column({ name: 'news_score', type: 'smallint', nullable: true })
  newsScore: number | null;

  @Column({ name: 'mews_score', type: 'smallint', nullable: true })
  mewsScore: number | null;

  @Column({ type: 'enum', enum: TriageDisposition, nullable: true })
  disposition: TriageDisposition | null;

  @Column({ name: 'nursing_notes', type: 'text', nullable: true })
  nursingNotes: string | null;

  @Column({ name: 'assessed_by_id', type: 'uuid' })
  assessedById: string;

  @Column({ name: 'reassessment_of', type: 'uuid', nullable: true })
  reassessmentOf: string | null;

  @ManyToOne(() => TriageAssessment, { nullable: true })
  @JoinColumn({ name: 'reassessment_of' })
  originalAssessment: TriageAssessment | null;
}
