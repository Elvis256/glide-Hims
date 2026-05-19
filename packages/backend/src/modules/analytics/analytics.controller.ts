import {
  Controller,
  ForbiddenException,
  Get,
  Logger,
  Query,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('admin-dashboard')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({
    summary:
      'Admin dashboard analytics. Cross-tenant aggregation requires system-admin; tenant users only see their own tenant.',
  })
  async getAdminDashboard(@Request() req: any) {
    // F-10: only system admins may view cross-tenant aggregates. For tenant
    // users we require a tenant context, falling back to the JWT tenantId.
    const user = req.user;
    if (!user?.tenantId) {
      if (!user?.isSystemAdmin) {
        throw new ForbiddenException(
          'Tenant context required for admin dashboard analytics',
        );
      }
      this.logger.warn(
        JSON.stringify({
          type: 'CROSS_TENANT_ANALYTICS_ACCESS',
          userId: user?.id,
          username: user?.username,
          path: req.url,
        }),
      );
    }
    return this.analyticsService.getAdminDashboard(user.tenantId);
  }

  @Get('dashboard')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get executive dashboard KPIs' })
  async getExecutiveDashboard(@CurrentUser() user: any) {
    return this.analyticsService.getExecutiveDashboard(user.facilityId, user.tenantId);
  }

  @Get('patients')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get patient analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getPatientAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getPatientAnalytics(user.facilityId, period, user.tenantId);
  }

  @Get('clinical')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get clinical analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getClinicalAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getClinicalAnalytics(user.facilityId, period, user.tenantId);
  }

  @Get('financial')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get financial analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getFinancialAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getFinancialAnalytics(user.facilityId, period, user.tenantId);
  }

  @Get('operational')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get operational analytics' })
  async getOperationalAnalytics(@CurrentUser() user: any) {
    return this.analyticsService.getOperationalAnalytics(user.facilityId, user.tenantId);
  }

  @Get('summary')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get summary report for date range' })
  @ApiQuery({ name: 'startDate', required: true })
  @ApiQuery({ name: 'endDate', required: true })
  async getSummaryReport(
    @CurrentUser() user: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Invalid date format for startDate or endDate');
    }
    return this.analyticsService.getSummaryReport(user.facilityId, start, end, user.tenantId);
  }

  @Get('recent-activity')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get recent activity for dashboard' })
  @ApiQuery({ name: 'limit', required: false })
  async getRecentActivity(
    @CurrentUser() user: any,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    return this.analyticsService.getRecentActivity(user.facilityId, safeLimit, user.tenantId);
  }

  @Get('alerts')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get dashboard alerts' })
  async getDashboardAlerts(@CurrentUser() user: any) {
    return this.analyticsService.getDashboardAlerts(user.facilityId, user.tenantId);
  }

  @Get('hmis-105')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'HMIS 105 - Uganda Monthly OPD Summary Report' })
  @ApiQuery({
    name: 'facilityId',
    required: false,
    description: 'Facility UUID (defaults to user facility)',
  })
  @ApiQuery({ name: 'month', required: true, description: 'Report month (1-12)' })
  @ApiQuery({ name: 'year', required: true, description: 'Report year' })
  async getHMIS105Report(
    @CurrentUser() user: any,
    @Query('facilityId') facilityId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const m = parseInt(month || '0', 10);
    const y = parseInt(year || '0', 10);
    if (m < 1 || m > 12 || y < 2000 || y > 2100) {
      throw new BadRequestException('month must be 1-12 and year must be 2000-2100');
    }
    return this.analyticsService.getHMIS105Report(
      user.tenantId,
      facilityId || user.facilityId,
      m,
      y,
    );
  }
}
