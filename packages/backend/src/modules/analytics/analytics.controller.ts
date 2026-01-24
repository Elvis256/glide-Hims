import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @Auth()
  @ApiOperation({ summary: 'Get executive dashboard KPIs' })
  async getExecutiveDashboard(@CurrentUser() user: any) {
    return this.analyticsService.getExecutiveDashboard(user.facilityId);
  }

  @Get('patients')
  @Auth()
  @ApiOperation({ summary: 'Get patient analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getPatientAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getPatientAnalytics(user.facilityId, period);
  }

  @Get('clinical')
  @Auth()
  @ApiOperation({ summary: 'Get clinical analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getClinicalAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getClinicalAnalytics(user.facilityId, period);
  }

  @Get('financial')
  @Auth()
  @ApiOperation({ summary: 'Get financial analytics' })
  @ApiQuery({ name: 'period', required: false, enum: ['day', 'week', 'month', 'year'] })
  async getFinancialAnalytics(
    @CurrentUser() user: any,
    @Query('period') period: 'day' | 'week' | 'month' | 'year' = 'month',
  ) {
    return this.analyticsService.getFinancialAnalytics(user.facilityId, period);
  }

  @Get('operational')
  @Auth()
  @ApiOperation({ summary: 'Get operational analytics' })
  async getOperationalAnalytics(@CurrentUser() user: any) {
    return this.analyticsService.getOperationalAnalytics(user.facilityId);
  }

  @Get('summary')
  @Auth()
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
}
