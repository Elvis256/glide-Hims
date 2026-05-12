import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Deployment } from './deployment.entity';
import { UpdateRollout } from './update-rollout.entity';

export enum NotificationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
  ACKNOWLEDGED = 'acknowledged',
}

export enum NotificationType {
  UPDATE_AVAILABLE = 'update_available',
  UPDATE_STARTED = 'update_started',
  UPDATE_COMPLETED = 'update_completed',
  UPDATE_FAILED = 'update_failed',
  ROLLBACK_INITIATED = 'rollback_initiated',
  ROLLBACK_COMPLETED = 'rollback_completed',
  FEATURE_FLAG_CHANGED = 'feature_flag_changed',
  MAINTENANCE_SCHEDULED = 'maintenance_scheduled',
  SYSTEM_ALERT = 'system_alert',
}

@Entity('update_notifications')
@Index(['deploymentId', 'status'])
@Index(['notificationType', 'createdAt'])
@Index(['updateRolloutId', 'status'])
export class UpdateNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deployment_id', type: 'uuid' })
  deploymentId: string;

  @ManyToOne(() => Deployment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({ name: 'update_rollout_id', type: 'uuid', nullable: true })
  updateRolloutId: string;

  @ManyToOne(() => UpdateRollout, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'update_rollout_id' })
  updateRollout: UpdateRollout;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.UPDATE_AVAILABLE,
  })
  notificationType: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
  })
  status: NotificationStatus;

  @Column({ type: 'text' })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'integer', default: 3 })
  maxRetries: number;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  deliveredAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  failedAt: Date;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'text', nullable: true })
  deploymentResponse: string;

  @Column({ type: 'uuid', nullable: true })
  sentBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  scheduledFor: Date;
}
