import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Encounter } from './encounter.entity';
import { User } from './user.entity';

export enum OrderType {
  LAB = 'lab',
  RADIOLOGY = 'radiology',
  PHARMACY = 'pharmacy',
  PROCEDURE = 'procedure',
}

export enum OrderStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum OrderPriority {
  ROUTINE = 'routine',
  URGENT = 'urgent',
  STAT = 'stat',
}

@Entity('orders')
@Index(['encounter', 'orderType'])
@Index(['status', 'createdAt'])
export class Order extends BaseEntity {
  @Column({ name: 'order_number', unique: true })
  orderNumber: string;

  @Column({
    name: 'order_type',
    type: 'enum',
    enum: OrderType,
  })
  orderType: OrderType;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PENDING,
  })
  status: OrderStatus;

  @Column({
    type: 'enum',
    enum: OrderPriority,
    default: OrderPriority.ROUTINE,
  })
  priority: OrderPriority;

  @Column({ type: 'text', nullable: true })
  instructions: string;

  @Column({ name: 'clinical_notes', type: 'text', nullable: true })
  clinicalNotes: string;

  // For lab/radiology orders
  @Column({ name: 'test_codes', type: 'jsonb', nullable: true })
  testCodes: { code: string; name: string }[];

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date;

  // Assignment tracking
  @Column({ name: 'assigned_to', type: 'varchar', nullable: true })
  assignedTo: string;

  // Relationships
  @ManyToOne(() => Encounter)
  @JoinColumn({ name: 'encounter_id' })
  encounter: Encounter;

  @Column({ name: 'encounter_id' })
  encounterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'ordered_by_id' })
  orderedBy: User;

  @Column({ name: 'ordered_by_id' })
  orderedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'completed_by_id' })
  completedBy: User;

  @Column({ name: 'completed_by_id', nullable: true })
  completedById: string;
}
