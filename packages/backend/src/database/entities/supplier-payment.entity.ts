import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Supplier } from './supplier.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { User } from './user.entity';

export enum PaymentVoucherStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  PAID = 'paid',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CASH = 'cash',
  BANK_TRANSFER = 'bank_transfer',
  CHEQUE = 'cheque',
  MOBILE_MONEY = 'mobile_money',
  CREDIT_CARD = 'credit_card',
}

@Entity('supplier_payments')
@Index(['voucherNumber'], { unique: true, where: 'deleted_at IS NULL' })
export class SupplierPayment extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 50, name: 'voucher_number' })
  voucherNumber: string;

  @Column({ type: 'uuid', name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'uuid', nullable: true, name: 'purchase_order_id' })
  purchaseOrderId?: string;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PurchaseOrder;

  @Column({ type: 'date', name: 'payment_date' })
  paymentDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'gross_amount' })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'withholding_tax' })
  withholdingTax: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'other_deductions' })
  otherDeductions: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'net_amount' })
  netAmount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    name: 'payment_method',
  })
  paymentMethod: PaymentMethod;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'cheque_number' })
  chequeNumber?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'bank_reference' })
  bankReference?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'bank_name' })
  bankName?: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'account_number' })
  accountNumber?: string;

  @Column({
    type: 'enum',
    enum: PaymentVoucherStatus,
    default: PaymentVoucherStatus.DRAFT,
  })
  status: PaymentVoucherStatus;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text', nullable: true })
  remarks?: string;

  @Column({ type: 'uuid', name: 'prepared_by' })
  preparedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'prepared_by' })
  preparedByUser: User;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser?: User;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'paid_by' })
  paidBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'paid_by' })
  paidByUser?: User;

  @Column({ type: 'timestamp', nullable: true, name: 'paid_at' })
  paidAt?: Date;

  @Column({ type: 'uuid', nullable: true, name: 'journal_entry_id' })
  journalEntryId?: string;

  @OneToMany(() => SupplierPaymentItem, item => item.payment)
  items: SupplierPaymentItem[];
}

@Entity('supplier_payment_items')
export class SupplierPaymentItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'payment_id' })
  paymentId: string;

  @ManyToOne(() => SupplierPayment, payment => payment.items)
  @JoinColumn({ name: 'payment_id' })
  payment: SupplierPayment;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'invoice_number' })
  invoiceNumber?: string;

  @Column({ type: 'date', nullable: true, name: 'invoice_date' })
  invoiceDate?: Date;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'uuid', nullable: true, name: 'grn_id' })
  grnId?: string;
}
