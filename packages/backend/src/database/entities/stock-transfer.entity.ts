import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { StockTransferItem } from './stock-transfer-item.entity';

export enum TransferStatus {
  REQUESTED = 'requested',
  APPROVED = 'approved',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  CANCELLED = 'cancelled',
  REJECTED = 'rejected',
}

export enum TransferReason {
  NEAR_EXPIRY = 'near_expiry',
  SURPLUS = 'surplus',
  STOCKOUT_RELIEF = 'stockout_relief',
  REDISTRIBUTION = 'redistribution',
  OTHER = 'other',
}

@Entity('stock_transfers')
@Index(['fromFacilityId'])
@Index(['toFacilityId'])
@Index(['status'])
@Index(['transferNumber'], { unique: true })
export class StockTransfer extends BaseEntity {
  @Column({ name: 'transfer_number' })
  transferNumber: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'from_facility_id' })
  fromFacility: Facility;

  @Column({ name: 'from_facility_id', type: 'uuid' })
  fromFacilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'to_facility_id' })
  toFacility: Facility;

  @Column({ name: 'to_facility_id', type: 'uuid' })
  toFacilityId: string;

  @Column({
    type: 'enum',
    enum: TransferStatus,
    default: TransferStatus.REQUESTED,
  })
  status: TransferStatus;

  @Column({ type: 'enum', enum: TransferReason })
  reason: TransferReason;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'received_by_id' })
  receivedBy: User;

  @Column({ name: 'received_by_id', type: 'uuid', nullable: true })
  receivedById: string;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  @OneToMany(() => StockTransferItem, (item) => item.transfer, { cascade: true })
  items: StockTransferItem[];
}
