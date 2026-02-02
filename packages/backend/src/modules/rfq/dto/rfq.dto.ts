import { IsString, IsOptional, IsArray, IsUUID, IsDateString, IsNumber, IsEnum, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { RFQStatus, QuotationStatus } from '../../../database/entities/rfq.entity';

export class CreateRFQItemDto {
  @IsString()
  itemCode: string;

  @IsString()
  itemName: string;

  @IsNumber()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsString()
  specifications?: string;
}

export class CreateRFQDto {
  @IsString()
  title: string;

  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  purchaseRequestId?: string;

  @IsDateString()
  deadline: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRFQItemDto)
  items: CreateRFQItemDto[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  vendorIds?: string[];
}

export class UpdateRFQDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsDateString()
  deadline?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  instructions?: string;
}

export class AddVendorsDto {
  @IsArray()
  @IsUUID('4', { each: true })
  vendorIds: string[];
}

export class CreateQuotationItemDto {
  @IsUUID()
  rfqItemId: string;

  @IsNumber()
  unitPrice: number;

  @IsNumber()
  totalPrice: number;

  @IsOptional()
  @IsNumber()
  deliveryDays?: number;

  @IsOptional()
  inStock?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateQuotationDto {
  @IsUUID()
  rfqId: string;

  @IsUUID()
  supplierId: string;

  @IsString()
  quotationNumber: string;

  @IsNumber()
  totalAmount: number;

  @IsNumber()
  deliveryDays: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  warranty?: string;

  @IsDateString()
  validUntil: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuotationItemDto)
  items: CreateQuotationItemDto[];
}

export class SelectWinnerDto {
  @IsUUID()
  quotationId: string;
}

export class ApproveQuotationDto {
  @IsOptional()
  @IsString()
  comments?: string;
}

export class RejectQuotationDto {
  @IsString()
  comments: string;
}
