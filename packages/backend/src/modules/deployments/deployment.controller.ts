import { Controller, Get, Post, Put, Delete, Param, Body, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { Request } from 'express';
import { DeploymentService } from './deployment.service';
import { UpdateManagementService } from './update-management.service';
import { FeatureFlagService } from './feature-flag.service';
import { ReplicationService } from './replication.service';
import { MonitoringService } from './monitoring.service';
import { CreateDeploymentDto, UpdateDeploymentDto, ToggleFeatureFlagDto, ProvisionDeploymentDto } from './deployment.dto';

@Controller('deployments')
export class DeploymentController {
  constructor(
    private deploymentService: DeploymentService,
    private updateService: UpdateManagementService,
    private featureFlagService: FeatureFlagService,
    private replicationService: ReplicationService,
    private monitoringService: MonitoringService,
  ) {}

  private getTenantId(req: Request): string {
    return (req.user as any)?.tenantId || req.headers['x-tenant-id'] as string;
  }

  private isSystemAdmin(req: Request): boolean {
    return !!(req.user as any)?.isSystemAdmin;
  }

  // ============ DEPLOYMENT MANAGEMENT ============

  @Post()
  async createDeployment(@Req() req: Request, @Body() dto: any) {
    if (this.isSystemAdmin(req) && dto?.organizationName && !dto?.tenantId) {
      const provisionDto: ProvisionDeploymentDto = {
        organizationName: dto.organizationName,
        type: dto.type,
        tier: dto.tier,
        domain: dto.domain,
        maxUsers: typeof dto.maxUsers === 'string' ? parseInt(dto.maxUsers, 10) : dto.maxUsers,
        notes: dto.notes,
      };
      return this.deploymentService.provisionDeployment(provisionDto);
    }
    const tenantId = this.getTenantId(req);
    return this.deploymentService.createDeployment(tenantId, dto as CreateDeploymentDto);
  }

  @Get()
  async listDeployments(@Req() req: Request) {
    if (this.isSystemAdmin(req)) {
      return this.deploymentService.listAllDeployments();
    }
    const tenantId = this.getTenantId(req);
    return this.deploymentService.listDeployments(tenantId);
  }

  @Get(':deploymentId')
  async getDeployment(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.deploymentService.getDeployment(tenantId, deploymentId);
  }

  @Put(':deploymentId')
  async updateDeployment(@Req() req: Request, @Param('deploymentId') deploymentId: string, @Body() dto: UpdateDeploymentDto) {
    const tenantId = this.getTenantId(req);
    return this.deploymentService.updateDeployment(tenantId, deploymentId, dto);
  }

  @Delete(':deploymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDeployment(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.deploymentService.deleteDeployment(tenantId, deploymentId);
  }

  @Post(':deploymentId/activate/:versionId')
  async activateDeployment(@Req() req: Request, @Param('deploymentId') deploymentId: string, @Param('versionId') versionId: string) {
    const tenantId = this.getTenantId(req);
    return this.deploymentService.activateDeployment(tenantId, deploymentId, versionId);
  }

  @Get(':deploymentId/health')
  async getDeploymentHealth(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.deploymentService.getDeploymentHealth(tenantId, deploymentId);
  }

  // ============ UPDATE MANAGEMENT ============

  @Get('rollouts/:rolloutId/status')
  async getRolloutStatus(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    const tenantId = this.getTenantId(req);
    return this.updateService.getRolloutStatus(tenantId, rolloutId);
  }

  @Get('rollouts')
  async listRollouts() {
    return this.updateService.listRollouts();
  }

  @Post(':deploymentId/rollback')
  async rollbackDeployment(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.updateService.rollbackDeployment(tenantId, deploymentId);
  }

  // ============ FEATURE FLAGS ============

  @Post('features/toggle')
  async toggleFeature(@Req() req: Request, @Body() dto: ToggleFeatureFlagDto) {
    const tenantId = this.getTenantId(req);
    return this.featureFlagService.toggleFeature(tenantId, dto);
  }

  @Get('features')
  async getTenantFeatures(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.featureFlagService.getFeatures(tenantId);
  }

  // ============ REPLICATION ============

  @Get(':deploymentId/replication-status')
  async getReplicationStatus(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.replicationService.getReplicationStatus(tenantId, deploymentId);
  }

  @Get(':deploymentId/pending-changes')
  async getPendingChanges(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.replicationService.getPendingChanges(tenantId, deploymentId);
  }

  @Get('replication-history')
  async getReplicationHistory(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.replicationService.getReplicationHistory(tenantId);
  }

  // ============ MONITORING ============

  @Post(':deploymentId/health-metrics')
  async recordHealthMetrics(
    @Req() req: Request,
    @Param('deploymentId') deploymentId: string,
    @Body()
    dto: {
      cpuUsagePercent?: number;
      memoryUsagePercent?: number;
      diskUsagePercent?: number;
      uptime?: number;
      uptimePercentage?: number;
      errorRatePercent?: number;
    },
  ) {
    const tenantId = this.getTenantId(req);
    return this.monitoringService.recordHealthMetrics(tenantId, deploymentId, dto);
  }

  @Get(':deploymentId/status')
  async getDeploymentStatus(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.monitoringService.getDeploymentStatus(tenantId, deploymentId);
  }

  @Get(':deploymentId/health-history')
  async getHealthHistory(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.monitoringService.getHealthHistory(tenantId, deploymentId);
  }

  @Post(':deploymentId/alerts')
  async createAlert(
    @Req() req: Request,
    @Param('deploymentId') deploymentId: string,
    @Body() dto: { title: string; severity: string },
  ) {
    const tenantId = this.getTenantId(req);
    return this.monitoringService.createAlert(tenantId, deploymentId, dto.title, dto.severity as any);
  }

  @Get('alerts')
  async listAlerts(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.monitoringService.getAlerts(tenantId);
  }

  @Put('alerts/:alertId/resolve')
  async resolveAlert(@Req() req: Request, @Param('alertId') alertId: string) {
    const tenantId = this.getTenantId(req);
    return this.monitoringService.resolveAlert(tenantId, alertId);
  }
}
