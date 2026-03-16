import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { User } from './user.entity';

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
export class InAppNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;

  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'target_department_id' })
  targetDepartmentId: string;

  @Column({ type: 'uuid', nullable: true, name: 'target_user_id' })
  @Index()
  targetUserId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User;

  @Column({ type: 'uuid', nullable: true, name: 'sender_user_id' })
  senderUserId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser: User;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sender_name' })
  senderName: string;

  @Column({ type: 'enum', enum: InAppNotificationType, default: InAppNotificationType.GENERAL })
  type: InAppNotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ default: false, name: 'is_read' })
  @Index()
  isRead: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'read_by_user_id' })
  readByUserId: string;

  @Column({ type: 'timestamp', nullable: true, name: 'read_at' })
  readAt: Date;
}
