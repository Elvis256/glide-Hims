import { IsString, IsOptional, IsUUID, IsNumber } from 'class-validator';

/**
 * GetTrialBalanceQueryDto
 */
export class GetTrialBalanceQueryDto {
  @IsUUID()
  fiscalPeriodId: string;

  @IsOptional()
  @IsString()
  format?: 'json' | 'csv' | 'excel' | 'pdf';
}

/**
 * GetReconciliationStatusQueryDto
 */
export class GetReconciliationStatusQueryDto {
  @IsUUID()
  fiscalPeriodId: string;
}

/**
 * ComparePeriodQueryDto
 */
export class ComparePeriodQueryDto {
  @IsUUID()
  period1Id: string;

  @IsUUID()
  period2Id: string;
}

/**
 * ExportTrialBalanceDto
 */
export class ExportTrialBalanceDto {
  @IsUUID()
  fiscalPeriodId: string;

  @IsString()
  format: 'csv' | 'excel' | 'pdf'; // csv, xlsx, pdf

  @IsOptional()
  @IsString()
  includeZeroBalance?: boolean; // Include accounts with zero balance
}

/**
 * MarkAccountReconciledDto
 */
export class MarkAccountReconciledDto {
  @IsUUID()
  accountId: string;

  @IsUUID()
  fiscalPeriodId: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * GetAccountBalanceQueryDto
 */
export class GetAccountBalanceQueryDto {
  @IsUUID()
  accountId: string;

  @IsUUID()
  fiscalPeriodId: string;
}
