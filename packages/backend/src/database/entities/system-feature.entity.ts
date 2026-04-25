import { Entity, Column, Index, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

/**
 * System Feature - Global feature definitions (not tenant-specific)
 * Used to define available features system-wide
 */
@Entity('system_features')
export class SystemFeature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 100, unique: true, name: 'feature_key' })
  featureKey: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  category: string;

  @Column({ type: 'boolean', default: true, name: 'default_enabled' })
  defaultEnabled: boolean;

  @Column({ type: 'varchar', length: 50, default: 'standard', name: 'min_license_type' })
  minLicenseType: 'trial' | 'standard' | 'professional' | 'enterprise';

  @Column({ type: 'jsonb', nullable: true })
  dependencies: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
