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
import { Supplier } from './supplier.entity';
import { PurchaseOrder } from './purchase-order.entity';
import { GoodsReceiptNote } from './goods-receipt.entity';
import { Invoice } from './invoice.entity';

export enum InvoiceMatchStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  MISMATCH = 'mismatch',
  FLAGGED = 'flagged',
  APPROVED = 'approved',
  PAID = 'paid',
}

@Entity('invoice_matches')
@Index(['status'])
@Index(['dueDate'])
export class InvoiceMatch extends BaseEntity {
  @Column({ name: 'match_number', unique: true })
  matchNumber: string;

  @Column({ name: 'vendor_invoice_number' })
  vendorInvoiceNumber: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => PurchaseOrder)
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @ManyToOne(() => GoodsReceiptNote, { nullable: true })
  @JoinColumn({ name: 'grn_id' })
  goodsReceipt?: GoodsReceiptNote;

  @Column({ name: 'grn_id', nullable: true })
  grnId?: string;

  @Column({ name: 'invoice_date', type: 'date' })
  invoiceDate: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate: Date;

  @Column({
    type: 'enum',
    enum: InvoiceMatchStatus,
    default: InvoiceMatchStatus.PENDING,
  })
  status: InvoiceMatchStatus;

  // Totals for comparison
  @Column({ name: 'po_total', type: 'decimal', precision: 14, scale: 2 })
  poTotal: number;

  @Column({ name: 'grn_total', type: 'decimal', precision: 14, scale: 2, default: 0 })
  grnTotal: number;

  @Column({ name: 'invoice_total', type: 'decimal', precision: 14, scale: 2 })
  invoiceTotal: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, default: 0 })
  variance: number;

  @Column({ name: 'variance_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  variancePercent: number;

  @Column({ name: 'payment_scheduled', type: 'date', nullable: true })
  paymentScheduled?: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById?: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt?: Date;

  @OneToMany(() => InvoiceMatchItem, (item) => item.match, { cascade: true })
  items: InvoiceMatchItem[];
}

@Entity('invoice_match_items')
@Index(['match'])
export class InvoiceMatchItem extends BaseEntity {
  @ManyToOne(() => InvoiceMatch, (m) => m.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'match_id' })
  match: InvoiceMatch;

  @Column({ name: 'match_id' })
  matchId: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'item_name' })
  itemName: string;

  // PO values
  @Column({ name: 'po_qty' })
  poQty: number;

  @Column({ name: 'po_price', type: 'decimal', precision: 10, scale: 2 })
  poPrice: number;

  // GRN values
  @Column({ name: 'grn_qty', default: 0 })
  grnQty: number;

  // Invoice values
  @Column({ name: 'invoice_qty' })
  invoiceQty: number;

  @Column({ name: 'invoice_price', type: 'decimal', precision: 10, scale: 2 })
  invoicePrice: number;

  // Match flags
  @Column({ name: 'qty_match', default: true })
  qtyMatch: boolean;

  @Column({ name: 'price_match', default: true })
  priceMatch: boolean;
}
