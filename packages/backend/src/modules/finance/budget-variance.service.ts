import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { Budget, BudgetLine } from '../../database/entities/finance-extended.entity';
import { JournalEntryLine } from '../../database/entities/journal-entry-line.entity';
import { ChartOfAccount, AccountType } from '../../database/entities/chart-of-account.entity';

/**
 * Resolve a YYYY-MM period string to its true [start, end] day window.
 * Centralised because previous code used
 *   new Date(period + '-01').getDate()
 * which always returns 1 → start === end → 1-day query window
 * (Budget audit F6).
 */
function resolvePeriodRange(period: string): { startDate: Date; endDate: Date } {
  const [year, month] = period.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) {
    throw new Error(`Invalid period '${period}'; expected YYYY-MM`);
  }
  const startDate = new Date(Date.UTC(year, month - 1, 1));
  // Day 0 of next month = last day of this month.
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  return { startDate, endDate };
}

/**
 * Budget Variance Service
 * Compares budget allocations against actual GL entries
 */

export interface BudgetVarianceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  budgetedAmount: number;
  actualAmount: number;
  absoluteVariance: number;
  percentVariance: number;
  status: 'under' | 'over' | 'on-target';
  severity: 'low' | 'medium' | 'high';
}

export interface BudgetVarianceSummary {
  period: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  percentVariance: number;
  itemCount: number;
  underBudgetCount: number;
  overBudgetCount: number;
  onTargetCount: number;
}

export interface CostCenterBudgetAnalysis {
  costCenterId: string;
  costCenterName: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  percentVariance: number;
  remainingBudget: number;
  burnRate: number; // percentage of budget consumed
}

export interface BudgetByAccountType {
  accountType: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  percentVariance: number;
  accountCount: number;
}

export interface BudgetVsActualLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  budgetMonth: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  percentVariance: number;
}

@Injectable()
export class BudgetVarianceService {
  constructor(
    @InjectRepository(BudgetLine)
    private readonly budgetLineRepository: Repository<BudgetLine>,
    @InjectRepository(JournalEntryLine)
    private readonly journalEntryLineRepository: Repository<JournalEntryLine>,
    @InjectRepository(ChartOfAccount)
    private readonly accountRepository: Repository<ChartOfAccount>,
  ) {}

  /**
   * Get variance summary for period
   */
  async getBudgetVarianceSummary(
    facilityId: string,
    period: string,
    tenantId?: string,
  ): Promise<BudgetVarianceSummary> {
    const variances = await this.getDetailedVariances(facilityId, period, tenantId);

    const totalBudget = variances.reduce((sum, v) => sum + v.budgetedAmount, 0);
    const totalActual = variances.reduce((sum, v) => sum + v.actualAmount, 0);
    const totalVariance = totalBudget - totalActual;
    const percentVariance = totalBudget > 0 ? (totalVariance / totalBudget) * 100 : 0;

    const underBudgetCount = variances.filter((v) => v.status === 'under').length;
    const overBudgetCount = variances.filter((v) => v.status === 'over').length;
    const onTargetCount = variances.filter((v) => v.status === 'on-target').length;

    return {
      period,
      totalBudget,
      totalActual,
      totalVariance,
      percentVariance,
      itemCount: variances.length,
      underBudgetCount,
      overBudgetCount,
      onTargetCount,
    };
  }

  /**
   * Get detailed variance for each account
   */
  async getDetailedVariances(
    facilityId: string,
    period: string,
    tenantId?: string,
  ): Promise<BudgetVarianceItem[]> {
    const { startDate, endDate } = resolvePeriodRange(period);

    // Get budgets for period — must scope by tenant to avoid leaking
    // other tenants' budget lines if the same facilityId UUID were
    // ever reused (defence in depth).
    const budgetLines = await this.budgetLineRepository.find({
      where: {
        ...(tenantId ? { tenantId } : {}),
        budget: {
          facilityId,
          ...(tenantId ? { tenantId } : {}),
        },
      } as any,
      relations: ['account', 'budget'],
    });

    // Get actuals from GL — same tenant scoping.
    const lines = await this.journalEntryLineRepository.find({
      where: {
        ...(tenantId ? { tenantId } : {}),
        journalEntry: {
          facilityId,
          journalDate: Between(startDate, endDate),
          ...(tenantId ? { tenantId } : {}),
        },
      } as any,
      relations: ['account', 'journalEntry'],
    });

    // Aggregate actuals by account
    const actualsByAccount = new Map<string, number>();
    lines.forEach((line) => {
      const accountId = line.accountId;
      const current = actualsByAccount.get(accountId) || 0;
      actualsByAccount.set(accountId, current + (line.debit - line.credit));
    });

    // Calculate variances
    const variances: BudgetVarianceItem[] = budgetLines.map((budgetLine) => {
      const actualAmount = Math.abs(actualsByAccount.get(budgetLine.accountId) || 0);
      const budgetedAmount = Math.abs(budgetLine.budgetedAmount);
      const absoluteVariance = budgetedAmount - actualAmount;
      const percentVariance = budgetedAmount > 0 ? (absoluteVariance / budgetedAmount) * 100 : 0;

      let status: 'under' | 'over' | 'on-target';
      if (actualAmount > budgetedAmount * 1.1) {
        status = 'over';
      } else if (actualAmount < budgetedAmount * 0.9) {
        status = 'under';
      } else {
        status = 'on-target';
      }

      let severity: 'low' | 'medium' | 'high';
      if (Math.abs(percentVariance) > 20) {
        severity = 'high';
      } else if (Math.abs(percentVariance) > 10) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      return {
        accountId: budgetLine.accountId,
        accountCode: budgetLine.account!.accountCode,
        accountName: budgetLine.account!.accountName,
        budgetedAmount,
        actualAmount,
        absoluteVariance,
        percentVariance,
        status,
        severity,
      };
    });

    return variances.sort((a, b) => Math.abs(b.percentVariance) - Math.abs(a.percentVariance));
  }

  /**
   * Get budget vs actual by cost center
   */
  async getBudgetByCostCenter(
    facilityId: string,
    period: string,
    tenantId?: string,
  ): Promise<CostCenterBudgetAnalysis[]> {
    const { startDate, endDate } = resolvePeriodRange(period);

    // Get budgets grouped by cost center
    const budgetLines = await this.budgetLineRepository.find({
      where: {
        ...(tenantId ? { tenantId } : {}),
        budget: {
          facilityId,
          ...(tenantId ? { tenantId } : {}),
        },
      } as any,
      relations: ['budget'],
    });

    // Get actuals by cost center
    const lines = await this.journalEntryLineRepository.find({
      where: {
        ...(tenantId ? { tenantId } : {}),
        journalEntry: {
          facilityId,
          journalDate: Between(startDate, endDate),
          ...(tenantId ? { tenantId } : {}),
        },
      } as any,
      relations: ['journalEntry'],
    });

    const costCenterMap = new Map<
      string,
      {
        id: string;
        name: string;
        budgeted: number;
        actual: number;
      }
    >();

    // Aggregate budgets by cost center
    budgetLines.forEach((budgetLine) => {
      const ccId = budgetLine.costCenterId || 'UNASSIGNED';
      const ccName = 'Unassigned';

      if (!costCenterMap.has(ccId)) {
        costCenterMap.set(ccId, { id: ccId, name: ccName, budgeted: 0, actual: 0 });
      }

      const cc = costCenterMap.get(ccId)!;
      cc.budgeted += Math.abs(budgetLine.budgetedAmount);
    });

    // Aggregate actuals by cost center
    lines.forEach((line) => {
      const ccId = 'UNASSIGNED';
      const ccName = 'Unassigned';

      if (!costCenterMap.has(ccId)) {
        costCenterMap.set(ccId, { id: ccId, name: ccName, budgeted: 0, actual: 0 });
      }

      const cc = costCenterMap.get(ccId)!;
      cc.actual += Math.abs(line.debit - line.credit);
    });

    return Array.from(costCenterMap.values()).map((cc) => {
      const variance = cc.budgeted - cc.actual;
      const percentVariance = cc.budgeted > 0 ? (variance / cc.budgeted) * 100 : 0;
      const burnRate = cc.budgeted > 0 ? (cc.actual / cc.budgeted) * 100 : 0;

      return {
        costCenterId: cc.id,
        costCenterName: cc.name,
        budgetedAmount: cc.budgeted,
        actualAmount: cc.actual,
        variance,
        percentVariance,
        remainingBudget: Math.max(0, cc.budgeted - cc.actual),
        burnRate,
      };
    });
  }

  /**
   * Get budget vs actual by account type
   */
  async getBudgetByAccountType(
    facilityId: string,
    period: string,
    tenantId?: string,
  ): Promise<BudgetByAccountType[]> {
    const variances = await this.getDetailedVariances(facilityId, period, tenantId);
    const accountMap = new Map<string, BudgetByAccountType>();

    for (const variance of variances) {
      const account = await this.accountRepository.findOne({
        where: {
          id: variance.accountId,
          ...(tenantId ? { tenantId } : {}),
        } as any,
      });

      const accountType = account?.accountType || 'UNKNOWN';

      if (!accountMap.has(accountType)) {
        accountMap.set(accountType, {
          accountType,
          budgetedAmount: 0,
          actualAmount: 0,
          variance: 0,
          percentVariance: 0,
          accountCount: 0,
        });
      }

      const at = accountMap.get(accountType)!;
      at.budgetedAmount += variance.budgetedAmount;
      at.actualAmount += variance.actualAmount;
      at.variance += variance.absoluteVariance;
      at.accountCount += 1;
    }

    // Calculate percentages
    return Array.from(accountMap.values()).map((at) => ({
      ...at,
      percentVariance: at.budgetedAmount > 0 ? (at.variance / at.budgetedAmount) * 100 : 0,
    }));
  }

  /**
   * Get accounts with highest variance (over or under)
   */
  async getHighestVarianceAccounts(
    facilityId: string,
    period: string,
    limit: number = 10,
    tenantId?: string,
  ): Promise<BudgetVarianceItem[]> {
    const variances = await this.getDetailedVariances(facilityId, period, tenantId);

    return variances
      .sort((a, b) => Math.abs(b.absoluteVariance) - Math.abs(a.absoluteVariance))
      .slice(0, limit);
  }

  /**
   * Get accounts significantly over budget
   */
  async getOverBudgetAccounts(
    facilityId: string,
    period: string,
    threshold: number = 10, // % over budget (positive number)
    tenantId?: string,
  ): Promise<BudgetVarianceItem[]> {
    const variances = await this.getDetailedVariances(facilityId, period, tenantId);

    // absoluteVariance = budgeted - actual, so over-budget items have
    // a NEGATIVE percentVariance. The previous filter
    //   v.percentVariance > threshold
    // never matched any over-budget line (Budget audit F5).
    return variances.filter((v) => v.status === 'over' && v.percentVariance < -threshold);
  }

  /**
   * Get accounts significantly under budget
   */
  async getUnderBudgetAccounts(
    facilityId: string,
    period: string,
    threshold: number = 10, // % under budget
    tenantId?: string,
  ): Promise<BudgetVarianceItem[]> {
    const variances = await this.getDetailedVariances(facilityId, period, tenantId);

    return variances.filter((v) => v.status === 'under' && v.percentVariance > threshold);
  }

  /**
   * Get budget burn rate (spend pace)
   * Useful for forecasting full-period spend
   */
  async getBudgetBurnRate(
    facilityId: string,
    period: string,
    tenantId?: string,
  ): Promise<{
    currentPeriod: string;
    estimatedTotalBudget: number;
    currentActual: number;
    burnRate: number;
    pacePercentage: number;
    daysElapsed: number;
    daysRemaining: number;
  }> {
    const summary = await this.getBudgetVarianceSummary(facilityId, period, tenantId);

    // Calculate days into the month
    const [year, month] = period.split('-').map(Number);
    const periodDate = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysElapsed = Math.min(new Date().getDate(), daysInMonth);
    const daysRemaining = daysInMonth - daysElapsed;

    // Estimate pace
    const pacePercentage = (daysElapsed / daysInMonth) * 100;
    const burnRate =
      summary.totalBudget > 0 ? (summary.totalActual / summary.totalBudget) * 100 : 0;

    return {
      currentPeriod: period,
      estimatedTotalBudget: summary.totalBudget,
      currentActual: summary.totalActual,
      burnRate,
      pacePercentage,
      daysElapsed,
      daysRemaining,
    };
  }
}
