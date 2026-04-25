import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag } from '../../database/entities/feature-flag.entity';
import { SystemFeature } from '../../database/entities/system-feature.entity';

interface FeatureFlagValue {
  enabled: boolean;
  value?: any;
}

@Injectable()
export class FeatureFlagsService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly cache: Map<string, Map<string, FeatureFlagValue>> = new Map();
  private systemFeaturesCache: Map<string, SystemFeature> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private lastCacheRefresh: Date | null = null;

  constructor(
    @InjectRepository(FeatureFlag)
    private readonly featureFlagRepository: Repository<FeatureFlag>,
    @InjectRepository(SystemFeature)
    private readonly systemFeatureRepository: Repository<SystemFeature>,
  ) {}

  async onModuleInit() {
    await this.refreshSystemFeaturesCache();
    this.logger.log('Feature flags service initialized');
  }

  /**
   * Check if a feature is enabled for a tenant
   */
  async isEnabled(featureKey: string, tenantId: string): Promise<boolean> {
    const flag = await this.getFlag(featureKey, tenantId);
    return flag?.enabled ?? this.getSystemDefault(featureKey);
  }

  /**
   * Get a feature flag value
   */
  async getValue<T = any>(featureKey: string, tenantId: string, defaultValue?: T): Promise<T> {
    const flag = await this.getFlag(featureKey, tenantId);

    if (!flag || !flag.enabled) {
      return defaultValue as T;
    }

    if (flag.value === undefined) {
      return defaultValue as T;
    }

    return flag.value as T;
  }

  /**
   * Get feature flag from cache or database
   */
  private async getFlag(featureKey: string, tenantId: string): Promise<FeatureFlagValue | null> {
    const cacheKey = tenantId || 'global';

    // Check cache
    if (this.isCacheValid()) {
      const tenantCache = this.cache.get(cacheKey);
      if (tenantCache?.has(featureKey)) {
        return tenantCache.get(featureKey)!;
      }
    }

    // Query database
    const flag = await this.featureFlagRepository.findOne({
      where: { featureKey, tenantId: tenantId || undefined },
    });

    if (!flag && tenantId) {
      // Check global flag if tenant-specific not found
      const globalFlag = await this.featureFlagRepository.findOne({
        where: { featureKey, tenantId: undefined as any },
      });

      if (globalFlag) {
        return this.cacheAndReturn(cacheKey, featureKey, {
          enabled: globalFlag.isEnabled,
          value: this.parseValue(globalFlag),
        });
      }
    }

    if (!flag) {
      return null;
    }

    return this.cacheAndReturn(cacheKey, featureKey, {
      enabled: flag.isEnabled,
      value: this.parseValue(flag),
    });
  }

  /**
   * Set a feature flag
   */
  async setFlag(
    featureKey: string,
    tenantId: string | null,
    enabled: boolean,
    value?: any,
    metadata?: Record<string, any>,
  ): Promise<FeatureFlag> {
    let flag = await this.featureFlagRepository.findOne({
      where: { featureKey, tenantId: tenantId || undefined },
    });

    if (!flag) {
      flag = this.featureFlagRepository.create({
        featureKey,
        name: featureKey,
        tenantId: tenantId || undefined,
        isEnabled: enabled,
        value: value !== undefined ? JSON.stringify(value) : undefined,
        metadata,
      });
    } else {
      flag.isEnabled = enabled;
      if (value !== undefined) {
        flag.value = JSON.stringify(value);
      }
      if (metadata) {
        flag.metadata = { ...flag.metadata, ...metadata };
      }
    }

    const saved = await this.featureFlagRepository.save(flag);

    // Invalidate cache
    this.invalidateCache(tenantId);

    return saved;
  }

  /**
   * Get all feature flags for a tenant
   */
  async getFlags(tenantId: string): Promise<FeatureFlag[]> {
    const query = this.featureFlagRepository.createQueryBuilder('flag');

    if (tenantId) {
      query.where('(flag.tenant_id = :tenantId OR flag.tenant_id IS NULL)', { tenantId });
    }

    return query.orderBy('flag.feature_key', 'ASC').getMany();
  }

  /**
   * Delete a feature flag
   */
  async deleteFlag(featureKey: string, tenantId: string): Promise<void> {
    await this.featureFlagRepository.delete({
      featureKey,
      tenantId: tenantId || undefined,
    });

    this.invalidateCache(tenantId);
  }

  /**
   * Get all system features
   */
  async getSystemFeatures(): Promise<SystemFeature[]> {
    return this.systemFeatureRepository.find({
      where: { isActive: true },
      order: { category: 'ASC', name: 'ASC' },
    });
  }

  /**
   * Create or update a system feature definition
   */
  async upsertSystemFeature(data: Partial<SystemFeature>): Promise<SystemFeature> {
    let feature = await this.systemFeatureRepository.findOne({
      where: { featureKey: data.featureKey },
    });

    if (!feature) {
      feature = this.systemFeatureRepository.create(data);
    } else {
      Object.assign(feature, data);
    }

    const saved = await this.systemFeatureRepository.save(feature);
    await this.refreshSystemFeaturesCache();
    return saved;
  }

  /**
   * Check multiple features at once (batch operation)
   */
  async checkFeatures(featureKeys: string[], tenantId: string): Promise<Record<string, boolean>> {
    const result: Record<string, boolean> = {};

    await Promise.all(
      featureKeys.map(async (key) => {
        result[key] = await this.isEnabled(key, tenantId);
      }),
    );

    return result;
  }

  // ==================== Private Methods ====================

  private parseValue(flag: FeatureFlag): any {
    if (!flag.value) return undefined;

    try {
      switch (flag.valueType) {
        case 'boolean':
          return flag.value === 'true';
        case 'number':
          return Number(flag.value);
        case 'json':
          return JSON.parse(flag.value);
        default:
          return flag.value;
      }
    } catch {
      return flag.value;
    }
  }

  private cacheAndReturn(
    cacheKey: string,
    featureKey: string,
    value: FeatureFlagValue,
  ): FeatureFlagValue {
    if (!this.cache.has(cacheKey)) {
      this.cache.set(cacheKey, new Map());
    }
    this.cache.get(cacheKey)!.set(featureKey, value);
    this.lastCacheRefresh = new Date();
    return value;
  }

  private isCacheValid(): boolean {
    if (!this.lastCacheRefresh) return false;
    return Date.now() - this.lastCacheRefresh.getTime() < this.CACHE_TTL_MS;
  }

  private invalidateCache(tenantId: string | null) {
    if (tenantId) {
      this.cache.delete(tenantId);
    } else {
      this.cache.clear();
    }
  }

  private getSystemDefault(featureKey: string): boolean {
    const systemFeature = this.systemFeaturesCache.get(featureKey);
    return systemFeature?.defaultEnabled ?? false;
  }

  private async refreshSystemFeaturesCache() {
    const features = await this.systemFeatureRepository.find({
      where: { isActive: true },
    });

    this.systemFeaturesCache.clear();
    features.forEach((f) => this.systemFeaturesCache.set(f.featureKey, f));
  }
}
