import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

@Entity('tenants')
@Unique(['slug'])
@Unique(['subdomain'])
@Index(['status'])
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('varchar', { length: 100 })
  slug: string;

  @Column('varchar', { length: 255 })
  subdomain: string;

  @Column('varchar', { length: 255, nullable: true })
  logo_url: string;

  @Column('varchar', { length: 255, nullable: true })
  favicon_url: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('varchar', { length: 50, default: 'active' })
  status: 'active' | 'suspended' | 'archived';

  @Column('jsonb', { default: {} })
  configuration: Record<string, any>;

  @Column('jsonb', { default: {} })
  branding: Record<string, any>;

  @Column('varchar', { length: 50, nullable: true })
  billing_plan: 'free' | 'pro' | 'enterprise';

  @Column('integer', { default: 0 })
  user_count: number;

  @Column('integer', { default: 0 })
  deployment_count: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column('timestamp', { nullable: true })
  deleted_at: Date;
}
