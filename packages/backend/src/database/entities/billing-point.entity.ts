import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum BillingPointType {
  CENTRAL = 'central',
  PHARMACY = 'pharmacy',
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  OPD = 'opd',
  IPD = 'ipd',
  EMERGENCY = 'emergency',
  THEATRE = 'theatre',
}

@Entity('billing_points')
@Index(['code'], { unique: true })
@Index(['facility'])
export class BillingPoint extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: BillingPointType,
    default: BillingPointType.CENTRAL,
  })
  type: BillingPointType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'can_collect_payment', default: true })
  canCollectPayment: boolean;

  @Column({ name: 'can_create_invoice', default: true })
  canCreateInvoice: boolean;

  @Column({ name: 'can_give_discount', default: false })
  canGiveDiscount: boolean;

  @Column({ name: 'max_discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  maxDiscountPercent: number;

  @Column({ name: 'printer_name', nullable: true })
  printerName: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;
}

@Entity('cashier_sessions')
@Index(['billingPoint', 'openedAt'])
@Index(['cashier', 'status'])
export class CashierSession extends BaseEntity {
  @Column({ name: 'session_number', unique: true })
  sessionNumber: string;

  @ManyToOne(() => BillingPoint)
  @JoinColumn({ name: 'billing_point_id' })
  billingPoint: BillingPoint;

  @Column({ name: 'billing_point_id' })
  billingPointId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'cashier_id' })
  cashierId: string;

  @Column({ name: 'opening_balance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  openingBalance: number;

  @Column({ name: 'closing_balance', type: 'decimal', precision: 12, scale: 2, nullable: true })
  closingBalance: number;

  @Column({ name: 'total_cash', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCash: number;

  @Column({ name: 'total_card', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalCard: number;

  @Column({ name: 'total_mobile', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalMobile: number;

  @Column({ name: 'total_insurance', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalInsurance: number;

  @Column({ name: 'transactions_count', default: 0 })
  transactionsCount: number;

  @Column({ default: 'open' })
  status: string; // open, closed, reconciled

  @Column({ name: 'opened_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  openedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'jsonb', nullable: true })
  denominations: Record<string, number>; // Cash denomination breakdown
}
