import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['createdAt'])
export class AuditLog extends BaseEntity {
  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

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
}
