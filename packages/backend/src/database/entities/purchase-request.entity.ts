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
import { Department } from './department.entity';

export enum PRStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  PARTIALLY_ORDERED = 'partially_ordered',
  FULLY_ORDERED = 'fully_ordered',
  CANCELLED = 'cancelled',
}

export enum PRPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

@Entity('purchase_requests')
@Index(['requestNumber'], { unique: true })
@Index(['status'])
@Index(['createdAt'])
export class PurchaseRequest extends BaseEntity {
  @Column({ name: 'request_number', unique: true })
  requestNumber: string;

  @Column({
    type: 'enum',
    enum: PRStatus,
    default: PRStatus.DRAFT,
  })
  status: PRStatus;

  @Column({
    type: 'enum',
    enum: PRPriority,
    default: PRPriority.NORMAL,
  })
  priority: PRPriority;

  @Column({ type: 'text', nullable: true })
  justification: string;

  @Column({ name: 'required_date', type: 'date', nullable: true })
  requiredDate?: Date;

  @Column({ name: 'total_estimated', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEstimated: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Approval tracking
  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'requested_by_id' })
  requestedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;

  @OneToMany(() => PurchaseRequestItem, item => item.purchaseRequest, { cascade: true })
  items: PurchaseRequestItem[];
}

@Entity('purchase_request_items')
@Index(['purchaseRequest'])
export class PurchaseRequestItem extends BaseEntity {
  @Column({ name: 'quantity_requested' })
  quantityRequested: number;

  @Column({ name: 'quantity_approved', nullable: true })
  quantityApproved: number;

  @Column({ name: 'quantity_ordered', default: 0 })
  quantityOrdered: number;

  @Column({ name: 'unit_price_estimated', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitPriceEstimated: number;

  @Column({ type: 'text', nullable: true })
  specifications: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => PurchaseRequest, pr => pr.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'purchase_request_id' })
  purchaseRequest: PurchaseRequest;

  @Column({ name: 'purchase_request_id' })
  purchaseRequestId: string;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ name: 'item_unit', default: 'unit' })
  itemUnit: string;
}
