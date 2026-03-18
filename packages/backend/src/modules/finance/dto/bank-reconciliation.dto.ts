import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsNumber,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @IsNumber()
  statementBalance: number;

  @ApiProperty()
  @IsNumber()
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
  @IsNumber()
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
