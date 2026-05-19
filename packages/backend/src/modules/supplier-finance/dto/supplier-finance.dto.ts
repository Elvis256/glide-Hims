import {
  IsUUID,
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  IsDateString,
  IsEnum,
  Min,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { PaymentMethod } from '../../../database/entities/supplier-payment.entity';
import {
  CreditNoteType,
  CreditNoteReason,
} from '../../../database/entities/supplier-credit-note.entity';

export class ApplyCreditNoteDto {
  @IsUUID()
  paymentVoucherId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}

export class PaymentVoucherItemDto {
  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  invoiceNumber?: string;

  @IsOptional()
  @Type(() => Date)
  invoiceDate?: Date;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsUUID()
  grnId?: string;
}

export class CreatePaymentVoucherDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @Type(() => Date)
  paymentDate: Date;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  grossAmount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  withholdingTax?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  otherDeductions?: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @IsOptional()
  @IsString()
  bankReference?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PaymentVoucherItemDto)
  items: PaymentVoucherItemDto[];
}

export class CreditNoteItemDto {
  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  unitPrice: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  taxRate?: number;

  @IsOptional()
  @IsString()
  batchNumber?: string;
}

export class CreateSupplierCreditNoteDto {
  @IsUUID()
  facilityId: string;

  @IsEnum(CreditNoteType)
  noteType: CreditNoteType;

  @IsUUID()
  supplierId: string;

  @Type(() => Date)
  noteDate: Date;

  @IsOptional()
  @IsString()
  supplierInvoiceNumber?: string;

  @IsOptional()
  @IsUUID()
  grnId?: string;

  @IsEnum(CreditNoteReason)
  reason: CreditNoteReason;

  @IsOptional()
  @IsString()
  reasonDetails?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CreditNoteItemDto)
  items: CreditNoteItemDto[];
}
