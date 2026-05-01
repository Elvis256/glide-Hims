import {
  IsUUID,
  IsEnum,
  IsNumber,
  IsString,
  IsOptional,
  IsObject,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CashDrawerEventType } from '../../database/entities/pos-compliance.entity';

export class CreateDrawerEventDto {
  @ApiProperty() @IsUUID() shiftId: string;
  @ApiProperty({ enum: CashDrawerEventType }) @IsEnum(CashDrawerEventType)
  eventType: CashDrawerEventType;
  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;
  @ApiProperty({ required: false }) @IsOptional() @IsString() reason?: string;
  @ApiProperty({ required: false }) @IsOptional() @IsString() reference?: string;
}

export class GenerateZReportDto {
  @ApiProperty({ required: false, description: 'Cashier-counted cash in drawer' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  countedCash?: number;
  @ApiProperty({
    required: false,
    description: 'Denomination breakdown e.g. {"note_50000":10,"note_20000":5}',
  })
  @IsOptional()
  @IsObject()
  denominationCount?: Record<string, number>;
  @ApiProperty({ required: false }) @IsOptional() @IsString() notes?: string;
}
