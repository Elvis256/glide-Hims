import {
  IsEnum,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsDate,
  IsArray,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
  ArrayNotEmpty,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ChronicStatus } from '../../../database/entities/patient-chronic-condition.entity';
import { ReminderChannel } from '../../../database/entities/patient-reminder.entity';

export class RegisterChronicConditionDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty()
  @IsUUID()
  diagnosisId: string;

  @ApiProperty()
  @Type(() => Date)
  @IsDate()
  diagnosedDate: Date;

  @ApiPropertyOptional({ enum: ChronicStatus })
  @IsOptional()
  @IsEnum(ChronicStatus)
  status?: ChronicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextFollowUp?: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  followUpIntervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  reminderDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryDoctorId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  currentMedications?: string[];
}

export class UpdateChronicConditionDto {
  @ApiPropertyOptional({ enum: ChronicStatus })
  @IsOptional()
  @IsEnum(ChronicStatus)
  status?: ChronicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextFollowUp?: Date;

  @ApiPropertyOptional({ minimum: 1, maximum: 365 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  followUpIntervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(60)
  reminderDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryDoctorId?: string;

  @ApiPropertyOptional({ type: [String], maxItems: 50 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  currentMedications?: string[];
}

export class ChronicPatientsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  diagnosisId?: string;

  @ApiPropertyOptional({ enum: ChronicStatus })
  @IsOptional()
  @IsEnum(ChronicStatus)
  status?: ChronicStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  overdueFollowUp?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 10000 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(10000)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 200 })
  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}

export class SendBulkReminderDto {
  @ApiProperty({ type: [String], maxItems: 500 })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(500)
  @IsUUID('4', { each: true })
  patientIds: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(200)
  subject: string;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ enum: ReminderChannel })
  @IsOptional()
  @IsEnum(ReminderChannel)
  channel?: ReminderChannel;
}

export class RecordVisitDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextFollowUpDate?: Date;
}
