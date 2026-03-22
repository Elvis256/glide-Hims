import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsUUID,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransferReason } from '../../../database/entities/stock-transfer.entity';

export class CreateTransferItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  batchNumber: string;

  @IsDateString()
  expiryDate: string;

  @IsInt()
  @Min(1)
  requestedQuantity: number;

  @IsNumber()
  @Min(0)
  unitCost: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateStockTransferDto {
  @IsUUID()
  fromFacilityId: string;

  @IsUUID()
  toFacilityId: string;

  @IsEnum(TransferReason)
  reason: TransferReason;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTransferItemDto)
  items: CreateTransferItemDto[];
}

export class ApproveTransferItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  batchNumber: string;

  @IsInt()
  @Min(0)
  approvedQuantity: number;
}

export class ApproveStockTransferDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveTransferItemDto)
  items?: ApproveTransferItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectStockTransferDto {
  @IsString()
  reason: string;
}

export class ReceiveTransferItemDto {
  @IsUUID()
  itemId: string;

  @IsString()
  batchNumber: string;

  @IsInt()
  @Min(0)
  receivedQuantity: number;
}

export class ReceiveStockTransferDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceiveTransferItemDto)
  items: ReceiveTransferItemDto[];

  @IsOptional()
  @IsString()
  notes?: string;
}

export class CancelStockTransferDto {
  @IsString()
  reason: string;
}
