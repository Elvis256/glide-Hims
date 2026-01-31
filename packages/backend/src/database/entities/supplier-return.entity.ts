import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Item } from './inventory.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { Supplier } from './supplier.entity';

export enum ReturnStatus {
  PENDING = 'pending',
  AUTHORIZED = 'authorized',
  SHIPPED = 'shipped',
  RECEIVED_BY_SUPPLIER = 'received_by_supplier',
  CREDIT_ISSUED = 'credit_issued',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
}

export enum ReturnReason {
  EXPIRED = 'expired',
  NEAR_EXPIRY = 'near_expiry',
  DAMAGED = 'damaged',
  RECALLED = 'recalled',
  OVERSTOCK = 'overstock',
  QUALITY_ISSUE = 'quality_issue',
}

@Entity('supplier_returns')
@Index(['facilityId', 'createdAt'])
@Index(['status'])
@Index(['supplierId'])
export class SupplierReturn extends BaseEntity {
  @Column({ name: 'return_number', unique: true })
  returnNumber: string;

  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({
    type: 'enum',
    enum: ReturnStatus,
    default: ReturnStatus.PENDING,
  })
  status: ReturnStatus;

  @Column({
    type: 'enum',
    enum: ReturnReason,
  })
  reason: ReturnReason;

  @Column({ name: 'authorization_number', nullable: true })
  authorizationNumber: string;

  @Column({ name: 'credit_note_number', nullable: true })
  creditNoteNumber: string;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column({ name: 'expected_credit', type: 'decimal', precision: 10, scale: 2, default: 0 })
  expectedCredit: number;

  @Column({ name: 'actual_credit', type: 'decimal', precision: 10, scale: 2, nullable: true })
  actualCredit: number;

  @Column({ name: 'shipping_date', type: 'date', nullable: true })
  shippingDate: Date;

  @Column({ name: 'received_date', type: 'date', nullable: true })
  receivedDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
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

  @OneToMany(() => SupplierReturnItem, (item) => item.supplierReturn)
  items: SupplierReturnItem[];
}

@Entity('supplier_return_items')
@Index(['supplierReturnId'])
@Index(['itemId'])
export class SupplierReturnItem extends BaseEntity {
  @ManyToOne(() => SupplierReturn, (ret) => ret.items)
  @JoinColumn({ name: 'supplier_return_id' })
  supplierReturn: SupplierReturn;

  @Column({ name: 'supplier_return_id' })
  supplierReturnId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column()
  quantity: number;

  @Column({ name: 'unit_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitValue: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
