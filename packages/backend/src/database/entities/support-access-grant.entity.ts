import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

export enum SupportAccessTier {
  NONE = 0,
  METADATA = 1,
  CLINICAL_READ = 2,
  FULL_SUPPORT = 3,
}

@Entity('support_access_grants')
@Index(['tenantId', 'grantedToId'])
export class SupportAccessGrant extends BaseEntity {
  @Column({ name: 'granted_to_id', type: 'uuid' })
  grantedToId: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'granted_to_id' })
  grantedTo: User;

  @ManyToOne(() => Tenant, { nullable: false })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ name: 'access_tier', type: 'int', default: SupportAccessTier.METADATA })
  accessTier: SupportAccessTier;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @Column({ name: 'granted_by_id', type: 'uuid' })
  grantedById: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'granted_by_id' })
  grantedBy: User;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ name: 'revoked_at', type: 'timestamp', nullable: true })
  revokedAt: Date;

  @Column({ name: 'revoked_by_id', type: 'uuid', nullable: true })
  revokedById: string;

  get isActive(): boolean {
    return !this.revokedAt && this.expiresAt > new Date();
  }
}
