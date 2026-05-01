import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PharmacySale } from './pharmacy-sale.entity';

export enum MomoTransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  CANCELLED = 'cancelled',
}

@Entity('pos_mobile_money_transactions')
@Index(['tenantId', 'status'])
@Index(['saleId'])
export class PosMobileMoneyTransaction extends BaseEntity {
  @ManyToOne(() => PharmacySale)
  @JoinColumn({ name: 'sale_id' })
  sale?: PharmacySale;

  @Column({ name: 'sale_id', type: 'uuid' })
  saleId: string;

  @Column({ name: 'pos_shift_id', type: 'uuid', nullable: true })
  posShiftId?: string;

  @Column({ name: 'pos_register_id', type: 'uuid', nullable: true })
  posRegisterId?: string;

  @Column({ name: 'provider', type: 'varchar', length: 20 })
  provider: string; // 'mtn' | 'airtel'

  @Column({ name: 'phone', type: 'varchar', length: 30 })
  phone: string;

  @Column({ name: 'amount', type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'external_reference', type: 'varchar', length: 255, nullable: true })
  externalReference?: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: MomoTransactionStatus,
    enumName: 'pos_momo_status',
    default: MomoTransactionStatus.PENDING,
  })
  status: MomoTransactionStatus;

  @Column({ name: 'failure_reason', type: 'text', nullable: true })
  failureReason?: string;

  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @Column({ name: 'requested_at', type: 'timestamptz' })
  requestedAt: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @Column({ name: 'retry_count', type: 'int', default: 0 })
  retryCount: number;

  @Column({ name: 'last_polled_at', type: 'timestamptz', nullable: true })
  lastPolledAt?: Date;
}
