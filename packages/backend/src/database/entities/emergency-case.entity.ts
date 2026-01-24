import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum TriageLevel {
  RESUSCITATION = 1,  // Immediate - life threatening
  EMERGENT = 2,       // < 10 min - potentially life threatening
  URGENT = 3,         // < 30 min - could deteriorate
  LESS_URGENT = 4,    // < 60 min - stable
  NON_URGENT = 5,     // < 120 min - minor issues
}

export enum TriageStatus {
  PENDING = 'pending',
  TRIAGED = 'triaged',
  IN_TREATMENT = 'in_treatment',
  TRANSFERRED = 'transferred',
  ADMITTED = 'admitted',
  DISCHARGED = 'discharged',
  LEFT_AMA = 'left_ama',      // Left against medical advice
  DECEASED = 'deceased',
}

export enum ArrivalMode {
  WALK_IN = 'walk_in',
  AMBULANCE = 'ambulance',
  POLICE = 'police',
  PRIVATE_VEHICLE = 'private_vehicle',
  CARRIED = 'carried',
  REFERRED = 'referred',
}

@Entity('emergency_cases')
@Index(['triageLevel', 'status'])
@Index(['facility', 'createdAt'])
export class EmergencyCase extends BaseEntity {
  @Column({ name: 'case_number', unique: true })
  caseNumber: string;

  @Column({ name: 'triage_level', type: 'enum', enum: TriageLevel })
  triageLevel: TriageLevel;

  @Column({ name: 'status', type: 'enum', enum: TriageStatus, default: TriageStatus.PENDING })
  status: TriageStatus;

  @Column({ name: 'arrival_mode', type: 'enum', enum: ArrivalMode, default: ArrivalMode.WALK_IN })
  arrivalMode: ArrivalMode;

  @Column({ name: 'arrival_time', type: 'timestamptz' })
  arrivalTime: Date;

  @Column({ name: 'triage_time', type: 'timestamptz', nullable: true })
  triageTime: Date;

  @Column({ name: 'treatment_start_time', type: 'timestamptz', nullable: true })
  treatmentStartTime: Date;

  @Column({ name: 'discharge_time', type: 'timestamptz', nullable: true })
  dischargeTime: Date;

  @Column({ name: 'chief_complaint', type: 'text' })
  chiefComplaint: string;

  @Column({ name: 'presenting_symptoms', type: 'text', nullable: true })
  presentingSymptoms: string;

  @Column({ name: 'mechanism_of_injury', type: 'text', nullable: true })
  mechanismOfInjury: string;  // For trauma cases

  // Triage vitals (captured at triage)
  @Column({ name: 'blood_pressure_systolic', type: 'int', nullable: true })
  bloodPressureSystolic: number;

  @Column({ name: 'blood_pressure_diastolic', type: 'int', nullable: true })
  bloodPressureDiastolic: number;

  @Column({ name: 'heart_rate', type: 'int', nullable: true })
  heartRate: number;

  @Column({ name: 'respiratory_rate', type: 'int', nullable: true })
  respiratoryRate: number;

  @Column({ name: 'temperature', type: 'decimal', precision: 4, scale: 1, nullable: true })
  temperature: number;

  @Column({ name: 'oxygen_saturation', type: 'int', nullable: true })
  oxygenSaturation: number;

  @Column({ name: 'gcs_score', type: 'int', nullable: true })  // Glasgow Coma Scale
  gcsScore: number;

  @Column({ name: 'pain_score', type: 'int', nullable: true })  // 0-10
  painScore: number;

  @Column({ name: 'blood_glucose', type: 'decimal', precision: 5, scale: 1, nullable: true })
  bloodGlucose: number;

  // Clinical assessment
  @Column({ name: 'allergies', type: 'text', nullable: true })
  allergies: string;

  @Column({ name: 'current_medications', type: 'text', nullable: true })
  currentMedications: string;

  @Column({ name: 'past_medical_history', type: 'text', nullable: true })
  pastMedicalHistory: string;

  @Column({ name: 'triage_notes', type: 'text', nullable: true })
  triageNotes: string;

  @Column({ name: 'treatment_notes', type: 'text', nullable: true })
  treatmentNotes: string;

  @Column({ name: 'disposition_notes', type: 'text', nullable: true })
  dispositionNotes: string;

  // Outcomes
  @Column({ name: 'primary_diagnosis', type: 'text', nullable: true })
  primaryDiagnosis: string;

  @Column({ name: 'procedures_performed', type: 'jsonb', nullable: true })
  proceduresPerformed: { code: string; name: string; time: Date }[];

  // Relationships
  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id', nullable: true })
  encounterId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'triage_nurse_id' })
  triageNurse: User;

  @Column({ name: 'triage_nurse_id', nullable: true })
  triageNurseId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'attending_doctor_id' })
  attendingDoctor: User;

  @Column({ name: 'attending_doctor_id', nullable: true })
  attendingDoctorId: string;
}
