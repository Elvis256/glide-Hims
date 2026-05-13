import { Column, Entity, Index, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

export type ApprovalActionType =
  | 'submit'
  | 'approve'
  | 'reject'
  | 'delegate'
  | 'escalate'
  | 'recall'
  | 'comment';

@Entity('approval_actions')
@Index(['module', 'documentType', 'documentId'])
@Index(['actorUserId', 'createdAt'])
@Index(['tenantId', 'createdAt'])
export class ApprovalAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId?: string;

  @Column({ name: 'chain_id', type: 'uuid' })
  chainId: string;

  @Column({ name: 'chain_step_id', type: 'uuid', nullable: true })
  chainStepId?: string;

  @Column({ name: 'module', length: 50 })
  module: string;

  @Column({ name: 'document_type', length: 20 })
  documentType: string;

  @Column({ name: 'document_id', length: 64 })
  documentId: string;

  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId?: string;

  @Column({ name: 'action', length: 30 })
  action: ApprovalActionType;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment?: string;

  @Column({ name: 'ip_address', length: 64, nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent?: string;

  @Column({ name: 'before_json', type: 'jsonb', nullable: true })
  beforeJson?: Record<string, unknown>;

  @Column({ name: 'after_json', type: 'jsonb', nullable: true })
  afterJson?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
