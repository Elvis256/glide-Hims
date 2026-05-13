import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../database/entities/base.entity';
import { User } from '../../database/entities/user.entity';
import { Tenant } from '../../database/entities/tenant.entity';

export enum SupportAccessRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  DENIED = 'denied',
  EXPIRED = 'expired',
}

@Entity('support_access_requests')
@Index(['tenantId', 'status'])
export class SupportAccessRequest extends BaseEntity {
  @Column({ name: 'requested_by_id', type: 'uuid' })
  requestedById: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'requested_by_id' })
  requestedBy: User;

  @Column({ name: 'requested_tier', type: 'int', default: 2 })
  requestedTier: number;

  @Column({ name: 'requested_duration_hours', type: 'int', default: 4 })
  requestedDurationHours: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: SupportAccessRequestStatus,
    default: SupportAccessRequestStatus.PENDING,
  })
  status: SupportAccessRequestStatus;

  @Column({ name: 'reviewed_by_id', type: 'uuid', nullable: true })
  reviewedById: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewed_by_id' })
  reviewedBy: User;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date;

  @Column({ name: 'review_notes', type: 'text', nullable: true })
  reviewNotes: string | null;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant?: Tenant;
}
