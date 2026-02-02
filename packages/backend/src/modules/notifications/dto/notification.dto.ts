import { IsEnum, IsOptional, IsString, IsNumber, IsBoolean, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType, NotificationProvider } from '../../../database/entities/notification-config.entity';
import { ReminderType, ReminderChannel } from '../../../database/entities/patient-reminder.entity';

export class CreateNotificationConfigDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional({ enum: NotificationProvider })
  @IsOptional()
  @IsEnum(NotificationProvider)
  provider?: NotificationProvider;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  // SMTP
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  smtpPort?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  smtpSecure?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpUser?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fromName?: string;

  // SMS
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsApiUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsApiKey?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsApiSecret?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsSenderId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  smsUsername?: string;

  @ApiPropertyOptional()
  @IsOptional()
  extraConfig?: Record<string, any>;
}

export class UpdateNotificationConfigDto extends CreateNotificationConfigDto {}

export class SendReminderDto {
  @ApiProperty()
  @IsUUID()
  patientId: string;

  @ApiProperty({ enum: ReminderType })
  @IsEnum(ReminderType)
  type: ReminderType;

  @ApiProperty({ enum: ReminderChannel })
  @IsEnum(ReminderChannel)
  channel: ReminderChannel;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  message: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  referenceId?: string;
}

export class ScheduleReminderDto extends SendReminderDto {
  @ApiProperty()
  scheduledFor: Date;
}

export class TestNotificationDto {
  @ApiProperty()
  @IsUUID()
  facilityId: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testPhone?: string;
}
