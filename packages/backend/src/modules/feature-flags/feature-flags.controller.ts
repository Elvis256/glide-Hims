import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FeatureFlagsService } from './feature-flags.service';
import { GlobalJwtAuthGuard } from '../auth/guards/global-jwt.guard';

@ApiTags('Feature Flags')
@Controller('features')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagsService) {}

  private requireTenantId(tenantId: string | undefined): string {
    if (!tenantId) {
      throw new BadRequestException('tenantId is required');
    }
    return tenantId;
  }

  /**
   * Check if a feature is enabled
   */
  @Get('check/:featureKey')
  @ApiOperation({ summary: 'Check if a feature is enabled' })
  async checkFeature(
    @Param('featureKey') featureKey: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.requireTenantId(tenantId);
    const enabled = await this.featureFlagsService.isEnabled(featureKey, tid);
    return { featureKey, enabled };
  }

  /**
   * Check multiple features at once
   */
  @Post('check-batch')
  @ApiOperation({ summary: 'Check multiple features at once' })
  async checkFeatures(
    @Body() body: { featureKeys: string[]; tenantId?: string },
  ) {
    const tid = this.requireTenantId(body.tenantId);
    return this.featureFlagsService.checkFeatures(body.featureKeys, tid);
  }

  /**
   * Get all feature flags for a tenant
   */
  @Get()
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all feature flags' })
  async getFlags(@Query('tenantId') tenantId?: string) {
    const tid = this.requireTenantId(tenantId);
    return this.featureFlagsService.getFlags(tid);
  }

  /**
   * Get feature flag value
   */
  @Get(':featureKey/value')
  @ApiOperation({ summary: 'Get feature flag value' })
  async getFlagValue(
    @Param('featureKey') featureKey: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.requireTenantId(tenantId);
    const value = await this.featureFlagsService.getValue(featureKey, tid);
    const enabled = await this.featureFlagsService.isEnabled(featureKey, tid);
    return { featureKey, enabled, value };
  }

  /**
   * Set a feature flag (admin only)
   */
  @Put(':featureKey')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set a feature flag' })
  async setFlag(
    @Param('featureKey') featureKey: string,
    @Body() body: {
      tenantId?: string;
      enabled: boolean;
      value?: any;
      metadata?: Record<string, any>;
    },
  ) {
    return this.featureFlagsService.setFlag(
      featureKey,
      body.tenantId ?? null,
      body.enabled,
      body.value,
      body.metadata,
    );
  }

  /**
   * Delete a feature flag (admin only)
   */
  @Delete(':featureKey')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a feature flag' })
  async deleteFlag(
    @Param('featureKey') featureKey: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const tid = this.requireTenantId(tenantId);
    await this.featureFlagsService.deleteFlag(featureKey, tid);
    return { message: 'Feature flag deleted' };
  }

  /**
   * Get system feature definitions
   */
  @Get('system/definitions')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get system feature definitions' })
  async getSystemFeatures() {
    return this.featureFlagsService.getSystemFeatures();
  }

  /**
   * Create/update system feature definition (admin only)
   */
  @Post('system/definitions')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create or update system feature' })
  async upsertSystemFeature(
    @Body() body: {
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
