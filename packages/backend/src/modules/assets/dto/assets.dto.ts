import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RunDepreciationDto {
  @IsUUID()
  facilityId: string;

  @IsNumber()
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Type(() => Number)
  month: number;
}

export class CompleteTransferDto {
  @IsString()
  @IsNotEmpty()
  receivedBy: string;
}

// ============ ASSET CRUD ============
export class CreateAssetDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  assetTag?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  purchaseCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  usefulLifeMonths?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  salvageValue?: number;

  @IsOptional()
  @IsString()
  depreciationMethod?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  condition?: string;
}

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsString()
  condition?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

// ============ MAINTENANCE ============
export class RecordAssetMaintenanceDto {
  @IsString()
  maintenanceType: string;

  @IsOptional()
  @IsDateString()
  maintenanceDate?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  cost?: number;

  @IsOptional()
  @IsDateString()
  nextMaintenanceDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ TRANSFERS ============
export class InitiateTransferDto {
  @IsUUID()
  toFacilityId: string;

  @IsOptional()
  @IsUUID()
  toDepartmentId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  initiatedBy?: string;
}

// ============ DISPOSAL ============
export class DisposeAssetDto {
  @IsString()
  disposalMethod: string;

  @IsOptional()
  @IsDateString()
  disposalDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  disposalValue?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  approvedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ NEW: TRANSFER APPROVALS ============
export class ApproveTransferDto {
  @IsString()
  stage: 'origin_dept_head' | 'receiving_dept_head' | 'store_keeper';

  @IsString()
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class CompleteTransferReceiptDto {
  @IsOptional()
  @IsUUID()
  receivedBy?: string;

  @IsOptional()
  @IsString()
  conditionOnReceipt?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ NEW: ALLOCATION ============
export class CreateAllocationDto {
  @IsUUID()
  assetId: string;

  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsUUID()
  custodianId: string;

  @IsOptional()
  @IsUUID()
  roomId?: string;

  @IsDateString()
  allocationDate: string;

  @IsOptional()
  @IsDateString()
  expectedReturnDate?: string;

  @IsOptional()
  @IsString()
  purpose?: string;

  @IsOptional()
  @IsString()
  conditionOnIssue?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApproveAllocationDto {
  @IsString()
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class ReturnAllocationDto {
  @IsDateString()
  returnDate: string;

  @IsOptional()
  @IsString()
  conditionOnReturn?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ NEW: DISPOSAL WORKFLOW ============
export class CreateDisposalRequestDto {
  @IsUUID()
  assetId: string;

  @IsUUID()
  facilityId: string;

  @IsString()
  method: string; // sale|scrap|donation|trade_in|write_off

  @IsString()
  reason: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  expectedValue?: number;

  @IsOptional()
  @IsString()
  buyer?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  attachments?: string[];
}

export class BiomedReviewDto {
  @IsString()
  assessment: string;

  @IsString()
  recommendation: 'approve' | 'reject';
}

export class CommitteeDecisionDto {
  @IsString()
  role: string; // 'Auditor' | 'Administrator' | 'Facility Manager'

  @IsString()
  decision: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  comments?: string;
}

export class CompleteDisposalDto {
  @IsDateString()
  disposalDate: string;

  @IsNumber()
  @Type(() => Number)
  actualValue: number;

  @IsOptional()
  @IsString()
  buyer?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ NEW: CATEGORY CRUD ============
export class CreateAssetCategoryDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsString()
  assetClass: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultUsefulLifeMonths?: number;

  @IsOptional()
  @IsString()
  defaultDepreciationMethod?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultDepreciationRate?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultCalibrationIntervalDays?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  defaultMaintenanceIntervalDays?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  isActive?: boolean;
}

export class UpdateAssetCategoryDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() assetClass?: string;
  @IsOptional() @IsUUID() parentId?: string;
  @IsOptional() @IsNumber() @Type(() => Number) defaultUsefulLifeMonths?: number;
  @IsOptional() @IsString() defaultDepreciationMethod?: string;
  @IsOptional() @IsNumber() @Type(() => Number) defaultDepreciationRate?: number;
  @IsOptional() @IsNumber() @Type(() => Number) defaultCalibrationIntervalDays?: number;
  @IsOptional() @IsNumber() @Type(() => Number) defaultMaintenanceIntervalDays?: number;
  @IsOptional() @IsString() description?: string;
  @IsOptional() isActive?: boolean;
}

// ============ NEW: LOCATION HISTORY ============
export class RecordLocationDto {
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsString() locationLabel?: string;
  @IsOptional() @IsUUID() custodianId?: string;
  @IsOptional() @IsString() reason?: string;
  @IsOptional() @IsString() notes?: string;
}

