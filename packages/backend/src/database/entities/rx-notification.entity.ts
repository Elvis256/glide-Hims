import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('rx_notification_logs')
@Index(['tenantId', 'prescriptionId'])
@Index(['tenantId', 'patientId'])
@Index(['tenantId', 'notificationType'])
@Index(['createdAt'])
export class RxNotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'prescription_id', type: 'uuid' })
  prescriptionId: string;

  @Column({ name: 'patient_id', type: 'uuid' })
  patientId: string;

  @Column({ name: 'notification_type', type: 'varchar', length: 50 })
  notificationType: 'ready' | 'refill_reminder' | 'collection_reminder';

  @Column({ type: 'varchar', length: 20, default: 'sms' })
  channel: 'sms' | 'whatsapp';

  @Column({ name: 'phone_number', type: 'varchar', length: 30 })
  phoneNumber: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: 'sent' | 'delivered' | 'failed' | 'pending';

  @Column({ name: 'external_id', type: 'varchar', length: 255, nullable: true })
  externalId: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'tenant_id' })
  @Index()
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
