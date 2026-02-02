import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrescriptionStatus } from '../../database/entities/prescription.entity';

class PrescriptionItemDto {
  @IsString()
  drugCode: string;

  @IsString()
  drugName: string;

  @IsString()
  dose: string;

  @IsString()
  frequency: string;

  @IsString()
  duration: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  instructions?: string;
}

export class CreatePrescriptionDto {
  @IsUUID()
  encounterId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PrescriptionItemDto)
  items: PrescriptionItemDto[];

  @IsString()
  @IsOptional()
  notes?: string;
}

export class DispenseItemDto {
  @IsUUID()
  prescriptionItemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  unitPrice?: number;
}

// Batch dispense DTO - for dispensing all items at once
class DispenseBatchItemDto {
  @IsUUID()
  prescriptionItemId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity: number;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  unitPrice?: number;
}

export class DispenseBatchDto {
  @IsUUID()
  prescriptionId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DispenseBatchItemDto)
  items: DispenseBatchItemDto[];

  @IsOptional()
  counselingProvided?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class PrescriptionQueryDto {
  @IsEnum(PrescriptionStatus)
  @IsOptional()
  status?: PrescriptionStatus;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number = 20;
}
