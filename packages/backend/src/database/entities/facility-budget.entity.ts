import { Entity, Column, ManyToOne, JoinColumn, Index, Unique, OneToMany } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Tenant } from './tenant.entity';
import { BudgetReservation } from './budget-reservation.entity';

@Entity('facility_budgets')
@Unique(['facilityId', 'tenantId', 'fiscalYearStart'])
@Index(['facilityId'])
@Index(['fiscalYearStart'])
export class FacilityBudget extends BaseEntity {
  @Column({ name: 'facility_id' })
  facilityId: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId?: string;

  @Column({
    name: 'fiscal_year_start',
    type: 'date',
    comment: 'Start date of fiscal year (e.g., 2026-01-01)',
  })
  fiscalYearStart: Date;

  @Column({
    name: 'fiscal_year_end',
    type: 'date',
    nullable: true,
    comment: 'End date of fiscal year (e.g., 2026-12-31)',
  })
  fiscalYearEnd?: Date;

  @Column({
    name: 'total_budget_allocation',
    type: 'decimal',
    precision: 12,
    scale: 2,
    comment: 'Total budget allocated for fiscal year',
  })
  totalBudgetAllocation: number;

  @Column({
    name: 'notes',
    type: 'text',
    nullable: true,
    comment: 'Notes about budget (e.g., restrictions, approvals)',
  })
  notes?: string;

  @Column({
    name: 'is_active',
    type: 'boolean',
    default: true,
    comment: 'Whether this budget is currently active',
  })
  isActive: boolean;

  // Relationships
  @ManyToOne(() => Facility, { nullable: false })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => BudgetReservation, (res) => res.budget, {
    cascade: true,
  })
  reservations: BudgetReservation[];
}
