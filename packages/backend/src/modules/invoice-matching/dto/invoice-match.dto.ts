import { IsString, IsOptional, IsUUID, IsNumber, IsArray, ValidateNested, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceMatchItemDto {
  @IsString()
  itemId: string;

  @IsString()
  itemName: string;

  @IsNumber()
  poQty: number;

  @IsNumber()
  poPrice: number;

  @IsOptional()
  @IsNumber()
  grnQty?: number;

  @IsNumber()
  invoiceQty: number;

  @IsNumber()
  invoicePrice: number;
}

export class CreateInvoiceMatchDto {
  @IsUUID()
  facilityId: string;

  @IsUUID()
  purchaseOrderId: string;

  @IsOptional()
  @IsUUID()
  grnId?: string;

  @IsString()
  invoiceNumber: string;

  @IsDateString()
  invoiceDate: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsNumber()
  invoiceAmount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceMatchItemDto)
  items: CreateInvoiceMatchItemDto[];
}

export class ApproveMatchDto {
  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  paymentScheduled?: string;
}
