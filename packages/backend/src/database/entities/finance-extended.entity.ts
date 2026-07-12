import { Entity, Column, ManyToOne, OneToMany, JoinColumn, Index, Unique } from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { ChartOfAccount } from './chart-of-account.entity';
import { FiscalPeriod } from './fiscal-period.entity';

// ─── Cost Center ────────────────────────────────────────────────────────────

export enum CostCenterType {
  DEPARTMENT = 'department',
  PROJECT = 'project',
  PROGRAM = 'program',
}

@Entity('cost_centers')
@Index(['facilityId', 'code'], { unique: true })
export class CostCenter extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 20 })
  code: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: CostCenterType, default: CostCenterType.DEPARTMENT })
  type: CostCenterType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string;
}

// ─── Budget ─────────────────────────────────────────────────────────────────

export enum BudgetStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  ACTIVE = 'active',
  CLOSED = 'closed',
}

@Entity('budgets')
@Index(['facilityId', 'fiscalYear'])
export class Budget extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'fiscal_year' })
  fiscalYear: number;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'enum', enum: BudgetStatus, default: BudgetStatus.DRAFT })
  status: BudgetStatus;

  @Column({ name: 'total_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  totalAmount: number;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @OneToMany(() => BudgetLine, (line) => line.budget, { cascade: true })
  lines: BudgetLine[];
}

@Entity('budget_lines')
@Index(['budgetId', 'accountId', 'costCenterId'])
export class BudgetLine extends BaseEntity {
  @Column({ name: 'budget_id', type: 'uuid' })
  budgetId: string;

  @ManyToOne(() => Budget, (budget) => budget.lines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'budget_id' })
  budget: Budget;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => ChartOfAccount)
  @JoinColumn({ name: 'account_id' })
  account: ChartOfAccount;

  @Column({ name: 'cost_center_id', type: 'uuid', nullable: true })
  costCenterId: string;

  @Column({ name: 'budgeted_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  budgetedAmount: number;

  @Column({ name: 'actual_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  actualAmount: number;

  @Column({ type: 'int', nullable: true })
  period: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

// ─── Bank Reconciliation ────────────────────────────────────────────────────

export enum ReconciliationStatus {
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  REVIEWED = 'reviewed',
}

export enum ReconciliationItemStatus {
  MATCHED = 'matched',
  UNMATCHED = 'unmatched',
  ADJUSTED = 'adjusted',
}

@Entity('bank_reconciliations')
export class BankReconciliation extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ name: 'bank_account_id', type: 'uuid' })
  bankAccountId: string;

  @ManyToOne(() => ChartOfAccount)
  @JoinColumn({ name: 'bank_account_id' })
  bankAccount: ChartOfAccount;

  @Column({ name: 'statement_date', type: 'date' })
  statementDate: Date;

  @Column({ name: 'statement_balance', type: 'decimal', precision: 15, scale: 2 })
  statementBalance: number;

  @Column({ name: 'book_balance', type: 'decimal', precision: 15, scale: 2 })
  bookBalance: number;

  @Column({ name: 'reconciled_balance', type: 'decimal', precision: 15, scale: 2, nullable: true })
  reconciledBalance: number;

  @Column({ type: 'enum', enum: ReconciliationStatus, default: ReconciliationStatus.IN_PROGRESS })
  status: ReconciliationStatus;

  @Column({ name: 'reconciled_by', type: 'uuid', nullable: true })
  reconciledBy: string;

  @Column({ name: 'reconciled_at', type: 'timestamp', nullable: true })
  reconciledAt: Date;

  @OneToMany(() => BankReconciliationItem, (item) => item.reconciliation, { cascade: true })
  items: BankReconciliationItem[];
}

@Entity('bank_reconciliation_items')
export class BankReconciliationItem extends BaseEntity {
  @Column({ name: 'reconciliation_id', type: 'uuid' })
  reconciliationId: string;

  @ManyToOne(() => BankReconciliation, (recon) => recon.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reconciliation_id' })
  reconciliation: BankReconciliation;

  @Column({ name: 'statement_reference', nullable: true })
  statementReference: string;

  @Column({ name: 'statement_description', nullable: true })
  statementDescription: string;

  @Column({ name: 'statement_amount', type: 'decimal', precision: 15, scale: 2 })
  statementAmount: number;

  @Column({ name: 'statement_date', type: 'date' })
  statementDate: Date;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string;

  @Column({
    type: 'enum',
    enum: ReconciliationItemStatus,
    default: ReconciliationItemStatus.UNMATCHED,
  })
  status: ReconciliationItemStatus;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

// ─── Patient Credit Note ────────────────────────────────────────────────────

export enum CreditNoteType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

export enum CreditNoteStatus {
  DRAFT = 'draft',
  APPROVED = 'approved',
  APPLIED = 'applied',
  CANCELLED = 'cancelled',
}

@Entity('patient_credit_notes')
@Unique(['tenantId', 'noteNumber'])
export class PatientCreditNote extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ name: 'note_number' })
  noteNumber: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ type: 'enum', enum: CreditNoteType, default: CreditNoteType.CREDIT })
  type: CreditNoteType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: CreditNoteStatus, default: CreditNoteStatus.DRAFT })
  status: CreditNoteStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'applied_at', type: 'timestamp', nullable: true })
  appliedAt: Date;
}

// ─── Patient Deposit ────────────────────────────────────────────────────────

export enum DepositStatus {
  ACTIVE = 'active',
  PARTIALLY_APPLIED = 'partially_applied',
  FULLY_APPLIED = 'fully_applied',
  REFUNDED = 'refunded',
}

@Entity('patient_deposits')
@Unique(['tenantId', 'depositNumber'])
export class PatientDeposit extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ name: 'deposit_number' })
  depositNumber: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ name: 'payment_method' })
  paymentMethod: string;

  @Column({ name: 'payment_reference', nullable: true })
  paymentReference: string;

  @Column({ type: 'enum', enum: DepositStatus, default: DepositStatus.ACTIVE })
  status: DepositStatus;

  @Column({ name: 'received_by', type: 'uuid' })
  receivedBy: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}

@Entity('deposit_applications')
export class DepositApplication extends BaseEntity {
  @Column({ name: 'deposit_id', type: 'uuid' })
  depositId: string;

  @ManyToOne(() => PatientDeposit)
  @JoinColumn({ name: 'deposit_id' })
  deposit: PatientDeposit;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ name: 'applied_by', type: 'uuid' })
  appliedBy: string;
}

// ─── Waiver ─────────────────────────────────────────────────────────────────

export enum WaiverStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  APPLIED = 'applied',
}

@Entity('waivers')
export class Waiver extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ name: 'invoice_id', type: 'uuid' })
  invoiceId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'waiver_percent', type: 'decimal', precision: 5, scale: 2, default: 0 })
  waiverPercent: number;

  @Column({ name: 'waiver_amount', type: 'decimal', precision: 12, scale: 2 })
  waiverAmount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: WaiverStatus, default: WaiverStatus.PENDING })
  status: WaiverStatus;

  @Column({ name: 'requested_by', type: 'uuid' })
  requestedBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;

  @Column({ name: 'approved_at', type: 'timestamp', nullable: true })
  approvedAt: Date;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string;
}

// ─── Petty Cash ─────────────────────────────────────────────────────────────

export enum PettyCashTransactionType {
  EXPENSE = 'expense',
  TOPUP = 'topup',
  REFUND = 'refund',
}

@Entity('petty_cash_funds')
export class PettyCashFund extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ length: 100 })
  name: string;

  @Column({ name: 'imprest_amount', type: 'decimal', precision: 12, scale: 2 })
  imprestAmount: number;

  @Column({ name: 'current_balance', type: 'decimal', precision: 12, scale: 2 })
  currentBalance: number;

  @Column({ name: 'custodian_id', type: 'uuid' })
  custodianId: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => PettyCashTransaction, (txn) => txn.fund)
  transactions: PettyCashTransaction[];
}

@Entity('petty_cash_transactions')
export class PettyCashTransaction extends BaseEntity {
  @Column({ name: 'fund_id', type: 'uuid' })
  fundId: string;

  @ManyToOne(() => PettyCashFund, (fund) => fund.transactions)
  @JoinColumn({ name: 'fund_id' })
  fund: PettyCashFund;

  @Column({ type: 'enum', enum: PettyCashTransactionType })
  type: PettyCashTransactionType;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column()
  description: string;

  @Column({ name: 'receipt_reference', nullable: true })
  receiptReference: string;

  @Column({ nullable: true })
  category: string;

  @Column({ name: 'recorded_by', type: 'uuid' })
  recordedBy: string;

  @Column({ name: 'approved_by', type: 'uuid', nullable: true })
  approvedBy: string;
}

// ─── Finance Audit Log ──────────────────────────────────────────────────────

@Entity('finance_audit_log')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['createdAt'])
export class FinanceAuditLog extends BaseEntity {
  @Column({ name: 'entity_type' })
  entityType: string;

  @Column({ name: 'entity_id', type: 'uuid' })
  entityId: string;

  @Column()
  action: string;

  @Column({ name: 'old_value', type: 'jsonb', nullable: true })
  oldValue: any;

  @Column({ name: 'new_value', type: 'jsonb', nullable: true })
  newValue: any;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'user_name', nullable: true })
  userName: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;
}

// ─── Donor Fund ─────────────────────────────────────────────────────────────

export enum FundStatus {
  ACTIVE = 'active',
  EXHAUSTED = 'exhausted',
  EXPIRED = 'expired',
  CLOSED = 'closed',
}

export enum FundRestriction {
  UNRESTRICTED = 'unrestricted',
  TEMPORARILY_RESTRICTED = 'temporarily_restricted',
  PERMANENTLY_RESTRICTED = 'permanently_restricted',
}

@Entity('donor_funds')
@Unique(['tenantId', 'fundCode'])
export class DonorFund extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @Column({ name: 'fund_code' })
  fundCode: string;

  @Column()
  name: string;

  @Column({ name: 'donor_name' })
  donorName: string;

  @Column({ name: 'grant_amount', type: 'decimal', precision: 15, scale: 2 })
  grantAmount: number;

  @Column({ name: 'disbursed_amount', type: 'decimal', precision: 15, scale: 2, default: 0 })
  disbursedAmount: number;

  @Column({ name: 'remaining_balance', type: 'decimal', precision: 15, scale: 2 })
  remainingBalance: number;

  @Column({ type: 'enum', enum: FundRestriction, default: FundRestriction.TEMPORARILY_RESTRICTED })
  restriction: FundRestriction;

  @Column({ type: 'enum', enum: FundStatus, default: FundStatus.ACTIVE })
  status: FundStatus;

  @Column({ name: 'start_date', type: 'date' })
  startDate: Date;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: Date;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string;
}

// ─── Inter-Facility Transaction ─────────────────────────────────────────────

export enum InterFacilityStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  SETTLED = 'settled',
  CANCELLED = 'cancelled',
}

@Entity('interfacility_transactions')
@Unique(['tenantId', 'referenceNumber'])
export class InterFacilityTransaction extends BaseEntity {
  @Column({ name: 'source_facility_id', type: 'uuid' })
  sourceFacilityId: string;

  @Column({ name: 'target_facility_id', type: 'uuid' })
  targetFacilityId: string;

  @Column({ name: 'reference_number' })
  referenceNumber: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'transaction_type' })
  transactionType: string;

  @Column({ type: 'enum', enum: InterFacilityStatus, default: InterFacilityStatus.PENDING })
  status: InterFacilityStatus;

  @Column({ name: 'created_by', type: 'uuid' })
  createdBy: string;

  @Column({ name: 'confirmed_by', type: 'uuid', nullable: true })
  confirmedBy: string;

  @Column({ name: 'settled_at', type: 'timestamp', nullable: true })
  settledAt: Date;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string;
}

// ─── GL Reconciliation ──────────────────────────────────────────────────────

export enum GlReconciliationStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  RECONCILED = 'reconciled',
  PARTIAL = 'partial',
}

@Entity('gl_reconciliation_status')
@Index(['facilityId', 'accountId', 'fiscalPeriodId'], { unique: true })
@Index(['facilityId', 'status'])
export class GlReconciliation extends BaseEntity {
  @Column({ name: 'facility_id', type: 'uuid' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'account_id', type: 'uuid' })
  accountId: string;

  @ManyToOne(() => ChartOfAccount)
  @JoinColumn({ name: 'account_id' })
  account: ChartOfAccount;

  @Column({ name: 'fiscal_period_id', type: 'uuid' })
  fiscalPeriodId: string;

  @ManyToOne(() => FiscalPeriod)
  @JoinColumn({ name: 'fiscal_period_id' })
  fiscalPeriod: FiscalPeriod;

  @Column({ name: 'gl_total', type: 'decimal', precision: 15, scale: 2, default: 0 })
  glTotal: number;

  @Column({ name: 'external_total', type: 'decimal', precision: 15, scale: 2, default: 0 })
  externalTotal: number;

  @Column({ name: 'difference', type: 'decimal', precision: 15, scale: 2, default: 0 })
  difference: number;

  @Column({
    type: 'enum',
    enum: GlReconciliationStatus,
    default: GlReconciliationStatus.PENDING,
  })
  status: GlReconciliationStatus;

  @Column({ name: 'reconciled_by', type: 'uuid', nullable: true })
  reconciledBy: string;

  @Column({ name: 'reconciled_at', type: 'timestamp', nullable: true })
  reconciledAt: Date;

  @Column({ name: 'item_count', type: 'int', default: 0 })
  itemCount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @OneToMany(() => GlReconciliationItem, (item) => item.reconciliation, { cascade: true })
  items: GlReconciliationItem[];
}

export enum GlReconciliationItemType {
  GL_ENTRY = 'gl_entry',
  EXTERNAL_ENTRY = 'external_entry',
  ADJUSTMENT = 'adjustment',
}

export enum GlReconciliationItemMatchStatus {
  MATCHED = 'matched',
  UNMATCHED = 'unmatched',
  ADJUSTED = 'adjusted',
}

@Entity('gl_reconciliation_items')
@Index(['reconciliationId', 'matchStatus'])
export class GlReconciliationItem extends BaseEntity {
  @Column({ name: 'reconciliation_id', type: 'uuid' })
  reconciliationId: string;

  @ManyToOne(() => GlReconciliation, (recon) => recon.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reconciliation_id' })
  reconciliation: GlReconciliation;

  @Column({
    name: 'item_type',
    type: 'enum',
    enum: GlReconciliationItemType,
    default: GlReconciliationItemType.GL_ENTRY,
  })
  itemType: GlReconciliationItemType;

  @Column({ name: 'journal_entry_id', type: 'uuid', nullable: true })
  journalEntryId: string;

  @Column({ name: 'external_reference', nullable: true })
  externalReference: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ name: 'entry_date', type: 'date' })
  entryDate: Date;

  @Column({ nullable: true })
  description: string;

  @Column({
    name: 'match_status',
    type: 'enum',
    enum: GlReconciliationItemMatchStatus,
    default: GlReconciliationItemMatchStatus.UNMATCHED,
  })
  matchStatus: GlReconciliationItemMatchStatus;

  @Column({ name: 'matched_with_id', type: 'uuid', nullable: true })
  matchedWithId: string;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
