import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  ValidateIf,
  IsNumber,
  IsInt,
  IsDateString,
  IsEnum,
  Min,
  Max,
  MaxLength,
  MinLength,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InvoiceStatus,
  ChargeType,
  PaymentMethod,
  PaymentType,
} from '../../database/entities/invoice.entity';

const MAX_QTY = 1_000_000;
const MAX_MONEY = 100_000_000;
const NUMBER_OPTS = { allowNaN: false, allowInfinity: false } as const;

class InvoiceItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  serviceCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @IsEnum(ChargeType)
  @IsOptional()
  chargeType?: ChargeType = ChargeType.OTHER;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_QTY)
  quantity: number;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_MONEY)
  unitPrice: number;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @IsOptional()
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  referenceType?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  referenceId?: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @IsOptional()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  taxExemptReason?: string;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @IsOptional()
  @Min(0)
  @Max(MAX_MONEY)
  discountAmount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(4_000)
  notes?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;

  @IsUUID()
  @IsOptional()
  insurancePolicyId?: string;
}

/**
 * Mirrors CreateInvoiceDto but every field is optional so the frontend can
 * call it on every keystroke / line-edit. Used by /billing/invoice-preview
 * to get authoritative subtotal / tax / coverage / patient-portion numbers
 * without persisting anything.
 */
export class PreviewInvoiceDto {
  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @IsOptional()
  @Min(0)
  @Max(100)
  taxPercent?: number;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @IsOptional()
  @Min(0)
  @Max(MAX_MONEY)
  discountAmount?: number;

  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;

  @IsUUID()
  @IsOptional()
  insurancePolicyId?: string;

  @IsUUID()
  @IsOptional()
  membershipId?: string;
}

export class AddInvoiceItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  serviceCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  description: string;

  @IsEnum(ChargeType)
  @IsOptional()
  chargeType?: ChargeType;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_QTY)
  quantity: number;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_MONEY)
  unitPrice: number;
}

export class CreatePaymentDto {
  @IsUUID()
  invoiceId: string;

  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_MONEY)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  // For non-cash payments a transaction reference is mandatory (mobile-money
  // confirmation code, card terminal ref, bank slip, insurance claim number).
  // Cash payments may omit it — recordPayment() stamps the receipt number as
  // the reference so every payment row is still traceable.
  @ValidateIf((o) => o.method !== PaymentMethod.CASH)
  @IsString()
  @IsNotEmpty({ message: 'Transaction reference is required for non-cash payments' })
  @MaxLength(128)
  transactionReference?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2_000)
  notes?: string;
}

export class UpdateInvoiceItemDto {
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_MONEY)
  unitPrice: number;
}

/**
 * Shared shape for cancel / refund / void / write-off bodies — was previously
 * raw `@Body('reason')` with no validation, allowing arbitrarily long blobs
 * (or empty strings) to be persisted as audit reasons on financial actions.
 */
export class ReasonDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(2_000)
  reason: string;
}

export class RefundPaymentDto {
  @Type(() => Number)
  @IsNumber(NUMBER_OPTS)
  @Min(0.01)
  @Max(MAX_MONEY)
  amount: number;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(2_000)
  reason: string;
}

export class ListPaymentsQueryDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  method?: PaymentMethod;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 50;
}

export class InvoiceQueryDto {
  @IsEnum(InvoiceStatus)
  @IsOptional()
  status?: InvoiceStatus;

  @IsUUID()
  @IsOptional()
  patientId?: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  type?: string;

  @IsEnum(PaymentType)
  @IsOptional()
  paymentType?: PaymentType;

  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  search?: string;

  @IsString()
  @IsOptional()
  @MaxLength(64)
  patientMrn?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100_000)
  @IsOptional()
  page?: number = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  @IsOptional()
  limit?: number = 20;
}
