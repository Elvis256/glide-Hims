import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UpdateRollout, UpdateRolloutStatus } from '../../database/entities/update-rollout.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { Deployment, DeploymentStatus } from '../../database/entities/deployment.entity';
import { CreateUpdateRolloutDto } from './deployment.dto';

@Injectable()
export class UpdateManagementService {
  constructor(
    @InjectRepository(UpdateRollout)
    private rolloutRepository: Repository<UpdateRollout>,
    @InjectRepository(DeploymentVersion)
    private versionRepository: Repository<DeploymentVersion>,
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
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

  private calculateProgress(rollout: UpdateRollout): number {
    if (rollout.status === UpdateRolloutStatus.COMPLETED) return 100;
    if (rollout.status === UpdateRolloutStatus.FAILED || rollout.status === UpdateRolloutStatus.ROLLED_BACK) return 0;
    if (rollout.status === UpdateRolloutStatus.PAUSED) return 50;
    return 25;
  }
}
