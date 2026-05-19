import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import type { CacheModuleOptions } from './cache.module';
import Redis from 'ioredis';

/**
 * Cache service backed by Redis when REDIS_URL or REDIS_HOST is set,
 * falling back to in-memory Map when Redis is unavailable.
 *
 * Redis backing is recommended in production because:
 *   - State survives backend restarts (keeps rate-limit blocks in place)
 *   - Multiple backend instances share the same view (cluster-safe)
 */
@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private keyPrefix: string;
  private defaultTtl: number;
  private cleanupInterval: NodeJS.Timeout;

  private redis: Redis | null = null;
  private redisReady = false;

  constructor(@Inject('CACHE_OPTIONS') private options: CacheModuleOptions) {
    this.keyPrefix = options.keyPrefix || 'glide-hims:';
    this.defaultTtl = options.ttl || 3600;

    // Cleanup expired entries every minute (in-memory fallback only)
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async onModuleInit() {
    const url = process.env.REDIS_URL;
    const host = this.options.host || process.env.REDIS_HOST;
    if (!url && !host) {
      this.logger.log('Cache service initialized (in-memory mode — no Redis configured)');
      return;
    }
    try {
      const isProd = (process.env.NODE_ENV || '').toLowerCase() === 'production';
      const rawPassword = this.options.password;
      const isSentinel = rawPassword === 'CHANGE_ME_redis_password';
      if (isProd && (!rawPassword || isSentinel)) {
        throw new Error(
          'REDIS_PASSWORD is unset or still set to the placeholder ' +
            "'CHANGE_ME_redis_password'. Refusing to connect to Redis without auth in production.",
        );
      }
      const password = rawPassword && !isSentinel ? rawPassword : undefined;
      this.redis = url
        ? new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 2 })
        : new Redis({
            host: host!,
            port: this.options.port || Number(process.env.REDIS_PORT || 6379),
            password,
            db: this.options.db ?? 0,
            lazyConnect: true,
            maxRetriesPerRequest: 2,
          });
      this.redis.on('error', (err) => {
        if (this.redisReady) {
          this.logger.warn(`Redis error (will fallback to in-memory): ${err.message}`);
        }
      });
      this.redis.on('end', () => {
        this.redisReady = false;
      });
      this.redis.on('ready', () => {
        this.redisReady = true;
        this.logger.log('Cache service: connected to Redis');
      });
      await this.redis.connect();
      this.redisReady = true;
    } catch (err: any) {
      this.logger.warn(
        `Cache service: Redis unavailable (${err.message}); falling back to in-memory`,
      );
      this.redis = null;
      this.redisReady = false;
    }
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch {
        /* ignore */
      }
    }
  }

  private useRedis(): boolean {
    return !!(this.redis && this.redisReady);
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getKey(key);
    if (this.useRedis()) {
      try {
        const raw = await this.redis!.get(fullKey);
        if (raw == null) return null;
        try {
          return JSON.parse(raw) as T;
        } catch {
          return raw as unknown as T;
        }
      } catch (err: any) {
        this.logger.warn(`Redis GET failed for ${fullKey}: ${err.message}`);
      }
    }
    const entry = this.cache.get(fullKey);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.cache.delete(fullKey);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    const fullKey = this.getKey(key);
    const ttl = ttlSeconds || this.defaultTtl;
    if (this.useRedis()) {
      try {
        await this.redis!.set(fullKey, JSON.stringify(value), 'EX', ttl);
        return;
      } catch (err: any) {
        this.logger.warn(`Redis SET failed for ${fullKey}: ${err.message}`);
      }
    }
    this.cache.set(fullKey, { value, expiresAt: Date.now() + ttl * 1000 });
  }

  async del(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    if (this.useRedis()) {
      try {
        await this.redis!.del(fullKey);
      } catch (err: any) {
        this.logger.warn(`Redis DEL failed for ${fullKey}: ${err.message}`);
      }
    }
    this.cache.delete(fullKey);
  }

  async delByPattern(pattern: string): Promise<number> {
    const fullPattern = this.getKey(pattern);
    let count = 0;
    if (this.useRedis()) {
      try {
        let cursor = '0';
        do {
          const [next, batch] = await this.redis!.scan(cursor, 'MATCH', fullPattern, 'COUNT', 200);
          cursor = next;
          if (batch.length) {
            await this.redis!.del(...batch);
            count += batch.length;
          }
        } while (cursor !== '0');
      } catch (err: any) {
        this.logger.warn(`Redis SCAN/DEL failed for ${fullPattern}: ${err.message}`);
      }
    }
    const memPrefix = fullPattern.replace(/\*/g, '');
    for (const key of this.cache.keys()) {
      if (key.startsWith(memPrefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Find keys matching a glob pattern (e.g. "ratelimit:block:*").
   * Returns keys WITHOUT the global `keyPrefix`.
   */
  async keys(pattern: string): Promise<string[]> {
    const fullPattern = this.getKey(pattern);
    const seen = new Set<string>();
    if (this.useRedis()) {
      try {
        let cursor = '0';
        do {
          const [next, batch] = await this.redis!.scan(cursor, 'MATCH', fullPattern, 'COUNT', 200);
          cursor = next;
          for (const k of batch) seen.add(k);
        } while (cursor !== '0');
      } catch (err: any) {
        this.logger.warn(`Redis SCAN failed for ${fullPattern}: ${err.message}`);
      }
    }
    const re = new RegExp(
      '^' + fullPattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    for (const [k, v] of this.cache.entries()) {
      if (v.expiresAt < Date.now()) {
        this.cache.delete(k);
        continue;
      }
      if (re.test(k)) seen.add(k);
    }
    // Strip prefix on the way out so callers see logical keys
    return Array.from(seen).map((k) => (k.startsWith(this.keyPrefix) ? k.slice(this.keyPrefix.length) : k));
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.get(key);
    return result !== null;
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async increment(key: string, by: number = 1): Promise<number> {
    const fullKey = this.getKey(key);
    if (this.useRedis()) {
      try {
        const v = await this.redis!.incrby(fullKey, by);
        // Ensure TTL is set if this was a new key
        const ttl = await this.redis!.ttl(fullKey);
        if (ttl < 0) await this.redis!.expire(fullKey, this.defaultTtl);
        return v;
      } catch (err: any) {
        this.logger.warn(`Redis INCRBY failed for ${fullKey}: ${err.message}`);
      }
    }
    const entry = this.cache.get(fullKey);
    let value = by;
    if (entry && entry.expiresAt >= Date.now()) {
      value = (Number(entry.value) || 0) + by;
    }
    this.cache.set(fullKey, {
      value,
      expiresAt: Date.now() + this.defaultTtl * 1000,
    });
    return value;
  }

  async flush(): Promise<void> {
    if (this.useRedis()) {
      await this.delByPattern('*');
    }
    for (const key of this.cache.keys()) {
      if (key.startsWith(this.keyPrefix)) {
        this.cache.delete(key);
      }
    }
  }

  // Session management
  async setSession(sessionId: string, data: any, ttlSeconds: number = 86400): Promise<void> {
    await this.set(`session:${sessionId}`, data, ttlSeconds);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Rate limiting
  async checkRateLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number,
  ): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
    const key = `ratelimit:${identifier}`;
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const entry = await this.get<{ count: number; resetAt: number }>(key);
    if (!entry || entry.resetAt < now) {
      await this.set(key, { count: 1, resetAt: now + windowMs }, windowSeconds);
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }
    const next = { count: entry.count + 1, resetAt: entry.resetAt };
    await this.set(key, next, Math.max(1, Math.floor((entry.resetAt - now) / 1000)));
    if (next.count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt: next.resetAt };
    }
    return { allowed: true, remaining: maxRequests - next.count, resetAt: next.resetAt };
  }

  // Entity caching helpers
  async cacheEntity(entityType: string, id: string, data: any, ttl?: number): Promise<void> {
    await this.set(`entity:${entityType}:${id}`, data, ttl);
  }

  async getCachedEntity<T>(entityType: string, id: string): Promise<T | null> {
    return this.get<T>(`entity:${entityType}:${id}`);
  }

  async invalidateEntity(entityType: string, id: string): Promise<void> {
    await this.del(`entity:${entityType}:${id}`);
  }

  async invalidateEntityType(entityType: string): Promise<number> {
    return this.delByPattern(`entity:${entityType}:*`);
  }
}
