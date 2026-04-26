import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Deployment } from './deployment.entity';
import { AppVersion } from './app-version.entity';

export enum DeploymentVersionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  ROLLED_BACK = 'rolled_back',
  FAILED = 'failed',
}

@Entity('deployment_versions')
@Index(['deploymentId', 'status'])
@Index(['appVersionId'])
export class DeploymentVersion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'deployment_id' })
  deploymentId: string;

  @ManyToOne(() => Deployment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({ type: 'uuid', name: 'app_version_id' })
  appVersionId: string;

  @ManyToOne(() => AppVersion)
  @JoinColumn({ name: 'app_version_id' })
  appVersion: AppVersion;

  @Column({
    type: 'enum',
    enum: DeploymentVersionStatus,
    default: DeploymentVersionStatus.PENDING,
  })
  status: DeploymentVersionStatus;

  @Column({ type: 'timestamp', name: 'deployed_at' })
  deployedAt: Date;

  @Column({ type: 'text', nullable: true, name: 'rollback_reason' })
  rollbackReason?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'rolled_back_at' })
  rolledBackAt?: Date;

  @Column({ type: 'jsonb', nullable: true, name: 'deployment_metadata' })
  deploymentMetadata?: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
