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

  private calculateProgress(rollout: UpdateRollout): number {
    if (rollout.status === UpdateRolloutStatus.COMPLETED) return 100;
    if (rollout.status === UpdateRolloutStatus.FAILED || rollout.status === UpdateRolloutStatus.ROLLED_BACK) return 0;
    if (rollout.status === UpdateRolloutStatus.PAUSED) return 50;
    return 25;
  }
}
