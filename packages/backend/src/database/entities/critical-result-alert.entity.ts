import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Patient } from './patient.entity';
import { User } from './user.entity';

/**
 * Critical / abnormal result acknowledgement loop.
 *
 * One row per (resourceType, resourceId) flagged finding. Created when a Lab
 * or Radiology result is finalised with a critical/abnormal flag; closed
 * when the assigned (ordering) provider acknowledges with note + action,
 * or escalated to senior staff if the SLA window lapses.
 *
 * Compliance driver: JCI/ISO patient-safety standards require closed-loop
 * communication of critical results with timestamped sign-off.
 */
export type CriticalResultResourceType = 'lab' | 'radiology';

export type CriticalResultSeverity = 'critical_low' | 'critical_high' | 'critical' | 'abnormal';

export type CriticalResultStatus =
  | 'pending'
  | 'acknowledged'
  | 'escalated'
  | 'resolved'
  | 'cancelled';

@Entity('critical_result_alerts')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'assignedToId', 'status'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'resourceType', 'resourceId'], { unique: true })
export class CriticalResultAlert extends BaseEntity {
  @Column({ name: 'resource_type', type: 'varchar', length: 24 })
  resourceType: CriticalResultResourceType;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @Column({ name: 'order_id', type: 'uuid', nullable: true })
  orderId?: string | null;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @ManyToOne(() => Patient, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'patient_id' })
  patient?: Patient;

  @Column({ name: 'encounter_id', type: 'uuid', nullable: true })
  encounterId?: string | null;

  @Column({ type: 'varchar', length: 24 })
  severity: CriticalResultSeverity;

  @Column({ type: 'text', nullable: true })
  summary?: string | null;

  @Column({ name: 'flagged_at', type: 'timestamptz' })
  flaggedAt: Date;

  @Column({ name: 'flagged_by_id', type: 'uuid', nullable: true })
  flaggedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'flagged_by_id' })
  flaggedBy?: User | null;

  @Column({ name: 'assigned_to_id', type: 'uuid', nullable: true })
  assignedToId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to_id' })
  assignedTo?: User | null;

  @Column({ type: 'varchar', length: 24, default: 'pending' })
  status: CriticalResultStatus;

  @Column({ name: 'sla_deadline', type: 'timestamptz' })
  slaDeadline: Date;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt?: Date | null;

  @Column({ name: 'acknowledged_by_id', type: 'uuid', nullable: true })
  acknowledgedById?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'acknowledged_by_id' })
  acknowledgedBy?: User | null;

  @Column({ name: 'acknowledgement_note', type: 'text', nullable: true })
  acknowledgementNote?: string | null;

  @Column({ name: 'action_taken', type: 'text', nullable: true })
  actionTaken?: string | null;

  @Column({ name: 'follow_up_order_id', type: 'uuid', nullable: true })
  followUpOrderId?: string | null;

  @Column({ name: 'escalated_at', type: 'timestamptz', nullable: true })
  escalatedAt?: Date | null;

  @Column({ name: 'escalated_to_id', type: 'uuid', nullable: true })
  escalatedToId?: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'escalated_to_id' })
  escalatedTo?: User | null;

  @Column({ name: 'escalation_level', type: 'int', default: 0 })
  escalationLevel: number;

  @Column({ name: 'last_notified_at', type: 'timestamptz', nullable: true })
  lastNotifiedAt?: Date | null;
}
