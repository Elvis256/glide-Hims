import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { SystemHealthService } from '../services/system-health.service';

@ApiTags('Admin - System Health & Monitoring')
@ApiBearerAuth()
@Controller('admin/system-health')
@UseGuards(AdminGuard)
export class SystemHealthController {
  constructor(private readonly systemHealthService: SystemHealthService) {}

  // ---------------------------------------------------------------------------
  // Metrics
  // ---------------------------------------------------------------------------

  @Get('metrics')
  @ApiOperation({ summary: 'Get current system metrics' })
  @ApiQuery({ name: 'hours', required: false, description: 'Lookback hours (default: 1)' })
  async getMetrics(@Query('hours') hours?: number) {
    const data = await this.systemHealthService.getSystemMetrics(
      hours ? Math.min(Number(hours), 168) : 1,
    );
    return { statusCode: 200, data };
  }

  @Get('metrics/history')
  @ApiOperation({ summary: 'Get metric time series history' })
  @ApiQuery({ name: 'metricType', required: true, description: 'Metric type (cpu, memory, disk, db_connections, api_latency, active_users, tenant_count)' })
  @ApiQuery({ name: 'hours', required: false, description: 'Lookback hours (default: 24)' })
  async getMetricHistory(
    @Query('metricType') metricType: string,
    @Query('hours') hours?: number,
  ) {
    if (!metricType) {
      throw new BadRequestException('metricType query parameter is required');
    }

    const validTypes = ['cpu', 'memory', 'disk', 'db_connections', 'api_latency', 'active_users', 'tenant_count'];
    if (!validTypes.includes(metricType)) {
      throw new BadRequestException(`Invalid metricType. Valid types: ${validTypes.join(', ')}`);
    }

    const data = await this.systemHealthService.getMetricHistory(
      metricType,
      hours ? Math.min(Number(hours), 168) : 24,
    );
    return {
      statusCode: 200,
      data,
      meta: { metricType, hours: hours ? Number(hours) : 24, count: data.length },
    };
  }

  // ---------------------------------------------------------------------------
  // Tenant Usage
  // ---------------------------------------------------------------------------

  @Get('tenant-usage')
  @ApiOperation({ summary: 'Get per-tenant resource usage summary' })
  async getTenantUsage() {
    const data = await this.systemHealthService.getTenantResourceUsage();
    return { statusCode: 200, data };
  }

  @Get('tenant-usage/:tenantId')
  @ApiOperation({ summary: 'Get resource usage for a single tenant' })
  async getTenantUsageById(@Param('tenantId') tenantId: string) {
    const data = await this.systemHealthService.getTenantResourceUsage(tenantId);
    if (data?.error === 'Tenant not found') {
      throw new NotFoundException('Tenant not found');
    }
    return { statusCode: 200, data };
  }

  // ---------------------------------------------------------------------------
  // Alerts
  // ---------------------------------------------------------------------------

  @Get('alerts')
  @ApiOperation({ summary: 'List system alerts' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by status (open, acknowledged, resolved)' })
  @ApiQuery({ name: 'severity', required: false, description: 'Filter by severity (critical, high, medium, low, info)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max results (default: 50)' })
  @ApiQuery({ name: 'offset', required: false, description: 'Offset for pagination' })
  async getAlerts(
    @Query('status') status?: string,
    @Query('severity') severity?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const result = await this.systemHealthService.getAlerts({
      status,
      severity,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
    return {
      statusCode: 200,
      data: result.data,
      meta: { total: result.total, limit: limit ? Number(limit) : 50, offset: offset ? Number(offset) : 0 },
    };
  }

  @Post('alerts/:id/acknowledge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge a system alert' })
  async acknowledgeAlert(@Param('id') id: string, @Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId || 'system';
      const data = await this.systemHealthService.acknowledgeAlert(id, userId);
      return { statusCode: 200, data, message: 'Alert acknowledged' };
    } catch (err) {
      if ((err as Error).message === 'Alert not found') {
        throw new NotFoundException('Alert not found');
      }
      throw new BadRequestException((err as Error).message);
    }
  }

  @Post('alerts/:id/resolve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resolve a system alert' })
  async resolveAlert(@Param('id') id: string, @Request() req: any) {
    try {
      const userId = req.user?.id || req.user?.userId || 'system';
      const data = await this.systemHealthService.resolveAlert(id, userId);
      return { statusCode: 200, data, message: 'Alert resolved' };
    } catch (err) {
      if ((err as Error).message === 'Alert not found') {
        throw new NotFoundException('Alert not found');
      }
      throw new BadRequestException((err as Error).message);
    }
  }

  // ---------------------------------------------------------------------------
  // Alert Rules
  // ---------------------------------------------------------------------------

  @Get('alert-rules')
  @ApiOperation({ summary: 'List alert rules' })
  async getAlertRules() {
    const data = await this.systemHealthService.getAlertRules();
    return { statusCode: 200, data };
  }

  @Post('alert-rules')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new alert rule' })
  async createAlertRule(@Body() body: any) {
    this.validateAlertRuleBody(body);
    const data = await this.systemHealthService.createAlertRule({
      name: body.name,
      metricType: body.metricType,
      operator: body.operator,
      threshold: body.threshold,
      severity: body.severity || 'medium',
      enabled: body.enabled !== undefined ? body.enabled : true,
      cooldownMinutes: body.cooldownMinutes || 60,
      notifyChannels: body.notifyChannels || ['in_app'],
    });
    return { statusCode: 201, data, message: 'Alert rule created' };
  }

  @Patch('alert-rules/:id')
  @ApiOperation({ summary: 'Update an alert rule' })
  async updateAlertRule(@Param('id') id: string, @Body() body: any) {
    try {
      const data = await this.systemHealthService.updateAlertRule(id, body);
      return { statusCode: 200, data, message: 'Alert rule updated' };
    } catch (err) {
      if ((err as Error).message === 'Alert rule not found') {
        throw new NotFoundException('Alert rule not found');
      }
      throw new BadRequestException((err as Error).message);
    }
  }

  @Delete('alert-rules/:id')
  @ApiOperation({ summary: 'Delete an alert rule' })
  async deleteAlertRule(@Param('id') id: string) {
    try {
      await this.systemHealthService.deleteAlertRule(id);
      return { statusCode: 200, message: 'Alert rule deleted' };
    } catch (err) {
      if ((err as Error).message === 'Alert rule not found') {
        throw new NotFoundException('Alert rule not found');
      }
      throw new BadRequestException((err as Error).message);
    }
  }

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  private validateAlertRuleBody(body: any): void {
    if (!body.name || typeof body.name !== 'string') {
      throw new BadRequestException('name is required and must be a string');
    }

    const validMetricTypes = ['cpu', 'memory', 'disk', 'db_connections', 'api_latency', 'active_users', 'tenant_count'];
    if (!body.metricType || !validMetricTypes.includes(body.metricType)) {
      throw new BadRequestException(`metricType is required and must be one of: ${validMetricTypes.join(', ')}`);
    }

    const validOperators = ['gt', 'lt', 'gte', 'lte', 'eq'];
    if (!body.operator || !validOperators.includes(body.operator)) {
      throw new BadRequestException(`operator is required and must be one of: ${validOperators.join(', ')}`);
    }

    if (body.threshold === undefined || body.threshold === null || typeof body.threshold !== 'number') {
      throw new BadRequestException('threshold is required and must be a number');
    }

    const validSeverities = ['critical', 'high', 'medium', 'low'];
    if (body.severity && !validSeverities.includes(body.severity)) {
      throw new BadRequestException(`severity must be one of: ${validSeverities.join(', ')}`);
    }
  }
}
