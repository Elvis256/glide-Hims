import { Controller, ForbiddenException, Get, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ClientHealthService } from './client-health.service';

@ApiTags('Client Health')
@Controller('saas-revenue/client-health')
export class ClientHealthController {
  constructor(private readonly service: ClientHealthService) {}

  private assertAdmin(req: any) {
    if (!req.user?.isSystemAdmin) throw new ForbiddenException('System admin only');
  }

  @Get()
  @ApiOperation({ summary: 'List all client health scores' })
  async list(@Req() req: any) {
    this.assertAdmin(req);
    return this.service.listHealthScores();
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Health dashboard summary' })
  async dashboard(@Req() req: any) {
    this.assertAdmin(req);
    return this.service.getDashboard();
  }

  @Get(':tenantId')
  @ApiOperation({ summary: 'Get health score for a tenant' })
  async get(@Req() req: any, @Param('tenantId') tenantId: string) {
    this.assertAdmin(req);
    return this.service.getHealthScore(tenantId);
  }

  @Post('recalculate')
  @ApiOperation({ summary: 'Trigger recalculation of all health scores' })
  async recalculate(@Req() req: any) {
    this.assertAdmin(req);
    return this.service.recalculateAll();
  }
}
