import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsIn,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ─── Register DTOs ───────────────────────────────────────────────────────────

export class CreateRegisterDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty() @IsUUID() storeId: string;
}

export class UpdateRegisterDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() location?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['active', 'inactive', 'maintenance']) status?: string;
}

// ─── Shift DTOs ──────────────────────────────────────────────────────────────

export class OpenShiftDto {
  @ApiProperty() @IsUUID() registerId: string;
  @ApiProperty() @IsNumber() @Min(0) openingBalance: number;
}

export class CloseShiftDto {
  @ApiProperty() @IsNumber() @Min(0) closingBalance: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}

// ─── Wholesale Customer DTOs ─────────────────────────────────────────────────

export class CreateWholesaleCustomerDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() contactPerson?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() taxId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['standard', 'silver', 'gold', 'platinum']) pricingTier?: string;
}

export class UpdateWholesaleCustomerDto {
  @ApiProperty({ required: false }) @IsOptional() @IsString() name?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() contactPerson?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() phone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() email?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() address?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() taxId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) creditLimit?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['standard', 'silver', 'gold', 'platinum']) pricingTier?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsIn(['active', 'inactive']) status?: string;
}

// ─── Pricing Tier DTOs ───────────────────────────────────────────────────────

export class CreatePricingTierDto {
  @ApiProperty() @IsString() name: string;
  @ApiProperty() @IsNumber() @Min(0) discountPercent: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() @Min(0) minOrderAmount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
}

// ─── Delivery DTOs ───────────────────────────────────────────────────────────

export class CreateDeliveryDto {
  @ApiProperty() @IsUUID() saleId: string;
  @ApiProperty() @IsUUID() customerId: string;
  @ApiProperty() @IsString() deliveryAddress: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() scheduledAt?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() driverName?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() driverPhone?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() vehicleNumber?: string;
}

export class UpdateDeliveryStatusDto {
  @ApiProperty() @IsIn(['pending', 'dispatched', 'in_transit', 'delivered', 'failed']) status: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}
