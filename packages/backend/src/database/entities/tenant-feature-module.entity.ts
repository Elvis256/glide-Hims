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

@Entity("tenant_feature_modules")
@Index(['tenantId', 'moduleKey'])
export class TenantFeatureModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 100, name: 'module_key' })
  moduleKey: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  name?: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'boolean', default: true, name: 'is_enabled' })
  isEnabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  config?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'feature_flags' })
  featureFlags?: Record<string, boolean>;

  @Column({ type: 'text', nullable: true, name: 'enable_reason' })
  enableReason?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
