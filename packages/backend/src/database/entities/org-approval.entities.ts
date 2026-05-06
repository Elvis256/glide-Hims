import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('positions')
@Index(['tenantId'])
@Index(['rank'])
export class Position extends BaseEntity {
  @Column({ length: 120 })
  name: string;

  @Column({ length: 50, nullable: true })
  code?: string;

  @Column({ type: 'int', default: 0 })
  rank: number;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

export enum ApproverGroupQuorum {
  ANY = 'any',
  ALL = 'all',
  MAJORITY = 'majority',
  M_OF_N = 'm_of_n',
}

@Entity('approver_groups')
@Index(['tenantId'])
export class ApproverGroup extends BaseEntity {
  @Column({ length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'quorum_type',
    type: 'enum',
    enum: ApproverGroupQuorum,
    default: ApproverGroupQuorum.ANY,
  })
  quorumType: ApproverGroupQuorum;

  @Column({ name: 'quorum_count', type: 'int', nullable: true })
  quorumCount?: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

@Entity('approver_group_members')
@Index(['tenantId'])
@Index(['groupId'])
export class ApproverGroupMember extends BaseEntity {
  @Column({ name: 'group_id' })
  groupId: string;

  @ManyToOne(() => ApproverGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group: ApproverGroup;

  @Column({ name: 'user_id' })
  userId: string;
}

export enum ApprovalPolicyDocType {
  PR = 'PR',
  PO = 'PO',
  RFQ = 'RFQ',
  ANY = 'ANY',
}

export enum ApprovalPolicyStepType {
  DIRECT_MANAGER = 'direct_manager',
  DEPARTMENT_HEAD = 'department_head',
  PARENT_DEPARTMENT_HEAD = 'parent_department_head',
  ROLE = 'role',
  POSITION = 'position',
  SPECIFIC_USER = 'specific_user',
  GROUP = 'group',
}

@Entity('procurement_approval_policies')
@Index(['tenantId'])
@Index(['documentType'])
@Index(['priority'])
export class ProcurementApprovalPolicy extends BaseEntity {
  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({
    name: 'document_type',
    type: 'enum',
    enum: ApprovalPolicyDocType,
    default: ApprovalPolicyDocType.PR,
  })
  documentType: ApprovalPolicyDocType;

  @Column({ name: 'facility_id', nullable: true })
  facilityId?: string;

  @Column({ name: 'department_id', nullable: true })
  departmentId?: string;

  @Column({ length: 50, nullable: true })
  category?: string;

  @Column({ name: 'amount_min', type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountMin?: number;

  @Column({ name: 'amount_max', type: 'decimal', precision: 14, scale: 2, nullable: true })
  amountMax?: number;

  @Column({ type: 'int', default: 0 })
  priority: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}

@Entity('procurement_approval_policy_steps')
@Index(['tenantId'])
@Index(['policyId'])
export class ProcurementApprovalPolicyStep extends BaseEntity {
  @Column({ name: 'policy_id' })
  policyId: string;

  @ManyToOne(() => ProcurementApprovalPolicy, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'policy_id' })
  policy: ProcurementApprovalPolicy;

  @Column({ name: 'step_order', type: 'int' })
  stepOrder: number;

  @Column({
    name: 'approver_type',
    type: 'enum',
    enum: ApprovalPolicyStepType,
  })
  approverType: ApprovalPolicyStepType;

  @Column({ name: 'role_name', length: 80, nullable: true })
  roleName?: string;

  @Column({ name: 'position_id', nullable: true })
  positionId?: string;

  @Column({ name: 'user_id', nullable: true })
  userId?: string;

  @Column({ name: 'group_id', nullable: true })
  groupId?: string;

  @Column({ name: 'levels_up', type: 'int', default: 1 })
  levelsUp: number;

  @Column({ name: 'escalate_to_parent', default: false })
  escalateToParent: boolean;

  @Column({ name: 'is_optional', default: false })
  isOptional: boolean;

  @Column({ name: 'skip_if_self', default: true })
  skipIfSelf: boolean;
}

@Entity('approval_delegations')
@Index(['tenantId', 'fromUserId'])
export class ApprovalDelegation extends BaseEntity {
  @Column({ name: 'from_user_id' })
  fromUserId: string;

  @Column({ name: 'to_user_id' })
  toUserId: string;

  @Column({
    name: 'document_types',
    type: 'varchar',
    length: 20,
    array: true,
    default: () => "'{ANY}'",
  })
  documentTypes: string[];

  @Column({ name: 'valid_from', type: 'timestamp', default: () => 'now()' })
  validFrom: Date;

  @Column({ name: 'valid_to', type: 'timestamp', nullable: true })
  validTo?: Date;

  @Column({ type: 'text', nullable: true })
  reason?: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;
}
