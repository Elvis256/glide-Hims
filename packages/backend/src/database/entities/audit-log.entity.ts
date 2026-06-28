import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'attempted_identifier', type: 'varchar', length: 255, nullable: true })
  attemptedIdentifier?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ type: 'varchar', length: 100 })
  action: string; // CREATE, UPDATE, DELETE, LOGIN, etc.

  @Column({ type: 'varchar', length: 100, name: 'entity_type' })
  entityType: string; // Table/entity name

  @Column({ type: 'uuid', name: 'entity_id', nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', nullable: true, name: 'old_value' })
  oldValue?: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'new_value' })
  newValue?: Record<string, any>;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'text', nullable: true, name: 'user_agent' })
  userAgent?: string;

  @Column({ name: 'actor_type', type: 'varchar', length: 50, nullable: true })
  actorType?: string; // 'tenant_user' | 'system_admin' | 'system_support'

  @Column({ name: 'support_access_tier', type: 'int', nullable: true })
  supportAccessTier?: number;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'request_method', type: 'varchar', length: 10, nullable: true })
  requestMethod?: string;

  @Column({ name: 'request_url', type: 'text', nullable: true })
  requestUrl?: string;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode?: number;
}
