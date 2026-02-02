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
import { ItemCategory, ItemSubcategory, ItemBrand, ItemFormulation, ItemUnit, StorageCondition } from './item-classification.entity';

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
@Index(['categoryId'])
@Index(['subcategoryId'])
@Index(['brandId'])
export class Item extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ name: 'generic_name', nullable: true })
  genericName: string; // For drugs: generic name (e.g., "Paracetamol")

  @Column({ nullable: true })
  description: string;

  // Legacy category field (string) - kept for backward compatibility
  @Column({ nullable: true })
  category: string;

  // New dynamic classification references
  @ManyToOne(() => ItemCategory, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  itemCategory: ItemCategory;

  @Column({ name: 'category_id', type: 'uuid', nullable: true })
  categoryId: string;

  @ManyToOne(() => ItemSubcategory, { nullable: true })
  @JoinColumn({ name: 'subcategory_id' })
  subcategory: ItemSubcategory;

  @Column({ name: 'subcategory_id', type: 'uuid', nullable: true })
  subcategoryId: string;

  @ManyToOne(() => ItemBrand, { nullable: true })
  @JoinColumn({ name: 'brand_id' })
  brand: ItemBrand;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string;

  @ManyToOne(() => ItemFormulation, { nullable: true })
  @JoinColumn({ name: 'formulation_id' })
  formulation: ItemFormulation;

  @Column({ name: 'formulation_id', type: 'uuid', nullable: true })
  formulationId: string;

  @ManyToOne(() => ItemUnit, { nullable: true })
  @JoinColumn({ name: 'unit_id' })
  itemUnit: ItemUnit;

  @Column({ name: 'unit_id', type: 'uuid', nullable: true })
  unitId: string;

  @ManyToOne(() => StorageCondition, { nullable: true })
  @JoinColumn({ name: 'storage_condition_id' })
  storageCondition: StorageCondition;

  @Column({ name: 'storage_condition_id', type: 'uuid', nullable: true })
  storageConditionId: string;

  // Basic item properties
  @Column({ default: 'unit' })
  unit: string; // Legacy: tablet, bottle, piece, etc.

  @Column({ nullable: true })
  strength: string; // For drugs: strength (e.g., "500mg")

  @Column({ name: 'pack_size', type: 'int', nullable: true })
  packSize: number; // Number of units per pack

  @Column({ name: 'is_drug', default: false })
  isDrug: boolean;

  @Column({ name: 'requires_prescription', default: false })
  requiresPrescription: boolean;

  @Column({ name: 'is_controlled', default: false })
  isControlled: boolean; // Controlled substance

  @Column({ name: 'requires_batch_tracking', default: false })
  requiresBatchTracking: boolean;

  @Column({ name: 'requires_expiry_tracking', default: true })
  requiresExpiryTracking: boolean;

  // Pricing
  @Column({ name: 'reorder_level', default: 10 })
  reorderLevel: number;

  @Column({ name: 'max_stock_level', type: 'int', nullable: true })
  maxStockLevel: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, default: 0 })
  unitCost: number;

  @Column({ name: 'selling_price', type: 'decimal', precision: 10, scale: 2, default: 0 })
  sellingPrice: number;

  @Column({ name: 'markup_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  markupPercentage: number;

  // Supplier info
  @Column({ name: 'preferred_supplier_id', type: 'uuid', nullable: true })
  preferredSupplierId: string;

  @Column({ name: 'manufacturer', nullable: true })
  manufacturer: string; // Legacy: manufacturer name

  @Column({ name: 'barcode', nullable: true })
  barcode: string;

  @Column({ default: 'active' })
  status: string;

  // Facility reference
  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string;
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
