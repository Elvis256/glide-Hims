import {
  IsString,
  IsOptional,
  IsUUID,
  IsArray,
  ValidateNested,
  ValidateIf,
  IsNumber,
  IsDateString,
  IsEnum,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  InvoiceStatus,
  ChargeType,
  PaymentMethod,
  PaymentType,
} from '../../database/entities/invoice.entity';

class InvoiceItemDto {
  @IsString()
  serviceCode: string;

  @IsString()
  description: string;

  @IsEnum(ChargeType)
  @IsOptional()
  chargeType?: ChargeType = ChargeType.OTHER;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  unitPrice: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountPercent?: number;

  @IsString()
  @IsOptional()
  referenceType?: string;

  @IsString()
  @IsOptional()
  referenceId?: string;
}

export class CreateInvoiceDto {
  @IsUUID()
  patientId: string;

  @IsUUID()
  @IsOptional()
  encounterId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @IsString()
  @IsOptional()
  taxExemptReason?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  discountAmount?: number;

  @IsString()
  @IsOptional()
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
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  taxPercent?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
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
  serviceCode: string;

  @IsString()
  description: string;

  @IsEnum(ChargeType)
  @IsOptional()
  chargeType?: ChargeType;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  unitPrice: number;
}

export class CreatePaymentDto {
  @IsUUID()
  invoiceId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ValidateIf((o) => o.method !== PaymentMethod.CASH)
  @IsString()
  @IsNotEmpty({ message: 'Transaction reference is required for non-cash payments' })
  @IsOptional()
  transactionReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateInvoiceItemDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  unitPrice: number;
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
  type?: string;

  @IsString()
  @IsOptional()
  paymentType?: string;

  @IsString()
  @IsOptional()
  search?: string;

  @IsString()
  @IsOptional()
  patientMrn?: string;

  @IsDateString()
  @IsOptional()
  dateFrom?: string;

  @IsDateString()
  @IsOptional()
  dateTo?: string;

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
