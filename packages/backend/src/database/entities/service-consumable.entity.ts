import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Service } from './service-category.entity';
import { Item } from './inventory.entity';

/**
 * Per-service inventory consumables.
 * Defines which items (and how much) are auto-deducted from stock when a
 * service is rendered/billed. E.g. service "Wound Dressing" might consume
 * 1 gauze pack + 2 sterile gloves + 5ml saline.
 */
@Entity('service_consumables')
@Index(['serviceId'])
@Index(['itemId'])
@Unique('UQ_service_consumable', ['serviceId', 'itemId'])
export class ServiceConsumable extends BaseEntity {
  @ManyToOne(() => Service, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ name: 'service_id' })
  serviceId: string;

  @ManyToOne(() => Item, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'item_id' })
  item: Item;

  @Column({ name: 'item_id' })
  itemId: string;

  @Column({ type: 'decimal', precision: 12, scale: 3, default: 1 })
  quantity: number;

  /** If true, missing stock is logged but does not block invoicing. */
  @Column({ name: 'is_optional', default: false })
  isOptional: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
