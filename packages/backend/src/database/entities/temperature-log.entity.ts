import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum AlertType {
  NORMAL = 'normal',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum StorageType {
  REFRIGERATED = 'refrigerated',
  FROZEN = 'frozen',
  ROOM_TEMPERATURE = 'room_temperature',
}

@Entity('temperature_logs')
@Index(['sensorId', 'recordedAt'])
@Index(['isAlert', 'acknowledgedAt', 'tenantId'])
@Index(['tenantId', 'facilityId'])
export class TemperatureLog extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'sensor_id' })
  sensorId: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  temperature: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  humidity: number;

  @Column({ type: 'timestamptz', name: 'recorded_at', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;

  @Column({ type: 'boolean', name: 'is_alert', default: false })
  isAlert: boolean;

  @Column({
    type: 'enum',
    enum: AlertType,
    name: 'alert_type',
    nullable: true,
  })
  alertType: AlertType;

  @Column({ type: 'timestamptz', name: 'acknowledged_at', nullable: true })
  acknowledgedAt: Date;

  @Column({ type: 'varchar', length: 255, name: 'acknowledged_by', nullable: true })
  acknowledgedBy: string;

  @Column({ type: 'uuid', name: 'facility_id', nullable: true })
  facilityId: string;
}

@Entity('temperature_sensors')
@Index(['sensorId', 'tenantId'], { unique: true, where: 'deleted_at IS NULL' })
@Index(['tenantId', 'facilityId'])
export class TemperatureSensor extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'sensor_id' })
  sensorId: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  location: string;

  @Column({
    type: 'enum',
    enum: StorageType,
    name: 'storage_type',
    default: StorageType.REFRIGERATED,
  })
  storageType: StorageType;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'min_temp' })
  minTemp: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'max_temp' })
  maxTemp: number;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', name: 'facility_id', nullable: true })
  facilityId: string;
}
