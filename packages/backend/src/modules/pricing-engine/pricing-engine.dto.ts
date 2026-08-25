import {
  IsUUID,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsString,
  IsEnum,
  IsDateString,
  IsArray,
  ValidateNested,
  MaxLength,
  Min,
  Max,
  IsDate,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  PricingRuleType,
  DiscountType,
  AppliesTo,
} from '../../database/entities/pricing-rule.entity';
import { PartialType } from '@nestjs/swagger';
import { TaxType } from '../../database/entities/tax-rate.entity';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ========== Insurance Price List DTOs ==========

export class CreateInsurancePriceListDto {
  @IsUUID()
  insuranceProviderId: string;

  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsUUID()
  @IsOptional()
  labTestId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsNumber()
  agreedPrice: number;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateInsurancePriceListDto {
  @IsNumber()
  @IsOptional()
  agreedPrice?: number;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class BulkPriceListItemDto {
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsUUID()
  @IsOptional()
  labTestId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsNumber()
  agreedPrice: number;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;
}

export class BulkCreateInsurancePriceListDto {
  @IsUUID()
  insuranceProviderId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkPriceListItemDto)
  items: BulkPriceListItemDto[];

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;

  /**
   * The single-create DTO accepts effectiveTo and the column exists; only the
   * bulk path refused it, so a bulk price list carrying an end date was
   * rejected whole while the same field saved fine one row at a time.
   */
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;
}

// ========== Pricing Rule DTOs ==========

export class CreatePricingRuleDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEnum(PricingRuleType)
  ruleType: PricingRuleType;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsEnum(DiscountType)
  discountType: DiscountType;

  @IsNumber()
  @IsOptional()
  discountValue?: number;

  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @IsNumber()
  @IsOptional()
  maxDiscount?: number;

  @IsBoolean()
  @IsOptional()
  canStack?: boolean;

  @IsString()
  @IsOptional()
  stackWithTypes?: string;

  @IsEnum(AppliesTo)
  @IsOptional()
  appliesTo?: AppliesTo;

  @IsOptional()
  conditions?: Record<string, any>;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;

  @IsUUID()
  @IsOptional()
  facilityId?: string;
}

export class UpdatePricingRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  priority?: number;

  @IsNumber()
  @IsOptional()
  discountValue?: number;

  @IsNumber()
  @IsOptional()
  minAmount?: number;

  @IsNumber()
  @IsOptional()
  maxDiscount?: number;

  @IsBoolean()
  @IsOptional()
  canStack?: boolean;

  @IsString()
  @IsOptional()
  stackWithTypes?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  validFrom?: string;

  @IsDateString()
  @IsOptional()
  validTo?: string;
}

// ========== Price Resolution DTOs ==========

export class ResolvePriceDto {
  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsUUID()
  @IsOptional()
  labTestId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  payerType?: 'cash' | 'insurance' | 'corporate';

  @IsUUID()
  @IsOptional()
  insuranceProviderId?: string;

  @IsUUID()
  @IsOptional()
  insurancePolicyId?: string;

  @IsUUID()
  @IsOptional()
  membershipId?: string;

  @IsNumber()
  @IsOptional()
  quantity?: number;
}

export class PriceQueryDto {
  @IsUUID()
  @IsOptional()
  insuranceProviderId?: string;

  @IsUUID()
  @IsOptional()
  serviceId?: string;

  @IsUUID()
  @IsOptional()
  labTestId?: string;

  @IsUUID()
  @IsOptional()
  itemId?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  limit?: number = 50;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

// ========== Response Types ==========

export interface AppliedDiscount {
  ruleId?: string;
  ruleName: string;
  ruleType: string;
  discountType: string;
  discountAmount: number;
  description: string;
}

export interface ResolvedPrice {
  originalPrice: number;
  finalPrice: number;
  currency: string;
  payerType: string;
  appliedDiscounts: AppliedDiscount[];
  insuranceCoverage?: {
    providerId: string;
    providerName: string;
    coveredAmount: number;
    patientResponsibility: number;
    copayPercent?: number;
    copayAmount?: number;
  };
  breakdown: {
    basePrice: number;
    insuranceAdjustment: number;
    membershipDiscount: number;
    loyaltyDiscount: number;
    otherDiscounts: number;
    preTaxTotal: number;
    total: number;
  };
}

export interface PriceComparisonItem {
  providerId: string;
  providerName: string;
  agreedPrice: number;
  discountPercent: number;
  effectivePrice: number;
  savings: number;
}

/**
 * Tax rates and exemptions were the last @Body() `any` handlers in this
 * module: four routes that write straight into tax_rates / tax_exemptions with
 * `create({...dto})`. With no metatype the ValidationPipe had nothing to check,
 * so an unknown property was persisted as-is and a malformed `rate` reached
 * Postgres as a numeric error — a 500 where a 400 naming the field is the
 * honest answer. Tax rates decide what a patient is charged, so this is not a
 * cosmetic gap.
 */
export class CreateTaxRateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  code: string;

  /** Percentage, matching the entity's numeric(5,2). */
  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate: number;

  @ApiPropertyOptional({ enum: TaxType })
  @IsOptional()
  @IsEnum(TaxType)
  type?: TaxType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableServices?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** The column is a date; @Type converts the ISO string the client sends. */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveFrom?: Date;
}

export class UpdateTaxRateDto extends PartialType(CreateTaxRateDto) {}

export class CreateTaxExemptionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  category: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  reason: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  applicableTaxes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTaxExemptionDto extends PartialType(CreateTaxExemptionDto) {}
