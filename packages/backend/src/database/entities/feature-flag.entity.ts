import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Feature Flag entity - Controls feature availability per tenant
 */
@Entity('feature_flags')
export class FeatureFlag extends BaseEntity {
  @Index()
  @Column({ type: 'varchar', length: 100, name: 'feature_key' })
  featureKey: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'boolean', default: false, name: 'is_enabled' })
  isEnabled: boolean;

  @Column({ type: 'varchar', length: 50, default: 'boolean', name: 'value_type' })
  valueType: 'boolean' | 'string' | 'number' | 'json';

  @Column({ type: 'text', nullable: true, name: 'value' })
  value: string;

  @Column({ type: 'varchar', length: 50, default: 'feature' })
  category: 'feature' | 'module' | 'experiment' | 'config';

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
