import { Controller, Get, Post, Put, Delete, Param, Body, Req, Res, HttpCode, HttpStatus, ForbiddenException, NotFoundException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import { DeploymentService } from './deployment.service';
import { UpdateManagementService } from './update-management.service';
import { FeatureFlagService } from './feature-flag.service';
import { ReplicationService } from './replication.service';
import { MonitoringService } from './monitoring.service';
import { BackupService } from '../backup/backup.service';
import { CreateDeploymentDto, UpdateDeploymentDto, ToggleFeatureFlagDto, ProvisionDeploymentDto, CreateUpdateRolloutDto } from './deployment.dto';

@Controller('deployments')
export class DeploymentController {
  constructor(
    private deploymentService: DeploymentService,
    private updateService: UpdateManagementService,
    private featureFlagService: FeatureFlagService,
    private replicationService: ReplicationService,
    private monitoringService: MonitoringService,
    private backupService: BackupService,
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

  // ============ STATIC-PREFIX ROUTES ============
  // These MUST be declared before the `:deploymentId` parametric routes
  // below, otherwise Express matches e.g. /deployments/rollouts against
  // `:deploymentId` and the service tries to look up a deployment whose
  // id is the literal string "rollouts" (UUID parse error → 500).

  @Get('rollouts')
  async listRollouts() {
    return this.updateService.listRollouts();
  }

  @Post('rollouts')
  async createRolloutEndpoint(@Req() req: Request, @Body() dto: CreateUpdateRolloutDto) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    if (!dto.appVersionId && !dto.version) {
      throw new NotFoundException('appVersionId or version is required');
    }
    return this.updateService.createRollout({
      appVersionId: dto.appVersionId,
      versionString: dto.version,
      strategy: dto.strategy,
      startDate: dto.startDate,
      endDate: dto.endDate,
      autoRollbackOnError: dto.autoRollbackOnError,
      errorThresholdPercentage: dto.errorThresholdPercentage,
      notes: dto.notes,
      actorUserId: (req.user as any)?.id,
      triggeredBy: 'manual',
    });
  }

  @Get('rollouts/:rolloutId/status')
  async getRolloutStatus(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    const tenantId = this.getTenantId(req);
    return this.updateService.getRolloutStatus(tenantId, rolloutId);
  }

  @Put('rollouts/:rolloutId/pause')
  async pauseRollout(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.updateService.pauseRollout(rolloutId);
  }

  @Put('rollouts/:rolloutId/resume')
  async resumeRollout(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.updateService.resumeRollout(rolloutId);
  }

  @Put('rollouts/:rolloutId/cancel')
  async cancelRollout(
    @Req() req: Request,
    @Param('rolloutId') rolloutId: string,
    @Body() body: { reason?: string },
  ) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.updateService.cancelRollout(rolloutId, body?.reason);
  }

  @Get('snapshots/:snapshotId/download')
  async downloadSnapshot(
    @Req() req: Request,
    @Param('snapshotId') snapshotId: string,
    @Res() res: Response,
  ) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    const backup = await this.backupService.findById(snapshotId);
    if (!backup || !fs.existsSync(backup.filePath)) {
      throw new NotFoundException('Snapshot file not found');
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${backup.filename}"`);
    fs.createReadStream(backup.filePath).pipe(res);
  }

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

  @Get('replication-history')
  async getReplicationHistory(@Req() req: Request) {
    const tenantId = this.getTenantId(req);
    return this.replicationService.getReplicationHistory(tenantId);
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

  @Get(':deploymentId/detail')
  async getDeploymentDetail(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    if (!this.isSystemAdmin(req)) {
      throw new ForbiddenException('System admin access required');
    }
    const detail = await this.deploymentService.getAdminDeploymentDetail(deploymentId);
    const [history, alerts] = await Promise.all([
      this.monitoringService.getHealthHistory(detail.tenantId, deploymentId, 50),
      this.monitoringService.getAlerts(detail.tenantId, deploymentId),
    ]);
    return {
      deployment: detail,
      health: {
        latest: history[0] || null,
        history,
      },
      alerts,
    };
  }

  @Get(':deploymentId/installer-bundle')
  async downloadInstallerBundle(
    @Req() req: Request,
    @Param('deploymentId') deploymentId: string,
    @Res() res: Response,
  ) {
    if (!this.isSystemAdmin(req)) {
      throw new ForbiddenException('System admin access required');
    }
    const bundle = await this.deploymentService.generateInstallerBundle(deploymentId);
    res.setHeader('Content-Type', bundle.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${bundle.filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(bundle.content);
  }

  // ============ UPDATE MANAGEMENT ============
  // (rollout list/status/pause/resume/cancel routes are declared above
  // the `:deploymentId` parametric routes — see "STATIC-PREFIX ROUTES"
  // section near the top of this controller.)

  @Post(':deploymentId/rollback')
  async rollbackDeployment(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    const tenantId = this.getTenantId(req);
    return this.updateService.rollbackDeployment(tenantId, deploymentId);
  }

  @Post(':deploymentId/test-connectivity')
  async testConnectivity(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.deploymentService.testConnectivity(deploymentId);
  }

  // ============ STANDALONE SNAPSHOT IMPORT ============

  @Get(':deploymentId/snapshots')
  async listSnapshots(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    const detail = await this.deploymentService.getAdminDeploymentDetail(deploymentId);
    return this.backupService.listSnapshotsForTenant(detail.tenantId);
  }

  @Post(':deploymentId/snapshots')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSnapshot(
    @Req() req: Request,
    @Param('deploymentId') deploymentId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { notes?: string },
  ) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    if (!file) throw new NotFoundException('No file provided');
    const detail = await this.deploymentService.getAdminDeploymentDetail(deploymentId);
    return this.backupService.importSnapshot({
      tenantId: detail.tenantId,
      deploymentId,
      file,
      uploadedBy: (req.user as any)?.id,
      notes: body?.notes,
    });
  }

  // ============ STANDALONE SNAPSHOT IMPORT ============
  // (snapshots/:snapshotId/download is declared in the STATIC-PREFIX
  // ROUTES section above the `:deploymentId` parametric routes.)

  // ============ FEATURE FLAGS ============
  // (toggle + list routes are declared in the STATIC-PREFIX ROUTES section above)

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

  // (replication-history is declared in the STATIC-PREFIX ROUTES section above)

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

  // (alerts list + resolve are declared in the STATIC-PREFIX ROUTES section above)
}
