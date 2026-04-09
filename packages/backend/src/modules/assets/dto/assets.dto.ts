import { IsString, IsNotEmpty, IsNumber, IsUUID, IsOptional, IsDateString, IsEnum, Min } from 'class-validator';
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
