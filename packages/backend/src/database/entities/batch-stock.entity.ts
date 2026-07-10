import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { Item } from './inventory.entity';

export type BatchStockStatus = 'active' | 'quarantined' | 'expired' | 'recalled';

@Entity('batch_stock_balances')
@Index(['itemId', 'facilityId'])
@Index(['expiryDate'])
@Index(['batchNumber'])
@Index(['facilityId', 'status', 'expiryDate'])
export class BatchStockBalance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ name: 'store_id', type: 'uuid', nullable: true })
  storeId: string;

  @Column({ name: 'batch_number' })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ type: 'decimal', precision: 15, scale: 4, default: 0 })
  quantity: number;

  @Column({ name: 'reserved_quantity', type: 'decimal', precision: 15, scale: 4, default: 0 })
  reservedQuantity: number;

  @Column({ default: 'active' })
  status: BatchStockStatus;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date;
}
