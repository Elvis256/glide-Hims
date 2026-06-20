import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Configurable alert rules that are evaluated against collected system metrics.
 * When a metric breaches the threshold and the cooldown has elapsed, a SystemAlert is created.
 */
@Entity('alert_rules')
@Index(['metricType'])
@Index(['enabled'])
export class AlertRule extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'metric_type', type: 'varchar', length: 50 })
  metricType: string;

  @Column({ type: 'varchar', length: 10 })
  operator: string; // 'gt' | 'lt' | 'gte' | 'lte' | 'eq'

  @Column({ type: 'numeric', precision: 20, scale: 4 })
  threshold: number;

  @Column({ type: 'varchar', length: 20, default: 'medium' })
  severity: string; // 'critical' | 'high' | 'medium' | 'low'

  @Column({ type: 'boolean', default: true })
  enabled: boolean;

  @Column({ name: 'cooldown_minutes', type: 'int', default: 60 })
  cooldownMinutes: number;

  @Column({ name: 'notify_channels', type: 'jsonb', default: () => "'[\"in_app\"]'" })
  notifyChannels: string[];

  @Column({ name: 'last_triggered_at', type: 'timestamptz', nullable: true })
  lastTriggeredAt: Date;
}
