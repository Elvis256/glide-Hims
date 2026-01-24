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
import { PurchaseRequest } from './purchase-request.entity';

export enum POStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  SENT = 'sent',
  PARTIALLY_RECEIVED = 'partially_received',
  FULLY_RECEIVED = 'fully_received',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

@Entity('purchase_orders')
@Index(['orderNumber'], { unique: true })
@Index(['status'])
@Index(['createdAt'])
@Index(['supplier'])
export class PurchaseOrder extends BaseEntity {
  @Column({ name: 'order_number', unique: true })
  orderNumber: string;

  @Column({
    type: 'enum',
    enum: POStatus,
    default: POStatus.DRAFT,
  })
  status: POStatus;

  @Column({ name: 'order_date', type: 'date' })
  orderDate: Date;

  @Column({ name: 'expected_delivery', type: 'date', nullable: true })
  expectedDelivery?: Date;

  @Column({ name: 'payment_terms', nullable: true })
  paymentTerms: string;

  @Column({ name: 'delivery_address', type: 'text', nullable: true })
  deliveryAddress: string;

  @Column({ name: 'subtotal', type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal: number;

  @Column({ name: 'tax_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  taxAmount: number;

  @Column({ name: 'discount_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  discountAmount: number;

  @Column({ name: 'total_amount', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ type: 'text', nullable: true })
  terms: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Approval tracking
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date;

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

  @ManyToOne(() => PurchaseRequest, { nullable: true })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest: PurchaseRequest;

  @Column({ name: 'purchase_request_id', nullable: true })
  purchaseRequestId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById?: string;

  @OneToMany(() => PurchaseOrderItem, item => item.purchaseOrder, { cascade: true })
  items: PurchaseOrderItem[];
}

@Entity('purchase_order_items')
@Index(['purchaseOrder'])
export class PurchaseOrderItem extends BaseEntity {
  @Column({ name: 'quantity_ordered' })
  quantityOrdered: number;

  @Column({ name: 'quantity_received', default: 0 })
  quantityReceived: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 10, scale: 2 })
  unitPrice: number;

  @Column({ name: 'tax_rate', type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate: number;

  @Column({ name: 'discount_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column({ name: 'line_total', type: 'decimal', precision: 12, scale: 2, default: 0 })
  lineTotal: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => PurchaseOrder, po => po.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder: PurchaseOrder;

  @Column({ name: 'purchase_order_id' })
  purchaseOrderId: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ name: 'item_unit', default: 'unit' })
  itemUnit: string;
}
