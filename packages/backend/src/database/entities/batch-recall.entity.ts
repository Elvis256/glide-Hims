import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum RecallStatus {
  INITIATED = 'initiated',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RecallSeverity {
  CLASS_I = 'class_i', // Serious health risk
  CLASS_II = 'class_ii', // Temporary/reversible health risk
  CLASS_III = 'class_iii', // Unlikely to cause adverse health
}

export enum RecallActionType {
  QUARANTINE = 'quarantine',
  PATIENT_NOTIFICATION = 'patient_notification',
  RETURN_TO_MANUFACTURER = 'return_to_manufacturer',
  DISPOSAL = 'disposal',
  INVESTIGATION = 'investigation',
}

@Entity('batch_recalls')
@Unique(['tenantId', 'recallNumber'])
@Index(['status'])
@Index(['batchNumber'])
export class BatchRecall extends BaseEntity {
  @Column({ name: 'recall_number' })
  recallNumber: string;

  @Column({ name: 'batch_number' })
  batchNumber: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @Column({ name: 'item_name' })
  itemName: string;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: RecallSeverity,
    default: RecallSeverity.CLASS_II,
  })
  severity: RecallSeverity;

  @Column({
    type: 'enum',
    enum: RecallStatus,
    default: RecallStatus.INITIATED,
  })
  status: RecallStatus;

  @Column({ name: 'affected_quantity', type: 'decimal', precision: 15, scale: 4, default: 0 })
  affectedQuantity: number;

  @Column({ name: 'quarantined_quantity', type: 'decimal', precision: 15, scale: 4, default: 0 })
  quarantinedQuantity: number;

  @Column({ name: 'affected_patients_count', type: 'int', default: 0 })
  affectedPatientsCount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  // Relationships
  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id', type: 'uuid', nullable: true })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'initiated_by_id' })
  initiatedBy: User;

  @Column({ name: 'initiated_by_id' })
  initiatedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by_id' })
  completedBy: User;

  @Column({ name: 'completed_by_id', nullable: true })
  completedById: string;

  @OneToMany(() => BatchRecallAction, (action) => action.recall, { cascade: true })
  actions: BatchRecallAction[];
}

@Entity('batch_recall_actions')
@Index(['recallId'])
export class BatchRecallAction extends BaseEntity {
  @ManyToOne(() => BatchRecall, (recall) => recall.actions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recall_id' })
  recall: BatchRecall;

  @Column({ name: 'recall_id' })
  recallId: string;

  @Column({
    name: 'action_type',
    type: 'enum',
    enum: RecallActionType,
  })
  actionType: RecallActionType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'performed_at', type: 'timestamptz', nullable: true })
  performedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'performed_by_id' })
  performedBy: User;

  @Column({ name: 'performed_by_id' })
  performedById: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
