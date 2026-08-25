import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsObject,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The twelve @Body() parameters in saas-revenue.controller that the
 * ValidationPipe could not see: three typed `any` and nine inline object
 * types, all erased at compile time.
 *
 * This controller moves money. A refund takes an amount, a payment
 * verification flips a payment to `verified`, and the VAT rules decide what
 * tax is charged on every invoice the vendor issues. None of that was checked,
 * and forbidNonWhitelisted could not help because there was no schema to
 * whitelist against.
 */

export class UpdateSubscriptionDto {
  /** null clears the override and falls back to the tenant's own address. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsEmail()
  billingEmail?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  billingCurrency?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoRenew?: boolean;
}

export class CancelSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  atPeriodEnd?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class RefundPaymentDto {
  /**
   * Minor units, so an integer. Under `any` a float or a negative could be
   * sent straight into a refund — this is the single most consequential body
   * in the controller.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  amountMinor?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class PaymentProofNotesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class VerifyPaymentDto {
  /** The whole point of the route; it was unchecked. */
  @ApiProperty({ enum: ['verified', 'rejected'] })
  @IsIn(['verified', 'rejected'])
  status: 'verified' | 'rejected';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class SendInvoiceEmailDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  to?: string;
}

export class UpdateVendorBillingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  legalName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  tradingName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  country?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  logoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  defaultCurrency?: string;
}

export class UpdateDunningRulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  reminderIntervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  churnAfterDays?: number;
}

export class VatRuleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  country: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  rate: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxNumberLabel?: string;
}

export class UpdateVatSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  taxLabel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultRate?: number;

  @ApiPropertyOptional({ type: [VatRuleDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VatRuleDto)
  rules?: VatRuleDto[];
}

export class UpdateEmailTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(50000)
  body: string;
}

export class RevertEmailTemplateDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  versionIndex: number;
}

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50000)
  body?: string;
}

/** The remaining eight bodies in this controller: three `any`, five inline. */
export class UpdateCurrencyRatesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8)
  base?: string;

  /**
   * Rate map, base unit to target. Values are checked as numbers; the pipe
   * cannot check the keys of a Record, so the service remains responsible for
   * the currency codes themselves.
   */
  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  rates?: Record<string, number>;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  updatedAt?: string | null;
}

export class RefreshCurrencyRatesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  providerUrl?: string;
}

export class SetPayerTenantDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  payerTenantId?: string | null;
}

export class AddPaymentMethodDto {
  @ApiPropertyOptional({ enum: ['card', 'mobile_money', 'bank', 'other'] })
  @IsOptional()
  @IsIn(['card', 'mobile_money', 'bank', 'other'])
  kind?: 'card' | 'mobile_money' | 'bank' | 'other';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(128)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  brand?: string;

  /** Exactly four digits, and never more: this is displayed as a card tail. */
  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'last4 must be four digits' })
  last4?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  expMonth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(2000)
  @Max(2200)
  expYear?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  holderName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class CreateWebhookDto {
  @ApiProperty()
  @IsString()
  @MaxLength(2048)
  url: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateWebhookDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  url?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  events?: string[];

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class PayInvoiceDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  invoiceId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  paymentMethodId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  redirectUrl?: string;
}


/** A send that names no recipient is not a send; `to` is required here. */
export class SendInvoiceEmailRequiredDto {
  @ApiProperty()
  @IsEmail()
  to: string;
}
