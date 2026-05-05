import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Facility } from './facility.entity';
import { User } from './user.entity';
import { FiscalPeriod } from './fiscal-period.entity';

export enum JournalStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  POSTED = 'posted',
  REJECTED = 'rejected',
  REVERSED = 'reversed',
}

export enum JournalType {
  GENERAL = 'general',
  REVENUE = 'revenue',
  PAYMENT = 'payment',
  ADJUSTMENT = 'adjustment',
  CLOSING = 'closing',
}

@Entity('journal_entries')
export class JournalEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 20, unique: true, name: 'journal_number' })
  journalNumber: string;

  @Column({ type: 'date', name: 'journal_date' })
  journalDate: Date;

  @Column({ type: 'uuid', name: 'fiscal_period_id' })
  fiscalPeriodId: string;

  @ManyToOne(() => FiscalPeriod)
  @JoinColumn({ name: 'fiscal_period_id' })
  fiscalPeriod: FiscalPeriod;

  @Column({ type: 'enum', enum: JournalType, default: JournalType.GENERAL, name: 'journal_type' })
  journalType: JournalType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  reference: string; // External reference (invoice, receipt, etc.)

  @Column({ type: 'enum', enum: JournalStatus, default: JournalStatus.DRAFT })
  status: JournalStatus;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_debit' })
  totalDebit: number;

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'total_credit' })
  totalCredit: number;

  @OneToMany('JournalEntryLine', 'journalEntry', { cascade: true })
  lines: any[];

  // Created by
  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  // Posted by
  @Column({ type: 'uuid', nullable: true, name: 'posted_by_id' })
  postedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'posted_by_id' })
  postedBy: User;

  @Column({ type: 'timestamp', nullable: true, name: 'posted_at' })
  postedAt: Date;

  // Reversal tracking
  @Column({ type: 'boolean', default: false, name: 'is_reversal' })
  isReversal: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_reversed' })
  isReversed: boolean;

  @Column({ type: 'uuid', nullable: true, name: 'reversal_of_id' })
  reversalOfId: string;

  @Column({ type: 'uuid', nullable: true, name: 'reversed_by_id' })
  reversedById: string;

  @Column({ type: 'timestamp', nullable: true, name: 'reversed_at' })
  reversedAt: Date;

  // Approval workflow fields (Finance Phase 2A)
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'approval_status' })
  approvalStatus?: string; // 'draft', 'submitted', 'approved', 'posted', 'rejected'

  @Column({ type: 'uuid', nullable: true, name: 'submitted_by_user_id' })
  submittedByUserId?: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'submitted_by_user_id' })
  submittedBy?: User;

  @Column({ type: 'timestamp', nullable: true, name: 'submitted_at' })
  submittedAt?: Date;

  @Column({ type: 'boolean', default: false, name: 'approval_required' })
  approvalRequired?: boolean;

  @Column({
    type: 'decimal',
    precision: 20,
    scale: 2,
    nullable: true,
    name: 'approval_amount_threshold',
  })
  approvalAmountThreshold?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
