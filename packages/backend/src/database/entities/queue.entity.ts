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

export enum QueueStatus {
  WAITING = 'waiting',
  CALLED = 'called',
  IN_SERVICE = 'in_service',
  COMPLETED = 'completed',
  SKIPPED = 'skipped',
  NO_SHOW = 'no_show',
  TRANSFERRED = 'transferred',
  CANCELLED = 'cancelled',
}

export enum QueuePriority {
  EMERGENCY = 1,
  URGENT = 2,
  VIP = 3,
  ELDERLY = 4,
  DISABLED = 5,
  PREGNANT = 6,
  PEDIATRIC = 7,
  ROUTINE = 10,
}

export enum ServicePoint {
  REGISTRATION = 'registration',
  TRIAGE = 'triage',
  CONSULTATION = 'consultation',
  LABORATORY = 'laboratory',
  RADIOLOGY = 'radiology',
  PHARMACY = 'pharmacy',
  BILLING = 'billing',
  CASHIER = 'cashier',
  INJECTION = 'injection',
  DRESSING = 'dressing',
  VITALS = 'vitals',
  RECORDS = 'records',
}

@Entity('queues')
@Index(['ticketNumber', 'queueDate'], { unique: true })
@Index(['facility', 'servicePoint', 'status', 'queueDate'])
@Index(['patient'])
@Index(['encounter'])
@Index(['priority', 'createdAt'])
export class Queue extends BaseEntity {
  @Column({ name: 'ticket_number' })
  ticketNumber: string;

  @Column({ name: 'queue_date', type: 'date' })
  queueDate: Date;

  @Column({
    type: 'enum',
    enum: ServicePoint,
    default: ServicePoint.REGISTRATION,
  })
  servicePoint: ServicePoint;

  @Column({
    type: 'enum',
    enum: QueueStatus,
    default: QueueStatus.WAITING,
  })
  status: QueueStatus;

  @Column({
    type: 'enum',
    enum: QueuePriority,
    default: QueuePriority.ROUTINE,
  })
  priority: QueuePriority;

  @Column({ name: 'priority_reason', nullable: true })
  priorityReason: string;

  @Column({ name: 'sequence_number' })
  sequenceNumber: number;

  @Column({ name: 'estimated_wait_minutes', nullable: true })
  estimatedWaitMinutes: number;

  @Column({ name: 'actual_wait_minutes', nullable: true })
  actualWaitMinutes: number;

  @Column({ name: 'service_duration_minutes', nullable: true })
  serviceDurationMinutes: number;

  @Column({ name: 'called_at', type: 'timestamptz', nullable: true })
  calledAt: Date;

  @Column({ name: 'service_started_at', type: 'timestamptz', nullable: true })
  serviceStartedAt: Date;

  @Column({ name: 'service_ended_at', type: 'timestamptz', nullable: true })
  serviceEndedAt: Date;

  @Column({ name: 'call_count', default: 0 })
  callCount: number;

  @Column({ name: 'counter_number', nullable: true })
  counterNumber: string;

  @Column({ name: 'room_number', nullable: true })
  roomNumber: string;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'skip_reason', type: 'text', nullable: true })
  skipReason: string;

  @Column({ name: 'transfer_reason', type: 'text', nullable: true })
  transferReason: string;

  @Column({ name: 'next_service_point', type: 'enum', enum: ServicePoint, nullable: true })
  nextServicePoint: ServicePoint;

  // For tracking queue flow
  @Column({ name: 'previous_queue_id', nullable: true })
  previousQueueId: string;

  // Relationships
  @ManyToOne(() => Patient, { eager: true })
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

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

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'serving_user_id' })
  servingUser: User;

  @Column({ name: 'serving_user_id', nullable: true })
  servingUserId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;
}

// Queue display configuration
@Entity('queue_displays')
export class QueueDisplay extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'display_code', unique: true })
  displayCode: string;

  @Column({ name: 'service_points', type: 'jsonb' })
  servicePoints: ServicePoint[];

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

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_settings', type: 'jsonb', nullable: true })
  displaySettings: {
    showPatientName: boolean;
    showWaitTime: boolean;
    refreshInterval: number;
    maxDisplay: number;
    audioEnabled: boolean;
  };
}
