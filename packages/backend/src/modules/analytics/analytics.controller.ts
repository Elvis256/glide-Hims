import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

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
    return this.analyticsService.getSummaryReport(
      user.facilityId,
      new Date(startDate),
      new Date(endDate),
      user.tenantId,
    );
  }

  @Get('recent-activity')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get recent activity for dashboard' })
  @ApiQuery({ name: 'limit', required: false })
  async getRecentActivity(
    @CurrentUser() user: any,
    @Query('limit') limit?: number,
  ) {
    return this.analyticsService.getRecentActivity(user.facilityId, limit || 10, user.tenantId);
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
  @ApiQuery({ name: 'facilityId', required: false, description: 'Facility UUID (defaults to user facility)' })
  @ApiQuery({ name: 'month', required: true, description: 'Report month (1-12)' })
  @ApiQuery({ name: 'year', required: true, description: 'Report year' })
  async getHMIS105Report(
    @CurrentUser() user: any,
    @Query('facilityId') facilityId?: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    return this.analyticsService.getHMIS105Report(
      user.tenantId,
      facilityId || user.facilityId,
      parseInt(month || '0', 10),
      parseInt(year || '0', 10),
    );
  }
}
