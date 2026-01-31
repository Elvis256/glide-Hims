import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Facility } from './facility.entity';
import { User } from './user.entity';

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum AlertChannel {
  EMAIL = 'email',
  SMS = 'sms',
  IN_APP = 'in_app',
  PUSH = 'push',
}

@Entity('expiry_alert_configs')
@Index(['facilityId'])
export class ExpiryAlertConfig extends BaseEntity {
  @Column({ name: 'config_name' })
  configName: string;

  @Column({ name: 'days_before_expiry', type: 'int' })
  daysBeforeExpiry: number;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @Column({
    type: 'simple-array',
    nullable: true,
  })
  channels: AlertChannel[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'notify_emails', type: 'simple-array', nullable: true })
  notifyEmails: string[];

  @Column({ name: 'notify_phones', type: 'simple-array', nullable: true })
  notifyPhones: string[];

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({ name: 'created_by_id' })
  createdById: string;
}

@Entity('expiry_alert_history')
@Index(['facilityId', 'createdAt'])
@Index(['acknowledged'])
export class ExpiryAlertHistory extends BaseEntity {
  @Column({ name: 'alert_type' })
  alertType: string;

  @Column({ name: 'items_affected', type: 'int' })
  itemsAffected: number;

  @Column({ name: 'total_value', type: 'decimal', precision: 10, scale: 2, default: 0 })
  totalValue: number;

  @Column({
    type: 'enum',
    enum: AlertSeverity,
    default: AlertSeverity.MEDIUM,
  })
  severity: AlertSeverity;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({ default: false })
  acknowledged: boolean;

  @Column({ name: 'acknowledged_at', type: 'timestamp', nullable: true })
  acknowledgedAt: Date;

  @Column({
    type: 'enum',
    enum: AlertChannel,
    nullable: true,
  })
  channel: AlertChannel;

  @Column({ name: 'sent_at', type: 'timestamp', nullable: true })
  sentAt: Date;

  // Relationships
  @ManyToOne(() => Facility)
  @JoinColumn({ name: 'facility_id' })
  facility: Facility;

  @Column({ name: 'facility_id' })
  facilityId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'acknowledged_by_id' })
  acknowledgedBy: User;

  @Column({ name: 'acknowledged_by_id', nullable: true })
  acknowledgedById: string;
}
