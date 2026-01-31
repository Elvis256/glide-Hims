import { IsString, IsNumber, IsOptional, IsEnum, IsDateString, IsUUID, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ReturnStatus, ReturnReason } from '../../database/entities/supplier-return.entity';

export class CreateReturnItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  @IsOptional()
  batchNumber?: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;

  @IsNumber()
  quantity: number;

  @IsNumber()
  @IsOptional()
  unitValue?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class CreateSupplierReturnDto {
  @IsUUID()
  supplierId: string;

  @IsEnum(ReturnReason)
  reason: ReturnReason;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsUUID()
  facilityId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];
}

export class UpdateSupplierReturnDto {
  @IsEnum(ReturnStatus)
  @IsOptional()
  status?: ReturnStatus;

  @IsString()
  @IsOptional()
  authorizationNumber?: string;

  @IsString()
  @IsOptional()
  creditNoteNumber?: string;

  @IsNumber()
  @IsOptional()
  actualCredit?: number;

  @IsDateString()
  @IsOptional()
  shippingDate?: string;

  @IsDateString()
  @IsOptional()
  receivedDate?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class SupplierReturnQueryDto {
  @IsUUID()
  @IsOptional()
  facilityId?: string;

  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsEnum(ReturnStatus)
  @IsOptional()
  status?: ReturnStatus;

  @IsEnum(ReturnReason)
  @IsOptional()
  reason?: ReturnReason;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsNumber()
  @IsOptional()
  page?: number;

  @IsNumber()
  @IsOptional()
  limit?: number;
}
