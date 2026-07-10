import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BaseEntity } from './base.entity';
import { Tenant } from './tenant.entity';

export enum UsageMetricType {
  API_CALLS = 'api_calls',
  STORAGE_GB = 'storage_gb',
  ACTIVE_USERS = 'active_users',
  SMS_SENT = 'sms_sent',
  PDF_GENERATED = 'pdf_generated',
  EMAIL_SENT = 'email_sent',
  REPORTS_GENERATED = 'reports_generated',
  DATA_SYNCED = 'data_synced_gb',
  BACKUP_SIZE = 'backup_size_gb',
}

export enum UsageAggregationPeriod {
  HOURLY = 'hourly',
  DAILY = 'daily',
  MONTHLY = 'monthly',
}

/**
 * Raw usage events for metering
 * One record per event (granular tracking)
 */
@Entity('usage_meter_event')
@Index('idx_usage_tenant_metric_time', ['tenantId', 'metricType', 'createdAt'])
@Index('idx_usage_tenant_metric', ['tenantId', 'metricType'])
export class UsageMeterEvent extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: UsageMetricType,
    name: 'metric_type',
  })
  metricType: UsageMetricType;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'event_source' })
  eventSource?: string; // 'api', 'batch_job', 'system', etc.

  @Column({ type: 'jsonb', nullable: true, name: 'metadata' })
  metadata?: Record<string, any>; // Additional context (user_id, endpoint, etc.)

  @Column({ type: 'boolean', default: true, name: 'billable' })
  billable: boolean; // Whether this event counts toward billing

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

/**
 * Aggregated usage per tenant per period
 * Pre-aggregated for faster queries (dashboard, billing)
 */
@Entity('usage_meter_aggregate')
@Index('idx_usage_aggregate_tenant_metric_period', ['tenantId', 'metricType', 'period', 'periodStart'])
@Index('idx_usage_aggregate_tenant_time', ['tenantId', 'periodStart'])
export class UsageMeterAggregate extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: UsageMetricType,
    name: 'metric_type',
  })
  metricType: UsageMetricType;

  @Column({
    type: 'enum',
    enum: UsageAggregationPeriod,
  })
  period: UsageAggregationPeriod; // hourly, daily, monthly

  @Column({ type: 'timestamp', name: 'period_start' })
  periodStart: Date;

  @Column({ type: 'timestamp', name: 'period_end' })
  periodEnd: Date;

  @Column({ type: 'decimal', precision: 18, scale: 4, default: 0 })
  totalAmount: number;

  @Column({ type: 'int', default: 0, name: 'event_count' })
  eventCount: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, name: 'avg_per_event' })
  avgPerEvent?: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, name: 'max_amount' })
  maxAmount?: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Plan-based quotas per tenant
 * Enforced against actual usage
 */
@Entity('usage_quota')
@Index('idx_quota_tenant_metric', ['tenantId', 'metricType'])
export class UsageQuota extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: UsageMetricType,
    name: 'metric_type',
  })
  metricType: UsageMetricType;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, name: 'limit_monthly' })
  limitMonthly?: number; // null = unlimited

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, name: 'limit_daily' })
  limitDaily?: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, name: 'limit_hourly' })
  limitHourly?: number;

  @Column({ type: 'boolean', default: true, name: 'hard_limit' })
  hardLimit: boolean; // true = block, false = warn

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 80, name: 'alert_threshold_pct' })
  alertThresholdPct: number; // Alert when X% of limit reached

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

/**
 * Usage alerts per quota breach
 * Track when tenants hit limits
 */
@Entity('usage_alert')
@Index('idx_alert_tenant_metric_time', ['tenantId', 'metricType', 'createdAt'])
@Index('idx_alert_tenant_resolved', ['tenantId', 'resolvedAt'])
export class UsageAlert extends BaseEntity {
  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({
    type: 'enum',
    enum: UsageMetricType,
    name: 'metric_type',
  })
  metricType: UsageMetricType;

  @Column({ type: 'varchar', length: 50, default: 'warning' })
  severity: 'info' | 'warning' | 'critical'; // info (80%), warning (90%), critical (100%+)

  @Column({ type: 'decimal', precision: 18, scale: 4, name: 'current_usage' })
  currentUsage: number;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true, name: 'limit' })
  limit?: number;

  @Column({ type: 'varchar', length: 100, default: 'monthly', name: 'limit_period' })
  limitPeriod: 'hourly' | 'daily' | 'monthly';

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'usage_pct' })
  usagePct: number; // Percentage of limit used

  @Column({ type: 'text', nullable: true })
  message: string; // Human-readable alert message

  @Column({ type: 'boolean', default: false, name: 'acknowledged' })
  acknowledged: boolean;

  @Column({ type: 'timestamp', nullable: true, name: 'resolved_at' })
  resolvedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
