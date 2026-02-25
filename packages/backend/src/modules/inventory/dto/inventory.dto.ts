import { IsString, IsOptional, IsNumber, IsBoolean, IsEnum, Min, IsUUID, IsDateString } from 'class-validator';
import { MovementType } from '../../../database/entities/inventory.entity';

export class CreateItemDto {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  formulationId?: string;

  @IsOptional()
  @IsUUID()
  storageConditionId?: string;

  @IsOptional()
  @IsString()
  genericName?: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packSize?: number;

  @IsOptional()
  @IsBoolean()
  isDrug?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlled?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBatchTracking?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresExpiryTracking?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  subcategoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  unitId?: string;

  @IsOptional()
  @IsUUID()
  formulationId?: string;

  @IsOptional()
  @IsUUID()
  storageConditionId?: string;

  @IsOptional()
  @IsString()
  genericName?: string;

  @IsOptional()
  @IsString()
  strength?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  packSize?: number;

  @IsOptional()
  @IsBoolean()
  isDrug?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresPrescription?: boolean;

  @IsOptional()
  @IsBoolean()
  isControlled?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresBatchTracking?: boolean;

  @IsOptional()
  @IsBoolean()
  requiresExpiryTracking?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxStockLevel?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  sellingPrice?: number;

  @IsOptional()
  @IsString()
  status?: string;
}

export class StockMovementDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  facilityId: string;

  @IsNumber()
  quantity: number;

  @IsEnum(MovementType)
  movementType: MovementType;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockReceiveDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  facilityId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  unitCost?: number;

  @IsOptional()
  @IsString()
  supplierName?: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockAdjustmentDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  facilityId: string;

  @IsNumber()
  newQuantity: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class StockTransferDto {
  @IsUUID()
  itemId: string;

  @IsUUID()
  fromFacilityId: string;

  @IsUUID()
  toFacilityId: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
