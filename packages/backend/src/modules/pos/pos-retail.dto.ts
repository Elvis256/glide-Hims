import {
  IsString,
  IsUUID,
  IsArray,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsIn,
  IsNotEmpty,
  ValidateNested,
  Min,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DiscountType, DiscountValueType } from '../../database/entities/pos-retail.entity';

// ─── B1: Returns ─────────────────────────────────────────────────────────────

export class ReturnItemDto {
  @ApiProperty()
  @IsUUID()
  saleItemId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  qtyReturned: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  restockable?: boolean;
}

export class CreateReturnDto {
  @ApiProperty()
  @IsUUID()
  originalSaleId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiProperty({ type: [ReturnItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items: ReturnItemDto[];

  @ApiPropertyOptional({ default: 'cash' })
  @IsString()
  @IsOptional()
  paymentMethod?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  refundReference?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posShiftId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posRegisterId?: string;
}

// ─── B2: Void ────────────────────────────────────────────────────────────────

export class VoidSaleDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  managerPin: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posShiftId?: string;
}

export class SetManagerPinDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pin: string;
}

// ─── B3: Hold ────────────────────────────────────────────────────────────────

export class HoldSaleDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posShiftId?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  posRegisterId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiProperty()
  @IsObject()
  cartSnapshot: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  holdReason?: string;
}

export class RecallHoldDto {
  // No body needed — id is in the URL
}

// ─── B4: Discounts ───────────────────────────────────────────────────────────

export class ApplyDiscountDto {
  @ApiProperty()
  @IsUUID()
  saleId: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  saleItemId?: string;

  @ApiProperty({ enum: DiscountType })
  @IsIn(Object.values(DiscountType))
  type: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  value: number;

  @ApiProperty({ enum: DiscountValueType })
  @IsIn(Object.values(DiscountValueType))
  valueType: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  managerPin?: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  approverId?: string;
}

// ─── B6: Receipt Reprint ─────────────────────────────────────────────────────

export interface GetReprintReceiptOptions {
  duplicate?: boolean;
}

// ─── B7: Quick Keys ──────────────────────────────────────────────────────────

export class UpsertQuickKeyDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  registerId?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  position: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  itemId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  color?: string;
}

// ─── B8: Retail Customer ─────────────────────────────────────────────────────

export class UpdateRetailCustomerDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;
}

// ─── Receipt history query ────────────────────────────────────────────────────

export class ReceiptHistoryQueryDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  from?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  to?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cashierId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  saleNumber?: string;
}
