import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============ REAGENTS ============
export class CreateReagentDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  catalogNumber?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderLevel?: number;

  @IsOptional()
  @IsString()
  storageConditions?: string;

  @IsOptional()
  @IsString()
  hazardClassification?: string;
}

export class UpdateReagentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  catalogNumber?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  reorderLevel?: number;

  @IsOptional()
  @IsString()
  storageConditions?: string;

  @IsOptional()
  @IsString()
  hazardClassification?: string;
}

// ============ REAGENT LOTS ============
export class ReceiveLotDto {
  @IsString()
  lotNumber: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantity?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  supplier?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitCost?: number;
}

export class RecordConsumptionDto {
  @IsNumber()
  @Min(0.001)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  consumedBy?: string;

  @IsOptional()
  @IsString()
  testCode?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ============ EQUIPMENT ============
export class CreateEquipmentDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsDateString()
  purchaseDate?: string;

  @IsOptional()
  @IsDateString()
  warrantyExpiry?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  calibrationIntervalDays?: number;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  serialNumber?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  calibrationIntervalDays?: number;
}

export class RecordCalibrationDto {
  @IsDateString()
  calibrationDate: string;

  @IsOptional()
  @IsString()
  calibratedBy?: string;

  @IsOptional()
  @IsString()
  result?: string;

  @IsOptional()
  @IsDateString()
  nextCalibrationDate?: string;

  @IsOptional()
  @IsString()
  certificateNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RecordMaintenanceDto {
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
  @IsString()
  notes?: string;
}

// ============ QC MATERIALS ============
export class CreateQCMaterialDto {
  @IsUUID()
  facilityId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  testCode?: string;

  @IsOptional()
  @IsString()
  lotNumber?: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  targetValue?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  standardDeviation?: number;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;
}

// ============ QC RESULTS ============
export class RecordQCResultDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  qcMaterialId: string;

  @IsString()
  testCode: string;

  @IsNumber()
  @Type(() => Number)
  value: number;

  @IsOptional()
  @IsString()
  performedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsBoolean()
  accepted?: boolean;
}
