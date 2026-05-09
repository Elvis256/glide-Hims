import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import { Deployment, DeploymentType, DeploymentStatus } from '../../database/entities/deployment.entity';
import { DeploymentVersion } from '../../database/entities/deployment-version.entity';
import { DeploymentConfig } from '../../database/entities/deployment-config.entity';
import { License } from '../../database/entities/license.entity';
import { In } from 'typeorm';
import { CreateDeploymentDto, UpdateDeploymentDto, DeploymentResponseDto, ProvisionDeploymentDto } from './deployment.dto';
import { TenantsService } from '../tenants/tenants.service';
import { LicenseService } from '../licensing/license.service';

type DeploymentTier = 'community' | 'professional' | 'enterprise';
type LicenseType = 'trial' | 'standard' | 'professional' | 'enterprise';

const TIER_TO_LICENSE_TYPE: Record<DeploymentTier, LicenseType> = {
  community: 'standard',
  professional: 'professional',
  enterprise: 'enterprise',
};

@Injectable()
export class DeploymentService {
  constructor(
    @InjectRepository(Deployment)
    private deploymentRepository: Repository<Deployment>,
    @InjectRepository(DeploymentVersion)
    private versionRepository: Repository<DeploymentVersion>,
    @InjectRepository(DeploymentConfig)
    private configRepository: Repository<DeploymentConfig>,
    @InjectRepository(License)
    private licenseRepository: Repository<License>,
    private tenantsService: TenantsService,
    private licenseService: LicenseService,
  ) {}

  private maskLicenseKey(key: string | null | undefined): string | null {
    if (!key) return null;
    if (key.length <= 12) return key;
    return `${key.slice(0, 6)}…${key.slice(-4)}`;
  }

  private async loadLicensesForTenants(
    tenantIds: string[],
  ): Promise<Map<string, License>> {
    const map = new Map<string, License>();
    const ids = Array.from(new Set(tenantIds.filter(Boolean)));
    if (ids.length === 0) return map;

    const licenses = await this.licenseRepository.find({
      where: { tenantId: In(ids) },
      order: { createdAt: 'DESC' },
    });

    // Prefer the most recent active license per tenant; fall back to most recent.
    for (const lic of licenses) {
      const existing = map.get(lic.tenantId);
      if (!existing) {
        map.set(lic.tenantId, lic);
        continue;
      }
      if (existing.status !== 'active' && lic.status === 'active') {
        map.set(lic.tenantId, lic);
      }
    }
    return map;
  }

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
      status: DeploymentStatus.PENDING,
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

    // Align the tenant's license with the chosen tier / maxUsers. If the
    // tenant was just auto-created above, it already has a 30-day trial
    // license issued by TenantsService.create — we upgrade it in place
    // (re-signing) rather than minting a parallel license. If for any reason
    // no license exists yet, mint one.
    try {
      await this.alignLicenseWithDeployment({
        tenantId: tenant.id,
        organizationName: orgName,
        tier: (dto.tier as DeploymentTier) || 'professional',
        maxUsers: dto.maxUsers ?? 50,
        adminEmail: (tenant as any).adminEmail,
      });
    } catch (err) {
      // Do not fail provisioning if license alignment hits an error;
      // the deployment is still useful and an admin can rotate the key
      // from the licenses page.
      // eslint-disable-next-line no-console
      console.warn(
        `Deployment ${saved.id} created but license alignment failed: ${(err as Error).message}`,
      );
    }

    return { ...this.mapToResponse(saved), organizationName: orgName, tenantSlug: tenant.slug } as any;
  }

  private async alignLicenseWithDeployment(args: {
    tenantId: string;
    organizationName: string;
    tier: DeploymentTier;
    maxUsers: number;
    adminEmail?: string;
  }): Promise<void> {
    const targetType = TIER_TO_LICENSE_TYPE[args.tier];

    const existing = await this.licenseRepository.find({
      where: { tenantId: args.tenantId },
      order: { createdAt: 'DESC' },
    });
    const active = existing.find((l) => l.status === 'active') ?? existing[0];

    if (!active) {
      // No license yet — mint one with paid-tier defaults (1y validity).
      await this.licenseService.generateLicense({
        organizationName: args.organizationName,
        email: args.adminEmail || `admin@tenant-${args.tenantId}.local`,
        licenseType: targetType,
        maxUsers: args.maxUsers,
        maxFacilities: 1,
        validityDays: 365,
        tenantId: args.tenantId,
      });
      return;
    }

    const tierMismatch = active.licenseType !== targetType;
    const usersMismatch = active.maxUsers !== args.maxUsers;
    const isStillTrial = active.licenseType === 'trial';

    if (!tierMismatch && !usersMismatch) {
      return;
    }

    const patch: Parameters<LicenseService['updateLicense']>[1] = {};
    if (tierMismatch) patch.licenseType = targetType;
    if (usersMismatch) patch.maxUsers = args.maxUsers;
    // If we're upgrading away from trial, extend validity to a year so the
    // expiry doesn't quietly stay at the original 30-day trial window.
    if (isStillTrial && targetType !== 'trial') {
      const oneYear = new Date();
      oneYear.setDate(oneYear.getDate() + 365);
      patch.expiresAt = oneYear;
    }

    await this.licenseService.updateLicense(active.licenseKey, patch);
  }

  async listAllDeployments(opts?: { maskLicenseKey?: boolean }): Promise<any[]> {
    const rows = await this.deploymentRepository
      .createQueryBuilder('d')
      .leftJoin('tenants', 't', 't.id = d.tenantId')
      .select(['d.*', 't.name AS organization_name', 't.slug AS tenant_slug'])
      .orderBy('d.createdAt', 'DESC')
      .getRawMany();

    const tenantIds = rows.map((r: any) => r.tenant_id);
    const licensesByTenant = await this.loadLicensesForTenants(tenantIds);
    const mask = !!opts?.maskLicenseKey;

    return rows.map((r: any) => {
      const license = licensesByTenant.get(r.tenant_id);
      const rawKey = license?.licenseKey ?? null;
      return {
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
        lastSeen: r.last_health_check ?? r.last_sync ?? null,
        licenseKey: mask ? this.maskLicenseKey(rawKey) : rawKey,
        licenseStatus: license?.status ?? null,
        licenseTier: license?.licenseType ?? r.config?.tier ?? null,
        licenseExpiresAt: license?.expiresAt ?? null,
      };
    });
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

  async getAdminDeploymentDetail(deploymentId: string): Promise<any> {
    const deployment = await this.deploymentRepository.findOne({ where: { id: deploymentId } });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const license = deployment.tenantId
      ? await this.licenseRepository.findOne({
          where: { tenantId: deployment.tenantId },
          order: { createdAt: 'DESC' },
        })
      : null;

    let tenant: any = null;
    try {
      const t = deployment.tenantId ? await this.tenantsService.findOne(deployment.tenantId) : null;
      tenant = t ? { id: t.id, name: t.name, slug: t.slug } : null;
    } catch {
      tenant = null;
    }

    return {
      id: deployment.id,
      tenantId: deployment.tenantId,
      tenant,
      name: deployment.name,
      organizationName: deployment.name,
      type: deployment.config?.userFacingType || (deployment.deploymentType === DeploymentType.ONPREMISE ? 'standalone' : 'hybrid'),
      deploymentType: deployment.deploymentType,
      status: deployment.status,
      apiEndpoint: deployment.apiEndpoint,
      domain: deployment.config?.domain || null,
      tier: deployment.config?.tier || null,
      maxUsers: deployment.config?.maxUsers || null,
      currentVersion: deployment.currentVersion,
      notes: deployment.notes,
      createdAt: deployment.createdAt,
      updatedAt: deployment.updatedAt,
      lastSync: deployment.lastSync,
      lastHealthCheck: deployment.lastHealthCheck,
      license: license
        ? {
            licenseKey: license.licenseKey,
            status: license.status,
            licenseType: license.licenseType,
            issuedAt: license.issuedAt,
            expiresAt: license.expiresAt,
            maxUsers: license.maxUsers,
            maxFacilities: license.maxFacilities,
            enabledModules: license.enabledModules,
            hardwareId: license.hardwareId,
            lastValidatedAt: license.lastValidatedAt,
          }
        : null,
    };
  }

  async testConnectivity(deploymentId: string): Promise<{
    deploymentId: string;
    target: string | null;
    reachable: boolean;
    statusCode: number | null;
    latencyMs: number | null;
    error?: string;
    checkedAt: string;
  }> {
    const deployment = await this.deploymentRepository.findOne({ where: { id: deploymentId } });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const apiEndpoint = deployment.apiEndpoint;
    const domain = deployment.config?.domain;
    let target: string | null = null;
    if (apiEndpoint) {
      target = apiEndpoint.replace(/\/+$/, '') + '/health';
    } else if (domain) {
      target = `https://${domain}/health`;
    }

    const checkedAt = new Date().toISOString();
    if (!target) {
      return {
        deploymentId,
        target: null,
        reachable: false,
        statusCode: null,
        latencyMs: null,
        error: 'No apiEndpoint or domain configured for this deployment',
        checkedAt,
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const start = Date.now();
    try {
      const res = await fetch(target, { method: 'GET', signal: controller.signal });
      const latencyMs = Date.now() - start;
      return {
        deploymentId,
        target,
        reachable: res.ok,
        statusCode: res.status,
        latencyMs,
        error: res.ok ? undefined : `HTTP ${res.status}`,
        checkedAt,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      const isAbort = err?.name === 'AbortError';
      return {
        deploymentId,
        target,
        reachable: false,
        statusCode: null,
        latencyMs,
        error: isAbort ? 'Request timed out after 7s' : (err?.message || 'Network error'),
        checkedAt,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async generateInstallerBundle(deploymentId: string): Promise<{ filename: string; content: string; mimeType: string }> {
    const deployment = await this.deploymentRepository.findOne({ where: { id: deploymentId } });
    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    const userFacingType: 'hybrid' | 'standalone' =
      (deployment.config?.userFacingType as 'hybrid' | 'standalone') ||
      (deployment.deploymentType === DeploymentType.ONPREMISE ? 'standalone' : 'hybrid');

    if (deployment.deploymentType === DeploymentType.CLOUD) {
      throw new BadRequestException('Installer bundles are only available for hybrid or standalone deployments');
    }

    const license = deployment.tenantId
      ? await this.licenseRepository.findOne({
          where: { tenantId: deployment.tenantId, status: 'active' },
          order: { createdAt: 'DESC' },
        })
      : null;

    const rand = (bytes = 32) => randomBytes(bytes).toString('base64').replace(/[+/=]/g, '').slice(0, 32);
    const dbPassword = rand(24);
    const redisPassword = rand(24);
    const jwtSecret = rand(48);

    const repoBase = process.env.GLIDE_INSTALLER_REPO || 'https://raw.githubusercontent.com/Elvis256/glide-Hims/main';
    const installerUrl = `${repoBase}/install-${userFacingType}.sh`;

    const orgName = deployment.name || 'glide-hims';
    const orgSlug = orgName.replace(/[^a-z0-9]+/gi, '-').toLowerCase().replace(/(^-|-$)/g, '') || 'install';
    const filename = `glide-hims-bootstrap-${orgSlug}-${userFacingType}.sh`;

    const tenantNameSafe = orgName.replace(/"/g, '\\"');
    const domain = (deployment.config?.domain as string) || '';
    const licenseKey = license?.licenseKey || '';
    const signature = license?.signature || '';

    const lines = [
      `#!/usr/bin/env bash`,
      `###############################################################################`,
      `# Glide-HIMS ${userFacingType.toUpperCase()} bootstrap`,
      `# Organization : ${tenantNameSafe}`,
      `# Deployment ID: ${deployment.id}`,
      `# Generated    : ${new Date().toISOString()}`,
      `#`,
      `# WARNING: this file contains a pre-generated license key and freshly`,
      `# generated random secrets. Treat it as confidential and delete after use.`,
      `###############################################################################`,
      `set -euo pipefail`,
      ``,
      `export LICENSE_KEY="${licenseKey}"`,
      `export DOMAIN_NAME="${domain}"`,
      `export DB_PASSWORD="${dbPassword}"`,
      `export REDIS_PASSWORD="${redisPassword}"`,
      `export JWT_SECRET="${jwtSecret}"`,
      ``,
    ];

    if (userFacingType === 'standalone' && signature) {
      lines.push(
        `# Offline license signature — written so install-standalone.sh can validate`,
        `# the license without phoning home (air-gapped deployments).`,
        `OFFLINE_LIC_DIR="\${OFFLINE_LIC_DIR:-/etc/glide-hims}"`,
        `mkdir -p "$OFFLINE_LIC_DIR"`,
        `cat > "$OFFLINE_LIC_DIR/license.sig" <<'GLIDE_LIC_EOF'`,
        signature,
        `GLIDE_LIC_EOF`,
        `chmod 600 "$OFFLINE_LIC_DIR/license.sig"`,
        `export OFFLINE_LICENSE_SIGNATURE_FILE="$OFFLINE_LIC_DIR/license.sig"`,
        ``,
      );
    }

    lines.push(
      `INSTALLER_URL="\${INSTALLER_URL:-${installerUrl}}"`,
      `WORK_DIR="$(mktemp -d -t glide-hims-install-XXXXXX)"`,
      `INSTALLER_PATH="$WORK_DIR/install-${userFacingType}.sh"`,
      ``,
      `echo "==> Downloading installer from $INSTALLER_URL"`,
      `if command -v curl >/dev/null 2>&1; then`,
      `  curl -fsSL "$INSTALLER_URL" -o "$INSTALLER_PATH"`,
      `elif command -v wget >/dev/null 2>&1; then`,
      `  wget -q "$INSTALLER_URL" -O "$INSTALLER_PATH"`,
      `else`,
      `  echo "ERROR: need curl or wget on PATH" >&2`,
      `  exit 1`,
      `fi`,
      ``,
      `chmod +x "$INSTALLER_PATH"`,
      `echo "==> Running installer"`,
      `bash "$INSTALLER_PATH"`,
      ``,
    );

    return {
      filename,
      content: lines.join('\n'),
      mimeType: 'application/x-sh',
    };
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
