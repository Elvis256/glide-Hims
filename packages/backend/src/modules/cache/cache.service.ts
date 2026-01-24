import { Injectable, Inject, OnModuleDestroy, Logger } from '@nestjs/common';
import type { CacheModuleOptions } from './cache.module';

// Simple in-memory cache that can be swapped for Redis
// This implementation works without Redis installed
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private cache: Map<string, { value: any; expiresAt: number }> = new Map();
  private keyPrefix: string;
  private defaultTtl: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(
    @Inject('CACHE_OPTIONS') private options: CacheModuleOptions,
  ) {
    this.keyPrefix = options.keyPrefix || 'glide-hims:';
    this.defaultTtl = options.ttl || 3600;
    
    // Cleanup expired entries every minute
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    
    this.logger.log('Cache service initialized (in-memory mode)');
  }

  async onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
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
    
    this.cache.set(fullKey, {
      value,
      expiresAt: Date.now() + (ttl * 1000),
    });
  }

  async del(key: string): Promise<void> {
    const fullKey = this.getKey(key);
    this.cache.delete(fullKey);
  }

  async delByPattern(pattern: string): Promise<number> {
    const fullPattern = this.getKey(pattern).replace(/\*/g, '');
    let count = 0;
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(fullPattern)) {
        this.cache.delete(key);
        count++;
      }
    }
    
    return count;
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.get(key);
    return result !== null;
  }

  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttlSeconds?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await factory();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  async increment(key: string, by: number = 1): Promise<number> {
    const fullKey = this.getKey(key);
    const entry = this.cache.get(fullKey);
    
    let value = by;
    if (entry && entry.expiresAt >= Date.now()) {
      value = (Number(entry.value) || 0) + by;
    }
    
    this.cache.set(fullKey, {
      value,
      expiresAt: Date.now() + (this.defaultTtl * 1000),
    });
    
    return value;
  }

  async flush(): Promise<void> {
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
    
    const entry = this.cache.get(this.getKey(key));
    
    if (!entry || entry.expiresAt < now) {
      await this.set(key, { count: 1, resetAt: now + windowMs }, windowSeconds);
      return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
    }
    
    const data = entry.value as { count: number; resetAt: number };
    data.count++;
    
    if (data.count > maxRequests) {
      return { allowed: false, remaining: 0, resetAt: data.resetAt };
    }
    
    return { allowed: true, remaining: maxRequests - data.count, resetAt: data.resetAt };
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
