import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum NotificationType {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  BOTH = 'both',
}

export enum NotificationProvider {
  SMTP = 'smtp',
  AFRICAS_TALKING = 'africas_talking',
  TWILIO = 'twilio',
  WHATSAPP_BUSINESS = 'whatsapp_business',
  WHATSAPP_CLOUD = 'whatsapp_cloud',
  CUSTOM = 'custom',
}

@Entity('notification_configs')
@Index(['facilityId', 'type'], { unique: true, where: 'deleted_at IS NULL' })
export class NotificationConfig extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
  })
  type: NotificationType;

  @Column({
    type: 'enum',
    enum: NotificationProvider,
    nullable: true,
  })
  provider?: NotificationProvider;

  @Column({ type: 'boolean', default: false, name: 'is_enabled' })
  isEnabled: boolean;

  // Email SMTP Configuration
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_host' })
  smtpHost?: string;

  @Column({ type: 'int', nullable: true, name: 'smtp_port' })
  smtpPort?: number;

  @Column({ type: 'boolean', default: true, name: 'smtp_secure' })
  smtpSecure: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_user' })
  smtpUser?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'smtp_password' })
  smtpPassword?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'from_email' })
  fromEmail?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'from_name' })
  fromName?: string;

  // SMS Configuration
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sms_api_url' })
  smsApiUrl?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sms_api_key' })
  smsApiKey?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sms_api_secret' })
  smsApiSecret?: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'sms_sender_id' })
  smsSenderId?: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'sms_username' })
  smsUsername?: string;

  // Additional provider-specific config
  @Column({ type: 'jsonb', nullable: true, name: 'extra_config' })
  extraConfig?: Record<string, any>;

  @Column({ type: 'timestamp', nullable: true, name: 'last_tested_at' })
  lastTestedAt?: Date;

  @Column({ type: 'boolean', default: false, name: 'test_successful' })
  testSuccessful: boolean;
}
