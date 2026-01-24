import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('tenants')
export class Tenant extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;
}
