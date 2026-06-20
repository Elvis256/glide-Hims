import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * API keys for programmatic access.
 * Supports scoped permissions, rate limits, and expiry.
 */
@Entity('api_keys')
export class ApiKey extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64, name: 'key_hash' })
  keyHash: string;

  @Column({ type: 'varchar', length: 16, name: 'key_prefix' })
  keyPrefix: string;

  @Column({ type: 'uuid', name: 'created_by' })
  createdBy: string;

  @Column({ type: 'jsonb', default: [] })
  scopes: string[];

  @Column({ type: 'int', default: 1000, name: 'rate_limit_per_hour' })
  rateLimitPerHour: number;

  @Column({ type: 'timestamp', nullable: true, name: 'expires_at' })
  expiresAt?: Date;

  @Column({ type: 'timestamp', nullable: true, name: 'last_used_at' })
  lastUsedAt?: Date;

  @Column({ type: 'int', default: 0, name: 'usage_count' })
  usageCount: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'ip_whitelist' })
  ipWhitelist?: string;
}

/**
 * Webhook delivery logs for tracking webhook reliability.
 */
@Entity('webhook_delivery_logs')
export class WebhookDeliveryLog extends BaseEntity {
  @Column({ type: 'varchar', length: 100, name: 'webhook_id' })
  webhookId: string;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 100 })
  event: string;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any>;

  @Column({ type: 'int', nullable: true, name: 'response_status' })
  responseStatus?: number;

  @Column({ type: 'text', nullable: true, name: 'response_body' })
  responseBody?: string;

  @Column({ type: 'int', nullable: true, name: 'duration_ms' })
  durationMs?: number;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: string; // pending, success, failed, retrying

  @Column({ type: 'int', default: 0, name: 'retry_count' })
  retryCount: number;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage?: string;

  @Column({ type: 'timestamp', nullable: true, name: 'next_retry_at' })
  nextRetryAt?: Date;
}
