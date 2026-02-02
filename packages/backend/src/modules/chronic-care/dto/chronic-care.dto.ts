import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean, IsUUID, IsDate, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ChronicStatus } from '../../../database/entities/patient-chronic-condition.entity';

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
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextFollowUp?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  followUpIntervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  reminderDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryDoctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
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
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  nextFollowUp?: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  followUpIntervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  reminderDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  primaryDoctorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  currentMedications?: string[];
}

export class ChronicPatientsQueryDto {
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
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  overdueFollowUp?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  limit?: number;
}

export class SendBulkReminderDto {
  @ApiProperty()
  @IsArray()
  @IsUUID('4', { each: true })
  patientIds: string[];

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  channel?: 'email' | 'sms' | 'both';
}
