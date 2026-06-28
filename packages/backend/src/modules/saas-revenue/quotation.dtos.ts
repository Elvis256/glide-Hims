import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ---------------------------------------------------------------------------
// Price Catalog DTOs
// ---------------------------------------------------------------------------

export class CreateCatalogItemDto {
  @IsString() @MaxLength(100) code: string;
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsInt() @Min(0) unitPriceMinor: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() metadata?: Record<string, any>;
}

export class UpdateCatalogItemDto {
  @IsOptional() @IsString() @MaxLength(100) code?: string;
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsInt() @Min(0) unitPriceMinor?: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() metadata?: Record<string, any>;
}

// ---------------------------------------------------------------------------
// Quotation Line Item DTO
// ---------------------------------------------------------------------------

export class LineItemDto {
  @IsOptional() @IsUUID() catalogItemId?: string;
  @IsOptional() @IsString() moduleId?: string;
  @IsString() description: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() @Min(0) unitPriceMinor: number;
  @IsOptional() @IsString() category?: string;
}

// ---------------------------------------------------------------------------
// Quotation DTOs
// ---------------------------------------------------------------------------

export class CreateQuotationDto {
  @IsOptional() @Transform(({ value }) => value || undefined) @IsUUID() leadId?: string;
  @IsOptional() @Transform(({ value }) => value || undefined) @IsUUID() planId?: string;

  @IsString() @MaxLength(200) clientName: string;
  @IsOptional() @IsString() @MaxLength(200) clientOrganization?: string;
  @IsOptional() @IsString() @MaxLength(200) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) clientPhone?: string;
  @IsOptional() @IsString() @MaxLength(100) clientCountry?: string;

  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() billingInterval?: string;
  @IsOptional() @IsInt() @Min(1) seats?: number;

  @IsOptional() @IsBoolean() includeVat?: boolean;
  @IsOptional() vatRatePercent?: number;
  @IsOptional() @IsBoolean() deductWht?: boolean;
  @IsOptional() whtRatePercent?: number;

  @IsOptional() discountPercent?: number;
  @IsOptional() @IsInt() discountFixedMinor?: number;

  @IsOptional() @IsString() validUntil?: string;

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;

  @IsOptional() @IsString() @MaxLength(20) deploymentType?: string;
  @IsOptional() @IsString() @MaxLength(255) deploymentDomain?: string;

  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto)
  lineItems: LineItemDto[];
}

export class UpdateQuotationDto {
  @IsOptional() @Transform(({ value }) => value || undefined) @IsUUID() leadId?: string;
  @IsOptional() @Transform(({ value }) => value || undefined) @IsUUID() planId?: string;

  @IsOptional() @IsString() @MaxLength(200) clientName?: string;
  @IsOptional() @IsString() @MaxLength(200) clientOrganization?: string;
  @IsOptional() @IsString() @MaxLength(200) clientEmail?: string;
  @IsOptional() @IsString() @MaxLength(50) clientPhone?: string;
  @IsOptional() @IsString() @MaxLength(100) clientCountry?: string;

  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() billingInterval?: string;
  @IsOptional() @IsInt() @Min(1) seats?: number;

  @IsOptional() @IsBoolean() includeVat?: boolean;
  @IsOptional() vatRatePercent?: number;
  @IsOptional() @IsBoolean() deductWht?: boolean;
  @IsOptional() whtRatePercent?: number;

  @IsOptional() discountPercent?: number;
  @IsOptional() @IsInt() discountFixedMinor?: number;

  @IsOptional() @IsString() validUntil?: string;

  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() internalNotes?: string;

  @IsOptional() @IsString() @MaxLength(20) deploymentType?: string;
  @IsOptional() @IsString() @MaxLength(255) deploymentDomain?: string;

  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto)
  lineItems?: LineItemDto[];
}

export class CreateRevisionDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => LineItemDto)
  lineItems: LineItemDto[];
  @IsOptional() @IsString() changeNotes?: string;
}

export class RejectQuotationDto {
  @IsOptional() @IsString() reason?: string;
}
