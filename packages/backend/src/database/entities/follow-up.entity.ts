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
import { Department } from './department.entity';

export enum FollowUpStatus {
  SCHEDULED = 'scheduled',
  CONFIRMED = 'confirmed',
  CHECKED_IN = 'checked_in',
  COMPLETED = 'completed',
  MISSED = 'missed',
  CANCELLED = 'cancelled',
  RESCHEDULED = 'rescheduled',
}

export enum FollowUpType {
  ROUTINE = 'routine',
  POST_PROCEDURE = 'post_procedure',
  LAB_REVIEW = 'lab_review',
  IMAGING_REVIEW = 'imaging_review',
  MEDICATION_REVIEW = 'medication_review',
  CHRONIC_CARE = 'chronic_care',
  WOUND_CARE = 'wound_care',
  POST_DISCHARGE = 'post_discharge',
  VACCINATION = 'vaccination',
  ANC = 'anc',
  PNC = 'pnc',
  IMMUNIZATION = 'immunization',
  OTHER = 'other',
}

export enum FollowUpPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

@Entity('follow_ups')
@Index(['appointmentNumber'], { unique: true })
@Index(['patient', 'status'])
@Index(['scheduledDate', 'status'])
@Index(['facility', 'scheduledDate'])
export class FollowUp extends BaseEntity {
  @Column({ name: 'appointment_number', unique: true })
  appointmentNumber: string;

  @Column({
    type: 'enum',
    enum: FollowUpType,
    default: FollowUpType.ROUTINE,
  })
  type: FollowUpType;

  @Column({
    type: 'enum',
    enum: FollowUpStatus,
    default: FollowUpStatus.SCHEDULED,
  })
  status: FollowUpStatus;

  @Column({
    type: 'enum',
    enum: FollowUpPriority,
    default: FollowUpPriority.MEDIUM,
  })
  priority: FollowUpPriority;

  @Column({ name: 'scheduled_date', type: 'date' })
  scheduledDate: Date;

  @Column({ name: 'scheduled_time', nullable: true })
  scheduledTime: string;

  @Column({ name: 'duration_minutes', default: 30 })
  durationMinutes: number;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt: Date;

  @Column({ name: 'sms_reminder', default: true })
  smsReminder: boolean;

  @Column({ name: 'days_before_reminder', default: 1 })
  daysBeforeReminder: number;

  @Column({ name: 'confirmed_at', type: 'timestamptz', nullable: true })
  confirmedAt: Date;

  @Column({ name: 'checked_in_at', type: 'timestamptz', nullable: true })
  checkedInAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string;

  @Column({ name: 'cancelled_at', type: 'timestamptz', nullable: true })
  cancelledAt: Date;

  @Column({ name: 'rescheduled_from_id', nullable: true })
  rescheduledFromId: string;

  @Column({ name: 'missed_reason', type: 'text', nullable: true })
  missedReason: string;

  @Column({ name: 'outcome_notes', type: 'text', nullable: true })
  outcomeNotes: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

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
  @JoinColumn({ name: 'follow_up_encounter_id' })
  followUpEncounter: Encounter;

  @Column({ name: 'follow_up_encounter_id', nullable: true })
  followUpEncounterId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'provider_id' })
  provider: User;

  @Column({ name: 'provider_id', nullable: true })
  providerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'scheduled_by_id' })
  scheduledBy: User;

  @Column({ name: 'scheduled_by_id' })
  scheduledById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by_id' })
  completedBy: User;

  @Column({ name: 'completed_by_id', nullable: true })
  completedById: string;
}
