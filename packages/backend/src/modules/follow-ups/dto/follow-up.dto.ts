import { IsString, IsOptional, IsEnum, IsDateString, IsBoolean, IsUUID, IsNumber } from 'class-validator';
import { FollowUpType, FollowUpStatus, FollowUpPriority } from '../../../database/entities/follow-up.entity';

export class CreateFollowUpDto {
  @IsUUID()
  patientId: string;

  @IsOptional()
  @IsUUID()
  sourceEncounterId?: string;

  @IsEnum(FollowUpType)
  type: FollowUpType;

  @IsEnum(FollowUpPriority)
  @IsOptional()
  priority?: FollowUpPriority;

  @IsDateString()
  scheduledDate: string;

  @IsOptional()
  @IsString()
  scheduledTime?: string;

  @IsOptional()
  @IsNumber()
  durationMinutes?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsBoolean()
  smsReminder?: boolean;

  @IsOptional()
  @IsNumber()
  daysBeforeReminder?: number;
}

export class RescheduleFollowUpDto {
  @IsDateString()
  newDate: string;

  @IsOptional()
  @IsString()
  newTime?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CompleteFollowUpDto {
  @IsOptional()
  @IsUUID()
  followUpEncounterId?: string;

  @IsOptional()
  @IsString()
  outcomeNotes?: string;
}

export class CancelFollowUpDto {
  @IsString()
  cancellationReason: string;
}

export class FollowUpFilterDto {
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @IsOptional()
  @IsEnum(FollowUpStatus)
  status?: FollowUpStatus;

  @IsOptional()
  @IsEnum(FollowUpType)
  type?: FollowUpType;

  @IsOptional()
  @IsUUID()
  providerId?: string;

  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @IsOptional()
  @IsDateString()
  toDate?: string;
}
