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
import { Deployment } from './deployment.entity';

@Entity('deployment_configs')
@Index(['deploymentId', 'configKey'])
export class DeploymentConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'deployment_id' })
  deploymentId: string;

  @ManyToOne(() => Deployment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'deployment_id' })
  deployment: Deployment;

  @Column({ type: 'varchar', length: 255, name: 'config_key' })
  configKey: string;

  @Column({ type: 'text', name: 'config_value' })
  configValue: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'data_type' })
  dataType?: string; // string, number, boolean, json

  @Column({ type: 'text', nullable: true, name: 'override_reason' })
  overrideReason?: string;

  @Column({ type: 'text', nullable: true, name: 'description' })
  description?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
