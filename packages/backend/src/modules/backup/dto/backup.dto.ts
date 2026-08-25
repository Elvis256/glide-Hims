import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * The four backup @Body() handlers took `any` and passed it straight to
 * createSchedule / updateSchedule / createDrDrill / updateDrDrill.
 *
 * A backup schedule that accepts an unchecked body is a backup that may not
 * run: `timeOfDay` is written into a cron-style scheduler as a string, and
 * nothing checked it was a time. The entity's own comments carry the allowed
 * values for frequency, dayOfWeek and dayOfMonth — they were documentation
 * with nothing enforcing them.
 */
export class CreateBackupScheduleDto {
  @ApiProperty({ enum: ['daily', 'weekly', 'monthly'] })
  @IsIn(['daily', 'weekly', 'monthly'])
  frequency: string;

  /** HH:mm, per the entity comment. */
  @ApiProperty({ example: '02:00' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay must be HH:mm' })
  timeOfDay: string;

  /** 0=Sun..6=Sat, used for weekly. null clears it. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number | null;

  /** 1-28, so every month has the day. null clears it. */
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  dayOfMonth?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateBackupScheduleDto extends PartialType(CreateBackupScheduleDto) {}

export class DrDrillResultDto {
  @ApiProperty()
  @IsBoolean()
  success: boolean;

  /**
   * Required, matching the service's own type: a drill that reports success
   * still sends [] rather than omitting them, so a consumer never has to
   * distinguish "no errors" from "errors not reported".
   */
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  errors: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  warnings: string[];
}

export class CreateDrDrillDto {
  @ApiProperty({ enum: ['full_restore', 'partial_restore', 'failover_test', 'backup_verify'] })
  @IsIn(['full_restore', 'partial_restore', 'failover_test', 'backup_verify'])
  drillType: string;

  @ApiPropertyOptional({ enum: ['scheduled', 'in_progress', 'completed', 'failed'] })
  @IsOptional()
  @IsIn(['scheduled', 'in_progress', 'completed', 'failed'])
  status?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  scheduledAt: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  completedAt?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  backupId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  restoreDurationMinutes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(8000)
  notes?: string;

  /** Defaulted to the caller by the handler when absent. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  conductedBy?: string;

  @ApiPropertyOptional({ type: DrDrillResultDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DrDrillResultDto)
  result?: DrDrillResultDto;
}

export class UpdateDrDrillDto extends PartialType(CreateDrDrillDto) {}
