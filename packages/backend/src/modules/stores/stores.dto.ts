import { IsString, IsOptional, IsEnum, IsUUID, IsBoolean, IsArray, ValidateNested, IsNumber, IsDateString } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { StoreType, TransferStatus } from '../../database/entities/store.entity';

export class CreateStoreDto {
  @ApiProperty() @IsString() code: string;
  @ApiProperty() @IsString() name: string;
  @ApiProperty({ enum: StoreType }) @IsEnum(StoreType) type: StoreType;
  @ApiProperty({ required: false }) @IsOptional() @IsString() description?: string;
  @ApiProperty() @IsUUID() facilityId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() departmentId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsUUID() managerId?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() canDispense?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() canIssue?: boolean;
  @ApiProperty({ required: false }) @IsOptional() @IsBoolean() canReceive?: boolean;
}

export class UpdateStoreDto extends PartialType(CreateStoreDto) {}

export class TransferItemDto {
  @ApiProperty() @IsUUID() itemId: string;
  @ApiProperty() @IsString() itemCode: string;
  @ApiProperty() @IsString() itemName: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() batchNumber?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsDateString() expiryDate?: string;
  @ApiProperty() @IsNumber() quantityRequested: number;
  @ApiProperty({ required: false }) @IsOptional() @IsNumber() unitCost?: number;
}

export class CreateTransferDto {
  @ApiProperty() @IsUUID() fromStoreId: string;
  @ApiProperty() @IsUUID() toStoreId: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() reason?: string;
  @ApiProperty({ type: [TransferItemDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => TransferItemDto) items: TransferItemDto[];
}

export class ApproveTransferDto {
  @ApiProperty({ type: [Object] }) @IsArray() items: { itemId: string; quantityApproved: number }[];
}

export class ReceiveTransferDto {
  @ApiProperty({ type: [Object] }) @IsArray() items: { itemId: string; quantityReceived: number; notes?: string }[];
}
