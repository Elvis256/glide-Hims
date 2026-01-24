import { IsString, IsOptional, IsUUID, IsArray, ValidateNested, IsNumber, IsDateString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { InvoiceStatus, ChargeType, PaymentMethod } from '../../database/entities/invoice.entity';

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
  @Min(0)
  unitPrice: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
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

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  discountAmount?: number;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;
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
  @Min(0)
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

  @IsString()
  @IsOptional()
  transactionReference?: string;

  @IsString()
  @IsOptional()
  notes?: string;
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
