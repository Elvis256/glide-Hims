import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from './base.entity';
import { AlertRule } from './alert-rule.entity';

/**
 * Represents a system alert generated when an alert rule threshold is breached,
 * or created manually for informational purposes.
 */
@Entity('system_alerts')
@Index(['status'])
@Index(['severity'])
@Index(['createdAt'])
export class SystemAlert extends BaseEntity {
  @Column({ name: 'rule_id', type: 'uuid', nullable: true })
  ruleId: string;

  @ManyToOne(() => AlertRule, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'rule_id' })
  rule: AlertRule;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  severity: string; // 'critical' | 'high' | 'medium' | 'low' | 'info'

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status: string; // 'open' | 'acknowledged' | 'resolved'

  @Column({ name: 'metric_type', type: 'varchar', length: 50, nullable: true })
  metricType: string;

  @Column({ name: 'metric_value', type: 'numeric', precision: 20, scale: 4, nullable: true })
  metricValue: number;

  @Column({ name: 'acknowledged_by', type: 'uuid', nullable: true })
  acknowledgedBy: string;

  @Column({ name: 'acknowledged_at', type: 'timestamptz', nullable: true })
  acknowledgedAt: Date;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;
}
