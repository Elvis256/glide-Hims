import {
  Entity,
  Column,
  Index,
  CreateDateColumn,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { License } from './license.entity';

/**
 * Phone Home Record - Tracks heartbeats from on-premise installations
 */
@Entity('phone_home_records')
export class PhoneHomeRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'license_id' })
  @Index()
  licenseId: string;

  @ManyToOne(() => License)
  @JoinColumn({ name: 'license_id' })
  license: License;

  @Column({ type: 'varchar', length: 45, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'hardware_id' })
  hardwareId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'app_version' })
  appVersion: string;

  @Column({ type: 'int', default: 0, name: 'active_users' })
  activeUsers: number;

  @Column({ type: 'int', default: 0, name: 'total_users' })
  totalUsers: number;

  @Column({ type: 'int', default: 0, name: 'total_patients' })
  totalPatients: number;

  @Column({ type: 'int', default: 0, name: 'total_encounters' })
  totalEncounters: number;

  @Column({ type: 'jsonb', nullable: true, name: 'system_info' })
  systemInfo: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true, name: 'usage_stats' })
  usageStats: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
