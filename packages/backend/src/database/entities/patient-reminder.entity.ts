import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';

export enum ReminderType {
  APPOINTMENT = 'appointment',
  FOLLOW_UP = 'follow_up',
  MEDICATION = 'medication',
  LAB_TEST = 'lab_test',
  CHRONIC_CHECKUP = 'chronic_checkup',
}

export enum ReminderStatus {
  PENDING = 'pending',
  SENT = 'sent',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export enum ReminderChannel {
  EMAIL = 'email',
  SMS = 'sms',
  BOTH = 'both',
}

@Entity('patient_reminders')
@Index(['patientId', 'scheduledFor'])
@Index(['status', 'scheduledFor'])
export class PatientReminder extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({
    type: 'enum',
    enum: ReminderType,
  })
  type: ReminderType;

  @Column({
    type: 'enum',
    enum: ReminderChannel,
    default: ReminderChannel.BOTH,
  })
  channel: ReminderChannel;

  @Column({
    type: 'enum',
    enum: ReminderStatus,
    default: ReminderStatus.PENDING,
  })
  status: ReminderStatus;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'timestamp', name: 'scheduled_for' })
  scheduledFor: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'sent_at' })
  sentAt?: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'reference_type' })
  referenceType?: string; // 'encounter', 'follow_up', 'appointment'

  @Column({ type: 'uuid', nullable: true, name: 'reference_id' })
  referenceId?: string;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'uuid', nullable: true, name: 'created_by' })
  createdById?: string;
}
