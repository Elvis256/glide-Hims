import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';

export enum ApprovalChainStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('procurement_approval_chains')
@Index(['documentId', 'documentType'])
@Index(['documentId', 'approvalLevel'])
@Index(['approverId', 'status'])
export class ProcurementApprovalChain extends BaseEntity {
  @Column({
    name: 'module',
    type: 'varchar',
    length: 50,
    default: 'procurement',
  })
  module: string;

  @Column({ name: 'document_id' })
  documentId: string;

  @Column({
    name: 'document_type',
    type: 'varchar',
    length: 10,
    comment: 'PR (Purchase Request) or PO (Purchase Order)',
  })
  documentType: string; // 'PR' or 'PO'

  @Column({
    name: 'tenant_id',
    nullable: true,
  })
  tenantId?: string;

  @Column({
    name: 'approval_level',
    type: 'int',
    comment: '1 = Manager, 2 = Finance, 3 = Director, 4 = CFO',
  })
  approvalLevel: number;

  @Column({
    name: 'required_role',
    type: 'varchar',
    length: 50,
    comment: 'Role required to approve at this level',
  })
  requiredRole: string; // 'manager', 'finance_officer', 'director', 'cfo'

  @Column({
    name: 'approver_id',
    nullable: true,
  })
  approverId?: string;

  @Column({
    name: 'approved_at',
    type: 'timestamp',
    nullable: true,
  })
  approvedAt?: Date;

  @Column({
    name: 'approved_by_id',
    nullable: true,
  })
  approvedById?: string;

  @Column({
    name: 'comments',
    type: 'text',
    nullable: true,
  })
  comments?: string;

  @Column({
    type: 'enum',
    enum: ApprovalChainStatus,
    default: ApprovalChainStatus.PENDING,
  })
  status: ApprovalChainStatus;

  @Column({ name: 'group_id', nullable: true })
  groupId?: string;

  @Column({ name: 'quorum_type', type: 'varchar', length: 20, nullable: true })
  quorumType?: string;

  @Column({ name: 'quorum_count', type: 'int', nullable: true })
  quorumCount?: number;

  // Relationships
  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approver_id' })
  approver: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;
}
