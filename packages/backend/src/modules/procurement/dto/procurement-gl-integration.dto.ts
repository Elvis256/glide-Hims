import { IsString, IsNumber, IsDate, IsOptional, IsEnum, IsUUID, Min, Max, IsBoolean } from 'class-validator';
import { MAX_MONEY, NUMBER_OPTS } from '../../../common/constants/validation.constants';

export enum EncumbranceStatusType {
  ACTIVE = 'active',
  RELEASED = 'released',
  CANCELLED = 'cancelled',
}

export enum MatchStatus {
  MATCHED = 'matched',
  VARIANCE = 'variance',
  UNMATCHED = 'unmatched',
}

// Request DTOs
export class PostReceiptToGLDto {
  @IsUUID()
  grnId: string;

  @IsOptional()
  @IsUUID()
  userId?: string;

  @IsOptional()
  accountMappings?: {
    inventory: number;
    costOfGoods: number;
    accountsPayable: number;
  };
}

export class EncumbranceDto {
  @IsUUID()
  poId: string;

  @IsUUID()
  departmentId: string;

  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  amount: number;

  @IsOptional()
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReleaseEncumbranceDto {
  @IsUUID()
  grnId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PostInvoiceToGLDto {
  @IsUUID()
  invoiceId: string;

  @IsUUID()
  supplierId: string;

  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  amount: number;

  @IsOptional()
  @IsUUID()
  poId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ThreeWayMatchDto {
  @IsString()
  poId: string;

  @IsString()
  grnId: string;

  @IsString()
  invoiceId: string;

  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  poAmount: number;

  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  grnAmount: number;

  @IsNumber(NUMBER_OPTS)
  @Min(-MAX_MONEY)
  @Max(MAX_MONEY)
  variance: number;

  @IsOptional()
  @IsString()
  varianceReason?: string;

  @IsBoolean()
  quantitiesMatch: boolean;

  @IsBoolean()
  amountsMatch: boolean;

  @IsBoolean()
  isMatched: boolean;

  @IsEnum(MatchStatus)
  matchStatus: MatchStatus;
}

export class EncumbranceStatus {
  @IsString()
  encumbranceId: string;

  @IsString()
  poNumber: string;

  @IsNumber()
  amount: number;

  @IsString()
  departmentId: string;

  @IsEnum(EncumbranceStatusType)
  status: EncumbranceStatusType;

  @IsDate()
  createdDate: Date;

  @IsOptional()
  @IsDate()
  releasedDate?: Date;

  @IsOptional()
  @IsNumber()
  percentageUtilized?: number;
}

// Response DTOs
export class PostReceiptResponseDto {
  success: boolean;
  journalEntryId: string;
  amount: number;
  lineCount: number;
  grnId?: string;
}

export class EncumbranceResponseDto {
  success: boolean;
  encumbranceId: string;
  amount: number;
  departmentId: string;
  poId: string;
  status: string;
  createdDate: Date;
}

export class ReleaseEncumbranceResponseDto {
  success: boolean;
  grnId: string;
  amount: number;
  status: string;
  releasedDate: Date;
}

export class ThreeWayMatchResponseDto {
  isMatched: boolean;
  matchStatus: MatchStatus;
  variance: number;
  variancePercentage: number;
  poId: string;
  grnId: string;
  invoiceId: string;
  details: {
    quantitiesMatch: boolean;
    amountsMatch: boolean;
  };
}

export class ReconciliationReportDto {
  period: string;
  departmentId?: string;
  totalPOAmount: number;
  totalGRNAmount: number;
  totalEncumbered: number;
  totalActual: number;
  variance: number;
  variancePercentage?: number;
  grnCount: number;
  poCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

export class IntegrationSummaryDto {
  pendingGRNCount: number;
  pendingGRNAmount: number;
  activeEncumbrances: number;
  totalEncumbered: number;
  unmatchedPOCount: number;
  unmatchedPOAmount: number;
  status: string;
}

export class GLIntegrationQueueDto {
  id: string;
  type: 'grn_receipt' | 'invoice_posting' | 'manual';
  referenceId: string;
  amount: number;
  status: 'pending' | 'posted' | 'failed';
  createdDate: Date;
  postedDate?: Date;
  errorMessage?: string;
}
