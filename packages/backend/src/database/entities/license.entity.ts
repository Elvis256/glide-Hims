import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

/**
 * License entity - Stores license keys and their validation state
 * Used for on-premise deployments to control access
 */
@Entity('licenses')
export class License {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, unique: true, name: 'license_key' })
  licenseKey: string;

  @Column({ type: 'varchar', length: 255, name: 'organization_name' })
  organizationName: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'expired' | 'suspended' | 'revoked';

  @Column({ type: 'varchar', length: 50, name: 'license_type' })
  licenseType: 'trial' | 'standard' | 'professional' | 'enterprise';

  @Column({ type: 'timestamp', name: 'issued_at' })
  issuedAt: Date;

  @Column({ type: 'timestamp', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'int', default: 50, name: 'max_users' })
  maxUsers: number;

  @Column({ type: 'int', default: 1, name: 'max_facilities' })
  maxFacilities: number;

  @Column({ type: 'jsonb', nullable: true, name: 'enabled_modules' })
  enabledModules: string[];

  @Column({ type: 'jsonb', nullable: true })
  features: Record<string, boolean>;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'hardware_id' })
  hardwareId: string;

  @Column({ type: 'timestamp', nullable: true, name: 'last_validated_at' })
  lastValidatedAt: Date;

  @Column({ type: 'int', default: 0, name: 'validation_failures' })
  validationFailures: number;

  @Column({ type: 'text', nullable: true })
  signature: string;

  // For multi-tenant SaaS, a license can be tied to a specific tenant
  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
