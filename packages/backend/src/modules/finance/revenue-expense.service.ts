import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { CostCenter } from '../../database/entities/finance-extended.entity';
import { AccountType } from '../../database/entities/chart-of-account.entity';
import { JournalStatus } from '../../database/entities/journal-entry.entity';

/**
 * Revenue & Expense Service
 * Groups GL accounts by cost center, department, and account type
 */

export interface RevenueItem {
  code: string;
  description: string;
  amount: number;
}

export interface ExpenseItem {
  code: string;
  description: string;
  amount: number;
}

export interface RevenueExpenseSummary {
  period: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  revenueItems: RevenueItem[];
  expenseItems: ExpenseItem[];
  revenueCount: number;
  expenseCount: number;
}

export interface CostCenterBreakdown {
  costCenterId: string;
  costCenterName: string;
  departmentName?: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  percentOfTotal: number;
}

export interface DepartmentBreakdown {
  departmentName: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  costCenters: CostCenterBreakdown[];
}

export interface AccountTypeAnalysis {
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  netAmount: number;
  accountCount: number;
  percentage: number;
}

@Injectable()
export class RevenueExpenseService {
  constructor(
    @InjectRepository(JournalEntryLine)
    private readonly journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(CostCenter)
    private readonly costCenterRepository: Repository<CostCenter>,
  ) {}

  /**
   * Get revenue and expense summary for a period
   */
  async getRevenueExpenseSummary(
    facilityId: string,
    period: string,
  ): Promise<RevenueExpenseSummary> {
    const [pY, pM] = period.split('-').map((n) => parseInt(n, 10));
    const startDate = new Date(pY, pM - 1, 1);
    const endDate = new Date(pY, pM, 0); // last day of period month

    const lines = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['journalEntry', 'account'],
    });

    const revenueItems: Map<
      string,
      { code: string; description: string; amount: number }
    > = new Map();
    const expenseItems: Map<
      string,
      { code: string; description: string; amount: number }
    > = new Map();

    let totalRevenue = 0;
    let totalExpense = 0;

    lines.forEach((line) => {
      const accountType = line.account?.accountType;
      if (!accountType) return;

      const code = line.account?.accountCode || '';
      const name = line.account?.accountName || '';
      const amount = line.credit - line.debit; // Revenue is credit-based

      if (accountType === AccountType.REVENUE) {
        totalRevenue += Math.abs(amount);
        if (!revenueItems.has(code)) {
          revenueItems.set(code, { code, description: name, amount: 0 });
        }
        const item = revenueItems.get(code)!;
        item.amount += Math.abs(amount);
      } else if (accountType === AccountType.EXPENSE) {
        totalExpense += Math.abs(amount);
        if (!expenseItems.has(code)) {
          expenseItems.set(code, { code, description: name, amount: 0 });
        }
        const item = expenseItems.get(code)!;
        item.amount += Math.abs(amount);
      }
    });

    return {
      period,
      totalRevenue,
      totalExpense,
      netIncome: totalRevenue - totalExpense,
      revenueItems: Array.from(revenueItems.values()),
      expenseItems: Array.from(expenseItems.values()),
      revenueCount: revenueItems.size,
      expenseCount: expenseItems.size,
    };
  }

  /**
   * Get revenue breakdown by cost center
   */
  async getRevenueByCostCenter(
    facilityId: string,
    period: string,
  ): Promise<CostCenterBreakdown[]> {
    const [pY, pM] = period.split('-').map((n) => parseInt(n, 10));
    const startDate = new Date(pY, pM - 1, 1);
    const endDate = new Date(pY, pM, 0); // last day of period month

    const lines = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['journalEntry', 'account'],
    });

    const costCenterMap = new Map<
      string,
      {
        id: string;
        name: string;
        revenue: number;
        expense: number;
      }
    >();

    lines.forEach((line) => {
      const ccId = 'UNASSIGNED';
      const ccName = 'Unassigned';

      if (!costCenterMap.has(ccId)) {
        costCenterMap.set(ccId, { id: ccId, name: ccName, revenue: 0, expense: 0 });
      }

      const cc = costCenterMap.get(ccId)!;
      const accountType = line.account?.accountType;
      if (!accountType) return;

      const amount = line.credit - line.debit;

      if (accountType === AccountType.REVENUE) {
        cc.revenue += Math.abs(amount);
      } else if (accountType === AccountType.EXPENSE) {
        cc.expense += Math.abs(amount);
      }
    });

    // Calculate total for percentage
    const totalRevenue = Array.from(costCenterMap.values()).reduce(
      (sum, cc) => sum + cc.revenue,
      0,
    );

    return Array.from(costCenterMap.values()).map((cc) => ({
      costCenterId: cc.id,
      costCenterName: cc.name,
      totalRevenue: cc.revenue,
      totalExpense: cc.expense,
      netIncome: cc.revenue - cc.expense,
      percentOfTotal: totalRevenue > 0 ? (cc.revenue / totalRevenue) * 100 : 0,
    }));
  }

  /**
   * Get expense breakdown by cost center
   */
  async getExpenseByCostCenter(
    facilityId: string,
    period: string,
  ): Promise<CostCenterBreakdown[]> {
    const [pY, pM] = period.split('-').map((n) => parseInt(n, 10));
    const startDate = new Date(pY, pM - 1, 1);
    const endDate = new Date(pY, pM, 0); // last day of period month

    const lines = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['journalEntry', 'account'],
    });

    const costCenterMap = new Map<
      string,
      {
        id: string;
        name: string;
        revenue: number;
        expense: number;
      }
    >();

    lines.forEach((line) => {
      const ccId = 'UNASSIGNED';
      const ccName = 'Unassigned';

      if (!costCenterMap.has(ccId)) {
        costCenterMap.set(ccId, { id: ccId, name: ccName, revenue: 0, expense: 0 });
      }

      const cc = costCenterMap.get(ccId)!;
      const accountType = line.account?.accountType;
      if (!accountType) return;

      const amount = line.credit - line.debit;

      if (accountType === AccountType.REVENUE) {
        cc.revenue += Math.abs(amount);
      } else if (accountType === AccountType.EXPENSE) {
        cc.expense += Math.abs(amount);
      }
    });

    // Calculate total for percentage
    const totalExpense = Array.from(costCenterMap.values()).reduce(
      (sum, cc) => sum + cc.expense,
      0,
    );

    return Array.from(costCenterMap.values()).map((cc) => ({
      costCenterId: cc.id,
      costCenterName: cc.name,
      totalRevenue: cc.revenue,
      totalExpense: cc.expense,
      netIncome: cc.revenue - cc.expense,
      percentOfTotal: totalExpense > 0 ? (cc.expense / totalExpense) * 100 : 0,
    }));
  }

  /**
   * Get revenue by account type analysis
   */
  async getRevenueByAccountType(
    facilityId: string,
    period: string,
  ): Promise<AccountTypeAnalysis[]> {
    const [pY, pM] = period.split('-').map((n) => parseInt(n, 10));
    const startDate = new Date(pY, pM - 1, 1);
    const endDate = new Date(pY, pM, 0); // last day of period month

    const lines = await this.journalEntryLineRepository.find({
      where: {
        journalEntry: {
          facilityId,
          status: JournalStatus.POSTED,
          journalDate: Between(startDate, endDate),
        },
      },
      relations: ['account', 'journalEntry'],
    });

    const accountTypeMap = new Map<
      string,
      {
        type: string;
        debit: number;
        credit: number;
        accounts: Set<string>;
      }
    >();

    let totalDebit = 0;
    let totalCredit = 0;

    lines.forEach((line) => {
      const accountType = line.account?.accountType || 'UNKNOWN';

      if (!accountTypeMap.has(accountType)) {
        accountTypeMap.set(accountType, {
          type: accountType,
          debit: 0,
          credit: 0,
          accounts: new Set(),
        });
      }

      const at = accountTypeMap.get(accountType)!;
      at.debit += line.debit;
      at.credit += line.credit;
      at.accounts.add(line.accountId);

      totalDebit += line.debit;
      totalCredit += line.credit;
    });

    const totalAmount = totalDebit + totalCredit;

    return Array.from(accountTypeMap.values()).map((at) => ({
      accountType: at.type,
      totalDebit: at.debit,
      totalCredit: at.credit,
      netAmount: at.debit - at.credit,
      accountCount: at.accounts.size,
      percentage:
        totalAmount > 0
          ? ((Math.abs(at.debit - at.credit) / totalAmount) * 100)
          : 0,
    }));
  }

  /**
   * Get department breakdown (derived from cost centers)
   */
  async getDepartmentBreakdown(
    facilityId: string,
    period: string,
  ): Promise<DepartmentBreakdown[]> {
    const costCenters = await this.getRevenueByCostCenter(
      facilityId,
      period,
    );

    // Group by department (would need actual department mapping in real system)
    const deptMap = new Map<string, DepartmentBreakdown>();

    costCenters.forEach((cc) => {
      const deptName = cc.departmentName || 'General';

      if (!deptMap.has(deptName)) {
        deptMap.set(deptName, {
          departmentName: deptName,
          totalRevenue: 0,
          totalExpense: 0,
          netIncome: 0,
          costCenters: [],
        });
      }

      const dept = deptMap.get(deptName)!;
      dept.totalRevenue += cc.totalRevenue;
      dept.totalExpense += cc.totalExpense;
      dept.netIncome += cc.netIncome;
      dept.costCenters.push(cc);
    });

    return Array.from(deptMap.values());
  }

  /**
   * Get top revenue accounts
   */
  async getTopRevenueAccounts(
    facilityId: string,
    period: string,
    limit: number = 10,
  ): Promise<
    Array<{
      accountCode: string;
      accountName: string;
      amount: number;
      percentage: number;
    }>
  > {
    const summary = await this.getRevenueExpenseSummary(facilityId, period);

    return summary.revenueItems
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map((item) => ({
        accountCode: item.code,
        accountName: item.description,
        amount: item.amount,
        percentage:
          summary.totalRevenue > 0
            ? (item.amount / summary.totalRevenue) * 100
            : 0,
      }));
  }

  /**
   * Get top expense accounts
   */
  async getTopExpenseAccounts(
    facilityId: string,
    period: string,
    limit: number = 10,
  ): Promise<
    Array<{
      accountCode: string;
      accountName: string;
      amount: number;
      percentage: number;
    }>
  > {
    const summary = await this.getRevenueExpenseSummary(facilityId, period);

    return summary.expenseItems
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit)
      .map((item) => ({
        accountCode: item.code,
        accountName: item.description,
        amount: item.amount,
        percentage:
          summary.totalExpense > 0
            ? (item.amount / summary.totalExpense) * 100
            : 0,
      }));
  }
}
