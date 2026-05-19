import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  IsIn,
  Matches,
  IsInt,
  Min,
  Max,
  IsDateString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type GroupBy = 'day' | 'week' | 'month';
export type ExportFormat = 'json' | 'csv' | 'xlsx';

/**
 * Every reports endpoint is scoped to a specific facility — the caller must
 * pass a facility UUID that belongs to their tenant. Tenant ownership of the
 * facility is enforced server-side in `ReportsService.requireFacility` so
 * cross-tenant probing returns 404 instead of empty result sets.
 */
export class FacilityScopedDto {
  @ApiProperty({ description: 'Facility ID (required)' })
  @IsUUID()
  facilityId: string;
}

export class DateRangeDto extends FacilityScopedDto {
  @ApiPropertyOptional({ description: 'ISO 8601 date (YYYY-MM-DD) or full timestamp (start)' })
  @IsOptional()
  @IsDateString({}, { message: 'startDate must be an ISO 8601 date string' })
  startDate?: string;

  @ApiPropertyOptional({ description: 'ISO 8601 date (YYYY-MM-DD) or full timestamp (end)' })
  @IsOptional()
  @IsDateString({}, { message: 'endDate must be an ISO 8601 date string' })
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
  // Free-text filter against payments.payment_method. Bound the length so a
  // pathological query string can't be used to bloat audit logs.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  paymentMethod?: string;
}

export class OutstandingQueryDto extends FacilityScopedDto {
  @ApiPropertyOptional({ description: 'ISO 8601 date as-of cutoff' })
  @IsOptional()
  @IsDateString({}, { message: 'asOf must be an ISO 8601 date string' })
  asOf?: string;
}

export class StockQueryDto extends FacilityScopedDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  storeId?: string;

  // Bound to item_categories.code length.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;
}

export class ConsumptionQueryDto extends DateRangeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  itemId?: string;
}

export class ExpiryQueryDto extends FacilityScopedDto {
  // Cap at 5 years ahead so a query like ?daysAhead=10000000 can't cause the
  // interval cast in the query to overflow.
  @ApiPropertyOptional({ description: 'Days ahead (default 90, max 1825 ≈ 5 years)' })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? value : Number(value)))
  @IsInt()
  @Min(1)
  @Max(1825)
  daysAhead?: number;
}

// Statutory ----------------------------------------------------------------

export class HmisMonthlyDto extends FacilityScopedDto {
  // Period must be YYYY-MM with year 2000..2099 — bounds chosen so that
  // `parsePeriodMonth` never produces dates outside JS Date safe range.
  @ApiProperty({ description: 'Period in YYYY-MM (year 2000-2099)' })
  @Matches(/^(20\d{2})-(0[1-9]|1[0-2])$/, {
    message: 'period must be YYYY-MM with year between 2000 and 2099',
  })
  period: string;

  @ApiPropertyOptional({ enum: ['json', 'csv', 'xlsx'] })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx'])
  format?: ExportFormat;
}

export class HmisWeeklyDto extends FacilityScopedDto {
  // ISO week, year 2000..2099, week 01..53. The 53 vs 52 check for a given
  // year is done in `parsePeriodWeek` so we can return a precise error.
  @ApiProperty({ description: 'ISO week in YYYY-WW (year 2000-2099, week 01-53)' })
  @Matches(/^(20\d{2})-(0[1-9]|[1-4]\d|5[0-3])$/, {
    message: 'week must be YYYY-WW with year between 2000 and 2099',
  })
  week: string;

  @ApiPropertyOptional({ enum: ['json', 'csv', 'xlsx'] })
  @IsOptional()
  @IsIn(['json', 'csv', 'xlsx'])
  format?: ExportFormat;
}

// Silence unused-import warning for ValidateIf — kept for future cross-field
// rules (e.g., endDate >= startDate) that we currently enforce in the service.
void ValidateIf;
