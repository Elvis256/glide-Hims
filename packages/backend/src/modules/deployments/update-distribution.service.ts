import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In } from 'typeorm';
import { UpdateRollout, UpdateRolloutStatus, UpdateRolloutPhase } from '../../database/entities/update-rollout.entity';
import { Deployment } from '../../database/entities/deployment.entity';

@Injectable()
export class UpdateDistributionService {
  constructor(
    @InjectRepository(UpdateRollout)
    private rolloutRepository: Repository<UpdateRollout>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
  ) {}

  /**
   * Distribute updates to deployments in phases
   * Phase 1: 10% of deployments
   * Phase 2: 50% of deployments
   * Phase 3: 100% of deployments
   */
  async distributeUpdate(rolloutId: string): Promise<any> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
      relations: ['releaseCandidate'],
    });

    if (!rollout) {
      throw new Error('Rollout not found');
    }

    // Get total deployments for this rollout
    const totalDeployments = await this.deploymentRepository.count({
      where: { currentVersion: rollout.releaseCandidate.id },
    });

    // Calculate targets for each phase
    const phase1Target = Math.ceil(totalDeployments * (rollout.phase1PercentageTarget / 100));
    const phase2Target = Math.ceil(totalDeployments * (rollout.phase2PercentageTarget / 100));
    const phase3Target = totalDeployments;

    return {
      rolloutId,
      totalDeployments,
      phases: {
        phase1: { target: phase1Target, percentage: rollout.phase1PercentageTarget },
        phase2: { target: phase2Target, percentage: rollout.phase2PercentageTarget },
        phase3: { target: phase3Target, percentage: 100 },
      },
    };
  }

  /**
   * Get rollout progress by phase
   */
  async getRolloutProgress(rolloutId: string): Promise<any> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
    });

    if (!rollout) {
      throw new Error('Rollout not found');
    }

    return {
      rolloutId,
      currentPhase: rollout.currentPhase,
      status: rollout.status,
      startDate: rollout.startDate,
      endDate: rollout.endDate,
      progressPercentage: this.calculatePhaseProgress(rollout.currentPhase),
    };
  }

  /**
   * Advance rollout to next phase
   */
  async advancePhase(rolloutId: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
    });

    if (!rollout) {
      throw new Error('Rollout not found');
    }

    let nextPhase: UpdateRolloutPhase;

    if (rollout.currentPhase === UpdateRolloutPhase.PHASE_1) {
      nextPhase = UpdateRolloutPhase.PHASE_2;
    } else if (rollout.currentPhase === UpdateRolloutPhase.PHASE_2) {
      nextPhase = UpdateRolloutPhase.PHASE_3;
    } else {
      throw new Error('Rollout already in final phase');
    }

    rollout.currentPhase = nextPhase;
    if (nextPhase === UpdateRolloutPhase.PHASE_3) {
      rollout.status = UpdateRolloutStatus.COMPLETED;
      rollout.endDate = new Date();
    }

    return this.rolloutRepository.save(rollout);
  }

  /**
   * Pause rollout and halt distribution
   */
  async pauseRollout(rolloutId: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
    });

    if (!rollout) {
      throw new Error('Rollout not found');
    }

    rollout.status = UpdateRolloutStatus.PAUSED;
    return this.rolloutRepository.save(rollout);
  }

  /**
   * Resume paused rollout
   */
  async resumeRollout(rolloutId: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
    });

    if (!rollout) {
      throw new Error('Rollout not found');
    }

    if (rollout.status !== UpdateRolloutStatus.PAUSED) {
      throw new Error('Rollout is not paused');
    }

    rollout.status = UpdateRolloutStatus.IN_PROGRESS;
    return this.rolloutRepository.save(rollout);
  }

  /**
   * Mark rollout as failed
   */
  async failRollout(rolloutId: string, reason: string): Promise<UpdateRollout> {
    const rollout = await this.rolloutRepository.findOne({
      where: { id: rolloutId },
    });

    if (!rollout) {
      throw new Error('Rollout not found');
    }

    rollout.status = UpdateRolloutStatus.FAILED;
    rollout.metadata = rollout.metadata || {};
    rollout.metadata.failureReason = reason;
    rollout.metadata.failedAt = new Date();

    return this.rolloutRepository.save(rollout);
  }

  private calculatePhaseProgress(currentPhase: UpdateRolloutPhase): number {
    switch (currentPhase) {
      case UpdateRolloutPhase.PHASE_1:
        return 33;
      case UpdateRolloutPhase.PHASE_2:
        return 66;
      case UpdateRolloutPhase.PHASE_3:
        return 100;
      default:
        return 0;
    }
  }
}
