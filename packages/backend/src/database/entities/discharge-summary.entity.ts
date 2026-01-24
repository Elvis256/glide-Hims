import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum DischargeType {
  REGULAR = 'regular',
  AGAINST_MEDICAL_ADVICE = 'against_medical_advice',
  TRANSFERRED = 'transferred',
  DECEASED = 'deceased',
  ABSCONDED = 'absconded',
  REFERRAL = 'referral',
}

export enum DischargeDestination {
  HOME = 'home',
  OTHER_FACILITY = 'other_facility',
  NURSING_HOME = 'nursing_home',
  HOSPICE = 'hospice',
  REHABILITATION = 'rehabilitation',
  MORGUE = 'morgue',
}

@Entity('discharge_summaries')
@Index(['dischargeNumber'], { unique: true })
@Index(['patient'])
@Index(['encounter'], { unique: true })
@Index(['dischargeDate'])
export class DischargeSummary extends BaseEntity {
  @Column({ name: 'discharge_number', unique: true })
  dischargeNumber: string;

  @Column({
    type: 'enum',
    enum: DischargeType,
    default: DischargeType.REGULAR,
  })
  type: DischargeType;

  @Column({
    type: 'enum',
    enum: DischargeDestination,
    default: DischargeDestination.HOME,
  })
  destination: DischargeDestination;

  @Column({ name: 'discharge_date', type: 'timestamptz' })
  dischargeDate: Date;

  // Clinical Summary
  @Column({ name: 'chief_complaint', type: 'text' })
  chiefComplaint: string;

  @Column({ name: 'presenting_illness', type: 'text', nullable: true })
  presentingIllness: string;

  @Column({ name: 'admission_diagnosis', type: 'text', nullable: true })
  admissionDiagnosis: string;

  @Column({ name: 'final_diagnosis', type: 'text' })
  finalDiagnosis: string;

  @Column({ name: 'diagnosis_codes', type: 'jsonb', nullable: true })
  diagnosisCodes: { code: string; name: string; type: 'primary' | 'secondary' | 'complication' }[];

  @Column({ name: 'secondary_diagnoses', type: 'jsonb', nullable: true })
  secondaryDiagnoses: string[];

  @Column({ name: 'comorbidities', type: 'jsonb', nullable: true })
  comorbidities: string[];

  // Hospital Course
  @Column({ name: 'hospital_course', type: 'text' })
  hospitalCourse: string;

  @Column({ name: 'procedures_performed', type: 'jsonb', nullable: true })
  proceduresPerformed: {
    name: string;
    date: string;
    surgeon?: string;
    notes?: string;
  }[];

  @Column({ name: 'significant_findings', type: 'text', nullable: true })
  significantFindings: string;

  @Column({ name: 'complications', type: 'text', nullable: true })
  complications: string;

  @Column({ name: 'consultations', type: 'jsonb', nullable: true })
  consultations: {
    specialty: string;
    consultant: string;
    date: string;
    recommendations: string;
  }[];

  // Condition at Discharge
  @Column({ name: 'condition_at_discharge', type: 'text' })
  conditionAtDischarge: string;

  @Column({ name: 'vital_signs_at_discharge', type: 'jsonb', nullable: true })
  vitalSignsAtDischarge: {
    temperature?: number;
    pulse?: number;
    bloodPressure?: string;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weight?: number;
  };

  @Column({ name: 'functional_status', type: 'text', nullable: true })
  functionalStatus: string;

  // Discharge Medications
  @Column({ name: 'discharge_medications', type: 'jsonb', nullable: true })
  dischargeMedications: {
    drugName: string;
    dosage: string;
    frequency: string;
    route: string;
    duration: string;
    instructions?: string;
    isNew: boolean;
  }[];

  @Column({ name: 'medications_discontinued', type: 'jsonb', nullable: true })
  medicationsDiscontinued: {
    drugName: string;
    reason: string;
  }[];

  // Instructions
  @Column({ name: 'discharge_instructions', type: 'text' })
  dischargeInstructions: string;

  @Column({ name: 'diet_instructions', type: 'text', nullable: true })
  dietInstructions: string;

  @Column({ name: 'activity_instructions', type: 'text', nullable: true })
  activityInstructions: string;

  @Column({ name: 'wound_care_instructions', type: 'text', nullable: true })
  woundCareInstructions: string;

  @Column({ name: 'warning_signs', type: 'text', nullable: true })
  warningSigns: string;

  @Column({ name: 'when_to_seek_care', type: 'text', nullable: true })
  whenToSeekCare: string;

  // Follow-up
  @Column({ name: 'follow_up_appointments', type: 'jsonb', nullable: true })
  followUpAppointments: {
    date: string;
    time?: string;
    department: string;
    provider?: string;
    purpose: string;
  }[];

  @Column({ name: 'pending_results', type: 'jsonb', nullable: true })
  pendingResults: {
    testName: string;
    expectedDate: string;
    instructions: string;
  }[];

  @Column({ name: 'pending_referrals', type: 'jsonb', nullable: true })
  pendingReferrals: {
    specialty: string;
    reason: string;
    urgency: string;
  }[];

  // For transfers/referrals
  @Column({ name: 'transfer_facility_name', nullable: true })
  transferFacilityName: string;

  @Column({ name: 'transfer_reason', type: 'text', nullable: true })
  transferReason: string;

  @Column({ name: 'transport_mode', nullable: true })
  transportMode: string;

  // For AMA (Against Medical Advice)
  @Column({ name: 'ama_reason', type: 'text', nullable: true })
  amaReason: string;

  @Column({ name: 'ama_risks_explained', default: false })
  amaRisksExplained: boolean;

  @Column({ name: 'ama_consent_signed', default: false })
  amaConsentSigned: boolean;

  // Patient Education
  @Column({ name: 'education_provided', type: 'jsonb', nullable: true })
  educationProvided: {
    topic: string;
    method: string;
    understoodBy: string;
  }[];

  // Contact Information
  @Column({ name: 'emergency_contact_informed', default: false })
  emergencyContactInformed: boolean;

  @Column({ name: 'emergency_contact_name', nullable: true })
  emergencyContactName: string;

  @Column({ name: 'emergency_contact_phone', nullable: true })
  emergencyContactPhone: string;

  // Relationships
  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id' })
  encounterId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'discharged_by_id' })
  dischargedBy: User;

  @Column({ name: 'discharged_by_id' })
  dischargedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attending_physician_id' })
  attendingPhysician: User;

  @Column({ name: 'attending_physician_id', nullable: true })
  attendingPhysicianId: string;
}
