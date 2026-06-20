import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('Feature Flags')
@Controller('features')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  /**
   * Check if a feature is enabled (Fix 2: now requires auth, uses JWT tenantId)
   */
  @Get('check/:featureKey')
  @Auth()
  @ApiOperation({ summary: 'Check if a feature is enabled' })
  async checkFeature(
    @Param('featureKey') featureKey: string,
    @Request() req: any,
  ) {
    const tid = req.user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant context required');
    const enabled = await this.featureFlagsService.isEnabled(featureKey, tid);
    return { featureKey, enabled };
  }

  /**
   * Check multiple features at once (Fix 2: now requires auth, uses JWT tenantId)
   */
  @Post('check-batch')
  @Auth()
  @ApiOperation({ summary: 'Check multiple features at once' })
  async checkFeatures(@Body() body: { featureKeys: string[] }, @Request() req: any) {
    const tid = req.user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant context required');
    return this.featureFlagsService.checkFeatures(body.featureKeys, tid);
  }

  /**
   * Get all feature flags for a tenant
   */
  @Get()
  @Auth('Administrator')
  @ApiOperation({ summary: 'Get all feature flags' })
  async getFlags(@Request() req: any) {
    const tid = req.user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant context required');
    return this.featureFlagsService.getFlags(tid);
  }

  /**
   * Get feature flag value (Fix 2: now requires auth, uses JWT tenantId)
   */
  @Get(':featureKey/value')
  @Auth()
  @ApiOperation({ summary: 'Get feature flag value' })
  async getFlagValue(
    @Param('featureKey') featureKey: string,
    @Request() req: any,
  ) {
    const tid = req.user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant context required');
    const value = await this.featureFlagsService.getValue(featureKey, tid);
    const enabled = await this.featureFlagsService.isEnabled(featureKey, tid);
    return { featureKey, enabled, value };
  }

  /**
   * Set a feature flag (admin only)
   */
  @Put(':featureKey')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Set a feature flag' })
  async setFlag(
    @Param('featureKey') featureKey: string,
    @Body()
    body: {
      enabled: boolean;
      value?: any;
      metadata?: Record<string, any>;
    },
    @Request() req: any,
  ) {
    const tid = req.user?.tenantId ?? null;
    return this.featureFlagsService.setFlag(
      featureKey,
      tid,
      body.enabled,
      body.value,
      body.metadata,
    );
  }

  /**
   * Delete a feature flag (admin only)
   */
  @Delete(':featureKey')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Delete a feature flag' })
  async deleteFlag(@Param('featureKey') featureKey: string, @Request() req: any) {
    const tid = req.user?.tenantId;
    if (!tid) throw new BadRequestException('Tenant context required');
    await this.featureFlagsService.deleteFlag(featureKey, tid);
    return { message: 'Feature flag deleted' };
  }

  /**
   * Get system feature definitions
   */
  @Get('system/definitions')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Get system feature definitions' })
  async getSystemFeatures() {
    return this.featureFlagsService.getSystemFeatures();
  }

  /**
   * Create/update system feature definition (admin only)
   */
  @Post('system/definitions')
  @Auth('Administrator')
  @ApiOperation({ summary: 'Create or update system feature' })
  async upsertSystemFeature(
    @Body()
    body: {
      featureKey: string;
      name: string;
      description?: string;
      category: string;
      defaultEnabled?: boolean;
      minLicenseType?: string;
      dependencies?: string[];
    },
  ) {
    return this.featureFlagsService.upsertSystemFeature(body as any);
  }
}
