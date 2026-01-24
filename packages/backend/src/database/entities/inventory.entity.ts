import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum MovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
  TRANSFER_IN = 'transfer_in',
  TRANSFER_OUT = 'transfer_out',
  RETURN = 'return',
  EXPIRED = 'expired',
  DAMAGED = 'damaged',
}

@Entity('items')
@Index(['code'], { unique: true })
@Index(['category'])
export class Item extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'unit' })
  unit: string; // tablet, bottle, piece, etc.

  @Column({ name: 'is_drug', default: false })
  isDrug: boolean;

  @Column({ name: 'requires_prescription', default: false })
  requiresPrescription: boolean;

  @Column({ name: 'reorder_level', default: 10 })
  reorderLevel: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ name: 'selling_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ default: 'active' })
  status: string;
}

@Entity('stock_ledger')
@Index(['item', 'facility'])
@Index(['createdAt'])
@Index(['batchNumber'])
export class StockLedger extends BaseEntity {
  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date;

  @Column()
  quantity: number; // positive for in, negative for out

  @Column({ name: 'balance_after' })
  balanceAfter: number;

  @Column({
    name: 'movement_type',
    type: 'enum',
    enum: MovementType,
  })
  movementType: MovementType;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ name: 'reference_type', nullable: true })
  referenceType: string; // 'dispensation', 'purchase_order', etc.

  @Column({ name: 'reference_id', nullable: true })
  referenceId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Relationships
  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

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
}

// Aggregated stock view per item per facility
@Entity('stock_balances')
@Index(['item', 'facility'], { unique: true })
export class StockBalance extends BaseEntity {
  @Column({ name: 'total_quantity', default: 0 })
  totalQuantity: number;

  @Column({ name: 'reserved_quantity', default: 0 })
  reservedQuantity: number;

  @Column({ name: 'available_quantity', default: 0 })
  availableQuantity: number;

  @Column({ name: 'last_movement_at', type: 'timestamptz', nullable: true })
  lastMovementAt: Date;

  // Relationships
  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;
}
