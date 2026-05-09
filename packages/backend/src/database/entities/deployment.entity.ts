import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export enum DeploymentType {
  CLOUD = 'cloud',
  ONPREMISE = 'onpremise',
  HYBRID = 'hybrid',
}

export enum DeploymentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  MAINTENANCE = 'maintenance',
  PENDING = 'pending',
}

@Entity('deployments')
@Index(['tenantId', 'status'])
@Index(['deploymentType'])
export class Deployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: DeploymentType,
    name: 'deployment_type',
  })
  deploymentType: DeploymentType;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.ACTIVE,
  })
  status: DeploymentStatus;

  @Column({ type: 'varchar', length: 500, name: 'api_endpoint' })
  apiEndpoint: string;

  @Column({ type: 'varchar', length: 50, name: 'current_version' })
  currentVersion: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_sync' })
  lastSync?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_health_check' })
  lastHealthCheck?: Date;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
