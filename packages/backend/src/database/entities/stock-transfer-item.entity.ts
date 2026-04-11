import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { StockTransfer } from './stock-transfer.entity';
import { Item } from './inventory.entity';

@Entity('stock_transfer_items')
@Index(['transferId'])
@Index(['itemId'])
export class StockTransferItem extends BaseEntity {
  @ManyToOne(() => StockTransfer, (transfer) => transfer.items)
  @JoinColumn({ name: 'transfer_id' })
  transfer: StockTransfer;

  @Column({ name: 'transfer_id', type: 'uuid' })
  transferId: string;

  @ManyToOne(() => Item)
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'batch_number' })
  batchNumber: string;

  @Column({ name: 'expiry_date', type: 'date' })
  expiryDate: Date;

  @Column({ name: 'requested_quantity', type: 'int' })
  requestedQuantity: number;

  @Column({ name: 'approved_quantity', type: 'int', nullable: true })
  approvedQuantity: number;

  @Column({ name: 'received_quantity', type: 'int', nullable: true })
  receivedQuantity: number;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2 })
  unitCost: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
