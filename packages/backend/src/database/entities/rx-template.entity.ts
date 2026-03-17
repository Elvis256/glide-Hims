import {
  Entity,
  Column,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';

export interface RxTemplateItem {
  drugName: string;
  genericName?: string;
  dose: string;
  frequency: string;
  duration: string;
  route?: string;
  quantity: number;
  instructions?: string;
}

@Entity('prescription_templates')
@Index(['tenantId', 'scope'])
@Index(['tenantId', 'condition'])
@Index(['tenantId', 'department'])
@Index(['tenantId', 'createdById'])
@Index(['usageCount'])
export class PrescriptionTemplate extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  condition: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  department: string;

  @Column({ type: 'varchar', length: 20, default: 'personal' })
  scope: 'personal' | 'department' | 'facility';

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @Column({ type: 'jsonb', default: '[]' })
  items: RxTemplateItem[];

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'usage_count', type: 'integer', default: 0 })
  usageCount: number;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string;
}
