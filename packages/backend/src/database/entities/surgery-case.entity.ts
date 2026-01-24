import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Patient } from './patient.entity';
import { Encounter } from './encounter.entity';
import { Theatre } from './theatre.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum SurgeryStatus {
  SCHEDULED = 'scheduled',
  PRE_OP = 'pre_op',
  IN_PROGRESS = 'in_progress',
  POST_OP = 'post_op',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  POSTPONED = 'postponed',
}

export enum SurgeryPriority {
  ELECTIVE = 'elective',
  URGENT = 'urgent',
  EMERGENCY = 'emergency',
}

export enum SurgeryType {
  MAJOR = 'major',
  MINOR = 'minor',
  DAY_CASE = 'day_case',
}

export enum AnesthesiaType {
  GENERAL = 'general',
  SPINAL = 'spinal',
  EPIDURAL = 'epidural',
  LOCAL = 'local',
  REGIONAL = 'regional',
  SEDATION = 'sedation',
}

@Entity('surgery_cases')
export class SurgeryCase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 20, unique: true, name: 'case_number' })
  caseNumber: string;

  // Patient info
  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ type: 'uuid', name: 'encounter_id', nullable: true })
  encounterId: string;

  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  // Theatre assignment
  @Column({ type: 'uuid', name: 'theatre_id' })
  theatreId: string;

  @ManyToOne(() => Theatre)
  @JoinColumn({ name: 'theatre_id' })
  theatre: Theatre;

  // Procedure details
  @Column({ length: 200, name: 'procedure_name' })
  procedureName: string;

  @Column({ length: 20, nullable: true, name: 'procedure_code' })
  procedureCode: string;

  @Column({ type: 'text', nullable: true })
  diagnosis: string;

  @Column({ type: 'enum', enum: SurgeryType, default: SurgeryType.MAJOR, name: 'surgery_type' })
  surgeryType: SurgeryType;

  @Column({ type: 'enum', enum: SurgeryPriority, default: SurgeryPriority.ELECTIVE, name: 'priority' })
  priority: SurgeryPriority;

  @Column({ type: 'enum', enum: SurgeryStatus, default: SurgeryStatus.SCHEDULED, name: 'status' })
  status: SurgeryStatus;

  // Scheduling
  @Column({ type: 'date', name: 'scheduled_date' })
  scheduledDate: Date;

  @Column({ type: 'time', name: 'scheduled_time' })
  scheduledTime: string;

  @Column({ type: 'int', name: 'estimated_duration_minutes' })
  estimatedDurationMinutes: number;

  @Column({ type: 'timestamp', nullable: true, name: 'actual_start_time' })
  actualStartTime: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'actual_end_time' })
  actualEndTime: Date;

  // Surgical team
  @Column({ type: 'uuid', name: 'lead_surgeon_id' })
  leadSurgeonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'lead_surgeon_id' })
  leadSurgeon: User;

  @Column({ type: 'uuid', nullable: true, name: 'assistant_surgeon_id' })
  assistantSurgeonId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assistant_surgeon_id' })
  assistantSurgeon: User;

  @Column({ type: 'uuid', nullable: true, name: 'anesthesiologist_id' })
  anesthesiologistId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'anesthesiologist_id' })
  anesthesiologist: User;

  @Column({ type: 'jsonb', nullable: true, name: 'nursing_team' })
  nursingTeam: { id: string; name: string; role: string }[];

  // Anesthesia
  @Column({ type: 'enum', enum: AnesthesiaType, nullable: true, name: 'anesthesia_type' })
  anesthesiaType: AnesthesiaType;

  @Column({ type: 'text', nullable: true, name: 'anesthesia_notes' })
  anesthesiaNotes: string;

  // Pre-operative
  @Column({ type: 'jsonb', nullable: true, name: 'pre_op_checklist' })
  preOpChecklist: {
    item: string;
    checked: boolean;
    checkedBy?: string;
    checkedAt?: string;
  }[];

  @Column({ type: 'text', nullable: true, name: 'pre_op_notes' })
  preOpNotes: string;

  @Column({ type: 'boolean', default: false, name: 'consent_signed' })
  consentSigned: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'consent_signed_at' })
  consentSignedAt: Date;

  @Column({ type: 'boolean', default: false, name: 'blood_available' })
  bloodAvailable: boolean;

  @Column({ type: 'text', nullable: true, name: 'blood_group' })
  bloodGroup: string;

  // Intra-operative
  @Column({ type: 'text', nullable: true, name: 'operative_findings' })
  operativeFindings: string;

  @Column({ type: 'text', nullable: true, name: 'operative_notes' })
  operativeNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  complications: { type: string; description: string; time: string }[];

  @Column({ type: 'int', nullable: true, name: 'blood_loss_ml' })
  bloodLossMl: number;

  @Column({ type: 'jsonb', nullable: true, name: 'specimens_collected' })
  specimensCollected: { type: string; sentTo: string; labId?: string }[];

  // Post-operative
  @Column({ type: 'text', nullable: true, name: 'post_op_instructions' })
  postOpInstructions: string;

  @Column({ type: 'text', nullable: true, name: 'post_op_diagnosis' })
  postOpDiagnosis: string;

  @Column({ type: 'text', nullable: true, name: 'recovery_notes' })
  recoveryNotes: string;

  @Column({ type: 'timestamp', nullable: true, name: 'discharge_from_theatre' })
  dischargeFromTheatre: Date;

  @Column({ type: 'text', nullable: true, name: 'discharge_destination' })
  dischargeDestination: string; // ICU, Ward, Home

  // Facility
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  // Created by
  @Column({ type: 'uuid', nullable: true, name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
