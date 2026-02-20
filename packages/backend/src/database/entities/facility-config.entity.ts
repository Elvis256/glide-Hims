import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';

@Entity('facility_configs')
@Index(['facilityId'])
export class FacilityConfig extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id', unique: true })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 50, name: 'facility_type' })
  facilityType: string; // FacilityType enum

  @Column({ type: 'boolean', name: 'single_user_mode', default: false })
  singleUserMode: boolean;

  @Column({ type: 'boolean', name: 'auto_login', default: false })
  autoLogin: boolean;

  @Column({ type: 'uuid', name: 'default_user_id', nullable: true })
  defaultUserId?: string;

  @Column({ type: 'boolean', name: 'multi_site_enabled', default: false })
  multiSiteEnabled: boolean;

  @Column({ type: 'boolean', name: 'setup_completed', default: false })
  setupCompleted: boolean;

  @Column({ type: 'jsonb', nullable: true })
  uiPreferences?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  workflowSettings?: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  notes?: string;
}
