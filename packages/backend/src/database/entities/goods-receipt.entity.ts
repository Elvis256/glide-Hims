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

export enum GRNStatus {
  DRAFT = 'draft',
  PENDING_INSPECTION = 'pending_inspection',
  INSPECTED = 'inspected',
  APPROVED = 'approved',
  POSTED = 'posted',  // Stock updated
  CANCELLED = 'cancelled',
}

@Entity('goods_receipt_notes')
@Index(['grnNumber'], { unique: true })
@Index(['status'])
@Index(['receivedAt'])
export class GoodsReceiptNote extends BaseEntity {
  @Column({ name: 'grn_number', unique: true })
  grnNumber: string;

  @Column({
    type: 'enum',
    enum: GRNStatus,
    default: GRNStatus.DRAFT,
  })
  status: GRNStatus;

  @Column({ name: 'received_at', type: 'timestamptz' })
  receivedAt: Date;

  @Column({ name: 'delivery_note_number', nullable: true })
  deliveryNoteNumber: string;

  @Column({ name: 'invoice_number', nullable: true })
  invoiceNumber: string;

  @Column({ name: 'invoice_date', type: 'date', nullable: true })
  invoiceDate?: Date;

  @Column({ name: 'invoice_amount', type: 'decimal', precision: 12, scale: 2, nullable: true })
  invoiceAmount: number;

  @Column({ name: 'total_quantity_received', default: 0 })
  totalQuantityReceived: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalValue: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Inspection
  @Column({ name: 'inspected_at', type: 'timestamptz', nullable: true })
  inspectedAt: Date;

  @Column({ name: 'inspection_notes', type: 'text', nullable: true })
  inspectionNotes: string;

  // Posting
  @Column({ name: 'posted_at', type: 'timestamptz', nullable: true })
  postedAt: Date;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'purchase_order_id', nullable: true })
  purchaseOrderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ name: 'received_by_id' })
  receivedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'inspected_by_id' })
  inspectedBy: User;

  @Column({ name: 'inspected_by_id', nullable: true })
  inspectedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'posted_by_id' })
  postedBy: User;

  @Column({ name: 'posted_by_id', nullable: true })
  postedById: string;

  @OneToMany(() => GoodsReceiptItem, item => item.goodsReceiptNote, { cascade: true })
  items: GoodsReceiptItem[];
}

@Entity('goods_receipt_items')
@Index(['goodsReceiptNote'])
export class GoodsReceiptItem extends BaseEntity {
  @Column({ name: 'quantity_expected' })
  quantityExpected: number;

  @Column({ name: 'quantity_received' })
  quantityReceived: number;

  @Column({ name: 'quantity_accepted', nullable: true })
  quantityAccepted: number;

  @Column({ name: 'quantity_rejected', default: 0 })
  quantityRejected: number;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  lineTotal: number;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate?: Date;

  @Column({ name: 'manufacture_date', type: 'date', nullable: true })
  manufactureDate?: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => GoodsReceiptNote, grn => grn.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'goods_receipt_note_id' })
  goodsReceiptNote: GoodsReceiptNote;

  @Column({ name: 'goods_receipt_note_id' })
  goodsReceiptNoteId: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ name: 'item_unit', default: 'unit' })
  itemUnit: string;

  @Column({ name: 'purchase_order_item_id', nullable: true })
  purchaseOrderItemId: string;
}
