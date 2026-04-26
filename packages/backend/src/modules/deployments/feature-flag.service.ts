import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantFeatureModule } from '../../database/entities/tenant-feature-module.entity';
import { Deployment } from '../../database/entities/deployment.entity';
import { ToggleFeatureFlagDto } from './deployment.dto';

@Injectable()
export class FeatureFlagService {
  constructor(
    @InjectRepository(TenantFeatureModule)
    private featureModuleRepository: Repository<TenantFeatureModule>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
  ) {}

  async toggleFeature(tenantId: string, dto: ToggleFeatureFlagDto): Promise<any> {
    const enabled = typeof dto.isEnabled === 'string' ? dto.isEnabled.toLowerCase() === 'true' : dto.isEnabled;

    const feature = await this.featureModuleRepository.findOne({
      where: { tenantId, moduleKey: dto.featureKey },
    });

    if (feature) {
      feature.isEnabled = enabled;
      return this.featureModuleRepository.save(feature);
    } else {
      const newFeature = this.featureModuleRepository.create({
        tenantId,
        moduleKey: dto.featureKey,
        name: dto.featureKey,
        isEnabled: enabled,
      });
      return this.featureModuleRepository.save(newFeature);
    }
  }

  async isFeatureEnabled(tenantId: string, featureKey: string): Promise<boolean> {
    const feature = await this.featureModuleRepository.findOne({
      where: { tenantId, moduleKey: featureKey },
    });

    return feature?.isEnabled ?? true;
  }

  async getFeatures(tenantId: string): Promise<Record<string, boolean>> {
    const features = await this.featureModuleRepository.find({
      where: { tenantId },
    });

    const result: Record<string, boolean> = {};
    for (const feature of features) {
      result[feature.moduleKey] = feature.isEnabled;
    }

    return result;
  }
}
