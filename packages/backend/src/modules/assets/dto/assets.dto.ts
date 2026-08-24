import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OmitType, PartialType } from '@nestjs/swagger';
import {
  AssetCategoryEnum,
  AssetClass,
  AssetCondition,
  AssetCriticality,
  AssetStatus,
  DepreciationMethod,
} from '../../../database/entities/fixed-asset.entity';

/**
 * Depreciation permanently reduces book value and posts a journal, and the
 * period was unbounded: `month: 13` became January of the following year,
 * `month: 0` became the previous December, and any future year could be run
 * today — each of them idempotent per (asset, year, month), so the wrong
 * period could not simply be re-run over. A period is a real month, and it
 * has to have happened.
 */
export class RunDepreciationDto {
  @IsUUID()
  facilityId: string;

  @IsInt()
  @Min(2000)
  @Max(2200)
  @Type(() => Number)
  year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;
}

export class CompleteTransferDto {
  @IsString()
  @IsNotEmpty()
  receivedBy: string;
}

// ============ ASSET CRUD ============
/**
 * The asset register could not create an asset by ANY payload.
 *
 * This DTO described a different asset from the one the service writes and the
 * entity stores: it declared `purchaseCost` where everything else uses
 * `acquisitionCost`, offered no `categoryId`, `installationCost`,
 * `acquisitionDate` or `depreciationStartDate`, and named `category` a free
 * string when the column is an enum. With the global ValidationPipe on
 * forbidNonWhitelisted, the register page's payload — which uses the entity's
 * names, as the service does — was rejected outright as unknown fields; and a
 * payload shaped to this DTO instead died in Postgres, because
 * depreciation_start_date, acquisition_date and category are NOT NULL and
 * nothing supplied them.
 *
 * These are the entity's own names. Fields the service derives — assetCode,
 * totalCost, bookValue, accumulatedDepreciation — are deliberately absent: they
 * are computed on write and accepting them would let a caller state a book
 * value that its own cost and depreciation contradict.
 */
export class CreateAssetDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(AssetCategoryEnum)
  category: AssetCategoryEnum;

  @IsDateString()
  acquisitionDate: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  acquisitionCost: number;

  // Optional here, but required by the database. The service falls back to the
  // category's default and then refuses with a 400 rather than letting the
  // NOT NULL constraint surface as a 500.
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'usefulLifeMonths must be at least 1 — a life of 0 divides by zero and writes the whole asset off in one month' })
  @Type(() => Number)
  usefulLifeMonths?: number;

  /** Defaults to acquisitionDate when omitted. */
  @IsOptional()
  @IsDateString()
  depreciationStartDate?: string;

  @IsOptional() @IsString() assetCode?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() subCategory?: string;
  @IsOptional() @IsString() serialNumber?: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsString() manufacturer?: string;
  @IsOptional() @IsString() supplier?: string;
  @IsOptional() @IsString() purchaseOrderNumber?: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() warrantyProvider?: string;
  @IsOptional() @IsString() insurancePolicyNumber?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() amcVendor?: string;
  @IsOptional() @IsString() amcContractRef?: string;
  @IsOptional() @IsString() barcodeQr?: string;
  @IsOptional() @IsString() rfidTag?: string;
  @IsOptional() @IsString() assetTag?: string;

  @IsOptional() @IsEnum(DepreciationMethod) depreciationMethod?: DepreciationMethod;
  @IsOptional() @IsEnum(AssetStatus) status?: AssetStatus;
  @IsOptional() @IsEnum(AssetCondition) condition?: AssetCondition;
  @IsOptional() @IsEnum(AssetClass) assetClass?: AssetClass;
  @IsOptional() @IsEnum(AssetCriticality) criticalityLevel?: AssetCriticality;

  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsUUID() custodianId?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() parentAssetId?: string;
  @IsOptional() @IsUUID() buildingId?: string;
  @IsOptional() @IsUUID() floorId?: string;
  @IsOptional() @IsUUID() roomId?: string;
  @IsOptional() @IsUUID() biomedEngineerId?: string;
  @IsOptional() @IsUUID() purchaseOrderId?: string;
  @IsOptional() @IsUUID() grnId?: string;

  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) installationCost?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) salvageValue?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) depreciationRate?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) currentMarketValue?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) insuredValue?: number;
  @IsOptional() @IsNumber() @Min(0) @Type(() => Number) replacementCost?: number;
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) maintenanceIntervalDays?: number;
  @IsOptional() @IsNumber() @Min(1) @Type(() => Number) calibrationIntervalDays?: number;

  @IsOptional() @IsDateString() lastValuationDate?: string;
  @IsOptional() @IsDateString() warrantyExpiry?: string;
  @IsOptional() @IsDateString() nextMaintenanceDate?: string;
  @IsOptional() @IsDateString() insuranceExpiry?: string;
  @IsOptional() @IsDateString() lastCalibrationDate?: string;
  @IsOptional() @IsDateString() nextCalibrationDue?: string;
  @IsOptional() @IsDateString() amcStartDate?: string;
  @IsOptional() @IsDateString() amcEndDate?: string;

  @IsOptional() @IsBoolean() isInsured?: boolean;
  @IsOptional() @IsBoolean() isCapex?: boolean;
}

/**
 * Every editable field, optional — the same drift as CreateAssetDto had, in
 * miniature: this listed seven fields and typed `category`, `condition` and
 * `status` as free strings, so editing an asset from the register rejected
 * most of the form and would have accepted "banana" as a status. facilityId
 * is excluded on purpose: moving an asset between facilities is what the
 * transfer workflow is for, with its approval stages.
 */
export class UpdateAssetDto extends PartialType(
  OmitType(CreateAssetDto, ['facilityId', 'assetCode'] as const),
) {}

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
