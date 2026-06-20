import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Stores time-series system health metrics collected periodically
 * (CPU, memory, disk, DB connections, API latency, active users, tenant count, etc.).
 */
@Entity('system_metrics')
@Index(['metricType', 'recordedAt'])
@Index(['recordedAt'])
export class SystemMetric extends BaseEntity {
  @Column({ name: 'metric_type', type: 'varchar', length: 50 })
  metricType: string;

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  value: number;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ name: 'recorded_at', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  recordedAt: Date;
}
