import { IsString, IsOptional, IsEnum, IsUUID, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { SaleType } from '../../database/entities/pharmacy-sale.entity';

export class SaleItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsString() itemCode: string;
  @ApiProperty() @IsString() itemName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiryDate?: string;
  @ApiProperty() @IsNumber() quantity: number;
  @ApiProperty() @IsNumber() unitPrice: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() discountPercent?: number;
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
  @ApiProperty() @IsNumber() amountPaid: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() paymentMethod?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() transactionReference?: string;
}
