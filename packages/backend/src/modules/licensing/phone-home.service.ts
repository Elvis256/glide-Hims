import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as os from 'os';
import * as crypto from 'crypto';
import { PhoneHomeRecord } from '../../database/entities/phone-home-record.entity';
import { License } from '../../database/entities/license.entity';
import { AppVersion } from '../../database/entities/app-version.entity';
import { Deployment, DeploymentStatus } from '../../database/entities/deployment.entity';
import { UpdateRollout, UpdateRolloutStatus } from '../../database/entities/update-rollout.entity';
import { UpdateClientService } from './update-client.service';

export interface PhoneHomePayload {
  licenseKey: string;
  hardwareId: string;
  appVersion: string;
  activeUsers?: number;
  totalUsers?: number;
  totalPatients?: number;
  totalEncounters?: number;
  systemInfo?: Record<string, any>;
  usageStats?: Record<string, any>;
}

export interface PhoneHomeResponse {
  status: 'ok' | 'warning' | 'error';
  licenseValid: boolean;
  message?: string;
  updateAvailable?: boolean;
  latestVersion?: string;
  updateUrl?: string;
  rolloutId?: string;
  commands?: string[];
}

@Injectable()
export class PhoneHomeService {
  private readonly logger = new Logger(PhoneHomeService.name);
  private readonly phoneHomeUrl: string;
  private readonly enabled: boolean;
  private lastPhoneHome: Date | null = null;

  constructor(
    @InjectRepository(PhoneHomeRecord)
    private readonly recordRepository: Repository<PhoneHomeRecord>,
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    @InjectRepository(AppVersion)
    private readonly versionRepository: Repository<AppVersion>,
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
    @InjectRepository(UpdateRollout)
    private readonly rolloutRepository: Repository<UpdateRollout>,
    private readonly configService: ConfigService,
    private readonly updateClientService: UpdateClientService,
  ) {
    this.phoneHomeUrl =
      this.configService.get<string>('PHONE_HOME_URL') ||
      'https://hmisdemo.itsolutionsuganda.com/api/phone-home';
    this.enabled = this.configService.get<string>('PHONE_HOME_ENABLED') !== 'false';
  }

  /**
   * Send phone home heartbeat (for on-premise installations)
   */
  async sendHeartbeat(payload: PhoneHomePayload): Promise<PhoneHomeResponse> {
    if (!this.enabled) {
      return { status: 'ok', licenseValid: true, message: 'Phone home disabled' };
    }

    try {
      const response = await axios.post(this.phoneHomeUrl, payload, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'X-Glide-License': payload.licenseKey,
        },
      });

      this.lastPhoneHome = new Date();
      return response.data;
    } catch (error) {
      this.logger.warn(`Phone home failed: ${error.message}`);
      // Graceful degradation - don't fail if phone home is unreachable
      return {
        status: 'warning',
        licenseValid: true,
        message: 'Phone home server unreachable',
      };
    }
  }

  /**
   * Receive phone home heartbeat (for this server as the control plane)
   */
  async receiveHeartbeat(payload: PhoneHomePayload, ipAddress: string): Promise<PhoneHomeResponse> {
    // Validate license
    const license = await this.licenseRepository.findOne({
      where: { licenseKey: payload.licenseKey },
    });

    if (!license) {
      return { status: 'error', licenseValid: false, message: 'Invalid license key' };
    }

    if (license.status !== 'active') {
      return { status: 'error', licenseValid: false, message: `License is ${license.status}` };
    }

    if (new Date() > license.expiresAt) {
      return { status: 'error', licenseValid: false, message: 'License expired' };
    }

    // Record heartbeat
    const record = this.recordRepository.create({
      licenseId: license.id,
      ipAddress,
      hardwareId: payload.hardwareId,
      appVersion: payload.appVersion,
      activeUsers: payload.activeUsers || 0,
      totalUsers: payload.totalUsers || 0,
      totalPatients: payload.totalPatients || 0,
      totalEncounters: payload.totalEncounters || 0,
      systemInfo: payload.systemInfo,
      usageStats: payload.usageStats,
    });

    await this.recordRepository.save(record);

    // Update license validation
    license.lastValidatedAt = new Date();
    await this.licenseRepository.save(license);

    // Mirror the heartbeat onto the tenant's deployment(s) so the Deployments
    // page shows accurate "last seen" and flips PENDING → ACTIVE on first
    // contact. Phone-home payloads carry licenseKey but no deploymentId, so we
    // update all deployments for the license's tenant. (Most tenants have one.)
    if (license.tenantId) {
      try {
        const deployments = await this.deploymentRepository.find({
          where: { tenantId: license.tenantId },
        });
        const now = new Date();
        for (const d of deployments) {
          d.lastHealthCheck = now;
          if (payload.appVersion) d.currentVersion = payload.appVersion;
          if (d.status === DeploymentStatus.PENDING) {
            d.status = DeploymentStatus.ACTIVE;
          }
        }
        if (deployments.length > 0) {
          await this.deploymentRepository.save(deployments);
        }
      } catch (err) {
        this.logger.warn(
          `Failed to update deployment heartbeat for tenant ${license.tenantId}: ${(err as Error).message}`,
        );
      }
    }

    // Check for updates
    const latestVersion = await this.getLatestVersion();
    const updateAvailable = latestVersion
      ? this.compareVersions(payload.appVersion, latestVersion.version) < 0
      : false;

    // Build source-bundle URL and find active rollout for this tenant
    let updateUrl: string | undefined;
    let rolloutId: string | undefined;

    if (updateAvailable) {
      // Always provide the license-gated source-bundle URL
      const baseUrl = this.configService.get<string>('CONTROL_PLANE_URL') ||
        'https://hmisdemo.itsolutionsuganda.com';
      updateUrl =
        latestVersion?.downloadUrl ||
        `${baseUrl}/api/v1/deployments/source-bundle?licenseKey=${payload.licenseKey}`;

      // Look up an active rollout for reporting purposes
      if (license.tenantId) {
        rolloutId = await this.findActiveRolloutId(license.tenantId);
      }
    }

    // Calculate expiry warning
    const daysUntilExpiry = Math.ceil(
      (license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    const response: PhoneHomeResponse = {
      status: daysUntilExpiry <= 7 ? 'warning' : 'ok',
      licenseValid: true,
      message: daysUntilExpiry <= 30 ? `License expires in ${daysUntilExpiry} days` : undefined,
      updateAvailable,
      latestVersion: latestVersion?.version,
      updateUrl,
      rolloutId,
    };

    return response;
  }

  /**
   * Get system information for phone home payload
   */
  getSystemInfo(): Record<string, any> {
    return {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: Math.round(os.totalmem() / (1024 * 1024 * 1024)) + 'GB',
      freeMemory: Math.round(os.freemem() / (1024 * 1024 * 1024)) + 'GB',
      nodeVersion: process.version,
      uptime: Math.round(os.uptime() / 3600) + ' hours',
    };
  }

  /**
   * Generate hardware ID for this installation
   */
  getHardwareId(): string {
    const interfaces = os.networkInterfaces();
    const macs: string[] = [];

    for (const name in interfaces) {
      for (const iface of interfaces[name] || []) {
        if (!iface.internal && iface.mac !== '00:00:00:00:00:00') {
          macs.push(iface.mac);
        }
      }
    }

    const data = macs.sort().join(':') + os.hostname() + os.cpus()[0]?.model;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  /**
   * Get phone home records for a license (admin)
   */
  async getRecords(licenseId: string, limit = 100): Promise<PhoneHomeRecord[]> {
    return this.recordRepository.find({
      where: { licenseId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get license dashboard data (admin)
   */
  async getDashboard(): Promise<any> {
    const [totalLicenses, activeLicenses, expiringLicenses] = await Promise.all([
      this.licenseRepository.count(),
      this.licenseRepository.count({ where: { status: 'active' } }),
      this.licenseRepository
        .createQueryBuilder('l')
        .where('l.status = :status', { status: 'active' })
        .andWhere('l.expires_at <= :date', {
          date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        })
        .getCount(),
    ]);

    const recentHeartbeats = await this.recordRepository
      .createQueryBuilder('r')
      .select('r.license_id', 'licenseId')
      .addSelect('MAX(r.created_at)', 'lastSeen')
      .addSelect('r.app_version', 'version')
      .groupBy('r.license_id')
      .addGroupBy('r.app_version')
      .orderBy('lastSeen', 'DESC')
      .limit(20)
      .getRawMany();

    return {
      summary: {
        totalLicenses,
        activeLicenses,
        expiringLicenses,
        suspendedLicenses: await this.licenseRepository.count({ where: { status: 'suspended' } }),
      },
      recentHeartbeats,
    };
  }

  /**
   * Periodic phone home for on-premise installations
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'license-phone-home' })
  async periodicPhoneHome() {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE');
    if (deploymentMode !== 'on-premise') return;

    const licenseKey = this.configService.get<string>('LICENSE_KEY');
    if (!licenseKey) return;

    this.logger.log('Sending periodic phone home...');

    // Gather real usage stats from database
    let activeUsers = 0;
    let totalUsers = 0;
    let totalPatients = 0;
    let totalEncounters = 0;
    try {
      const mgr = this.recordRepository.manager;
      const [userStats] = await mgr.query(
        `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE last_login_at > NOW() - INTERVAL '30 days') AS active FROM users`,
      );
      totalUsers = parseInt(userStats?.total || '0', 10);
      activeUsers = parseInt(userStats?.active || '0', 10);
      const [patientStats] = await mgr.query(`SELECT COUNT(*) AS total FROM patients`);
      totalPatients = parseInt(patientStats?.total || '0', 10);
      const [encounterStats] = await mgr.query(`SELECT COUNT(*) AS total FROM encounters`);
      totalEncounters = parseInt(encounterStats?.total || '0', 10);
    } catch {
      // Tables may not exist; stats are optional
    }

    // Read version from package.json at runtime
    let appVersion = '1.0.0';
    try {
      appVersion = require('../../../package.json').version || '1.0.0';
    } catch { /* fallback */ }

    const payload: PhoneHomePayload = {
      licenseKey,
      hardwareId: this.getHardwareId(),
      appVersion,
      activeUsers,
      totalUsers,
      totalPatients,
      totalEncounters,
      systemInfo: this.getSystemInfo(),
    };

    const response = await this.sendHeartbeat(payload);

    if (response.updateAvailable && response.latestVersion) {
      this.logger.log(`Update available: ${response.latestVersion}`);
      // Notify the update client so it can auto-apply or store for admin
      await this.updateClientService.handleUpdateAvailable({
        version: response.latestVersion,
        updateUrl: response.updateUrl || '',
        rolloutId: response.rolloutId,
      });
    }

    if (response.status === 'error') {
      this.logger.error(`Phone home error: ${response.message}`);
    }
  }

  // ==================== Private Methods ====================

  /**
   * Find the most recent in-progress or scheduled rollout for a tenant's
   * deployments so on-premise instances can report update progress.
   */
  private async findActiveRolloutId(tenantId: string): Promise<string | undefined> {
    try {
      // Deployments belong to a tenant; rollouts reference a release candidate.
      // We look for any rollout that is currently active (in_progress or scheduled).
      const rollout = await this.rolloutRepository
        .createQueryBuilder('r')
        .where('r.status IN (:...statuses)', {
          statuses: [UpdateRolloutStatus.IN_PROGRESS, UpdateRolloutStatus.SCHEDULED],
        })
        .orderBy('r.created_at', 'DESC')
        .getOne();

      return rollout?.id;
    } catch {
      return undefined;
    }
  }

  private async getLatestVersion(): Promise<AppVersion | null> {
    return this.versionRepository.findOne({
      where: { isLatest: true },
    });
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.replace(/^v/, '').split('.').map(Number);
    const parts2 = v2.replace(/^v/, '').split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  }
}
