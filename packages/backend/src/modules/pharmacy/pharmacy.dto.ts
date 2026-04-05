import { IsString, IsOptional, IsEnum, IsUUID, IsNumber, IsArray, ValidateNested, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SaleType } from '../../database/entities/pharmacy-sale.entity';

export class SaleItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsString() itemCode: string;
  @ApiProperty() @IsString() itemName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiryDate?: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) discountPercent?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() instructions?: string;
}

export class CreatePharmacySaleDto {
  @ApiProperty() @IsUUID() storeId: string;
  @ApiProperty({ enum: SaleType, default: SaleType.OTC }) @IsOptional() @IsEnum(SaleType) saleType?: SaleType;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() patientId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() customerName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() customerPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() prescriptionId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() paymentMethod?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transactionReference?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() discountAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
  @ApiProperty({ type: [SaleItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto) items: SaleItemDto[];
}

export class CompleteSaleDto {
  @ApiProperty() @IsNumber() @Min(0) amountPaid: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() paymentMethod?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transactionReference?: string;
}

export class QuarantineItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

export class ProcessExpiredItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty({ enum: ['dispose', 'return'] }) @IsEnum(['dispose', 'return'] as const) action: 'dispose' | 'return';
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

// Batch Stock DTOs
export class AllocateFEFODto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() storeId?: string;
}

export class ReceiveBatchDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty() @IsString() batchNumber: string;
  @ApiProperty() @IsDateString() expiryDate: string;
  @ApiProperty() @IsNumber() @Min(1) quantity: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() storeId?: string;
}

// Drug Label DTOs
export class CreateLabelTemplateDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsString() content: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() language?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() format?: string;
}

export class CreateDrugTranslationDto {
  @ApiProperty() @IsString() drugName: string;
  @ApiProperty() @IsString() language: string;
  @ApiProperty() @IsString() translatedName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() directions?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() warnings?: string;
}

// Temperature Monitoring DTOs
export class RecordTemperatureReadingDto {
  @ApiProperty() @IsString() sensorId: string;
  @ApiProperty() @IsNumber() @Min(-100) temperature: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) humidity?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}

export class CreateTemperatureSensorDto {
  @ApiProperty() @IsString() sensorId: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() storageType?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() minTemp?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() maxTemp?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() facilityId?: string;
}
