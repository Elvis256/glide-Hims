import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';

@ApiTags('Mortality')
@ApiBearerAuth()
@RequireModule('reports')
@Controller('mortality')
export class MortalityController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('statistics')
  @AuthWithPermissions('analytics.read')
  @ApiOperation({ summary: 'Get mortality statistics' })
  @ApiQuery({ name: 'range', required: false, enum: ['week', 'month', 'quarter', 'year'] })
  async getMortalityStatistics(@Request() req: any, @Query('range') range: string = 'month') {
    return this.analyticsService.getMortalityStatistics(req.user?.tenantId, range);
  }
}
