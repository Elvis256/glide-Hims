import { IsString, IsOptional, IsNumber, IsEnum, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UsageMetricType } from '../../../database/entities/usage-meter.entity';

export class RecordUsageDto {
  @ApiProperty({
    enum: UsageMetricType,
    example: UsageMetricType.API_CALLS,
  })
  @IsEnum(UsageMetricType)
  metricType: UsageMetricType;

  @ApiProperty({
    example: 1,
    description: 'Amount to record (e.g., 1 for API call, 0.5 for 500MB)',
  })
  @IsNumber()
  amount: number = 1;

  @ApiProperty({
    example: true,
    description: 'Whether this event counts toward billing',
    required: false,
  })
  @IsOptional()
  billable?: boolean;

  @ApiProperty({
    example: 'api_endpoint',
    description: 'Source of the event',
    required: false,
  })
  @IsOptional()
  @IsString()
  eventSource?: string;

  @ApiProperty({
    example: { endpoint: '/api/patients', method: 'POST', userId: 'user-123' },
    description: 'Additional context metadata',
    required: false,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CheckQuotaDto {
  @ApiProperty({
    enum: UsageMetricType,
    example: UsageMetricType.API_CALLS,
  })
  @IsEnum(UsageMetricType)
  metricType: UsageMetricType;
}

export class SetQuotaDto {
  @ApiProperty({
    enum: UsageMetricType,
    example: UsageMetricType.API_CALLS,
  })
  @IsEnum(UsageMetricType)
  metricType: UsageMetricType;

  @ApiProperty({
    example: 100000,
    description: 'Monthly limit (null = unlimited)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  limitMonthly?: number;

  @ApiProperty({
    example: 5000,
    description: 'Daily limit (null = unlimited)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  limitDaily?: number;

  @ApiProperty({
    example: 250,
    description: 'Hourly limit (null = unlimited)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  limitHourly?: number;

  @ApiProperty({
    example: true,
    description: 'Hard limit blocks requests at limit; soft limit warns',
  })
  hardLimit: boolean = true;

  @ApiProperty({
    example: 80,
    description: 'Alert threshold percentage (0-100)',
  })
  @IsNumber()
  alertThresholdPct: number = 80;
}

export class GetUsageReportDto {
  @ApiProperty({
    example: '2026-06-01T00:00:00Z',
    description: 'Start of reporting period',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2026-06-30T23:59:59Z',
    description: 'End of reporting period',
  })
  @IsDateString()
  endDate: string;
}

export class BillingUsageDto {
  @ApiProperty({
    example: '2026-06-01T00:00:00Z',
  })
  @IsDateString()
  periodStart: string;

  @ApiProperty({
    example: '2026-06-30T23:59:59Z',
  })
  @IsDateString()
  periodEnd: string;
}
