import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { JournalEntry } from './journal-entry.entity';

export enum FinanceApprovalStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('finance_approval_chains')
@Index('uq_finance_approval_journal_level', ['journalEntryId', 'approvalLevel'], { unique: true })
@Index(['status'])
@Index(['facilityId', 'requiredRole'])
export class FinanceApprovalChain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId?: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', name: 'journal_entry_id' })
  journalEntryId: string;

  @ManyToOne(() => JournalEntry, { eager: false })
  @JoinColumn({ name: 'journal_entry_id' })
  journalEntry: JournalEntry;

  @Column({
    name: 'approval_level',
    type: 'int',
    comment: '1 = Finance Officer, 2 = Accounting Manager, 3 = Director, 4 = CFO',
  })
  approvalLevel: number;

  @Column({
    name: 'required_role',
    type: 'varchar',
    length: 100,
    comment: 'Role required to approve at this level',
  })
  requiredRole: string; // 'Finance Officer', 'Accounting Manager', 'Director', 'CFO'

  @Column({
    type: 'enum',
    enum: FinanceApprovalStatus,
    default: FinanceApprovalStatus.PENDING,
  })
  status: FinanceApprovalStatus;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'approver_id',
    comment: 'ID of user who needs to approve (if assigned)',
  })
  approverId?: string;

  @Column({
    type: 'uuid',
    nullable: true,
    name: 'approved_by_id',
    comment: 'ID of user who approved',
  })
  approvedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @Column({
    type: 'timestamp',
    nullable: true,
    name: 'approved_at',
  })
  approvedAt?: Date;

  @Column({
    name: 'rejection_reason',
    type: 'text',
    nullable: true,
  })
  rejectionReason?: string;

  @Column({
    name: 'comments',
    type: 'text',
    nullable: true,
  })
  comments?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
