import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

export enum SyncType {
  INTERACTIONS = 'interactions',
  LABELS = 'labels',
  FULL = 'full',
}

export enum SyncStatus {
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('drug_sync_logs')
@Index(['tenantId', 'syncType'])
export class DrugSyncLog extends BaseEntity {
  @Column({
    type: 'enum',
    enum: SyncType,
    name: 'sync_type',
  })
  syncType: SyncType;

  @Column({
    type: 'enum',
    enum: SyncStatus,
    default: SyncStatus.RUNNING,
  })
  status: SyncStatus;

  @Column({ type: 'int', default: 0, name: 'records_processed' })
  recordsProcessed: number;

  @Column({ type: 'int', default: 0, name: 'records_added' })
  recordsAdded: number;

  @Column({ type: 'int', default: 0, name: 'records_failed' })
  recordsFailed: number;

  @Column({ type: 'timestamptz', name: 'started_at', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'timestamptz', name: 'completed_at', nullable: true })
  completedAt: Date;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string;
}
