import { Entity, Column, ManyToOne, JoinColumn, OneToMany, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Supplier } from './supplier.entity';
import { User } from './user.entity';

export enum CreditNoteType {
  CREDIT_NOTE = 'credit_note',
  DEBIT_NOTE = 'debit_note',
}

export enum CreditNoteReason {
  GOODS_RETURNED = 'goods_returned',
  DAMAGED_GOODS = 'damaged_goods',
  PRICING_ERROR = 'pricing_error',
  QUANTITY_DISCREPANCY = 'quantity_discrepancy',
  QUALITY_ISSUE = 'quality_issue',
  EXPIRED_GOODS = 'expired_goods',
  OVERCHARGE = 'overcharge',
  UNDERCHARGE = 'undercharge',
  OTHER = 'other',
}

export enum CreditNoteStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  APPLIED = 'applied',
  CANCELLED = 'cancelled',
}

@Entity('supplier_credit_notes')
@Unique(['tenantId', 'noteNumber'])
@Index(['noteNumber'], { unique: true, where: 'deleted_at IS NULL' })
export class SupplierCreditNote extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ type: 'varchar', length: 50, name: 'note_number' })
  noteNumber: string;

  @Column({
    type: 'enum',
    enum: CreditNoteType,
    name: 'note_type',
  })
  noteType: CreditNoteType;

  @Column({ type: 'uuid', name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ type: 'date', name: 'note_date' })
  noteDate: Date;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'supplier_invoice_number' })
  supplierInvoiceNumber?: string;

  @Column({ type: 'uuid', nullable: true, name: 'grn_id' })
  grnId?: string;

  @Column({
    type: 'enum',
    enum: CreditNoteReason,
  })
  reason: CreditNoteReason;

  @Column({ type: 'text', nullable: true, name: 'reason_details' })
  reasonDetails?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'subtotal_amount' })
  subtotalAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: CreditNoteStatus,
    default: CreditNoteStatus.DRAFT,
  })
  status: CreditNoteStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'applied_amount' })
  appliedAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'balance_amount' })
  balanceAmount: number;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by' })
  createdByUser: User;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser?: User;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @OneToMany(() => SupplierCreditNoteItem, (item) => item.creditNote)
  items: SupplierCreditNoteItem[];
}

@Entity('supplier_credit_note_items')
export class SupplierCreditNoteItem extends BaseEntity {
  @Column({ type: 'uuid', name: 'credit_note_id' })
  creditNoteId: string;

  @ManyToOne(() => SupplierCreditNote, (note) => note.items)
  @JoinColumn({ name: 'credit_note_id' })
  creditNote: SupplierCreditNote;

  @Column({ type: 'uuid', nullable: true, name: 'item_id' })
  itemId?: string;

  @Column({ type: 'varchar', length: 255 })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  quantity: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  unit?: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'unit_price' })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0, name: 'tax_rate' })
  taxRate: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'tax_amount' })
  taxAmount: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, name: 'total_amount' })
  totalAmount: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'batch_number' })
  batchNumber?: string;
}

/**
 * A single application of a credit/debit note against a payment voucher.
 *
 * A note can be split across several vouchers, so the link lives here rather
 * than as a column on either side. Reversal is recorded rather than deleted,
 * so a cancelled voucher still shows what was returned and when.
 */
@Entity('supplier_credit_note_applications')
@Index(['creditNoteId'])
@Index(['paymentVoucherId'])
export class SupplierCreditNoteApplication extends BaseEntity {
  @Column({ type: 'uuid', name: 'credit_note_id' })
  creditNoteId: string;

  @Column({ type: 'uuid', name: 'payment_voucher_id' })
  paymentVoucherId: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'uuid', nullable: true, name: 'applied_by' })
  appliedBy?: string;

  @Column({ type: 'timestamptz', name: 'applied_at', default: () => 'CURRENT_TIMESTAMP' })
  appliedAt: Date;

  /** Set when the voucher was cancelled and the credit handed back. */
  @Column({ type: 'timestamptz', nullable: true, name: 'reversed_at' })
  reversedAt?: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'reversed_by' })
  reversedBy?: string | null;
}
