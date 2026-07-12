/**
 * Phase B — Retail UX entities
 * B1: PharmacyReturn, PharmacyReturnItem
 * B3: HeldSale
 * B4: DiscountApplication
 * B7: PosQuickKey
 * B8: RetailCustomer
 */

import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { PharmacySale, PharmacySaleItem } from './pharmacy-sale.entity';
import { PosShift, PosRegister } from './pos.entity';

// ─── B1: Returns / Refunds ────────────────────────────────────────────────────

export enum ReturnStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  VOIDED = 'voided',
}

@Entity('pharmacy_returns')
@Unique(['tenantId', 'returnNumber'])
@Index(['tenantId', 'originalSaleId'])
@Index(['tenantId', 'returnedAt'])
@Index(['tenantId', 'posShiftId'])
export class PharmacyReturn extends BaseEntity {
  @Column({ type: 'uuid', name: 'original_sale_id' })
  originalSaleId: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'original_sale_id' })
  originalSale: PharmacySale;

  @Column({ name: 'return_number' })
  returnNumber: string;

  @Column({ type: 'timestamptz', name: 'returned_at' })
  returnedAt: Date;

  @Column({ type: 'uuid', name: 'returned_by_id' })
  returnedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'returned_by_id' })
  returnedBy: User;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_refund', default: 0 })
  totalRefund: number;

  @Column({ name: 'payment_method', default: 'cash' })
  paymentMethod: string;

  @Column({ name: 'refund_reference', nullable: true })
  refundReference: string;

  @Column({ type: 'uuid', name: 'pos_shift_id', nullable: true })
  posShiftId: string;

  @ManyToOne(() => PosShift, { nullable: true })
  @JoinColumn({ name: 'pos_shift_id' })
  posShift: PosShift;

  @Column({ type: 'uuid', name: 'pos_register_id', nullable: true })
  posRegisterId: string;

  @Column({
    type: 'enum',
    enum: ReturnStatus,
    default: ReturnStatus.COMPLETED,
  })
  status: ReturnStatus;

  // EFRIS credit note reference (populated after acceptance)
  @Column({ name: 'efris_credit_note_id', type: 'uuid', nullable: true })
  efrisCreditNoteId: string;

  @OneToMany(() => PharmacyReturnItem, (item) => item.pharmacyReturn, { cascade: true })
  items: PharmacyReturnItem[];
}

@Entity('pharmacy_return_items')
@Index(['returnId'])
@Index(['originalSaleItemId'])
export class PharmacyReturnItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'return_id' })
  returnId: string;

  @ManyToOne(() => PharmacyReturn, (r) => r.items)
  @JoinColumn({ name: 'return_id' })
  pharmacyReturn: PharmacyReturn;

  @Column({ type: 'uuid', name: 'original_sale_item_id' })
  originalSaleItemId: string;

  @ManyToOne(() => PharmacySaleItem)
  @JoinColumn({ name: 'original_sale_item_id' })
  originalSaleItem: PharmacySaleItem;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'batch_id', nullable: true })
  batchId: string;

  @Column({ name: 'qty_returned', type: 'int' })
  qtyReturned: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'net_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  netAmount: number;

  @Column({ name: 'gross_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  grossAmount: number;

  @Column({ name: 'restockable', default: true })
  restockable: boolean;
}

// ─── B2: Sale void audit ──────────────────────────────────────────────────────
// The void data is stored directly on PharmacySale via nullable columns added
// in the migration (see pharmacy-sale.entity.ts for the new columns).

// ─── B3: Hold / Park Sale ────────────────────────────────────────────────────

@Entity('held_sales')
@Index(['tenantId', 'posShiftId'])
@Index(['tenantId', 'posRegisterId'])
@Index(['tenantId', 'cashierId'])
@Index(['tenantId', 'heldAt'])
export class HeldSale extends BaseEntity {
  @Column({ type: 'uuid', name: 'pos_shift_id', nullable: true })
  posShiftId: string;

  @ManyToOne(() => PosShift, { nullable: true })
  @JoinColumn({ name: 'pos_shift_id' })
  posShift: PosShift;

  @Column({ type: 'uuid', name: 'pos_register_id', nullable: true })
  posRegisterId: string;

  @ManyToOne(() => PosRegister, { nullable: true })
  @JoinColumn({ name: 'pos_register_id' })
  posRegister: PosRegister;

  @Column({ type: 'uuid', name: 'cashier_id' })
  cashierId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'cashier_id' })
  cashier: User;

  @Column({ name: 'customer_name', nullable: true })
  customerName: string;

  @Column({ name: 'customer_phone', nullable: true })
  customerPhone: string;

  /** Full cart state serialized to JSONB */
  @Column({ name: 'cart_snapshot', type: 'jsonb' })
  cartSnapshot: Record<string, unknown>;

  @Column({ name: 'hold_reason', nullable: true })
  holdReason: string;

  @Column({ type: 'timestamptz', name: 'held_at' })
  heldAt: Date;

  /** 12-hour TTL — cron sweeps rows where held_at < NOW() - INTERVAL '12 hours' */
  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;
}

// ─── B4: Discount Application Audit Log ──────────────────────────────────────

export enum DiscountType {
  LINE = 'line',
  CART = 'cart',
  PROMO = 'promo',
}

export enum DiscountValueType {
  PERCENT = 'percent',
  AMOUNT = 'amount',
}

@Entity('discount_applications')
@Index(['tenantId', 'saleId'])
export class DiscountApplication extends BaseEntity {
  @Column({ type: 'uuid', name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column({ type: 'uuid', name: 'sale_item_id', nullable: true })
  saleItemId: string;

  @ManyToOne(() => PharmacySaleItem, { nullable: true })
  @JoinColumn({ name: 'sale_item_id' })
  saleItem: PharmacySaleItem;

  @Column({ type: 'enum', enum: DiscountType, default: DiscountType.LINE })
  type: DiscountType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  value: number;

  @Column({
    name: 'value_type',
    type: 'enum',
    enum: DiscountValueType,
    default: DiscountValueType.AMOUNT,
  })
  valueType: DiscountValueType;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'uuid', name: 'approver_id', nullable: true })
  approverId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  /** bcrypt hash of the manager PIN used to approve; never store plaintext */
  @Column({ name: 'approver_pin_hash', nullable: true })
  approverPinHash: string;

  @Column({ type: 'uuid', name: 'applied_by_id' })
  appliedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'applied_by_id' })
  appliedBy: User;

  @Column({ type: 'timestamptz', name: 'applied_at' })
  appliedAt: Date;
}

// ─── B6: Receipt Reprint Audit ───────────────────────────────────────────────

@Entity('receipt_reprints')
@Index(['tenantId', 'saleId'])
export class ReceiptReprint extends BaseEntity {
  @Column({ type: 'uuid', name: 'sale_id' })
  saleId: string;

  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale: PharmacySale;

  @Column({ name: 'reprinted_by_id', type: 'uuid' })
  reprintedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'reprinted_by_id' })
  reprintedBy: User;

  @Column({ name: 'reprint_count', type: 'int', default: 1 })
  reprintCount: number;

  @Column({ name: 'reprinted_at', type: 'timestamptz' })
  reprintedAt: Date;
}

// ─── B7: POS Quick Keys ───────────────────────────────────────────────────────

@Entity('pos_quick_keys')
@Index(['tenantId', 'registerId'])
@Unique('UQ_quick_key_position', ['tenantId', 'registerId', 'position'])
export class PosQuickKey extends BaseEntity {
  @Column({ type: 'uuid', name: 'register_id', nullable: true })
  registerId: string;

  @ManyToOne(() => PosRegister, { nullable: true })
  @JoinColumn({ name: 'register_id' })
  register: PosRegister;

  @Column({ type: 'int' })
  position: number;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column()
  label: string;

  @Column({ nullable: true })
  color: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}

// ─── B8: Retail Customer ─────────────────────────────────────────────────────

@Entity('retail_customers')
@Index(['tenantId', 'phone'])
@Unique('UQ_retail_customer_tenant_phone', ['tenantId', 'phone'])
export class RetailCustomer extends BaseEntity {
  @Column()
  phone: string;

  @Column({ nullable: true })
  name: string;

  @Column({ name: 'total_visits', type: 'int', default: 0 })
  totalVisits: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_spend', default: 0 })
  totalSpend: number;

  @Column({ type: 'timestamptz', name: 'first_seen_at', nullable: true })
  firstSeenAt: Date;

  @Column({ type: 'timestamptz', name: 'last_seen_at', nullable: true })
  lastSeenAt: Date;
}
