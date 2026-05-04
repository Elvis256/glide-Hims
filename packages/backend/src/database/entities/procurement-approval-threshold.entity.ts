import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Tenant } from './tenant.entity';

@Entity('procurement_approval_thresholds')
@Unique(['facilityId', 'tenantId'])
@Index(['facilityId'])
export class ProcurementApprovalThreshold extends BaseEntity {
  @Column({ name: 'facility_id' })
  facilityId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId?: string;

  @Column({
    name: 'level1_max_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 500,
    comment: 'Amount threshold for Level 1 (Manager) approval',
  })
  level1MaxAmount: number;

  @Column({
    name: 'level2_max_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 5000,
    comment: 'Amount threshold for Level 2 (Finance) approval',
  })
  level2MaxAmount: number;

  @Column({
    name: 'level3_max_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 50000,
    comment: 'Amount threshold for Level 3 (Director) approval',
  })
  level3MaxAmount: number;

  @Column({
    name: 'level4_max_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
    nullable: true,
    default: null,
    comment: 'Amount threshold for Level 4 (CFO) approval - null = unlimited',
  })
  level4MaxAmount?: number;

  @Column({
    name: 'require_justification_min',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 50000,
    comment: 'Minimum amount requiring emergency justification',
  })
  requireJustificationMin: number;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
  })
  isActive: boolean;

  @Column({
    name: 'notes',
    type: 'text',
    nullable: true,
  })
  notes?: string;

  // Relationships
  @ManyToOne(() => Facility, { nullable: false })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
