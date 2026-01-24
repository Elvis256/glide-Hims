import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { User } from './user.entity';
import { Facility } from './facility.entity';

export enum MasterDataEntityType {
  SERVICE = 'service',
  SERVICE_CATEGORY = 'service_category',
  ITEM = 'item',
  LAB_TEST = 'lab_test',
  IMAGING_MODALITY = 'imaging_modality',
  DIAGNOSIS = 'diagnosis',
  SUPPLIER = 'supplier',
  INSURANCE_PROVIDER = 'insurance_provider',
  CHART_OF_ACCOUNT = 'chart_of_account',
  MEMBERSHIP_SCHEME = 'membership_scheme',
  ROLE = 'role',
  DEPARTMENT = 'department',
  UNIT = 'unit',
  PROVIDER = 'provider',
}

export enum VersionAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  RESTORE = 'restore',
  APPROVE = 'approve',
  REJECT = 'reject',
}

export enum ApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  AUTO_APPROVED = 'auto_approved',
}

@Entity('master_data_versions')
@Index(['entityType', 'entityId'])
@Index(['createdAt'])
export class MasterDataVersion extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @Column({
    type: 'enum',
    enum: MasterDataEntityType,
    name: 'entity_type',
  })
  entityType: MasterDataEntityType;

  @Column({ type: 'uuid', name: 'entity_id' })
  entityId: string;

  @Column({ type: 'int', name: 'version_number' })
  versionNumber: number;

  @Column({
    type: 'enum',
    enum: VersionAction,
  })
  action: VersionAction;

  @Column({ type: 'jsonb', nullable: true, name: 'previous_data' })
  previousData?: Record<string, any>;

  @Column({ type: 'jsonb', name: 'current_data' })
  currentData: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'changed_fields' })
  changedFields?: string[];

  @Column({ type: 'text', nullable: true, name: 'change_reason' })
  changeReason?: string;

  @Column({ type: 'uuid', name: 'changed_by' })
  changedBy: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by' })
  changedByUser: User;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.AUTO_APPROVED,
    name: 'approval_status',
  })
  approvalStatus: ApprovalStatus;

  @Column({ type: 'uuid', nullable: true, name: 'approved_by' })
  approvedBy?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by' })
  approvedByUser?: User;

  @Column({ type: 'timestamp', nullable: true, name: 'approved_at' })
  approvedAt?: Date;

  @Column({ type: 'text', nullable: true, name: 'approval_notes' })
  approvalNotes?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'ip_address' })
  ipAddress?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'user_agent' })
  userAgent?: string;
}

@Entity('master_data_approval_rules')
export class MasterDataApprovalRule extends BaseEntity {
  @Column({ type: 'uuid', nullable: true, name: 'facility_id' })
  facilityId?: string;

  @ManyToOne(() => Facility, { nullable: true })
  @JoinColumn({ name: 'facility_id' })
  facility?: Facility;

  @Column({
    type: 'enum',
    enum: MasterDataEntityType,
    name: 'entity_type',
  })
  entityType: MasterDataEntityType;

  @Column({ type: 'boolean', default: false, name: 'requires_approval' })
  requiresApproval: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'approver_role_id' })
  approverRoleId?: string;

  @Column({ type: 'int', default: 1, name: 'min_approvers' })
  minApprovers: number;

  @Column({ type: 'boolean', default: false, name: 'notify_on_change' })
  notifyOnChange: boolean;

  @Column({ type: 'jsonb', nullable: true, name: 'notification_emails' })
  notificationEmails?: string[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;
}
