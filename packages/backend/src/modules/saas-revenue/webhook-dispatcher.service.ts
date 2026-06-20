import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import * as crypto from 'crypto';
import { SaasWebhookEndpoint, SaasWebhookDelivery } from './saas.entity';

const MAX_ATTEMPTS = 6;
const AUTO_DISABLE_AFTER = 15;
const BACKOFF_MIN_SECONDS = [30, 120, 300, 900, 1800, 3600];
const REQUEST_TIMEOUT_MS = 8000;

export const WEBHOOK_EVENT_TYPES = [
  'invoice.issued',
  'invoice.paid',
  'invoice.overdue',
  'payment.recorded',
  'payment.refunded',
  'subscription.created',
  'subscription.updated',
  'subscription.cancelled',
  'subscription.churned',
  'subscription.paused',
  'subscription.resumed',
] as const;
export type WebhookEventType = typeof WEBHOOK_EVENT_TYPES[number];

@Injectable()
export class WebhookDispatcherService {
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private cronEnabled = process.env.SAAS_WEBHOOKS_CRON !== 'off';

  constructor(
    @InjectRepository(SaasWebhookEndpoint) private readonly endpoints: Repository<SaasWebhookEndpoint>,
    @InjectRepository(SaasWebhookDelivery) private readonly deliveries: Repository<SaasWebhookDelivery>,
  ) {}

  /** Queue a delivery for every enabled endpoint of the given tenant subscribed to this event. */
  async enqueue(tenantId: string, eventType: WebhookEventType, data: Record<string, any>): Promise<number> {
    if (!tenantId) return 0;
    const all = await this.endpoints.find({ where: { tenantId, enabled: true } });
    const matching = all.filter((e) => !e.events?.length || e.events.includes(eventType) || e.events.includes('*'));
    if (!matching.length) return 0;
    const rows = matching.map((ep) =>
      this.deliveries.create({
        endpointId: ep.id,
        tenantId,
        eventType,
        payload: data,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: new Date(),
      }),
    );
    await this.deliveries.save(rows);
    // Fire-and-forget immediate flush so latency is low when the endpoint is healthy.
    setImmediate(() => this.flush().catch((e) => this.logger.warn(`flush error: ${e?.message}`)));
    return rows.length;
  }

  @Cron(CronExpression.EVERY_MINUTE, { name: 'saas-webhook-dispatcher' })
  async cronTick(): Promise<void> {
    if (!this.cronEnabled) return;
    try { await this.flush(); }
    catch (e: any) { this.logger.error(`Webhook cron failed: ${e?.message}`); }
  }

  /** Process up to N pending deliveries that are due. */
  async flush(limit = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
    const due = await this.deliveries.find({
      where: { status: 'pending' as any, nextAttemptAt: LessThanOrEqual(new Date()) },
      order: { nextAttemptAt: 'ASC' },
      take: limit,
    });
    let succeeded = 0;
    let failed = 0;
    for (const d of due) {
      const ok = await this.attemptDelivery(d);
      if (ok) succeeded++; else failed++;
    }
    return { processed: due.length, succeeded, failed };
  }

  /** Send a one-off test ping; not persisted as a delivery. */
  async sendTestPing(endpoint: SaasWebhookEndpoint): Promise<{ ok: boolean; statusCode?: number; error?: string; bodyPreview?: string }> {
    const payload = { eventId: crypto.randomUUID(), eventType: 'ping', tenantId: endpoint.tenantId, data: { message: 'Hello from Glide-HIMS' }, timestamp: new Date().toISOString() };
    return this.dispatch(endpoint, payload);
  }

  private async attemptDelivery(d: SaasWebhookDelivery): Promise<boolean> {
    const ep = await this.endpoints.findOne({ where: { id: d.endpointId } });
    if (!ep || !ep.enabled) {
      d.status = 'failed';
      d.errorMessage = 'Endpoint disabled or removed';
      d.lastAttemptAt = new Date();
      await this.deliveries.save(d);
      return false;
    }
    const body = { eventId: d.eventId, eventType: d.eventType, tenantId: d.tenantId, data: d.payload, timestamp: new Date().toISOString(), attempt: d.attempts + 1 };
    const result = await this.dispatch(ep, body);
    d.attempts += 1;
    d.lastAttemptAt = new Date();
    d.responseCode = result.statusCode ?? null;
    d.responseBody = result.bodyPreview ?? null;
    d.errorMessage = result.error ?? null;
    if (result.ok) {
      d.status = 'succeeded';
      d.succeededAt = new Date();
      ep.consecutiveFailures = 0;
      ep.lastSuccessAt = new Date();
      await this.endpoints.save(ep);
      await this.deliveries.save(d);
      return true;
    }
    ep.consecutiveFailures = (ep.consecutiveFailures || 0) + 1;
    ep.lastFailureAt = new Date();
    if (ep.consecutiveFailures >= AUTO_DISABLE_AFTER) {
      ep.enabled = false;
      ep.disabledAt = new Date();
      this.logger.warn(`Webhook endpoint ${ep.id} (${ep.url}) auto-disabled after ${ep.consecutiveFailures} consecutive failures`);
    }
    await this.endpoints.save(ep);
    if (d.attempts >= MAX_ATTEMPTS) {
      d.status = 'failed';
    } else {
      const backoff = BACKOFF_MIN_SECONDS[Math.min(d.attempts - 1, BACKOFF_MIN_SECONDS.length - 1)] || 60;
      d.nextAttemptAt = new Date(Date.now() + backoff * 1000);
    }
    await this.deliveries.save(d);
    return false;
  }

  private async dispatch(ep: SaasWebhookEndpoint, body: any): Promise<{ ok: boolean; statusCode?: number; error?: string; bodyPreview?: string }> {
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac('sha256', ep.secret).update(raw).digest('hex');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'glide-hims-webhooks/1.0',
          'X-Glide-Event': body.eventType,
          'X-Glide-Event-Id': body.eventId,
          'X-Glide-Signature': `sha256=${sig}`,
          'X-Glide-Timestamp': body.timestamp,
        },
        body: raw,
        signal: controller.signal,
      });
      const text = await res.text().catch(() => '');
      const ok = res.status >= 200 && res.status < 300;
      return { ok, statusCode: res.status, bodyPreview: text.slice(0, 500) };
    } catch (e: any) {
      return { ok: false, error: e?.name === 'AbortError' ? `Timeout after ${REQUEST_TIMEOUT_MS}ms` : (e?.message || 'Request failed') };
    } finally {
      clearTimeout(timer);
    }
  }
}
