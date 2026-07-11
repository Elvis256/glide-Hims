import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { RequireModule } from '../auth/decorators/module.decorator';
import { AcknowledgeCriticalResultDto, CriticalResultsService } from './critical-results.service';

interface AuthenticatedRequest extends Request {
  user?: { id: string; tenantId?: string; facilityId?: string; roles?: string[]; permissions?: string[]; isSystemAdmin?: boolean; };
}


@ApiTags('critical-results')
@RequireModule('diagnostics')
@Controller('critical-results')
export class CriticalResultsController {
  constructor(private readonly svc: CriticalResultsService) {}

  @Get()
  @AuthWithPermissions('critical-results.read')
  @ApiOperation({ summary: 'List critical-result alerts (filterable)' })
  list(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
    @Query('assignedToMe') assignedToMe?: string,
    @Query('flaggedByMe') flaggedByMe?: string,
    @Query('resourceType') resourceType?: 'lab' | 'radiology',
    @Query('patientId') patientId?: string,
    @Query('limit') limit?: string,
  ) {
    const user = req.user!;
    return this.svc.list({
      tenantId: user.tenantId,
      status,
      assignedToId: assignedToMe === 'true' ? user.id : undefined,
      flaggedById: flaggedByMe === 'true' ? user.id : undefined,
      resourceType,
      patientId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('stats')
  @AuthWithPermissions('critical-results.read')
  @ApiOperation({ summary: 'Aggregate stats (for Lab/Radiology dashboards)' })
  stats(
    @Req() req: AuthenticatedRequest,
    @Query('flaggedByMe') flaggedByMe?: string,
    @Query('resourceType') resourceType?: 'lab' | 'radiology',
    @Query('sinceDays') sinceDays?: string,
  ) {
    const user = req.user!;
    return this.svc.stats({
      tenantId: user.tenantId,
      flaggedById: flaggedByMe === 'true' ? user.id : undefined,
      resourceType,
      sinceDays: sinceDays ? parseInt(sinceDays, 10) : 30,
    });
  }

  @Get('count')
  @AuthWithPermissions('critical-results.read')
  @ApiOperation({ summary: 'Pending critical-result count (for badge)' })
  async count(@Req() req: AuthenticatedRequest, @Query('assignedToMe') assignedToMe?: string) {
    const user = req.user!;
    const total = await this.svc.countPending(user.tenantId);
    const mine = await this.svc.countPending(
      user.tenantId,
      assignedToMe === 'true' ? user.id : undefined,
    );
    return { total, mine };
  }

  @Get(':id')
  @AuthWithPermissions('critical-results.read')
  @ApiOperation({ summary: 'Get a critical-result alert by id' })
  getOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    const user = req.user!;
    return this.svc.getById(id, user.tenantId);
  }

  @Post(':id/acknowledge')
  @AuthWithPermissions('critical-results.acknowledge')
  @ApiOperation({ summary: 'Acknowledge a critical result with note + action' })
  acknowledge(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AcknowledgeCriticalResultDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user!;
    return this.svc.acknowledge(id, user.id, body, user.tenantId);
  }

  @Post(':id/cancel')
  @AuthWithPermissions('critical-results.acknowledge')
  @ApiOperation({ summary: 'Cancel a critical-result alert (e.g., result amended away)' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    const user = req.user!;
    return this.svc.cancel(id, user.tenantId);
  }
}
