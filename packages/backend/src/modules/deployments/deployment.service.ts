import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deployment, DeploymentType, DeploymentStatus } from '../../database/entities/deployment.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { DeploymentConfig } from '../../database/entities/deployment-config.entity';
import { CreateDeploymentDto, UpdateDeploymentDto, DeploymentResponseDto } from './deployment.dto';

@Injectable()
export class DeploymentService {
  constructor(
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    @InjectRepository(DeploymentVersion)
    private versionRepository: Repository<DeploymentVersion>,
    @InjectRepository(DeploymentConfig)
    private configRepository: Repository<DeploymentConfig>,
  ) {}

  async createDeployment(
    tenantId: string,
    dto: CreateDeploymentDto,
  ): Promise<DeploymentResponseDto> {
    // Validate tenant matches
    if (dto.tenantId !== tenantId) {
      throw new BadRequestException('Tenant ID mismatch');
    }

    const deployment = this.deploymentRepository.create({
      tenantId,
      name: dto.name,
      deploymentType: dto.type,
      status: DeploymentStatus.ACTIVE,
      apiEndpoint: dto.apiUrl,
      currentVersion: '1.0.0',
    });

    const saved = await this.deploymentRepository.save(deployment);
    return this.mapToResponse(saved);
  }

  async getDeployment(tenantId: string, deploymentId: string): Promise<DeploymentResponseDto> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return this.mapToResponse(deployment);
  }

  async listDeployments(tenantId: string, filters?: { type?: DeploymentType; status?: DeploymentStatus }): Promise<DeploymentResponseDto[]> {
    const query = this.deploymentRepository.createQueryBuilder('d').where('d.tenantId = :tenantId', { tenantId });

    if (filters?.type) {
      query.andWhere('d.deploymentType = :type', { type: filters.type });
    }

    if (filters?.status) {
      query.andWhere('d.status = :status', { status: filters.status });
    }

    const deployments = await query.orderBy('d.createdAt', 'DESC').getMany();
    return deployments.map((d) => this.mapToResponse(d));
  }

  async updateDeployment(tenantId: string, deploymentId: string, dto: UpdateDeploymentDto): Promise<DeploymentResponseDto> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (dto.name) deployment.name = dto.name;
    if (dto.status) deployment.status = dto.status;
    if (dto.apiUrl) deployment.apiEndpoint = dto.apiUrl;

    const updated = await this.deploymentRepository.save(deployment);
    return this.mapToResponse(updated);
  }

  async deleteDeployment(tenantId: string, deploymentId: string): Promise<void> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    if (deployment.status !== DeploymentStatus.INACTIVE) {
      throw new BadRequestException('Can only delete deployments in INACTIVE status');
    }

    await this.deploymentRepository.remove(deployment);
  }

  async activateDeployment(tenantId: string, deploymentId: string, versionId: string): Promise<DeploymentResponseDto> {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    // Verify version exists
    const version = await this.versionRepository.findOne({
      where: { id: versionId, deploymentId },
    });

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    deployment.status = DeploymentStatus.ACTIVE;
    deployment.currentVersion = versionId;

    const updated = await this.deploymentRepository.save(deployment);
    return this.mapToResponse(updated);
  }

  async getDeploymentHealth(tenantId: string, deploymentId: string) {
    const deployment = await this.deploymentRepository.findOne({
      where: { id: deploymentId, tenantId },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return {
      id: deployment.id,
      status: deployment.status,
      currentVersion: deployment.currentVersion,
      lastHealthCheck: deployment.lastHealthCheck,
      lastSync: deployment.lastSync,
    };
  }

  private mapToResponse(deployment: Deployment): DeploymentResponseDto {
    return {
      id: deployment.id,
      tenantId: deployment.tenantId,
      name: deployment.name,
      type: deployment.deploymentType,
      status: deployment.status,
      apiUrl: deployment.apiEndpoint,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
    };
  }
}
