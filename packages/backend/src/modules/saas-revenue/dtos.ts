import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MaxLength,
} from 'class-validator';

export class CreatePlanDto {
  @IsString() @MaxLength(100) code: string;
  @IsString() @MaxLength(200) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() tier?: string;
  @IsInt() @Min(0) priceMonthlyMinor: number;
  @IsInt() @Min(0) priceAnnualMinor: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() @Min(0) annualDiscountPercent?: number;
  @IsOptional() @IsInt() @Min(0) trialDays?: number;
  @IsOptional() @IsInt() maxUsers?: number;
  @IsOptional() @IsInt() maxFacilities?: number;
  @IsOptional() @IsArray() enabledModules?: string[];
  @IsOptional() features?: any;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isPublic?: boolean;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdatePlanDto extends CreatePlanDto {}

export class CreateSubscriptionDto {
  @IsUUID() tenantId: string;
  @IsOptional() @IsUUID() deploymentId?: string;
  @IsOptional() @IsUUID() leadId?: string;
  @IsUUID() planId: string;
  @IsEnum(['monthly', 'annual']) billingInterval: 'monthly' | 'annual';
  @IsOptional() @IsInt() @Min(1) seats?: number;
  @IsOptional() @IsString() couponCode?: string;
  @IsOptional() @IsBoolean() startTrial?: boolean;
  @IsOptional() @IsBoolean() autoRenew?: boolean;
  @IsOptional() @IsString() billingEmail?: string;
  @IsOptional() @IsString() billingName?: string;
  @IsOptional() @IsString() notes?: string;
}

export class ConvertLeadDto {
  @IsUUID() tenantId: string;
  @IsUUID() planId: string;
  @IsEnum(['monthly', 'annual']) billingInterval: 'monthly' | 'annual';
  @IsOptional() @IsInt() @Min(1) seats?: number;
  @IsOptional() @IsString() billingEmail?: string;
  @IsOptional() @IsBoolean() startTrial?: boolean;
}

export class InitCheckoutDto {
  @IsUUID() invoiceId: string;
  @IsOptional() @IsString() redirectUrl?: string;
  @IsOptional() @IsString() customerEmail?: string;
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() customerPhone?: string;
  @IsOptional() @IsEnum(['flutterwave', 'pesapal']) gateway?: 'flutterwave' | 'pesapal';
  @IsOptional() @IsUUID() savedPaymentMethodId?: string;
  @IsOptional() @IsBoolean() enableRecurring?: boolean;
}

export class ChangePlanDto {
  @IsUUID() planId: string;
  @IsOptional() @IsEnum(['monthly', 'annual']) billingInterval?: 'monthly' | 'annual';
  @IsOptional() @IsBoolean() prorate?: boolean;
}

export class RecordPaymentDto {
  @IsInt() @Min(1) amountMinor: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() gateway?: string;
  @IsOptional() @IsString() gatewayRef?: string;
  @IsOptional() @IsString() method?: string;
  @IsOptional() @IsString() paidAt?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateCouponDto {
  @IsString() code: string;
  @IsEnum(['percent', 'fixed']) discountType: 'percent' | 'fixed';
  @IsInt() @Min(0) amount: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() maxRedemptions?: number;
  @IsOptional() @IsInt() durationMonths?: number;
  @IsOptional() expiresAt?: string;
  @IsOptional() @IsArray() appliesToPlanIds?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() notes?: string;
}

export class CreateManualInvoiceLineDto {
  @IsString() description: string;
  @IsInt() @Min(1) quantity: number;
  @IsInt() @Min(0) unitPriceMinor: number;
}

export class CreateManualInvoiceDto {
  @IsUUID() subscriptionId: string;
  @IsArray() lines: CreateManualInvoiceLineDto[];
  @IsOptional() @IsString() memo?: string;
  @IsOptional() @IsInt() @Min(1) dueInDays?: number;
  @IsOptional() @IsBoolean() sendEmail?: boolean;
}

export class UpdateCouponDto {
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsEnum(['percent', 'fixed']) discountType?: 'percent' | 'fixed';
  @IsOptional() @IsInt() @Min(0) amount?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() maxRedemptions?: number | null;
  @IsOptional() @IsInt() durationMonths?: number | null;
  @IsOptional() expiresAt?: string | null;
  @IsOptional() @IsArray() appliesToPlanIds?: string[] | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() notes?: string;
}
