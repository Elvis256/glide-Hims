import { Controller, Get, Query, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { RevenueAnalyticsService } from '../services/revenue-analytics.service';

@ApiTags('Admin - Revenue Analytics')
@ApiBearerAuth()
@Controller('admin/revenue')
export class RevenueAnalyticsController {
  constructor(private readonly revenueService: RevenueAnalyticsService) {}

  private requireSystemAdmin(req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System administrator access required');
    }
  }

  @Get('overview')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Revenue overview (MRR, ARR, tenant counts)' })
  async getOverview(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.revenueService.getRevenueOverview();
  }

  @Get('churn')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Churn analytics and at-risk tenants' })
  async getChurn(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.revenueService.getChurnAnalytics();
  }

  @Get('tenant-usage')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Tenant usage metrics' })
  @ApiQuery({ name: 'tenantId', required: false })
  async getTenantUsage(@Query('tenantId') tenantId: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    return this.revenueService.getTenantUsageMetrics(tenantId);
  }

  @Get('trial-conversion')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Trial conversion metrics' })
  async getTrialConversion(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.revenueService.getTrialConversionMetrics();
  }
}
