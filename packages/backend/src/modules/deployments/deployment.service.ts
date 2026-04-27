import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Deployment, DeploymentType, DeploymentStatus } from '../../database/entities/deployment.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { DeploymentConfig } from '../../database/entities/deployment-config.entity';
import { CreateDeploymentDto, UpdateDeploymentDto, DeploymentResponseDto, ProvisionDeploymentDto } from './deployment.dto';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class DeploymentService {
  constructor(
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    @InjectRepository(DeploymentVersion)
    private versionRepository: Repository<DeploymentVersion>,
    @InjectRepository(DeploymentConfig)
    private configRepository: Repository<DeploymentConfig>,
    private tenantsService: TenantsService,
  ) {}

  async provisionDeployment(dto: ProvisionDeploymentDto): Promise<DeploymentResponseDto> {
    const orgName = dto.organizationName?.trim();
    if (!orgName) throw new BadRequestException('Organization name is required');

    const slug = TenantsService['generateSlug'](orgName);
    let tenant: any = await this.tenantsService.findBySlug(slug).catch(() => null);
    if (!tenant) {
      tenant = await this.tenantsService.create({
        name: orgName,
        description: `Auto-created from deployment provisioning${dto.tier ? ' (' + dto.tier + ')' : ''}`,
      } as any);
    }

    const dbType = dto.type === 'standalone' ? DeploymentType.ONPREMISE : DeploymentType.HYBRID;
    const apiEndpoint = dto.domain?.trim() ? `https://${dto.domain.trim()}` : '';

    const deployment = this.deploymentRepository.create({
      tenantId: tenant.id,
      name: orgName,
      deploymentType: dbType,
      status: DeploymentStatus.ACTIVE,
      apiEndpoint,
      currentVersion: '1.0.0',
      notes: dto.notes,
      config: {
        userFacingType: dto.type,
        tier: dto.tier || 'professional',
        domain: dto.domain || null,
        maxUsers: dto.maxUsers ?? 50,
      },
    });

    const saved = await this.deploymentRepository.save(deployment);
    return { ...this.mapToResponse(saved), organizationName: orgName, tenantSlug: tenant.slug } as any;
  }

  async listAllDeployments(): Promise<any[]> {
    const rows = await this.deploymentRepository
      .createQueryBuilder('d')
      .leftJoin('tenants', 't', 't.id = d.tenantId')
      .select(['d.*', 't.name AS organization_name', 't.slug AS tenant_slug'])
      .orderBy('d.createdAt', 'DESC')
      .getRawMany();
    return rows.map((r: any) => ({
      id: r.id,
      tenantId: r.tenant_id,
      organizationName: r.organization_name,
      tenantSlug: r.tenant_slug,
      name: r.name,
      type: r.config?.userFacingType || (r.deployment_type === 'onpremise' ? 'standalone' : 'hybrid'),
      deploymentType: r.deployment_type,
      status: r.status,
      apiEndpoint: r.api_endpoint,
      currentVersion: r.current_version,
      config: r.config,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

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
