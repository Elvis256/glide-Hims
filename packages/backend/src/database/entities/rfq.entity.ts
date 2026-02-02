import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { PurchaseRequest } from './purchase-request.entity';
import { Supplier } from './supplier.entity';

export enum RFQStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  PENDING_RESPONSES = 'pending_responses',
  RESPONSES_RECEIVED = 'responses_received',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
}

@Entity('rfqs')
@Index(['rfqNumber'], { unique: true })
@Index(['status'])
@Index(['createdAt'])
export class RFQ extends BaseEntity {
  @Column({ name: 'rfq_number', unique: true })
  rfqNumber: string;

  @Column()
  title: string;

  @Column({
    type: 'enum',
    enum: RFQStatus,
    default: RFQStatus.DRAFT,
  })
  status: RFQStatus;

  @Column({ name: 'deadline', type: 'date' })
  deadline: Date;

  @Column({ name: 'sent_date', type: 'timestamptz', nullable: true })
  sentDate?: Date;

  @Column({ name: 'closed_date', type: 'timestamptz', nullable: true })
  closedDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  // Relationships
  @ManyToOne(() => PurchaseRequest, { nullable: true })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest: PurchaseRequest;

  @Column({ name: 'purchase_request_id', nullable: true })
  purchaseRequestId?: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @OneToMany(() => RFQItem, (item) => item.rfq, { cascade: true })
  items: RFQItem[];

  @OneToMany(() => RFQVendor, (vendor) => vendor.rfq, { cascade: true })
  vendors: RFQVendor[];

  @OneToMany(() => VendorQuotation, (quote) => quote.rfq)
  quotations: VendorQuotation[];
}

@Entity('rfq_items')
@Index(['rfq'])
export class RFQItem extends BaseEntity {
  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column()
  quantity: number;

  @Column({ default: 'unit' })
  unit: string;

  @Column({ type: 'text', nullable: true })
  specifications: string;

  @ManyToOne(() => RFQ, (rfq) => rfq.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfq_id' })
  rfq: RFQ;

  @Column({ name: 'rfq_id' })
  rfqId: string;
}

@Entity('rfq_vendors')
@Index(['rfq', 'supplier'])
export class RFQVendor extends BaseEntity {
  @ManyToOne(() => RFQ, (rfq) => rfq.vendors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'rfq_id' })
  rfq: RFQ;

  @Column({ name: 'rfq_id' })
  rfqId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'has_responded', default: false })
  hasResponded: boolean;

  @Column({ name: 'response_date', type: 'timestamptz', nullable: true })
  responseDate?: Date;

  @Column({ name: 'reminder_sent', default: false })
  reminderSent: boolean;

  @Column({ name: 'reminder_sent_at', type: 'timestamptz', nullable: true })
  reminderSentAt?: Date;
}

export enum QuotationStatus {
  RECEIVED = 'received',
  UNDER_REVIEW = 'under_review',
  SELECTED = 'selected',
  REJECTED = 'rejected',
}

@Entity('vendor_quotations')
@Index(['rfq', 'supplier'])
@Index(['status'])
export class VendorQuotation extends BaseEntity {
  @Column({ name: 'quotation_number' })
  quotationNumber: string;

  @ManyToOne(() => RFQ, (rfq) => rfq.quotations)
  @JoinColumn({ name: 'rfq_id' })
  rfq: RFQ;

  @Column({ name: 'rfq_id' })
  rfqId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({
    type: 'enum',
    enum: QuotationStatus,
    default: QuotationStatus.RECEIVED,
  })
  status: QuotationStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2 })
  totalAmount: number;

  @Column({ name: 'delivery_days' })
  deliveryDays: number;

  @Column({ name: 'payment_terms', nullable: true })
  paymentTerms: string;

  @Column({ nullable: true })
  warranty: string;

  @Column({ name: 'valid_until', type: 'date' })
  validUntil: Date;

  @Column({ name: 'received_date', type: 'timestamptz' })
  receivedDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => VendorQuotationItem, (item) => item.quotation, { cascade: true })
  items: VendorQuotationItem[];
}

@Entity('vendor_quotation_items')
@Index(['quotation'])
export class VendorQuotationItem extends BaseEntity {
  @ManyToOne(() => VendorQuotation, (q) => q.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'quotation_id' })
  quotation: VendorQuotation;

  @Column({ name: 'quotation_id' })
  quotationId: string;

  @Column({ name: 'rfq_item_id' })
  rfqItemId: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'total_price', type: 'decimal', precision: 12, scale: 2 })
  totalPrice: number;

  @Column({ name: 'delivery_days', nullable: true })
  deliveryDays?: number;

  @Column({ name: 'in_stock', default: true })
  inStock: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

export enum QuotationApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ApprovalLevel {
  MANAGER = 'manager',
  FINANCE = 'finance',
  DIRECTOR = 'director',
}

@Entity('quotation_approvals')
@Index(['quotation'])
export class QuotationApproval extends BaseEntity {
  @ManyToOne(() => VendorQuotation)
  @JoinColumn({ name: 'quotation_id' })
  quotation: VendorQuotation;

  @Column({ name: 'quotation_id' })
  quotationId: string;

  @Column({
    type: 'enum',
    enum: ApprovalLevel,
  })
  level: ApprovalLevel;

  @Column({
    type: 'enum',
    enum: QuotationApprovalStatus,
    default: QuotationApprovalStatus.PENDING,
  })
  status: QuotationApprovalStatus;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_id' })
  approver?: User;

  @Column({ name: 'approver_id', nullable: true })
  approverId?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true })
  comments: string;
}
