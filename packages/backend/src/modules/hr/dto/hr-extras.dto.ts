import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PipStatus } from '../../../database/entities/performance-improvement-plan.entity';
import { GoalStatus } from '../../../database/entities/employee-goal.entity';
import { LetterTemplateType } from '../../../database/entities/letter-template.entity';

/**
 * These six handlers took `@Body() dto: any` and did `create({ ...dto })`
 * straight into the entity. With no metatype the ValidationPipe had nothing to
 * check, so whitelist and forbidNonWhitelisted were both inert: any property at
 * all was persisted, and a malformed date or a string where a number belongs
 * reached Postgres and came back as a 500 rather than a 400 naming the field.
 *
 * Performance improvement plans and goals are employment records. What is
 * written into them can end up supporting a dismissal, so "whatever the client
 * sent" is the wrong storage policy.
 */
export class CreatePipDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  reviewId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  managerId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  reason: string;

  @ApiProperty()
  @IsString()
  @MaxLength(4000)
  goals: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  supportProvided?: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  startDate: Date;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  endDate: Date;

  @ApiPropertyOptional({ enum: PipStatus })
  @IsOptional()
  @IsEnum(PipStatus)
  status?: PipStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  outcomeNotes?: string;

  @ApiProperty()
  @IsUUID()
  facilityId: string;
}

export class UpdatePipDto extends PartialType(CreatePipDto) {}

export class GoalKeyResultDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  description: string;

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  target: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  current?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  achieved?: boolean;
}

export class CreateGoalDto {
  @ApiProperty()
  @IsUUID()
  employeeId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;

  @ApiPropertyOptional({ type: [GoalKeyResultDto] })
  @IsOptional()
  @IsArray()
  @Type(() => GoalKeyResultDto)
  keyResults?: GoalKeyResultDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  targetDate?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @ApiPropertyOptional({ enum: GoalStatus })
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentGoalId?: string;
}

export class UpdateGoalDto extends PartialType(CreateGoalDto) {}

export class CreateLetterTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiProperty({ enum: LetterTemplateType })
  @IsEnum(LetterTemplateType)
  type: LetterTemplateType;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20000)
  body: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLetterTemplateDto extends PartialType(CreateLetterTemplateDto) {}
