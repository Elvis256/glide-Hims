import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('dr_drills')
export class DrDrill extends BaseEntity {
  @Column({ type: 'varchar', length: 30, name: 'drill_type' })
  drillType: string; // 'full_restore' | 'partial_restore' | 'failover_test' | 'backup_verify'

  @Column({ type: 'varchar', length: 20, default: 'scheduled' })
  status: string; // 'scheduled' | 'in_progress' | 'completed' | 'failed'

  @Column({ type: 'timestamp', name: 'scheduled_at' })
  scheduledAt: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'started_at' })
  startedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true, name: 'completed_at' })
  completedAt: Date | null;

  @Column({ type: 'uuid', nullable: true, name: 'backup_id' })
  backupId: string | null;

  @Column({ type: 'int', nullable: true, name: 'restore_duration_minutes' })
  restoreDurationMinutes: number | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true, name: 'conducted_by' })
  conductedBy: string | null;

  @Column({ type: 'jsonb', nullable: true })
  result: { success: boolean; errors: string[]; warnings: string[] } | null;
}
