import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Seven @Body() parameters in deployment.controller the ValidationPipe could
 * not see — one `any` and six inline object types.
 *
 * Two of them matter more than the rest: the rollout status report and the
 * health metrics are posted BY deployed instances, not by an operator's
 * browser, so they cross a trust boundary. Percentages that were never bounded
 * fed dashboards and alerting; a report claiming 10^9% disk usage was accepted
 * as readily as a real one.
 */
export class ReasonDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class NotesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

const ROLLOUT_STATUSES = ['started', 'in_progress', 'success', 'failed', 'rolled_back'] as const;

/** Posted by a deployed instance reporting how its update went. */
export class ReportRolloutStatusDto {
  @ApiProperty()
  @IsString()
  @MaxLength(512)
  licenseKey: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  hardwareId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  fromVersion?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  toVersion?: string;

  @ApiProperty({ enum: ROLLOUT_STATUSES })
  @IsIn(ROLLOUT_STATUSES as unknown as string[])
  status: (typeof ROLLOUT_STATUSES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  errorMessage?: string;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

/** Also posted by the instance. Every field is a percentage or a duration. */
export class ReportHealthMetricsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsagePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  memoryUsagePercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  diskUsagePercent?: number;

  /** Seconds since start; not a percentage. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  uptime?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  uptimePercentage?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  errorRatePercent?: number;
}

export class CreateIncidentDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: ['minor', 'moderate', 'major', 'critical'] })
  @IsIn(['minor', 'moderate', 'major', 'critical'])
  severity: string;
}

const CONFLICT_STRATEGIES = ['KEEP_LOCAL', 'TAKE_REMOTE', 'MERGE', 'MANUAL'] as const;

/**
 * Body for resolving one sync conflict. A conflict is a PAIR of changesets, so
 * both ids are required — resolving names the two rows whose metadata gets the
 * resolution stamped on it. The tenant is taken from the caller, never the body.
 */
export class ResolveSyncConflictDto {
  @ApiProperty({ description: 'Changeset id of the local side of the conflict' })
  @IsString()
  @IsUUID()
  localChangesetId: string;

  @ApiProperty({ description: 'Changeset id of the remote side of the conflict' })
  @IsString()
  @IsUUID()
  remoteChangesetId: string;

  @ApiProperty({ enum: CONFLICT_STRATEGIES })
  @IsIn(CONFLICT_STRATEGIES)
  strategy: (typeof CONFLICT_STRATEGIES)[number];

  @ApiPropertyOptional({ description: 'Why this resolution was chosen — kept in changeset metadata' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}
