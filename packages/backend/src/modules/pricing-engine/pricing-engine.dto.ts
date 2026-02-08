import { IsUUID, IsOptional, IsNumber, IsBoolean, IsString, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PricingRuleType, DiscountType, AppliesTo } from '../../database/entities/pricing-rule.entity';

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

export class BulkCreateInsurancePriceListDto {
  @IsUUID()
  insuranceProviderId: string;

  items: Array<{
    serviceId?: string;
    labTestId?: string;
    agreedPrice: number;
    discountPercent?: number;
  }>;

  @IsDateString()
  @IsOptional()
  effectiveFrom?: string;
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
    subtotal: number;
    tax: number;
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
