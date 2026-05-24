import { Controller, Get, Post, Put, Delete, Param, Body, Req, Res, Query, HttpCode, HttpStatus, ForbiddenException, NotFoundException, BadRequestException, UseInterceptors, UploadedFile } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import { DeploymentService } from './deployment.service';
import { UpdateManagementService } from './update-management.service';
import { FeatureFlagService } from './feature-flag.service';
import { ReplicationService } from './replication.service';
import { MonitoringService } from './monitoring.service';
import { BackupService } from '../backup/backup.service';
import { Public } from '../auth/decorators/public.decorator';
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
    const isSysAdmin = this.isSystemAdmin(req);
    const isProvisioningRequest =
      dto?.type === 'hybrid' ||
      dto?.type === 'standalone' ||
      !!dto?.organizationName ||
      !!dto?.tier ||
      dto?.maxUsers != null ||
      !!dto?.domain;

    if (isSysAdmin && isProvisioningRequest) {
      const provisionDto: ProvisionDeploymentDto = {
        tenantId: dto.tenantId,
        organizationName: dto.organizationName,
        type: dto.type,
        tier: dto.tier,
        domain: dto.domain,
        maxUsers: typeof dto.maxUsers === 'string' ? parseInt(dto.maxUsers, 10) : dto.maxUsers,
        notes: dto.notes,
      };
      return this.deploymentService.provisionDeployment(provisionDto);
    }

    // For system admins, use the tenantId from the DTO if provided, otherwise fallback to their context.
    // This allows admins to create deployments for any tenant while maintaining security for regular users.
    const tenantId = (isSysAdmin && dto?.tenantId) ? dto.tenantId : this.getTenantId(req);
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

  @Put('rollouts/:rolloutId/advance')
  async advanceRolloutEndpoint(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.updateService.advanceRollout(rolloutId);
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

  /**
   * Per-instance update report (called by tenant agents, NOT by browsers).
   * Authenticated by `licenseKey` in the body — no user session required.
   * Throttled to prevent runaway agents from spamming the platform.
   */
  @Post('rollouts/:rolloutId/report')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async reportRolloutResult(
    @Req() req: Request,
    @Param('rolloutId') rolloutId: string,
    @Body()
    body: {
      licenseKey: string;
      hardwareId?: string;
      fromVersion?: string;
      toVersion?: string;
      status: 'started' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
      errorMessage?: string;
      metadata?: Record<string, any>;
    },
  ) {
    const ipAddress =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      undefined;
    return this.updateService.reportRolloutResult(rolloutId, {
      ...body,
      ipAddress,
    });
  }

  @Get('rollouts/:rolloutId/reports')
  async listRolloutReports(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.updateService.listRolloutReports(rolloutId);
  }

  @Get('rollouts/:rolloutId/summary')
  async getRolloutSummary(@Req() req: Request, @Param('rolloutId') rolloutId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.updateService.getRolloutSummary(rolloutId);
  }

  /**
   * License-gated source bundle for bootstrap installers. This avoids requiring
   * customer hosts to authenticate against the private GitHub repository.
   */
  @Get('source-bundle')
  @Public()
  async serveSourceBundle(
    @Query('licenseKey') licenseKey: string,
    @Res() res: Response,
  ) {
    await this.deploymentService.assertValidInstallerLicense(licenseKey);

    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
    const filename = `glide-hims-source-${new Date().toISOString().slice(0, 10)}.tar.gz`;
    const tar = spawn('tar', [
      '--exclude=./.git',
      '--exclude=./node_modules',
      '--exclude=./packages/*/node_modules',
      '--exclude=./packages/backend/dist',
      '--exclude=./packages/*/.env',
      '--exclude=./packages/backend/uploads*',
      '--exclude=./packages/backend/backups*',
      '--exclude=./packages/frontend/dist',
      '--exclude=./packages/*/coverage',
      '--exclude=./.env',
      '--exclude=./backups*',
      '--exclude=./coverage',
      '--exclude=./*.log',
      '--exclude=./deployment/dist',
      '--exclude=./wildcard.key',
      '--exclude=./wildcard.crt',
      '-czf',
      '-',
      '-C',
      projectRoot,
      '.',
    ], { stdio: ['ignore', 'pipe', 'pipe'] });

    res.setHeader('Content-Type', 'application/gzip');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');

    tar.stderr.on('data', (chunk) => {
      // eslint-disable-next-line no-console
      console.warn(`source-bundle tar: ${chunk.toString().trim()}`);
    });
    tar.on('error', (err) => {
      res.destroy(err);
    });
    tar.on('close', (code) => {
      if (code !== 0 && !res.destroyed) {
        res.destroy(new Error(`source bundle failed with exit code ${code}`));
      }
    });

    tar.stdout.pipe(res);
  }

  /**
   * Serve installer scripts (install-hybrid.sh / install-standalone.sh) from the
   * project root.  Public so that bootstrap scripts on fresh servers can fetch
   * them without authentication.
   */
  @Get('installers/:type')
  @Public()
  async serveInstallerScript(
    @Param('type') type: string,
    @Res() res: Response,
  ) {
    const allowed = ['hybrid', 'standalone'];
    if (!allowed.includes(type)) {
      throw new BadRequestException(`Unknown installer type "${type}". Allowed: ${allowed.join(', ')}`);
    }

    // Walk up from dist/modules/deployments → project root
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..', '..');
    const scriptPath = path.join(projectRoot, `install-${type}.sh`);

    if (!fs.existsSync(scriptPath)) {
      throw new NotFoundException(`Installer script install-${type}.sh not found on server`);
    }

    res.setHeader('Content-Type', 'application/x-sh');
    res.setHeader('Content-Disposition', `attachment; filename="install-${type}.sh"`);
    fs.createReadStream(scriptPath).pipe(res);
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

  @Get('snapshots/:snapshotId/restore-instructions')
  async getRestoreInstructions(
    @Req() req: Request,
    @Param('snapshotId') snapshotId: string,
  ) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol;
    const host = (req.headers['x-forwarded-host'] as string) || req.headers['host'];
    const baseUrl = `${proto}://${host}`;
    return this.backupService.getRestoreInstructions(snapshotId, baseUrl);
  }

  @Post('features/toggle')
  async toggleFeature(@Req() req: Request, @Body() dto: ToggleFeatureFlagDto) {
    const tenantId = this.isSystemAdmin(req) && dto.tenantId ? dto.tenantId : this.getTenantId(req);
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

  @Post(':deploymentId/request-poll')
  async requestPoll(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.deploymentService.requestHealthPoll(deploymentId);
  }

  @Post(':deploymentId/sync-from-license')
  async syncFromLicense(
    @Req() req: Request,
    @Param('deploymentId') deploymentId: string,
  ) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.deploymentService.syncMetadataFromLicense(deploymentId);
  }

  @Put(':deploymentId/notes')
  async updateNotes(
    @Req() req: Request,
    @Param('deploymentId') deploymentId: string,
    @Body() body: { notes?: string },
  ) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    return this.deploymentService.updateNotes(deploymentId, body?.notes ?? '');
  }

  @Get(':deploymentId/rollouts-history')
  async getRolloutsHistory(@Req() req: Request, @Param('deploymentId') deploymentId: string) {
    if (!this.isSystemAdmin(req)) throw new ForbiddenException('System admin access required');
    const detail = await this.deploymentService.getAdminDeploymentDetail(deploymentId);
    if (!detail.license?.id) return [];
    return this.updateService.listRolloutsForLicense(detail.license.id);
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
