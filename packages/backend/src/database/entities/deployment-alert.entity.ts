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

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
  RESOLVED = 'resolved',
}

export enum AlertStatus {
  OPEN = 'open',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  ESCALATED = 'escalated',
  FALSE_POSITIVE = 'false_positive',
}

export enum AlertType {
  HIGH_ERROR_RATE = 'high_error_rate',
  HIGH_CPU = 'high_cpu',
  HIGH_MEMORY = 'high_memory',
  HIGH_DISK = 'high_disk',
  SLOW_RESPONSE = 'slow_response',
  SYNC_DELAY = 'sync_delay',
  CONNECTION_FAILURE = 'connection_failure',
  DEPLOYMENT_OFFLINE = 'deployment_offline',
  VERSION_MISMATCH = 'version_mismatch',
  LICENSE_EXPIRED = 'license_expired',
  QUOTA_EXCEEDED = 'quota_exceeded',
  DATA_INTEGRITY = 'data_integrity',
  REPLICATION_FAILED = 'replication_failed',
  UNKNOWN = 'unknown',
}

@Entity('deployment_alerts')
@Index(['deploymentId', 'status'])
@Index(['status', 'severity'])
@Index(['alertType', 'createdAt'])
@Index(['deploymentId', 'createdAt'])
export class DeploymentAlert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deployment_id', type: 'uuid' })
  deploymentId: string;

  @ManyToOne(() => Deployment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({
    type: 'enum',
    enum: AlertType,
    default: AlertType.UNKNOWN,
  })
  alertType: AlertType;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.WARNING,
  })
  severity: AlertSeverity;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.OPEN,
  })
  status: AlertStatus;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'integer', default: 1 })
  occurrenceCount: number;

  @Column({ type: 'integer', default: 0 })
  acknowledgedCount: number;

  @Column({ type: 'text', nullable: true })
  triggerCondition: string;

  @Column({ type: 'text', nullable: true })
  threshold: string;

  @Column({ type: 'text', nullable: true })
  actualValue: string;

  @Column({ type: 'integer', default: 0 })
  notificationsSent: number;

  @Column({ type: 'boolean', default: false })
  escalated: boolean;

  @Column({ type: 'text', nullable: true })
  escalationReason: string;

  @Column({ type: 'timestamp', nullable: true })
  escalatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'text', nullable: true })
  acknowledgmentNotes: string;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  resolvedBy: string;

  @Column({ type: 'text', nullable: true })
  resolutionNotes: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
