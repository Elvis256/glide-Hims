import { Injectable } from '@nestjs/common';

@Injectable()
export class CacheService {
  private cache = new Map<string, { data: any; expires: number }>();
  private readonly DEFAULT_TTL = 3600; // 1 hour

  async get<T>(key: string): Promise<T | null> {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return item.data;
  }

  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + ttl * 1000,
    });
  }

  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async getDeploymentHealth(deploymentId: string) {
    return this.get(`health:${deploymentId}`);
  }

  async setDeploymentHealth(deploymentId: string, data: any, ttl = 300) {
    return this.set(`health:${deploymentId}`, data, ttl);
  }

  async getDeploymentList(tenantId: string) {
    return this.get(`deployments:${tenantId}`);
  }

  async setDeploymentList(tenantId: string, data: any, ttl = 600) {
    return this.set(`deployments:${tenantId}`, data, ttl);
  }
}
