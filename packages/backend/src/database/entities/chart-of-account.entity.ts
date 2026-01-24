import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Tree,
  TreeParent,
  TreeChildren,
} from 'typeorm';
import { Facility } from './facility.entity';

export enum AccountType {
  ASSET = 'asset',
  LIABILITY = 'liability',
  EQUITY = 'equity',
  REVENUE = 'revenue',
  EXPENSE = 'expense',
}

export enum AccountCategory {
  // Assets
  CASH = 'cash',
  BANK = 'bank',
  RECEIVABLES = 'receivables',
  INVENTORY = 'inventory',
  FIXED_ASSETS = 'fixed_assets',
  // Liabilities
  PAYABLES = 'payables',
  ACCRUALS = 'accruals',
  LOANS = 'loans',
  // Equity
  CAPITAL = 'capital',
  RETAINED_EARNINGS = 'retained_earnings',
  // Revenue
  SERVICE_REVENUE = 'service_revenue',
  OTHER_INCOME = 'other_income',
  // Expenses
  SALARIES = 'salaries',
  SUPPLIES = 'supplies',
  UTILITIES = 'utilities',
  DEPRECIATION = 'depreciation',
  OTHER_EXPENSE = 'other_expense',
}

@Entity('chart_of_accounts')
@Tree('materialized-path')
export class ChartOfAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ length: 20, name: 'account_code' })
  accountCode: string;

  @Column({ length: 200, name: 'account_name' })
  accountName: string;

  @Column({ type: 'enum', enum: AccountType, name: 'account_type' })
  accountType: AccountType;

  @Column({ type: 'enum', enum: AccountCategory, name: 'account_category' })
  accountCategory: AccountCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @TreeParent()
  parent: ChartOfAccount;

  @TreeChildren()
  children: ChartOfAccount[];

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_header' })
  isHeader: boolean; // Header accounts can't have transactions

  @Column({ type: 'decimal', precision: 15, scale: 2, default: 0, name: 'current_balance' })
  currentBalance: number;

  @Column({ type: 'varchar', length: 10, default: 'UGX' })
  currency: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
