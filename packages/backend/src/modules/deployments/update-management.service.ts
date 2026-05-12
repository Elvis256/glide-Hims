import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import {
  UpdateRollout,
  UpdateRolloutStatus,
  UpdateRolloutPhase,
} from '../../database/entities/update-rollout.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { Deployment, DeploymentStatus } from '../../database/entities/deployment.entity';
import {
  ReleaseCandidate,
  ReleaseCandidateStage,
} from '../../database/entities/release-candidate.entity';
import { AppVersion } from '../../database/entities/app-version.entity';
import {
  DeploymentReport,
  DeploymentReportStatus,
} from '../../database/entities/deployment-report.entity';
import { License } from '../../database/entities/license.entity';
import { CreateUpdateRolloutDto } from './deployment.dto';

@Injectable()
export class UpdateManagementService {
  private readonly logger = new Logger(UpdateManagementService.name);

  constructor(
    @InjectRepository(UpdateRollout)
    private rolloutRepository: Repository<UpdateRollout>,
    @InjectRepository(DeploymentVersion)
    private versionRepository: Repository<DeploymentVersion>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    @InjectRepository(ReleaseCandidate)
    private rcRepository: Repository<ReleaseCandidate>,
    @InjectRepository(AppVersion)
    private appVersionRepository: Repository<AppVersion>,
    @InjectRepository(DeploymentReport)
    private reportRepository: Repository<DeploymentReport>,
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
  ) {}

  async getRolloutStatus(tenantId: string, rolloutId: string): Promise<any> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
      relations: ['releaseCandidate'],
    });

    if (!rollout) {
      throw new NotFoundException('Rollout not found');
    }

    return {
      id: rollout.id,
      status: rollout.status,
      currentPhase: rollout.currentPhase,
      releaseCandidate: rollout.releaseCandidate,
      startDate: rollout.startDate,
      endDate: rollout.endDate,
      progress: this.calculateProgress(rollout),
    };
  }

  async listRollouts(): Promise<any[]> {
    return this.rolloutRepository.find({
      order: { createdAt: 'DESC' },
    });
  }

  async pauseRollout(rolloutId: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) throw new NotFoundException('Rollout not found');
    if (rollout.status !== UpdateRolloutStatus.IN_PROGRESS && rollout.status !== UpdateRolloutStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot pause a rollout in status "${rollout.status}"`);
    }
    rollout.status = UpdateRolloutStatus.PAUSED;
    return this.rolloutRepository.save(rollout);
  }

  async resumeRollout(rolloutId: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) throw new NotFoundException('Rollout not found');
    if (rollout.status !== UpdateRolloutStatus.PAUSED) {
      throw new BadRequestException(`Cannot resume a rollout in status "${rollout.status}"`);
    }
    rollout.status = UpdateRolloutStatus.IN_PROGRESS;
    return this.rolloutRepository.save(rollout);
  }

  async advanceRollout(rolloutId: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) throw new NotFoundException('Rollout not found');
    if (rollout.status !== UpdateRolloutStatus.IN_PROGRESS) {
      throw new BadRequestException(`Cannot advance a rollout in status "${rollout.status}"`);
    }
    if (rollout.currentPhase === UpdateRolloutPhase.PHASE_1) {
      rollout.currentPhase = UpdateRolloutPhase.PHASE_2;
    } else if (rollout.currentPhase === UpdateRolloutPhase.PHASE_2) {
      rollout.currentPhase = UpdateRolloutPhase.PHASE_3;
    } else {
      rollout.status = UpdateRolloutStatus.COMPLETED;
      rollout.endDate = new Date();
    }
    rollout.metadata = {
      ...(rollout.metadata || {}),
      lastAdvancedAt: new Date().toISOString(),
      phaseStartedAt: new Date().toISOString(),
    };
    return this.rolloutRepository.save(rollout);
  }

  async cancelRollout(rolloutId: string, reason?: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) throw new NotFoundException('Rollout not found');
    if (rollout.status === UpdateRolloutStatus.COMPLETED || rollout.status === UpdateRolloutStatus.ROLLED_BACK) {
      throw new BadRequestException(`Rollout already finalized (${rollout.status})`);
    }
    rollout.status = UpdateRolloutStatus.ROLLED_BACK;
    rollout.rolledBackAt = new Date();
    rollout.rollbackReason = { reason: reason || 'cancelled by admin', cancelledAt: new Date().toISOString() };
    return this.rolloutRepository.save(rollout);
  }

  async rollbackDeployment(tenantId: string, deploymentId: string): Promise<any> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    // Get previous version
    const versions = await this.versionRepository.find({
      where: { deploymentId },
      order: { createdAt: 'DESC' },
      take: 2,
    });

    if (versions.length < 2) {
      throw new BadRequestException('No previous version to rollback to');
    }

    const previousVersion = versions[1];

    // Update deployment to previous version
    deployment.currentVersion = previousVersion.id;
    await this.deploymentRepository.save(deployment);

    return {
      deploymentId,
      previousVersionId: previousVersion.id,
      success: true,
    };
  }

  // ============ ROLLOUT CREATION ============

  async createRollout(input: {
    appVersionId?: string;
    versionString?: string;
    strategy: 'immediate' | 'scheduled' | 'gradual';
    startDate?: string | Date;
    endDate?: string | Date;
    autoRollbackOnError?: boolean;
    errorThresholdPercentage?: number;
    notes?: string;
    actorUserId?: string;
    triggeredBy?: 'manual' | 'auto-publish';
  }): Promise<UpdateRollout> {
    const appVersion = input.appVersionId
      ? await this.appVersionRepository.findOne({ where: { id: input.appVersionId } })
      : input.versionString
        ? await this.appVersionRepository.findOne({ where: { version: input.versionString } })
        : null;

    if (!appVersion) {
      throw new NotFoundException(
        `App version not found (id=${input.appVersionId ?? '-'}, version=${input.versionString ?? '-'})`,
      );
    }

    let rc = await this.rcRepository.findOne({
      where: { appVersionId: appVersion.id },
      order: { createdAt: 'DESC' },
    });

    if (!rc) {
      const newRc = this.rcRepository.create({
        appVersionId: appVersion.id,
        appVersion,
        stage: ReleaseCandidateStage.STABLE,
        approvedForRollout: true,
        approvedBy: input.actorUserId ?? undefined,
        approvedAt: new Date(),
        releaseNotes: appVersion.releaseNotes,
      } as Partial<ReleaseCandidate>);
      rc = await this.rcRepository.save(newRc);
    } else if (!rc.approvedForRollout) {
      rc.approvedForRollout = true;
      if (input.actorUserId) rc.approvedBy = input.actorUserId;
      rc.approvedAt = new Date();
      rc = await this.rcRepository.save(rc);
    }

    const totalDeployments = await this.deploymentRepository.count({
      where: { status: DeploymentStatus.ACTIVE },
    });

    const now = new Date();
    let startDate = input.startDate ? new Date(input.startDate) : now;
    let status: UpdateRolloutStatus =
      startDate.getTime() > now.getTime()
        ? UpdateRolloutStatus.SCHEDULED
        : UpdateRolloutStatus.IN_PROGRESS;

    let phase1 = 10;
    let phase2 = 50;
    let phase3 = 100;

    if (input.strategy === 'immediate') {
      phase1 = 100;
      phase2 = 100;
      phase3 = 100;
      startDate = now;
      status = UpdateRolloutStatus.IN_PROGRESS;
    } else if (input.strategy === 'scheduled') {
      if (!input.startDate) {
        throw new BadRequestException('startDate is required for scheduled rollouts');
      }
    }

    const rcEntity = rc!;
    const rollout = this.rolloutRepository.create({
      releaseCandidateId: rcEntity.id,
      releaseCandidate: rcEntity,
      status,
      currentPhase: UpdateRolloutPhase.PHASE_1,
      startDate,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      phase1PercentageTarget: phase1,
      phase2PercentageTarget: phase2,
      phase3PercentageTarget: phase3,
      errorThresholdPercentage: input.errorThresholdPercentage ?? 5,
      autoRollbackOnError: input.autoRollbackOnError ?? false,
      deploymentsTotalCount: totalDeployments,
      metadata: {
        strategy: input.strategy,
        notes: input.notes,
        triggeredBy: input.triggeredBy ?? 'manual',
        appVersion: appVersion.version,
        actorUserId: input.actorUserId,
      },
    });

    const saved = await this.rolloutRepository.save(rollout);
    this.logger.log(
      `Rollout ${saved.id} created for v${appVersion.version} (${input.strategy}, ${totalDeployments} deployments, ${input.triggeredBy ?? 'manual'})`,
    );
    return saved;
  }

  @OnEvent('app-version.published', { async: true })
  async handleAppVersionPublished(payload: {
    appVersionId: string;
    version: string;
    actorUserId?: string;
  }) {
    try {
      const existing = await this.rolloutRepository
        .createQueryBuilder('r')
        .innerJoin('r.releaseCandidate', 'rc')
        .where('rc.app_version_id = :avid', { avid: payload.appVersionId })
        .andWhere('r.status IN (:...statuses)', {
          statuses: [
            UpdateRolloutStatus.SCHEDULED,
            UpdateRolloutStatus.IN_PROGRESS,
            UpdateRolloutStatus.PAUSED,
            UpdateRolloutStatus.COMPLETED,
          ],
        })
        .getCount();
      if (existing > 0) {
        this.logger.log(
          `Skipping auto-rollout for ${payload.version}: ${existing} existing rollout(s)`,
        );
        return;
      }
      await this.createRollout({
        appVersionId: payload.appVersionId,
        strategy: 'gradual',
        autoRollbackOnError: true,
        notes: `Auto-created on publish of v${payload.version}`,
        actorUserId: payload.actorUserId,
        triggeredBy: 'auto-publish',
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to auto-create rollout for ${payload.version}: ${err?.message ?? err}`,
      );
    }
  }

  // ============ DEPLOYMENT REPORTS (per-instance update worker channel) ============

  /**
   * Ingest a per-instance update report for a rollout.
   * Called by tenant agents at update-start, on success, and on failure.
   * Authenticated by the on-prem licenseKey (NOT by user session).
   * One report per (rolloutId, licenseId) — re-submissions UPSERT.
   * After persisting, recomputes the rollout's success / failure / rolled-back
   * counters from the canonical reports table so the scheduler has live data.
   */
  async reportRolloutResult(
    rolloutId: string,
    payload: {
      licenseKey: string;
      hardwareId?: string;
      fromVersion?: string;
      toVersion?: string;
      status: 'started' | 'in_progress' | 'success' | 'failed' | 'rolled_back';
      errorMessage?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
    },
  ): Promise<{
    accepted: true;
    reportId: string;
    rollout: {
      id: string;
      status: UpdateRolloutStatus;
      deploymentsTotalCount: number;
      deploymentsSuccessCount: number;
      deploymentsFailedCount: number;
      deploymentsRolledBackCount: number;
    };
  }> {
    if (!payload?.licenseKey) {
      throw new BadRequestException('licenseKey is required');
    }
    if (!payload?.status) {
      throw new BadRequestException('status is required');
    }

    const license = await this.licenseRepository.findOne({
      where: { licenseKey: payload.licenseKey },
    });
    if (!license) {
      throw new NotFoundException('Invalid license key');
    }
    if (license.status !== 'active') {
      throw new BadRequestException(`License is ${license.status}`);
    }

    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) {
      throw new NotFoundException('Rollout not found');
    }

    const reportStatus = payload.status as DeploymentReportStatus;

    let report = await this.reportRepository.findOne({
      where: { rolloutId, licenseId: license.id },
    });

    if (report) {
      report.status = reportStatus;
      report.fromVersion = payload.fromVersion ?? report.fromVersion;
      report.toVersion = payload.toVersion ?? report.toVersion;
      report.hardwareId = payload.hardwareId ?? report.hardwareId;
      report.errorMessage = payload.errorMessage ?? report.errorMessage;
      report.metadata = payload.metadata ?? report.metadata;
      report.ipAddress = payload.ipAddress ?? report.ipAddress;
      report.tenantId = license.tenantId ?? report.tenantId;
      report = await this.reportRepository.save(report);
    } else {
      report = this.reportRepository.create({
        rolloutId,
        rollout,
        licenseId: license.id,
        license,
        tenantId: license.tenantId ?? null,
        hardwareId: payload.hardwareId ?? null,
        fromVersion: payload.fromVersion ?? null,
        toVersion: payload.toVersion ?? null,
        status: reportStatus,
        errorMessage: payload.errorMessage ?? null,
        metadata: payload.metadata ?? null,
        ipAddress: payload.ipAddress ?? null,
      });
      report = await this.reportRepository.save(report);
    }

    await this.recomputeRolloutCounters(rolloutId);

    const fresh = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!fresh) {
      throw new NotFoundException('Rollout disappeared after report');
    }

    this.logger.log(
      `Rollout ${rolloutId} report from license ${license.id}: ${reportStatus} ` +
        `(success=${fresh.deploymentsSuccessCount}, failed=${fresh.deploymentsFailedCount}, total=${fresh.deploymentsTotalCount})`,
    );

    return {
      accepted: true,
      reportId: report.id,
      rollout: {
        id: fresh.id,
        status: fresh.status,
        deploymentsTotalCount: fresh.deploymentsTotalCount,
        deploymentsSuccessCount: fresh.deploymentsSuccessCount,
        deploymentsFailedCount: fresh.deploymentsFailedCount,
        deploymentsRolledBackCount: fresh.deploymentsRolledBackCount,
      },
    };
  }

  /**
   * Recompute rollout's success / failed / rolled-back counters from the
   * canonical deployment_reports table. Idempotent. Total stays as configured
   * (set at rollout creation from active deployments) unless the live count
   * of distinct reporters now exceeds it (e.g., new instances came online).
   */
  async recomputeRolloutCounters(rolloutId: string): Promise<void> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) return;

    const rows = await this.reportRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.rollout_id = :rolloutId', { rolloutId })
      .groupBy('r.status')
      .getRawMany<{ status: DeploymentReportStatus; count: string }>();

    let success = 0;
    let failed = 0;
    let rolled = 0;
    let reporters = 0;
    for (const row of rows) {
      const n = parseInt(row.count, 10) || 0;
      reporters += n;
      if (row.status === DeploymentReportStatus.SUCCESS) success = n;
      else if (row.status === DeploymentReportStatus.FAILED) failed = n;
      else if (row.status === DeploymentReportStatus.ROLLED_BACK) rolled = n;
    }

    rollout.deploymentsSuccessCount = success;
    rollout.deploymentsFailedCount = failed;
    rollout.deploymentsRolledBackCount = rolled;
    if (reporters > rollout.deploymentsTotalCount) {
      rollout.deploymentsTotalCount = reporters;
    }
    await this.rolloutRepository.save(rollout);
  }

  /**
   * List per-instance reports for a rollout (system admin UI).
   */
  async listRolloutReports(rolloutId: string): Promise<any[]> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) throw new NotFoundException('Rollout not found');
    const reports = await this.reportRepository.find({
      where: { rolloutId },
      order: { updatedAt: 'DESC' },
      take: 200,
    });
    if (reports.length === 0) return [];

    const licenseIds = Array.from(new Set(reports.map((r) => r.licenseId)));
    const deployments = licenseIds.length
      ? await this.deploymentRepository
          .createQueryBuilder('d')
          .leftJoin('licenses', 'l', 'l.tenant_id = d.tenant_id')
          .select(['d.id AS "id"', 'd.name AS "name"', 'l.id AS "licenseId"'])
          .where('l.id IN (:...ids)', { ids: licenseIds })
          .getRawMany()
      : [];
    const licenseToDeployment = new Map<string, { id: string; name: string }>();
    for (const d of deployments) licenseToDeployment.set(d.licenseId, { id: d.id, name: d.name });

    const isSimulated = (r: DeploymentReport): boolean =>
      (!!r.ipAddress && (r.ipAddress === '::1' || r.ipAddress === '127.0.0.1')) ||
      (!!r.hardwareId && /^agent-/i.test(r.hardwareId));

    return reports.map((r) => {
      const dep = licenseToDeployment.get(r.licenseId);
      return {
        id: r.id,
        rolloutId: r.rolloutId,
        licenseId: r.licenseId,
        tenantId: r.tenantId,
        deploymentId: dep?.id || null,
        deploymentName: dep?.name || null,
        hardwareId: r.hardwareId,
        fromVersion: r.fromVersion,
        toVersion: r.toVersion,
        status: r.status,
        errorMessage: r.errorMessage,
        ipAddress: r.ipAddress,
        metadata: r.metadata,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        simulated: isSimulated(r),
      };
    });
  }

  /**
   * Aggregate auto-rollback status + error clusters for the rollout reports drawer.
   */
  async getRolloutSummary(rolloutId: string): Promise<{
    autoRollback: {
      enabled: boolean;
      threshold: number;
      currentFailureRatePct: number;
      tripped: boolean;
      rolledBackAt: string | null;
      rollbackReason: any;
    };
    errorClusters: Array<{ message: string; count: number; licenseIds: string[] }>;
    counts: {
      total: number;
      success: number;
      failed: number;
      rolledBack: number;
      simulated: number;
      reported: number;
    };
  }> {
    const rollout = await this.rolloutRepository.findOne({ where: { id: rolloutId } });
    if (!rollout) throw new NotFoundException('Rollout not found');

    const reports = await this.reportRepository.find({ where: { rolloutId } });

    const success = reports.filter((r) => r.status === DeploymentReportStatus.SUCCESS).length;
    const failed = reports.filter((r) => r.status === DeploymentReportStatus.FAILED).length;
    const rolledBack = reports.filter((r) => r.status === DeploymentReportStatus.ROLLED_BACK).length;
    const simulated = reports.filter(
      (r) =>
        (r.ipAddress === '::1' || r.ipAddress === '127.0.0.1') ||
        (r.hardwareId && /^agent-/i.test(r.hardwareId)),
    ).length;
    const reported = reports.length;
    const denom = success + failed;
    const currentFailureRatePct = denom > 0 ? (failed / denom) * 100 : 0;

    const clusterMap = new Map<string, { count: number; licenseIds: string[] }>();
    for (const r of reports) {
      if (r.status !== DeploymentReportStatus.FAILED) continue;
      const key = (r.errorMessage || '<no message>').trim();
      const c = clusterMap.get(key) || { count: 0, licenseIds: [] };
      c.count += 1;
      if (!c.licenseIds.includes(r.licenseId)) c.licenseIds.push(r.licenseId);
      clusterMap.set(key, c);
    }
    const errorClusters = Array.from(clusterMap.entries())
      .map(([message, v]) => ({ message, count: v.count, licenseIds: v.licenseIds }))
      .sort((a, b) => b.count - a.count);

    return {
      autoRollback: {
        enabled: !!rollout.autoRollbackOnError,
        threshold: rollout.errorThresholdPercentage,
        currentFailureRatePct,
        tripped: !!rollout.rolledBackAt,
        rolledBackAt: rollout.rolledBackAt ? rollout.rolledBackAt.toISOString() : null,
        rollbackReason: rollout.rollbackReason || null,
      },
      errorClusters,
      counts: {
        total: rollout.deploymentsTotalCount,
        success,
        failed,
        rolledBack,
        simulated,
        reported,
      },
    };
  }

  /**
   * Reverse lookup: rollouts that touched a particular license/deployment, with
   * this license's most recent report attached. Used by the deployment detail
   * page to surface "what updates have been pushed to me".
   */
  async listRolloutsForLicense(licenseId: string): Promise<
    Array<{
      rolloutId: string;
      rolloutStatus: string;
      currentPhase: string;
      startDate: string | null;
      report: {
        status: string;
        fromVersion: string | null;
        toVersion: string | null;
        errorMessage: string | null;
        updatedAt: string;
      };
    }>
  > {
    const reports = await this.reportRepository.find({
      where: { licenseId },
      order: { updatedAt: 'DESC' },
      take: 50,
    });
    if (reports.length === 0) return [];

    const rolloutIds = Array.from(new Set(reports.map((r) => r.rolloutId)));
    const rollouts = await this.rolloutRepository.findByIds(rolloutIds);
    const rolloutById = new Map(rollouts.map((r) => [r.id, r]));

    return reports
      .map((r) => {
        const ro = rolloutById.get(r.rolloutId);
        if (!ro) return null;
        return {
          rolloutId: ro.id,
          rolloutStatus: ro.status,
          currentPhase: ro.currentPhase,
          startDate: ro.startDate ? (ro.startDate as Date).toISOString() : null,
          report: {
            status: r.status,
            fromVersion: r.fromVersion || null,
            toVersion: r.toVersion || null,
            errorMessage: r.errorMessage || null,
            updatedAt: r.updatedAt.toISOString?.() || String(r.updatedAt),
          },
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }

  private calculateProgress(rollout: UpdateRollout): number {
    if (rollout.status === UpdateRolloutStatus.COMPLETED) return 100;
    if (rollout.status === UpdateRolloutStatus.FAILED || rollout.status === UpdateRolloutStatus.ROLLED_BACK) return 0;
    if (rollout.status === UpdateRolloutStatus.PAUSED) return 50;
    return 25;
  }
}
