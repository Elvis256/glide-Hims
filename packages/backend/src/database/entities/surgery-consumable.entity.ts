import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { SurgeryCase } from './surgery-case.entity';
import { Item } from './inventory.entity';
import { User } from './user.entity';

export enum ConsumableCategory {
  SURGICAL_SUPPLIES = 'surgical_supplies',
  ANESTHESIA = 'anesthesia',
  SUTURES = 'sutures',
  MEDICATIONS = 'medications',
  IMPLANTS = 'implants',
  INSTRUMENTS_DISPOSABLE = 'instruments_disposable',
  DRESSINGS = 'dressings',
  FLUIDS = 'fluids',
  BLOOD_PRODUCTS = 'blood_products',
  OTHER = 'other',
}

@Entity('surgery_consumables')
export class SurgeryConsumable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'surgery_case_id' })
  surgeryCaseId: string;

  @ManyToOne(() => SurgeryCase)
  @JoinColumn({ name: 'surgery_case_id' })
  surgeryCase: SurgeryCase;

  @Column({ type: 'uuid', name: 'item_id' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ type: 'varchar', length: 50, name: 'item_code' })
  itemCode: string;

  @Column({ type: 'varchar', length: 255, name: 'item_name' })
  itemName: string;

  @Column({ type: 'enum', enum: ConsumableCategory, default: ConsumableCategory.SURGICAL_SUPPLIES })
  category: ConsumableCategory;

  @Column({ type: 'decimal', precision: 10, scale: 2, name: 'quantity_used' })
  quantityUsed: number;

  @Column({ type: 'varchar', length: 20, default: 'unit' })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'unit_cost' })
  unitCost: number;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'total_cost' })
  totalCost: number;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'batch_number' })
  batchNumber: string;

  @Column({ type: 'date', nullable: true, name: 'expiry_date' })
  expiryDate: Date;

  // When the consumable was used
  @Column({ type: 'varchar', length: 50, name: 'usage_phase' })
  usagePhase: string; // pre_op, intra_op, post_op

  @Column({ type: 'timestamp', name: 'used_at' })
  usedAt: Date;

  @Column({ type: 'boolean', default: false, name: 'is_billable' })
  isBillable: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_deducted_from_stock' })
  isDeductedFromStock: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  // Who recorded
  @Column({ type: 'uuid', name: 'recorded_by_id' })
  recordedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'recorded_by_id' })
  recordedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
