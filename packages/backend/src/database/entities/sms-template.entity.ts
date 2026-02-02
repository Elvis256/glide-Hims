import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { ReminderType } from './patient-reminder.entity';

@Entity('sms_templates')
@Index(['facilityId', 'type'], { unique: true, where: 'deleted_at IS NULL' })
export class SmsTemplate extends BaseEntity {
  @Column({ type: 'uuid', name: 'facility_id' })
  facilityId: string;

  @Column({
    type: 'enum',
    enum: ReminderType,
  })
  type: ReminderType;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text' })
  smsTemplate: string;

  @Column({ type: 'text', nullable: true })
  whatsappTemplate?: string;

  @Column({ type: 'text', nullable: true })
  emailSubject?: string;

  @Column({ type: 'text', nullable: true })
  emailTemplate?: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'jsonb', nullable: true })
  variables?: string[]; // Available variables like {patientName}, {appointmentDate}, etc.
}
