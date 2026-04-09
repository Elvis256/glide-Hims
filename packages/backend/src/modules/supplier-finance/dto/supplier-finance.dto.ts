import { IsUUID, IsNumber, IsString, IsOptional, IsArray, ValidateNested, IsDateString, IsEnum, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyCreditNoteDto {
  @IsUUID()
  paymentVoucherId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;
}

export class CreatePaymentVoucherDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsString()
  voucherNumber?: string;

  @IsOptional()
  @IsString()
  paymentMethod?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  invoiceIds?: string[];

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsString()
  chequeNumber?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateSupplierCreditNoteDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  supplierId: string;

  @IsOptional()
  @IsString()
  noteNumber?: string;

  @IsString()
  noteType: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @IsString()
  reason: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsOptional()
  @IsDateString()
  noteDate?: string;
}
