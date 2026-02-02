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
import { Supplier } from './supplier.entity';

export enum PriceAgreementStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  TERMINATED = 'terminated',
}

@Entity('price_agreements')
@Index(['supplier', 'itemCode'])
@Index(['status'])
@Index(['validTo'])
export class PriceAgreement extends BaseEntity {
  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'item_id', nullable: true })
  itemId?: string;

  @Column({ name: 'item_code' })
  itemCode: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: number;

  @Column({ default: 'unit' })
  unit: string;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'date' })
  validTo: Date;

  @Column({
    type: 'enum',
    enum: PriceAgreementStatus,
    default: PriceAgreementStatus.DRAFT,
  })
  status: PriceAgreementStatus;

  // Volume discounts
  @Column({ type: 'jsonb', nullable: true })
  volumeDiscounts: {
    minQuantity: number;
    maxQuantity: number | null;
    discountPercent: number;
  }[];

  // Price history tracking
  @Column({ type: 'jsonb', nullable: true })
  priceHistory: {
    date: string;
    price: number;
    changePercent: number;
  }[];

  @Column({ name: 'is_best_price', default: false })
  isBestPrice: boolean;

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

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy?: User;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById?: string;
}
