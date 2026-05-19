import {
  IsString,
  IsNumber,
  IsOptional,
  IsEnum,
  IsDateString,
  IsUUID,
  IsArray,
  ArrayNotEmpty,
  ValidateNested,
  Min,
  Max,
  IsPositive,
} from 'class-validator';
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

  @IsPositive()
  quantity: number;

  @IsNumber()
  @Min(0)
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
  @ArrayNotEmpty()
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
  @Min(0)
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(500)
  limit?: number;
}
