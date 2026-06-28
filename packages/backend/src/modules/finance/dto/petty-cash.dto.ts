import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PettyCashTransactionType } from '../../../database/entities/finance-extended.entity';
import { MAX_MONEY, NUMBER_OPTS } from '../../../common/constants/validation.constants';

export class CreatePettyCashFundDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  imprestAmount: number;

  @ApiProperty()
  @IsUUID()
  custodianId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class RecordTransactionDto {
  @ApiProperty({ enum: PettyCashTransactionType })
  @IsEnum(PettyCashTransactionType)
  type: PettyCashTransactionType;

  @ApiProperty()
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  amount: number;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  receiptNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paidTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  approvedById?: string;
}

export class ReplenishFundDto {
  @ApiProperty()
  @IsNumber(NUMBER_OPTS)
  @Min(0)
  @Max(MAX_MONEY)
  amount: number;

  @ApiProperty()
  @IsUUID()
  approvedById: string;
}

export class FundStatementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
