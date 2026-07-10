import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { UsageMeterService, UsageCheckResponse, UsageReportResponse } from './usage-meter.service';
import {
  RecordUsageDto,
  CheckQuotaDto,
  SetQuotaDto,
  GetUsageReportDto,
  BillingUsageDto,
} from './dtos/usage-meter.dto';
import { CurrentUser } from '../../modules/auth/decorators/current-user.decorator';
import { CurrentTenant } from '../../common/decorators/current-tenant.decorator';
import { User } from '../../database/entities/user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { UsageAlert } from '../../database/entities/usage-meter.entity';

@ApiTags('SaaS - Usage Metering & Billing')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('saas/usage')
export class UsageMeterController {
  constructor(private usageMeterService: UsageMeterService) {}

  /**
   * Record a usage event for current tenant
   * Called from middleware or services when metered action occurs
   */
  @Post('record')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Record a usage event',
    description:
      'Log a usage event (API call, storage, SMS, etc.). Quota checks happen automatically.',
  })
  @ApiResponse({
    status: 201,
    description: 'Event recorded',
    schema: {
      example: {
        id: 'event-123',
        tenantId: 'tenant-456',
        metricType: 'api_calls',
        amount: 1,
        billable: true,
        eventSource: 'api_endpoint',
        createdAt: '2026-07-01T09:45:36Z',
      },
    },
  })
  @ApiResponse({
    status: 429,
    description: 'Quota exceeded (hard limit)',
  })
  async recordUsage(@CurrentTenant() tenantId: string, @Body() dto: RecordUsageDto) {
    return this.usageMeterService.recordUsage(
      tenantId,
      dto.metricType,
      dto.amount || 1,
      dto.billable !== false,
      dto.eventSource,
      dto.metadata,
    );
  }

  /**
   * Check current usage against quota for a metric
   */
  @Post('check-quota')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Check quota status for a metric',
    description: 'Returns current usage, limit, and usage percentage. Does not block requests.',
  })
  async checkQuota(
    @CurrentTenant() tenantId: string,
    @Body() dto: CheckQuotaDto,
  ): Promise<UsageCheckResponse> {
    return this.usageMeterService.checkQuota(tenantId, dto.metricType);
  }

  /**
   * Get usage report for tenant (dashboard view)
   */
  @Get('report')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get usage report for period',
    description: 'Returns usage metrics aggregated by day and month with quota information.',
  })
  async getUsageReport(
    @CurrentTenant() tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UsageReportResponse> {
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.usageMeterService.getTenantUsageReport(tenantId, start, end);
  }

  /**
   * Get current usage status for all metrics (summary view)
   */
  @Get('status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current usage status',
    description: 'Quick overview of usage vs quota for all enabled metrics.',
  })
  async getUsageStatus(@CurrentTenant() tenantId: string): Promise<
    Array<{
      metricType: string;
      currentUsage: number;
      limit?: number;
      usagePercentage: number;
      status: 'ok' | 'warning' | 'critical';
    }>
  > {
    const report = await this.usageMeterService.getTenantUsageReport(
      tenantId,
      new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      new Date(),
    );

    return report.metrics.map((m: any) => ({
      metricType: m.metricType,
      currentUsage: m.monthly || 0,
      limit: m.monthlyLimit,
      usagePercentage: Number(m.usagePercentage || 0),
      status:
        Number(m.usagePercentage || 0) >= 100
          ? 'critical'
          : Number(m.usagePercentage || 0) >= 80
            ? 'warning'
            : 'ok',
    }));
  }

  /**
   * ADMIN ONLY: Set quota for tenant
   * Usually called when updating plan or custom limits
   */
  @Post('quota/set')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN ONLY] Set quota for tenant',
    description: 'Configure usage limits. Called during plan upgrade/downgrade.',
  })
  async setQuota(
    @CurrentUser() user: User,
    @CurrentTenant() tenantId: string,
    @Body() dto: SetQuotaDto,
  ) {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can set quotas');
    }

    return this.usageMeterService.setQuota(
      tenantId,
      dto.metricType,
      dto.limitMonthly,
      dto.limitDaily,
      dto.hardLimit,
      dto.alertThresholdPct,
    );
  }

  /**
   * Get active alerts for tenant
   */
  @Get('alerts')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get active quota alerts',
    description: 'List unresolved alerts where usage exceeded threshold.',
  })
  async getActiveAlerts(@CurrentTenant() tenantId: string): Promise<UsageAlert[]> {
    return this.usageMeterService.getActiveAlerts(tenantId);
  }

  /**
   * Acknowledge an alert (dismiss)
   */
  @Post('alerts/:alertId/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge an alert',
    description: 'Mark alert as acknowledged but not resolved.',
  })
  async acknowledgeAlert(
    @CurrentTenant() tenantId: string,
    @Param('alertId') alertId: string,
  ): Promise<UsageAlert> {
    return this.usageMeterService.acknowledgeAlert(alertId);
  }

  /**
   * Resolve an alert (close it)
   */
  @Post('alerts/:alertId/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve an alert',
    description: 'Mark alert as resolved and remove from active list.',
  })
  async resolveAlert(
    @CurrentTenant() tenantId: string,
    @Param('alertId') alertId: string,
  ): Promise<UsageAlert> {
    return this.usageMeterService.resolveAlert(alertId);
  }

  /**
   * Get billing-ready usage summary for invoicing
   */
  @Post('billing/usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get usage for billing period',
    description: 'Returns billable usage by metric type for invoice generation.',
  })
  async getBillingUsage(
    @CurrentTenant() tenantId: string,
    @Body() dto: BillingUsageDto,
  ): Promise<Array<{ metricType: string; totalAmount: number; unitPrice?: number }>> {
    const start = new Date(dto.periodStart);
    const end = new Date(dto.periodEnd);

    if (start >= end) {
      throw new BadRequestException('periodStart must be before periodEnd');
    }

    return this.usageMeterService.getBillingUsage(tenantId, start, end);
  }

  /**
   * ADMIN ONLY: Get usage for any tenant
   */
  @Get('admin/report/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN ONLY] Get usage report for tenant',
    description: 'View usage metrics for any tenant.',
  })
  async getAdminTenantReport(
    @CurrentUser() user: User,
    @Param('tenantId') tenantId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<UsageReportResponse> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can view other tenant usage');
    }

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const end = endDate ? new Date(endDate) : new Date();

    if (start >= end) {
      throw new BadRequestException('startDate must be before endDate');
    }

    return this.usageMeterService.getTenantUsageReport(tenantId, start, end);
  }

  /**
   * ADMIN ONLY: Get alerts for any tenant
   */
  @Get('admin/alerts/:tenantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '[ADMIN ONLY] Get alerts for tenant',
    description: 'View quota alerts for any tenant.',
  })
  async getAdminTenantAlerts(
    @CurrentUser() user: User,
    @Param('tenantId') tenantId: string,
  ): Promise<UsageAlert[]> {
    if (!user.isSystemAdmin) {
      throw new BadRequestException('Only system admins can view other tenant alerts');
    }

    return this.usageMeterService.getActiveAlerts(tenantId);
  }
}
