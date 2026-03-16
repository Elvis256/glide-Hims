import { Entity, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('system_settings')
@Unique(['key', 'tenantId'])
export class SystemSetting extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;

  @Column({ type: 'text', nullable: true })
  description?: string;
}
