/**
 * Analytics DTOs for GL Analytics endpoints
 */
import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsIn,
  IsArray,
  Matches,
  Min,
  Max,
} from 'class-validator';

// GL Analytics Query DTOs
export class GetGLTrendsDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  startPeriod: string; // YYYY-MM

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  endPeriod: string; // YYYY-MM
}

export class ComparePeriodGLDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period1: string; // YYYY-MM

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period2: string; // YYYY-MM
}

export class GetVarianceAnalysisDto {
  @IsUUID()
  accountId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM

  @IsOptional()
  @IsNumber()
  expectedBalance?: number;
}

export class GetTopAccountsDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
}

// Revenue & Expense DTOs
export class GetRevenueExpenseDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM
}

export class GetRevenueExpenseByCCDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM
}

export class GetRevenueByAccountTypeDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM
}

// Budget Variance DTOs
export class GetBudgetVarianceDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM
}

export class GetBudgetByCCDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM
}

export class GetBudgetVarianceAccountsDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM

  @IsIn(['over', 'under'])
  type: 'over' | 'under'; // Over or under budget

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold?: number; // % threshold
}

export class GetBudgetBurnRateDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM
}

// Report Generation DTOs
export class GenerateReportDto {
  @IsIn(['trial-balance', 'income-statement', 'balance-sheet', 'variance', 'custom'])
  reportType: 'trial-balance' | 'income-statement' | 'balance-sheet' | 'variance' | 'custom';

  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  period: string; // YYYY-MM

  @IsOptional()
  @IsIn(['csv', 'excel', 'pdf'])
  format?: 'csv' | 'excel' | 'pdf';

  @IsOptional()
  @IsString()
  budget?: string; // For variance reports
}

export class ExportReportDto {
  @IsUUID()
  reportId: string;

  @IsIn(['csv', 'excel', 'pdf'])
  format: 'csv' | 'excel' | 'pdf';
}

export class CreateCustomReportDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  columns: Array<{
    field: string;
    label: string;
    dataType: 'number' | 'string' | 'date';
  }>;

  @IsOptional()
  @IsArray()
  filters?: Array<{
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'between';
    value: any;
  }>;

  @IsOptional()
  @IsArray()
  sorts?: Array<{
    field: string;
    direction: 'asc' | 'desc';
  }>;

  @IsOptional()
  @IsArray()
  groupBy?: string[];

  @IsOptional()
  @IsArray()
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
