import { IsString, IsOptional, IsUUID, IsNumber, IsIn, IsBoolean } from 'class-validator';

/**
 * GetTrialBalanceQueryDto
 */
export class GetTrialBalanceQueryDto {
  @IsUUID()
  fiscalPeriodId: string;

  @IsOptional()
  @IsIn(['json', 'csv', 'excel', 'pdf'])
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

  @IsIn(['csv', 'excel', 'pdf'])
  format: 'csv' | 'excel' | 'pdf';

  @IsOptional()
  @IsBoolean()
  includeZeroBalance?: boolean;
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
