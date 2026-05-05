import { IsString, IsNumber, IsDate, IsOptional, IsEnum } from 'class-validator';

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
  @IsString()
  grnId: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  accountMappings?: {
    inventory: number;
    costOfGoods: number;
    accountsPayable: number;
  };
}

export class EncumbranceDto {
  @IsString()
  poId: string;

  @IsString()
  departmentId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsDate()
  startDate?: Date;

  @IsOptional()
  @IsString()
  description?: string;
}

export class ReleaseEncumbranceDto {
  @IsString()
  grnId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class PostInvoiceToGLDto {
  @IsString()
  invoiceId: string;

  @IsString()
  supplierId: string;

  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
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

  @IsNumber()
  poAmount: number;

  @IsNumber()
  grnAmount: number;

  @IsNumber()
  variance: number;

  @IsOptional()
  varianceReason?: string;

  quantitiesMatch: boolean;

  amountsMatch: boolean;

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
