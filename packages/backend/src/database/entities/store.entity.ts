import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

export enum StoreType {
  MAIN = 'main',
  PHARMACY = 'pharmacy',
  WARD = 'ward',
  THEATRE = 'theatre',
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  EMERGENCY = 'emergency',
}

@Entity('stores')
@Index(['code'], { unique: true })
@Index(['facility'])
export class Store extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: StoreType,
    default: StoreType.MAIN,
  })
  type: StoreType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'can_dispense', default: false })
  canDispense: boolean; // Can dispense to patients

  @Column({ name: 'can_issue', default: true })
  canIssue: boolean; // Can issue to other stores

  @Column({ name: 'can_receive', default: true })
  canReceive: boolean; // Can receive from suppliers/stores

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Department, { nullable: true })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ name: 'department_id', nullable: true })
  departmentId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'manager_id' })
  manager: User;

  @Column({ name: 'manager_id', nullable: true })
  managerId: string;
}

export enum TransferStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

@Entity('stock_transfers')
@Index(['transferNumber'], { unique: true })
@Index(['fromStore', 'toStore'])
@Index(['status', 'createdAt'])
export class StockTransfer extends BaseEntity {
  @Column({ name: 'transfer_number', unique: true })
  transferNumber: string;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'from_store_id' })
  fromStore: Store;

  @Column({ name: 'from_store_id' })
  fromStoreId: string;

  @ManyToOne(() => Store)
  @JoinColumn({ name: 'to_store_id' })
  toStore: Store;

  @Column({ name: 'to_store_id' })
  toStoreId: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.REQUESTED,
  })
  status: TransferStatus;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'requested_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  requestedAt: Date;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @Column({ name: 'dispatched_at', type: 'timestamptz', nullable: true })
  dispatchedAt: Date;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date;

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ name: 'received_by_id', nullable: true })
  receivedById: string;
}

@Entity('stock_transfer_items')
@Index(['transfer'])
export class StockTransferItem extends BaseEntity {
  @ManyToOne(() => StockTransfer)
  @JoinColumn({ name: 'transfer_id' })
  transfer: StockTransfer;

  @Column({ name: 'transfer_id' })
  transferId: string;

  @Column({ name: 'item_id' })
  itemId: string; // Reference to inventory item

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column({ name: 'quantity_requested' })
  quantityRequested: number;

  @Column({ name: 'quantity_approved', nullable: true })
  quantityApproved: number;

  @Column({ name: 'quantity_dispatched', nullable: true })
  quantityDispatched: number;

  @Column({ name: 'quantity_received', nullable: true })
  quantityReceived: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 12, scale: 2, default: 0 })
  unitCost: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
