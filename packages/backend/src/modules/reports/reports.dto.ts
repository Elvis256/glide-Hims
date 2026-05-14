import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsIn, Matches, IsInt, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export type GroupBy = 'day' | 'week' | 'month';
export type ExportFormat = 'json' | 'csv' | 'xlsx';

export class FacilityScopedDto {
  @ApiProperty({ description: 'Facility ID (required)' })
  @IsUUID()
  facilityId: string;
}

export class DateRangeDto extends FacilityScopedDto {
  @ApiPropertyOptional({ description: 'ISO date string (start)' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO date string (end)' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: 'Optional department filter' })
  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

export class DashboardQueryDto extends DateRangeDto {}

export class VisitsQueryDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: GroupBy;
}

export class PatientStatsQueryDto extends FacilityScopedDto {
  @ApiPropertyOptional({ enum: ['week', 'month', 'quarter', 'year'] })
  @IsOptional()
  @IsIn(['week', 'month', 'quarter', 'year'])
  period?: 'week' | 'month' | 'quarter' | 'year';
}

export class DiseaseStatsQueryDto extends DateRangeDto {}

export class MortalityQueryDto extends DateRangeDto {}

export class RevenueQueryDto extends DateRangeDto {
  @ApiPropertyOptional({ enum: ['day', 'week', 'month'] })
  @IsOptional()
  @IsIn(['day', 'week', 'month'])
  groupBy?: GroupBy;
}

export class CollectionsQueryDto extends DateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymentMethod?: string;
}

export class OutstandingQueryDto extends FacilityScopedDto {
  @ApiPropertyOptional({ description: 'ISO date as-of cutoff' })
  @IsOptional()
  @IsString()
  asOf?: string;
}

export class StockQueryDto extends FacilityScopedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  category?: string;
}

export class ConsumptionQueryDto extends DateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export class ExpiryQueryDto extends FacilityScopedDto {
  @ApiPropertyOptional({ description: 'Days ahead (default 90)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  daysAhead?: number;
}

// Statutory ----------------------------------------------------------------

export class HmisMonthlyDto extends FacilityScopedDto {
  @ApiProperty({ description: 'Period in YYYY-MM' })
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'period must be YYYY-MM' })
  period: string;

  @ApiPropertyOptional({ enum: ['json', 'csv', 'xlsx'] })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx'])
  format?: ExportFormat;
}

export class HmisWeeklyDto extends FacilityScopedDto {
  @ApiProperty({ description: 'ISO week in YYYY-WW' })
  @Matches(/^\d{4}-(0[1-9]|[1-4]\d|5[0-3])$/, { message: 'week must be YYYY-WW' })
  week: string;

  @ApiPropertyOptional({ enum: ['json', 'csv', 'xlsx'] })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx'])
  format?: ExportFormat;
}
