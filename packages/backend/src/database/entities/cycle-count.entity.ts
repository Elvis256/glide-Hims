import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum CycleCountStatus {
  DRAFT = 'draft',
  IN_PROGRESS = 'in_progress',
  PENDING_REVIEW = 'pending_review',
  APPROVED = 'approved',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum VarianceStatus {
  NONE = 'none',
  WITHIN_TOLERANCE = 'within_tolerance',
  EXCEEDS_TOLERANCE = 'exceeds_tolerance',
  INVESTIGATED = 'investigated',
  ADJUSTED = 'adjusted',
}

@Entity('cycle_counts')
@Unique(['tenantId', 'countNumber'])
@Index(['status'])
@Index(['facilityId', 'createdAt'])
export class CycleCount extends BaseEntity {
  @Column({ name: 'count_number' })
  countNumber: string;

  @Column({
    type: 'enum',
    enum: CycleCountStatus,
    default: CycleCountStatus.DRAFT,
  })
  status: CycleCountStatus;

  @Column({ name: 'count_date', type: 'date' })
  countDate: Date;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'total_items', type: 'int', default: 0 })
  totalItems: number;

  @Column({ name: 'items_counted', type: 'int', default: 0 })
  itemsCounted: number;

  @Column({ name: 'variance_count', type: 'int', default: 0 })
  varianceCount: number;

  @Column({ name: 'total_variance_value', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalVarianceValue: number;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

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
  approvedBy: User;

  @Column({ name: 'approved_by_id', nullable: true })
  approvedById: string;

  @OneToMany(() => CycleCountItem, (item) => item.cycleCount, { cascade: true })
  items: CycleCountItem[];
}

@Entity('cycle_count_items')
@Index(['cycleCountId'])
@Index(['itemId'])
export class CycleCountItem extends BaseEntity {
  @ManyToOne(() => CycleCount, (cc) => cc.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cycle_count_id' })
  cycleCount: CycleCount;

  @Column({ name: 'cycle_count_id' })
  cycleCountId: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ name: 'item_code', nullable: true })
  itemCode: string;

  @Column({ name: 'batch_number', nullable: true })
  batchNumber: string;

  @Column({ name: 'system_quantity', type: 'decimal', precision: 15, scale: 4, default: 0 })
  systemQuantity: number;

  @Column({ name: 'counted_quantity', type: 'decimal', precision: 15, scale: 4, nullable: true })
  countedQuantity: number;

  @Column({ type: 'decimal', precision: 15, scale: 4, nullable: true })
  variance: number;

  @Column({ name: 'variance_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  varianceValue: number;

  @Column({
    name: 'variance_status',
    type: 'enum',
    enum: VarianceStatus,
    default: VarianceStatus.NONE,
  })
  varianceStatus: VarianceStatus;

  @Column({ name: 'investigation_notes', type: 'text', nullable: true })
  investigationNotes: string;

  @Column({ name: 'unit_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  unitCost: number;

  @Column({ name: 'counted_by_id', type: 'uuid', nullable: true })
  countedById: string;

  @Column({ name: 'counted_at', type: 'timestamptz', nullable: true })
  countedAt: Date;
}
