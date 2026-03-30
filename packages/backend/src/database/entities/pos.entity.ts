import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Store } from './store.entity';
import { User } from './user.entity';
import { PharmacySale } from './pharmacy-sale.entity';

// ─── POS Register ────────────────────────────────────────────────────────────

@Entity('pos_registers')
@Index(['tenantId', 'storeId'])
export class PosRegister extends BaseEntity {
  @Column()
  name: string;

  @Column({ nullable: true })
  location: string;

  @Column({ type: 'uuid', name: 'store_id' })
  storeId: string;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'store_id' })
  store: Store;

  @Column({ default: 'active' })
  status: string; // active, inactive, maintenance
}

// ─── POS Shift ───────────────────────────────────────────────────────────────

@Entity('pos_shifts')
@Index(['tenantId', 'registerId'])
@Index(['tenantId', 'cashierId'])
export class PosShift extends BaseEntity {
  @Column({ type: 'uuid', name: 'register_id' })
  registerId: string;

  @ManyToOne(() => PosRegister)
  @JoinColumn({ name: 'register_id' })
  register: PosRegister;

  @Column({ type: 'uuid', name: 'cashier_id' })
  cashierId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ type: 'timestamp', name: 'opened_at' })
  openedAt: Date;

  @Column({ type: 'timestamp', name: 'closed_at', nullable: true })
  closedAt: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'opening_balance', default: 0 })
  openingBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'closing_balance', nullable: true })
  closingBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'expected_balance', nullable: true })
  expectedBalance: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_sales', default: 0 })
  cashSales: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'mobile_money_sales', default: 0 })
  mobileMoneySales: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'card_sales', default: 0 })
  cardSales: number;

  @Column({ type: 'int', name: 'transaction_count', default: 0 })
  transactionCount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'cash_difference', nullable: true })
  cashDifference: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ default: 'open' })
  status: string; // open, closed
}

// ─── POS Payment Split ───────────────────────────────────────────────────────

@Entity('pos_payment_splits')
@Index(['tenantId', 'saleId'])
export class PosPaymentSplit extends BaseEntity {
  @Column({ type: 'uuid', name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column({ name: 'payment_method' })
  paymentMethod: string; // cash, mobile_money, card, credit

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'transaction_reference', nullable: true })
  transactionReference: string;
}

// ─── Wholesale Customer ──────────────────────────────────────────────────────

@Entity('wholesale_customers')
@Index(['tenantId', 'name'])
export class WholesaleCustomer extends BaseEntity {
  @Column()
  name: string;

  @Column({ name: 'contact_person', nullable: true })
  contactPerson: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  address: string;

  @Column({ name: 'tax_id', nullable: true })
  taxId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'credit_limit', default: 0 })
  creditLimit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'outstanding_balance', default: 0 })
  outstandingBalance: number;

  @Column({ name: 'pricing_tier', default: 'standard' })
  pricingTier: string; // standard, silver, gold, platinum

  @Column({ default: 'active' })
  status: string;
}

// ─── Pricing Tier ────────────────────────────────────────────────────────────

@Entity('pricing_tiers')
@Index(['tenantId', 'name'])
export class PricingTier extends BaseEntity {
  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'discount_percent', default: 0 })
  discountPercent: number;

  @Column({ type: 'int', name: 'min_order_amount', default: 0 })
  minOrderAmount: number;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ default: 'active' })
  status: string;
}

// ─── Delivery Tracking ──────────────────────────────────────────────────────

@Entity('deliveries')
@Index(['tenantId', 'saleId'])
@Index(['tenantId', 'customerId'])
export class Delivery extends BaseEntity {
  @Column({ type: 'uuid', name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column({ type: 'uuid', name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => WholesaleCustomer)
  @JoinColumn({ name: 'customer_id' })
  customer: WholesaleCustomer;

  @Column({ name: 'delivery_address' })
  deliveryAddress: string;

  @Column({ name: 'driver_name', nullable: true })
  driverName: string;

  @Column({ name: 'driver_phone', nullable: true })
  driverPhone: string;

  @Column({ name: 'vehicle_number', nullable: true })
  vehicleNumber: string;

  @Column({ type: 'timestamp', name: 'scheduled_at', nullable: true })
  scheduledAt: Date;

  @Column({ type: 'timestamp', name: 'dispatched_at', nullable: true })
  dispatchedAt: Date;

  @Column({ type: 'timestamp', name: 'delivered_at', nullable: true })
  deliveredAt: Date;

  @Column({ default: 'pending' })
  status: string; // pending, dispatched, in_transit, delivered, failed

  @Column({ type: 'text', nullable: true })
  notes: string;
}
