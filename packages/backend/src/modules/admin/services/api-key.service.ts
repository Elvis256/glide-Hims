import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ApiKey, WebhookDeliveryLog } from '../../../database/entities/api-key.entity';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    @InjectRepository(ApiKey)
    private readonly apiKeyRepo: Repository<ApiKey>,
    @InjectRepository(WebhookDeliveryLog)
    private readonly webhookLogRepo: Repository<WebhookDeliveryLog>,
  ) {}

  // ===== API Key Management =====

  async createApiKey(
    dto: {
      name: string;
      scopes: string[];
      rateLimitPerHour?: number;
      expiresInDays?: number;
      ipWhitelist?: string;
      tenantId?: string;
    },
    createdBy: string,
  ): Promise<{ apiKey: ApiKey; rawKey: string }> {
    // Generate a random API key
    const rawKey = `glide_${crypto.randomBytes(32).toString('base64url')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 12);

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

    const apiKey = this.apiKeyRepo.create({
      name: dto.name,
      keyHash,
      keyPrefix,
      createdBy,
      scopes: dto.scopes,
      rateLimitPerHour: dto.rateLimitPerHour || 1000,
      expiresAt,
      isActive: true,
      ipWhitelist: dto.ipWhitelist,
      tenantId: dto.tenantId,
    });

    const saved = await this.apiKeyRepo.save(apiKey);
    this.logger.log(`API key created: ${keyPrefix}... by user ${createdBy}`);

    // Return the raw key only once — it cannot be retrieved later
    return { apiKey: saved, rawKey };
  }

  async listApiKeys(tenantId?: string): Promise<ApiKey[]> {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;
    return this.apiKeyRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async getApiKey(id: string): Promise<ApiKey> {
    const key = await this.apiKeyRepo.findOne({ where: { id } });
    if (!key) throw new NotFoundException('API key not found');
    return key;
  }

  async updateApiKey(
    id: string,
    dto: {
      name?: string;
      scopes?: string[];
      rateLimitPerHour?: number;
      isActive?: boolean;
      ipWhitelist?: string;
    },
  ): Promise<ApiKey> {
    const key = await this.getApiKey(id);
    if (dto.name !== undefined) key.name = dto.name;
    if (dto.scopes !== undefined) key.scopes = dto.scopes;
    if (dto.rateLimitPerHour !== undefined) key.rateLimitPerHour = dto.rateLimitPerHour;
    if (dto.isActive !== undefined) key.isActive = dto.isActive;
    if (dto.ipWhitelist !== undefined) key.ipWhitelist = dto.ipWhitelist;
    return this.apiKeyRepo.save(key);
  }

  async revokeApiKey(id: string): Promise<void> {
    const key = await this.getApiKey(id);
    key.isActive = false;
    await this.apiKeyRepo.save(key);
    this.logger.log(`API key revoked: ${key.keyPrefix}...`);
  }

  async rotateApiKey(id: string, createdBy: string): Promise<{ apiKey: ApiKey; rawKey: string }> {
    const oldKey = await this.getApiKey(id);

    // Create a new key with the same settings
    const result = await this.createApiKey(
      {
        name: oldKey.name,
        scopes: oldKey.scopes,
        rateLimitPerHour: oldKey.rateLimitPerHour,
        ipWhitelist: oldKey.ipWhitelist,
        tenantId: oldKey.tenantId,
      },
      createdBy,
    );

    // Revoke the old key
    oldKey.isActive = false;
    await this.apiKeyRepo.save(oldKey);

    this.logger.log(`API key rotated: ${oldKey.keyPrefix}... → ${result.apiKey.keyPrefix}...`);
    return result;
  }

  async validateApiKey(rawKey: string): Promise<ApiKey | null> {
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyRepo.findOne({ where: { keyHash, isActive: true } });

    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    // Update usage stats
    apiKey.lastUsedAt = new Date();
    apiKey.usageCount++;
    await this.apiKeyRepo.save(apiKey);

    return apiKey;
  }

  async getKeyUsageStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    totalUsage: number;
    keys: Array<{
      id: string;
      name: string;
      prefix: string;
      usageCount: number;
      lastUsed: Date | null;
    }>;
  }> {
    const keys = await this.apiKeyRepo.find({ order: { usageCount: 'DESC' } });
    const now = new Date();
    return {
      total: keys.length,
      active: keys.filter((k) => k.isActive && (!k.expiresAt || k.expiresAt > now)).length,
      expired: keys.filter((k) => k.expiresAt && k.expiresAt <= now).length,
      totalUsage: keys.reduce((sum, k) => sum + k.usageCount, 0),
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.keyPrefix,
        usageCount: k.usageCount,
        lastUsed: k.lastUsedAt || null,
      })),
    };
  }

  // ===== Webhook Delivery Logs =====

  async logWebhookDelivery(dto: {
    webhookId: string;
    url: string;
    event: string;
    payload?: Record<string, any>;
    responseStatus?: number;
    responseBody?: string;
    durationMs?: number;
    status: string;
    errorMessage?: string;
    tenantId?: string;
  }): Promise<WebhookDeliveryLog> {
    return this.webhookLogRepo.save(this.webhookLogRepo.create(dto));
  }

  async listWebhookLogs(
    webhookId?: string,
    tenantId?: string,
    limit = 100,
  ): Promise<WebhookDeliveryLog[]> {
    const where: any = {};
    if (webhookId) where.webhookId = webhookId;
    if (tenantId) where.tenantId = tenantId;
    return this.webhookLogRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getWebhookDeliveryStats(tenantId?: string): Promise<{
    total: number;
    successful: number;
    failed: number;
    avgDurationMs: number;
  }> {
    const where: any = {};
    if (tenantId) where.tenantId = tenantId;

    const logs = await this.webhookLogRepo.find({ where });
    const successful = logs.filter((l) => l.status === 'success').length;
    const durations = logs.filter((l) => l.durationMs).map((l) => l.durationMs!);

    return {
      total: logs.length,
      successful,
      failed: logs.filter((l) => l.status === 'failed').length,
      avgDurationMs:
        durations.length > 0
          ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
          : 0,
    };
  }
}
