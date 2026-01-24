import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

@Entity('facilities')
export class Facility extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 100 })
  type: string; // clinic, hospital, pharmacy, etc.

  @Column({ type: 'uuid', name: 'parent_facility_id', nullable: true })
  parentFacilityId?: string;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'parent_facility_id' })
  parentFacility?: Facility;

  @Column({ type: 'text', nullable: true })
  location?: string;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ type: 'jsonb', nullable: true })
  contact?: Record<string, any>; // phone, email, etc.

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;
}
