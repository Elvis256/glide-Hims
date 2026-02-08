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
    return this.analyticsService.getExecutiveDashboard(user.facilityId);
  }

  @Get('patients')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get patient analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getPatientAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getPatientAnalytics(user.facilityId, period);
  }

  @Get('clinical')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get clinical analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getClinicalAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getClinicalAnalytics(user.facilityId, period);
  }

  @Get('financial')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get financial analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getFinancialAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getFinancialAnalytics(user.facilityId, period);
  }

  @Get('operational')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get operational analytics' })
  async getOperationalAnalytics(@CurrentUser() user: any) {
    return this.analyticsService.getOperationalAnalytics(user.facilityId);
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
    return this.analyticsService.getRecentActivity(user.facilityId, limit || 10);
  }

  @Get('alerts')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get dashboard alerts' })
  async getDashboardAlerts(@CurrentUser() user: any) {
    return this.analyticsService.getDashboardAlerts(user.facilityId);
  }
}
