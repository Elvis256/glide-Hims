import { SetMetadata } from '@nestjs/common';

export const REQUIRED_FEATURE_KEY = 'required_feature';

/**
 * Decorator to require a specific feature to be enabled
 * 
 * Usage:
 * @RequireFeature('advanced_analytics')
 * @Get('analytics')
 * async getAnalytics() { ... }
 */
export const RequireFeature = (featureKey: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, featureKey);
