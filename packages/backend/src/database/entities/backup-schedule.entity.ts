import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('backup_schedules')
export class BackupSchedule extends BaseEntity {
  @Column({ type: 'varchar', length: 20 })
  frequency: string; // 'daily' | 'weekly' | 'monthly'

  @Column({ type: 'varchar', length: 5, name: 'time_of_day' })
  timeOfDay: string; // HH:mm format, e.g. '02:00'

  @Column({ type: 'int', nullable: true, name: 'day_of_week' })
  dayOfWeek: number | null; // 0=Sun..6=Sat, used for weekly

  @Column({ type: 'int', nullable: true, name: 'day_of_month' })
  dayOfMonth: number | null; // 1-28, used for monthly

  @Column({ type: 'int', default: 30, name: 'retention_days' })
  retentionDays: number;

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'last_run_at' })
  lastRunAt: Date | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'last_run_status' })
  lastRunStatus: string | null; // 'success' | 'failed'

  @Column({ type: 'timestamp', nullable: true, name: 'next_run_at' })
  nextRunAt: Date | null;
}
