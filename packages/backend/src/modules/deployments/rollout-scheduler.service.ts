import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import {
  UpdateRollout,
  UpdateRolloutStatus,
  UpdateRolloutPhase,
} from '../../database/entities/update-rollout.entity';

/**
 * Periodic background job that advances rollouts through their lifecycle:
 *   - Activates SCHEDULED rollouts whose startDate has arrived.
 *   - Marks `immediate`-strategy rollouts as COMPLETED (target = 100% in all phases,
 *     so there is nothing further to do once they are IN_PROGRESS).
 *   - Auto-rolls back IN_PROGRESS rollouts when failure rate exceeds the
 *     configured `errorThresholdPercentage` and `autoRollbackOnError` is on.
 *   - Auto-advances `gradual`/`scheduled` phases when the phase has been active
 *     for at least `phaseDurationMinutes` (metadata, default 60) AND the failure
 *     rate is below threshold.
 */
@Injectable()
export class RolloutSchedulerService {
  private readonly logger = new Logger(RolloutSchedulerService.name);

  constructor(
    @InjectRepository(UpdateRollout)
    private rolloutRepository: Repository<UpdateRollout>,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'rollout-tick' })
  async tick(): Promise<void> {
    try {
      await this.activateScheduled();
      await this.processInProgress();
    } catch (err) {
      this.logger.error(`Rollout tick failed: ${(err as Error).message}`, (err as Error).stack);
    }
  }

  private async activateScheduled(): Promise<void> {
    const now = new Date();
    const due = await this.rolloutRepository.find({
      where: { status: UpdateRolloutStatus.SCHEDULED, startDate: LessThanOrEqual(now) },
    });
    for (const r of due) {
      r.status = UpdateRolloutStatus.IN_PROGRESS;
      r.metadata = {
        ...(r.metadata || {}),
        activatedAt: now.toISOString(),
        phaseStartedAt: now.toISOString(),
      };
      await this.rolloutRepository.save(r);
      this.logger.log(`Activated scheduled rollout ${r.id}`);
    }
  }

  private async processInProgress(): Promise<void> {
    const active = await this.rolloutRepository.find({
      where: { status: UpdateRolloutStatus.IN_PROGRESS },
    });
    const now = new Date();
    for (const r of active) {
      const total = r.deploymentsTotalCount || 0;
      const failed = r.deploymentsFailedCount || 0;
      const success = r.deploymentsSuccessCount || 0;
      const failureRate = total > 0 ? (failed / total) * 100 : 0;
      const meta = (r.metadata || {}) as Record<string, any>;
      const strategy: string = meta.strategy || 'gradual';

      if (r.autoRollbackOnError && total > 0 && failureRate >= r.errorThresholdPercentage) {
        r.status = UpdateRolloutStatus.ROLLED_BACK;
        r.rolledBackAt = now;
        r.rollbackReason = {
          reason: 'auto-rollback: failure threshold exceeded',
          failureRate: Number(failureRate.toFixed(2)),
          threshold: r.errorThresholdPercentage,
          rolledBackAt: now.toISOString(),
        };
        await this.rolloutRepository.save(r);
        this.logger.warn(`Auto-rolled back ${r.id} (failureRate=${failureRate.toFixed(2)}%)`);
        continue;
      }

      if (strategy === 'immediate') {
        r.status = UpdateRolloutStatus.COMPLETED;
        r.currentPhase = UpdateRolloutPhase.PHASE_3;
        r.endDate = now;
        r.metadata = { ...meta, completedAt: now.toISOString(), reason: 'immediate strategy' };
        await this.rolloutRepository.save(r);
        this.logger.log(`Completed immediate rollout ${r.id}`);
        continue;
      }

      if (total > 0 && success + failed >= total) {
        r.status = UpdateRolloutStatus.COMPLETED;
        r.currentPhase = UpdateRolloutPhase.PHASE_3;
        r.endDate = now;
        r.metadata = { ...meta, completedAt: now.toISOString(), reason: 'all deployments processed' };
        await this.rolloutRepository.save(r);
        this.logger.log(`Completed rollout ${r.id} (all deployments processed)`);
        continue;
      }

      const phaseDurationMin: number = Number(meta.phaseDurationMinutes) || 60;
      const phaseStartedAt = meta.phaseStartedAt ? new Date(meta.phaseStartedAt) : r.startDate;
      const elapsedMin = (now.getTime() - new Date(phaseStartedAt).getTime()) / 60000;

      if (elapsedMin >= phaseDurationMin && failureRate < r.errorThresholdPercentage) {
        if (r.currentPhase === UpdateRolloutPhase.PHASE_1) {
          r.currentPhase = UpdateRolloutPhase.PHASE_2;
        } else if (r.currentPhase === UpdateRolloutPhase.PHASE_2) {
          r.currentPhase = UpdateRolloutPhase.PHASE_3;
        } else {
          r.status = UpdateRolloutStatus.COMPLETED;
          r.endDate = now;
        }
        r.metadata = {
          ...meta,
          phaseStartedAt: now.toISOString(),
          autoAdvancedAt: now.toISOString(),
        };
        await this.rolloutRepository.save(r);
        this.logger.log(`Auto-advanced rollout ${r.id} to ${r.currentPhase} (status=${r.status})`);
      }
    }
  }
}
