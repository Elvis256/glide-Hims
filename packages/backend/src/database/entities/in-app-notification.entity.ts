import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';

export enum InAppNotificationType {
  PATIENT_QUEUED = 'PATIENT_QUEUED',
  PATIENT_TRANSFERRED = 'PATIENT_TRANSFERRED',
  PATIENT_CALLED = 'PATIENT_CALLED',
  LAB_ORDER_CREATED = 'LAB_ORDER_CREATED',
  LAB_SAMPLE_COLLECTED = 'LAB_SAMPLE_COLLECTED',
  LAB_RESULT_READY = 'LAB_RESULT_READY',
  RADIOLOGY_ORDER_CREATED = 'RADIOLOGY_ORDER_CREATED',
  RADIOLOGY_RESULT_READY = 'RADIOLOGY_RESULT_READY',
  PRESCRIPTION_CREATED = 'PRESCRIPTION_CREATED',
  PRESCRIPTION_DISPENSED = 'PRESCRIPTION_DISPENSED',
  INVOICE_CREATED = 'INVOICE_CREATED',
  ENCOUNTER_STATUS_CHANGED = 'ENCOUNTER_STATUS_CHANGED',
  GENERAL = 'GENERAL',
}

@Entity('in_app_notifications')
@Index(['facilityId', 'targetDepartmentId', 'isRead'])
@Index(['facilityId', 'targetUserId', 'isRead'])
export class InAppNotification extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'uuid', name: 'target_department_id', nullable: true })
  targetDepartmentId?: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'target_department_id' })
  targetDepartment?: Department;

  // When notification is for a specific user (e.g., the ordering doctor)
  @Column({ type: 'uuid', name: 'target_user_id', nullable: true })
  targetUserId?: string;

  // Who triggered this notification
  @Column({ type: 'uuid', name: 'sender_user_id', nullable: true })
  senderUserId?: string;

  @Column({ type: 'varchar', length: 100, name: 'sender_name', nullable: true })
  senderName?: string;

  @Column({
    type: 'enum',
    enum: InAppNotificationType,
    default: InAppNotificationType.GENERAL,
  })
  type: InAppNotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  // Store related IDs (patientId, encounterId, orderId, etc.)
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, any>;

  @Column({ type: 'boolean', name: 'is_read', default: false })
  isRead: boolean;

  @Column({ type: 'uuid', name: 'read_by_user_id', nullable: true })
  readByUserId?: string;

  @Column({ type: 'timestamp', name: 'read_at', nullable: true })
  readAt?: Date;
}
