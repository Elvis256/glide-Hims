import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_MONEY, NUMBER_OPTS } from '../../../common/constants/validation.constants';

export class CreateBankReconciliationDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsUUID()
  bankAccountId: string;

  @ApiProperty()
  @IsDateString()
  statementDate: string;

  @ApiProperty()
  @IsNumber(NUMBER_OPTS)
  @Min(-MAX_MONEY)
  @Max(MAX_MONEY)
  statementBalance: number;

  @ApiProperty()
  @IsNumber(NUMBER_OPTS)
  @Min(-MAX_MONEY)
  @Max(MAX_MONEY)
  bookBalance: number;
}

export class StatementItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statementReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statementDescription?: string;

  @ApiProperty()
  @IsNumber(NUMBER_OPTS)
  @Min(-MAX_MONEY)
  @Max(MAX_MONEY)
  statementAmount: number;

  @ApiProperty()
  @IsDateString()
  statementDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddStatementItemsDto {
  @ApiProperty({ type: [StatementItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatementItemDto)
  items: StatementItemDto[];
}

export class ManualMatchDto {
  @ApiProperty()
  @IsUUID()
  journalEntryId: string;
}
