import { IsOptional, IsString, IsUUID, IsEnum, IsBoolean } from 'class-validator';
import { InAppNotificationType } from '../../../database/entities/in-app-notification.entity';

export class CreateInAppNotificationDto {
  @IsUUID()
  facilityId: string;

  @IsOptional()
  @IsUUID()
  targetDepartmentId?: string;

  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @IsOptional()
  @IsUUID()
  senderUserId?: string;

  @IsOptional()
  @IsString()
  senderName?: string;

  @IsEnum(InAppNotificationType)
  type: InAppNotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class MarkNotificationReadDto {
  @IsOptional()
  @IsBoolean()
  all?: boolean;
}
