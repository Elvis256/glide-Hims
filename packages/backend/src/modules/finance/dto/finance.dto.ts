import {
  IsUUID,
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AccountType, AccountCategory } from '../../../database/entities/chart-of-account.entity';
import { JournalType } from '../../../database/entities/journal-entry.entity';

// ============ CHART OF ACCOUNTS ============
export class CreateAccountDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsString()
  accountCode: string;

  @ApiProperty()
  @IsString()
  accountName: string;

  @ApiProperty({ enum: AccountType })
  @IsEnum(AccountType)
  accountType: AccountType;

  @ApiProperty({ enum: AccountCategory })
  @IsEnum(AccountCategory)
  accountCategory: AccountCategory;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isHeader?: boolean;
}

export class UpdateAccountDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accountName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  isActive?: boolean;
}

// ============ JOURNAL ENTRIES ============
export class JournalLineDto {
  @ApiProperty()
  @IsUUID()
  accountId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  debit: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  credit: number;
}

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsDateString()
  journalDate: string;

  @ApiPropertyOptional({ enum: JournalType })
  @IsOptional()
  @IsEnum(JournalType)
  journalType?: JournalType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({ type: [JournalLineDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines: JournalLineDto[];
}

// ============ FISCAL PERIODS ============
export class CreateFiscalYearDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsInt()
  @Min(2020)
  year: number;
}

// ============ REPORTS ============
export class TrialBalanceQueryDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export class IncomeStatementQueryDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;
}
