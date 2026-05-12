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

export enum HealthStatus {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  OFFLINE = 'offline',
  DEGRADED = 'degraded',
}

@Entity('deployment_health')
@Index(['deploymentId', 'status'])
@Index(['deploymentId', 'createdAt'])
@Index(['status', 'updatedAt'])
export class DeploymentHealth {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'deployment_id', type: 'uuid' })
  deploymentId: string;

  @ManyToOne(() => Deployment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({
    type: 'enum',
    enum: HealthStatus,
    default: HealthStatus.HEALTHY,
  })
  status: HealthStatus;

  @Column({ type: 'integer', default: 0 })
  uptime: number;

  @Column({ type: 'float', default: 0 })
  uptimePercentage: number;

  @Column({ type: 'float', default: 0 })
  cpuUsagePercent: number;

  @Column({ type: 'float', default: 0 })
  memoryUsagePercent: number;

  @Column({ type: 'float', default: 0 })
  diskUsagePercent: number;

  @Column({ type: 'integer', default: 0 })
  errorRatePercent: number;

  @Column({ type: 'integer', default: 0 })
  responseTimeMs: number;

  @Column({ type: 'integer', default: 0 })
  requestCountPerMinute: number;

  @Column({ type: 'integer', default: 0 })
  activeConnectionsCount: number;

  @Column({ type: 'integer', default: 0 })
  queuedRequestsCount: number;

  @Column({ type: 'integer', default: 0 })
  totalErrorsLast24h: number;

  @Column({ type: 'integer', default: 0 })
  syncDelaySeconds: number;

  @Column({ type: 'text', nullable: true })
  lastErrorMessage: string;

  @Column({ type: 'timestamp', nullable: true })
  lastErrorAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastHealthCheckAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  serviceMetrics: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
