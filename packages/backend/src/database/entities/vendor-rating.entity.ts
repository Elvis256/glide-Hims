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
import { PurchaseOrder } from './purchase-order.entity';

@Entity('vendor_ratings')
@Index(['supplier'])
@Index(['createdAt'])
export class VendorRating extends BaseEntity {
  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id' })
  supplierId: string;

  @Column({ name: 'delivery_time_rating', type: 'decimal', precision: 2, scale: 1 })
  deliveryTimeRating: number; // 1.0 - 5.0

  @Column({ name: 'quality_rating', type: 'decimal', precision: 2, scale: 1 })
  qualityRating: number;

  @Column({ name: 'price_rating', type: 'decimal', precision: 2, scale: 1 })
  priceRating: number;

  @Column({ name: 'service_rating', type: 'decimal', precision: 2, scale: 1 })
  serviceRating: number;

  @Column({ name: 'overall_rating', type: 'decimal', precision: 2, scale: 1 })
  overallRating: number;

  @Column({ type: 'text', nullable: true })
  comments: string;

  // Link to specific PO if applicable
  @ManyToOne(() => PurchaseOrder, { nullable: true })
  @JoinColumn({ name: 'purchase_order_id' })
  purchaseOrder?: PurchaseOrder;

  @Column({ name: 'purchase_order_id', nullable: true })
  purchaseOrderId?: string;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'rated_by_id' })
  ratedBy: User;

  @Column({ name: 'rated_by_id' })
  ratedById: string;
}

// Aggregated vendor scores view/table for quick access
@Entity('vendor_rating_summaries')
@Index(['supplier'], { unique: true })
export class VendorRatingSummary extends BaseEntity {
  @ManyToOne(() => Supplier)
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id', unique: true })
  supplierId: string;

  @Column({ name: 'avg_delivery_time', type: 'decimal', precision: 2, scale: 1, default: 0 })
  avgDeliveryTime: number;

  @Column({ name: 'avg_quality', type: 'decimal', precision: 2, scale: 1, default: 0 })
  avgQuality: number;

  @Column({ name: 'avg_price', type: 'decimal', precision: 2, scale: 1, default: 0 })
  avgPrice: number;

  @Column({ name: 'avg_service', type: 'decimal', precision: 2, scale: 1, default: 0 })
  avgService: number;

  @Column({ name: 'avg_overall', type: 'decimal', precision: 2, scale: 1, default: 0 })
  avgOverall: number;

  @Column({ name: 'total_reviews', default: 0 })
  totalReviews: number;

  @Column({ name: 'last_review_date', type: 'timestamptz', nullable: true })
  lastReviewDate?: Date;

  @Column({
    type: 'enum',
    enum: ['up', 'down', 'stable'],
    default: 'stable',
  })
  trend: 'up' | 'down' | 'stable';

  // Monthly history for trend charts
  @Column({ type: 'jsonb', nullable: true })
  monthlyHistory: { month: string; overall: number }[];
}
