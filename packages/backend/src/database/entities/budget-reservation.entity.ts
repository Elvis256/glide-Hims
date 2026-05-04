import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { FacilityBudget } from './facility-budget.entity';

export enum ReservationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  RELEASED = 'released',
  SPENT = 'spent',
}

@Entity('budget_reservations')
@Index(['budgetId'])
@Index(['documentId'])
@Index(['status'])
export class BudgetReservation extends BaseEntity {
  @Column({ name: 'budget_id' })
  budgetId: string;

  @Column({
    name: 'document_id',
    comment: 'ID of PR or PO that reserved this budget',
  })
  documentId: string;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 10,
    comment: 'Type: PR (Purchase Request) or PO (Purchase Order)',
  })
  documentType: string; // 'PR' or 'PO'

  @Column({
    name: 'reserved_amount',
    type: 'decimal',
    precision: 12,
    scale: 2,
  })
  reservedAmount: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  @Column({
    name: 'remarks',
    type: 'text',
    nullable: true,
  })
  remarks?: string;

  @Column({
    name: 'tenant_id',
    nullable: true,
  })
  tenantId?: string;

  // Relationships
  @ManyToOne(() => FacilityBudget, (budget) => budget.reservations)
  @JoinColumn({ name: 'budget_id' })
  budget: FacilityBudget;
}
