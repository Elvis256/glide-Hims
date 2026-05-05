/**
 * Analytics DTOs for GL Analytics endpoints
 */

// GL Analytics Query DTOs
export class GetGLTrendsDto {
  accountId: string;
  startPeriod: string; // YYYY-MM
  endPeriod: string; // YYYY-MM
}

export class ComparePeriodGLDto {
  period1: string; // YYYY-MM
  period2: string; // YYYY-MM
}

export class GetVarianceAnalysisDto {
  accountId: string;
  period: string; // YYYY-MM
  expectedBalance?: number;
}

export class GetTopAccountsDto {
  period: string; // YYYY-MM
  limit?: number;
}

// Revenue & Expense DTOs
export class GetRevenueExpenseDto {
  period: string; // YYYY-MM
}

export class GetRevenueExpenseByCCDto {
  period: string; // YYYY-MM
}

export class GetRevenueByAccountTypeDto {
  period: string; // YYYY-MM
}

// Budget Variance DTOs
export class GetBudgetVarianceDto {
  period: string; // YYYY-MM
}

export class GetBudgetByCCDto {
  period: string; // YYYY-MM
}

export class GetBudgetVarianceAccountsDto {
  period: string; // YYYY-MM
  type: 'over' | 'under'; // Over or under budget
  threshold?: number; // % threshold
}

export class GetBudgetBurnRateDto {
  period: string; // YYYY-MM
}

// Report Generation DTOs
export class GenerateReportDto {
  reportType: 'trial-balance' | 'income-statement' | 'balance-sheet' | 'variance' | 'custom';
  period: string; // YYYY-MM
  format?: 'csv' | 'excel' | 'pdf';
  budget?: string; // For variance reports
}

export class ExportReportDto {
  reportId: string;
  format: 'csv' | 'excel' | 'pdf';
}

export class CreateCustomReportDto {
  name: string;
  description?: string;
  columns: Array<{
    field: string;
    label: string;
    dataType: 'number' | 'string' | 'date';
  }>;
  filters?: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
    value: any;
  }>;
  sorts?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;
  groupBy?: string[];
  aggregations?: Array<{
    field: string;
    function: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }>;
}

// Response DTOs (these match service return types)
export class TrendLineDto {
  period: string;
  periodId: string;
  debitAmount: number;
  creditAmount: number;
  netAmount: number;
  balance: number;
}

export class AccountTrendDto {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  trends: TrendLineDto[];
  minBalance: number;
  maxBalance: number;
  averageBalance: number;
  changePercent: number;
}

export class PeriodComparisonDto {
  period1Id: string;
  period1Name: string;
  period2Id: string;
  period2Name: string;
  accounts: Array<{
    accountCode: string;
    accountName: string;
    period1Balance: number;
    period2Balance: number;
    absoluteChange: number;
    percentChange: number;
    variance: 'increase' | 'decrease' | 'no-change';
  }>;
}

export class AggregatedGLDataDto {
  facilityId: string;
  period: string;
  totalDebits: number;
  totalCredits: number;
  difference: number;
  accountCount: number;
  lineItemCount: number;
  lastUpdated: Date;
}

export class VarianceAnalysisDto {
  accountCode: string;
  period: string;
  actualBalance: number;
  expectedBalance: number;
  absoluteVariance: number;
  percentVariance: number;
  isSignificant: boolean;
}

export class RevenueExpenseSummaryDto {
  period: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  revenueItems: Array<{
    description: string;
    code: string;
    amount: number;
  }>;
  expenseItems: Array<{
    description: string;
    code: string;
    amount: number;
  }>;
  revenueCount: number;
  expenseCount: number;
}

export class CostCenterBreakdownDto {
  costCenterId: string;
  costCenterName: string;
  departmentName?: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  percentOfTotal: number;
}

export class BudgetVarianceSummaryDto {
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

export class BudgetVarianceItemDto {
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

export class CostCenterBudgetAnalysisDto {
  costCenterId: string;
  costCenterName: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  percentVariance: number;
  remainingBudget: number;
  burnRate: number;
}

export class BudgetBurnRateDto {
  currentPeriod: string;
  estimatedTotalBudget: number;
  currentActual: number;
  burnRate: number;
  pacePercentage: number;
  daysElapsed: number;
  daysRemaining: number;
}

export class ReportDataDto {
  reportName: string;
  generatedAt: Date;
  periodCovered: string;
  rows: any[];
  summary?: {
    totalRows: number;
    totalValues?: Record<string, number>;
  };
}

export class StandardReportDto {
  id: string;
  name: string;
  description: string;
  reportType: string;
}
