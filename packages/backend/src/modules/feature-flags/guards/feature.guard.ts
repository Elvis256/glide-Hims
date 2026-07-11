import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureFlagsService } from '../feature-flags.service';
import { REQUIRED_FEATURE_KEY } from '../decorators/require-feature.decorator';

/**
 * Guard to check if a feature is enabled for the current tenant
 */
@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredFeature = this.reflector.getAllAndOverride<string>(REQUIRED_FEATURE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;
    if (!tenantId) {
      // Do not fall back to x-tenant-id header — it's unauthenticated and forgeable
      return true; // Let auth guard handle unauthenticated users
    }

    const isEnabled = await this.featureFlagsService.isEnabled(requiredFeature, tenantId);

    if (!isEnabled) {
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: `Feature '${requiredFeature}' is not enabled`,
          error: 'Feature Disabled',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}
