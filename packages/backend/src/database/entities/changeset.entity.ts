import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Deployment } from './deployment.entity';

export enum ChangeSetStatus {
  PENDING = 'pending',
  READY = 'ready',
  APPLYING = 'applying',
  APPLIED = 'applied',
  FAILED = 'failed',
  ROLLED_BACK = 'rolled_back',
}

@Entity('change_sets')
@Index(['tenantId', 'status'])
@Index(['deploymentId', 'status'])
@Index(['createdAt', 'status'])
@Index(['batchId'])
export class ChangeSet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column('uuid', { nullable: true })
  deploymentId: string;

  @ManyToOne(() => Deployment, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({ type: 'varchar', length: 255 })
  batchId: string;

  @Column({
    type: 'enum',
    enum: ChangeSetStatus,
    default: ChangeSetStatus.PENDING,
  })
  status: ChangeSetStatus;

  @Column({ type: 'integer', default: 0 })
  changeCount: number;

  @Column({ type: 'jsonb' })
  changes: Array<{
    entityId: string;
    entityType: string;
    operationType: 'create' | 'update' | 'delete';
    oldData?: Record<string, any>;
    newData?: Record<string, any>;
  }>;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'integer', default: 0 })
  successCount: number;

  @Column({ type: 'integer', default: 0 })
  failureCount: number;

  @Column({ type: 'text', nullable: true })
  failureReason: string;

  @Column({ type: 'boolean', default: false })
  canRollback: boolean;

  @Column({ type: 'timestamp', nullable: true })
  appliedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  rolledBackAt: Date;

  @Column({ type: 'uuid', nullable: true })
  appliedBy: string;

  @Column({ type: 'uuid', nullable: true })
  rolledBackBy: string;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'text', nullable: true })
  sourceSystem: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
