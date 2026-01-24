import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { Encounter } from './encounter.entity';

export enum ReferralType {
  INTERNAL = 'internal',      // Within same facility
  EXTERNAL = 'external',      // To another facility
  SELF = 'self',              // Patient self-referred
  COMMUNITY = 'community',    // From VHT/community health worker
}

export enum ReferralStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum ReferralPriority {
  EMERGENCY = 'emergency',
  URGENT = 'urgent',
  ROUTINE = 'routine',
}

export enum ReferralReason {
  SPECIALIST_CONSULTATION = 'specialist_consultation',
  DIAGNOSTIC_SERVICES = 'diagnostic_services',
  SURGICAL_INTERVENTION = 'surgical_intervention',
  HIGHER_LEVEL_CARE = 'higher_level_care',
  INPATIENT_ADMISSION = 'inpatient_admission',
  MATERNITY_CARE = 'maternity_care',
  MENTAL_HEALTH = 'mental_health',
  REHABILITATION = 'rehabilitation',
  PALLIATIVE_CARE = 'palliative_care',
  OTHER = 'other',
}

@Entity('referrals')
@Index(['referralNumber'], { unique: true })
@Index(['patient', 'status'])
@Index(['toFacility', 'status'])
@Index(['createdAt'])
export class Referral extends BaseEntity {
  @Column({ name: 'referral_number', unique: true })
  referralNumber: string;

  @Column({
    type: 'enum',
    enum: ReferralType,
    default: ReferralType.EXTERNAL,
  })
  type: ReferralType;

  @Column({
    type: 'enum',
    enum: ReferralStatus,
    default: ReferralStatus.PENDING,
  })
  status: ReferralStatus;

  @Column({
    type: 'enum',
    enum: ReferralPriority,
    default: ReferralPriority.ROUTINE,
  })
  priority: ReferralPriority;

  @Column({
    type: 'enum',
    enum: ReferralReason,
    default: ReferralReason.SPECIALIST_CONSULTATION,
  })
  reason: ReferralReason;

  @Column({ name: 'reason_details', type: 'text', nullable: true })
  reasonDetails: string;

  @Column({ name: 'clinical_summary', type: 'text' })
  clinicalSummary: string;

  @Column({ name: 'provisional_diagnosis', type: 'text', nullable: true })
  provisionalDiagnosis: string;

  @Column({ name: 'diagnosis_codes', type: 'jsonb', nullable: true })
  diagnosisCodes: { code: string; name: string }[];

  @Column({ name: 'vital_signs', type: 'jsonb', nullable: true })
  vitalSigns: {
    temperature?: number;
    pulse?: number;
    bloodPressure?: string;
    respiratoryRate?: number;
    oxygenSaturation?: number;
  };

  @Column({ name: 'investigations_done', type: 'jsonb', nullable: true })
  investigationsDone: {
    type: string;
    name: string;
    result: string;
    date: string;
  }[];

  @Column({ name: 'treatment_given', type: 'text', nullable: true })
  treatmentGiven: string;

  @Column({ name: 'referring_department', nullable: true })
  referringDepartment: string;

  @Column({ name: 'referred_to_department', nullable: true })
  referredToDepartment: string;

  @Column({ name: 'referred_to_specialty', nullable: true })
  referredToSpecialty: string;

  @Column({ name: 'appointment_date', type: 'timestamptz', nullable: true })
  appointmentDate: Date;

  @Column({ name: 'appointment_time', nullable: true })
  appointmentTime: string;

  @Column({ name: 'transport_mode', nullable: true })
  transportMode: string; // ambulance, self, public

  @Column({ name: 'escort_required', default: false })
  escortRequired: boolean;

  @Column({ name: 'escort_name', nullable: true })
  escortName: string;

  @Column({ name: 'escort_phone', nullable: true })
  escortPhone: string;

  @Column({ name: 'expiry_date', type: 'timestamptz', nullable: true })
  expiryDate: Date;

  @Column({ name: 'accepted_at', type: 'timestamptz', nullable: true })
  acceptedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'feedback_notes', type: 'text', nullable: true })
  feedbackNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: { name: string; url: string; type: string }[];

  // Relationships
  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'source_encounter_id' })
  sourceEncounter: Encounter;

  @Column({ name: 'source_encounter_id', nullable: true })
  sourceEncounterId: string;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'destination_encounter_id' })
  destinationEncounter: Encounter;

  @Column({ name: 'destination_encounter_id', nullable: true })
  destinationEncounterId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'from_facility_id' })
  fromFacility: Facility;

  @Column({ name: 'from_facility_id' })
  fromFacilityId: string;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'to_facility_id' })
  toFacility: Facility;

  @Column({ name: 'to_facility_id', nullable: true })
  toFacilityId: string;

  @Column({ name: 'external_facility_name', nullable: true })
  externalFacilityName: string;

  @Column({ name: 'external_facility_address', nullable: true })
  externalFacilityAddress: string;

  @Column({ name: 'external_facility_phone', nullable: true })
  externalFacilityPhone: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'referred_by_id' })
  referredBy: User;

  @Column({ name: 'referred_by_id' })
  referredById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'accepted_by_id' })
  acceptedBy: User;

  @Column({ name: 'accepted_by_id', nullable: true })
  acceptedById: string;

  @Column({ name: 'community_health_worker_name', nullable: true })
  communityHealthWorkerName: string;

  @Column({ name: 'community_health_worker_phone', nullable: true })
  communityHealthWorkerPhone: string;
}
