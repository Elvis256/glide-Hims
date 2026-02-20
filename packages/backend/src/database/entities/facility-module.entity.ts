import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

@Entity('facility_modules')
@Unique(['facilityId', 'moduleCode'])
@Index(['facilityId', 'enabled'])
export class FacilityModule extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 50, name: 'module_code' })
  moduleCode: string;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  settings?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
