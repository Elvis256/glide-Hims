import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Deployment } from './deployment.entity';

export enum ReplicationEntityType {
  DRUG = 'drug',
  PATIENT = 'patient',
  APPOINTMENT = 'appointment',
  BILLING = 'billing',
  INVENTORY = 'inventory',
  STAFF = 'staff',
  FACILITY = 'facility',
  CONFIG = 'config',
  USER = 'user',
  PERMISSION = 'permission',
  MODULE = 'module',
  OTHER = 'other',
}

export enum ReplicationOperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  BULK_UPDATE = 'bulk_update',
}

export enum ReplicationStatus {
  PENDING = 'pending',
  SENT = 'sent',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

@Entity('replication_logs')
@Index(['tenantId', 'deploymentId', 'status'])
@Index(['entityType', 'operationType'])
@Index(['createdAt', 'status'])
@Index(['deploymentId', 'status'])
export class ReplicationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'deployment_id', type: 'uuid', nullable: true })
  deploymentId: string;

  @ManyToOne(() => Deployment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({
    type: 'enum',
    enum: ReplicationEntityType,
  })
  entityType: ReplicationEntityType;

  @Column({ type: 'uuid' })
  entityId: string;

  @Column({
    type: 'enum',
    enum: ReplicationOperationType,
  })
  operationType: ReplicationOperationType;

  @Column({
    type: 'enum',
    enum: ReplicationStatus,
    default: ReplicationStatus.PENDING,
  })
  status: ReplicationStatus;

  @Column({ type: 'jsonb' })
  oldData: Record<string, any>;

  @Column({ type: 'jsonb' })
  newData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  changeSet: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'integer', default: 0 })
  retryCount: number;

  @Column({ type: 'integer', default: 0 })
  maxRetries: number;

  @Column({ type: 'integer', nullable: true })
  changesetCount: number;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  changedBy: string;

  @Column({ type: 'text', nullable: true })
  changeReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  processedAt: Date;
}
