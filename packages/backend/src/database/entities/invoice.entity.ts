import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';
import { Patient } from './patient.entity';

export enum InvoiceStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  PARTIALLY_PAID = 'partially_paid',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

@Entity('invoices')
@Index(['invoiceNumber'], { unique: true })
@Index(['encounter'])
@Index(['patient'])
@Index(['status', 'createdAt'])
export class Invoice extends BaseEntity {
  @Column({ name: 'invoice_number', unique: true })
  invoiceNumber: string;

  @Column({
    type: 'enum',
    enum: InvoiceStatus,
    default: InvoiceStatus.PENDING,
  })
  status: InvoiceStatus;

  @Column({ name: 'subtotal', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'amount_paid', type: 'decimal', precision: 12, scale: 2, default: 0 })
  amountPaid: number;

  @Column({ name: 'balance_due', type: 'decimal', precision: 12, scale: 2, default: 0 })
  balanceDue: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'due_date', type: 'date', nullable: true })
  dueDate: Date;

  // Relationships
  @ManyToOne(() => Patient)
  @JoinColumn({ name: 'patient_id' })
  patient: Patient;

  @Column({ name: 'patient_id' })
  patientId: string;

  @ManyToOne(() => Encounter, { nullable: true })
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id', nullable: true })
  encounterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice, { cascade: true })
  items: InvoiceItem[];

  @OneToMany(() => Payment, (payment) => payment.invoice)
  payments: Payment[];
}

export enum ChargeType {
  CONSULTATION = 'consultation',
  PROCEDURE = 'procedure',
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  PHARMACY = 'pharmacy',
  BED = 'bed',
  NURSING = 'nursing',
  OTHER = 'other',
}

@Entity('invoice_items')
@Index(['invoice'])
export class InvoiceItem extends BaseEntity {
  @Column({ name: 'service_code' })
  serviceCode: string;

  @Column()
  description: string;

  @Column({
    name: 'charge_type',
    type: 'enum',
    enum: ChargeType,
    default: ChargeType.OTHER,
  })
  chargeType: ChargeType;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 1 })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ name: 'tax_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxPercent: number;

  // Reference to the source (order ID, prescription ID, etc.)
  @Column({ name: 'reference_type', nullable: true })
  referenceType: string;

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  // Relationships
  @ManyToOne(() => Invoice, (invoice) => invoice.items)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  MOBILE_MONEY = 'mobile_money',
  BANK_TRANSFER = 'bank_transfer',
  INSURANCE = 'insurance',
  CHEQUE = 'cheque',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
@Index(['invoice'])
@Index(['receiptNumber'], { unique: true })
@Index(['paidAt'])
export class Payment extends BaseEntity {
  @Column({ name: 'receipt_number', unique: true })
  receiptNumber: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
  })
  method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.COMPLETED,
  })
  status: PaymentStatus;

  @Column({ name: 'transaction_reference', nullable: true })
  transactionReference: string; // External reference (mobile money, card, etc.)

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'paid_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  paidAt: Date;

  // Relationships
  @ManyToOne(() => Invoice, (invoice) => invoice.payments)
  @JoinColumn({ name: 'invoice_id' })
  invoice: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ name: 'received_by_id' })
  receivedById: string;
}
