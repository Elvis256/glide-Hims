import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppVersion } from '../../database/entities/app-version.entity';

export interface UpdateCheckResult {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion?: string;
  isMandatory?: boolean;
  releaseNotes?: string;
  downloadUrl?: string;
  checksum?: string;
}

@Injectable()
export class UpdatesService {
  private readonly logger = new Logger(UpdatesService.name);

  constructor(
    @InjectRepository(AppVersion)
    private readonly versionRepository: Repository<AppVersion>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Check for available updates
   */
  async checkForUpdates(currentVersion: string): Promise<UpdateCheckResult> {
    const latestVersion = await this.getLatestVersion();

    if (!latestVersion) {
      return { updateAvailable: false, currentVersion };
    }

    const comparison = this.compareVersions(currentVersion, latestVersion.version);

    if (comparison >= 0) {
      return { updateAvailable: false, currentVersion };
    }

    return {
      updateAvailable: true,
      currentVersion,
      latestVersion: latestVersion.version,
      isMandatory: latestVersion.isMandatory,
      releaseNotes: latestVersion.releaseNotes || undefined,
      downloadUrl: latestVersion.downloadUrl || undefined,
      checksum: latestVersion.checksum || undefined,
    };
  }

  /**
   * Get latest version
   */
  async getLatestVersion(): Promise<AppVersion | null> {
    return this.versionRepository.findOne({
      where: { isLatest: true },
    });
  }

  /**
   * Get all versions
   */
  async getAllVersions(limit = 20): Promise<AppVersion[]> {
    return this.versionRepository.find({
      order: { releasedAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get version by version string
   */
  async getVersion(version: string): Promise<AppVersion | null> {
    return this.versionRepository.findOne({
      where: { version },
    });
  }

  /**
   * Create a new version (admin)
   */
  async createVersion(data: Partial<AppVersion>, actorUserId?: string): Promise<AppVersion> {
    // Unset previous latest
    if (data.isLatest) {
      await this.versionRepository.update({ isLatest: true }, { isLatest: false });
    }

    const version = this.versionRepository.create(data);
    const saved = await this.versionRepository.save(version);
    if (saved.isLatest) {
      this.emitPublished(saved, actorUserId);
    }
    return saved;
  }

  /**
   * Set version as latest
   */
  async setLatestVersion(version: string, actorUserId?: string): Promise<AppVersion> {
    await this.versionRepository.update({ isLatest: true }, { isLatest: false });

    const appVersion = await this.versionRepository.findOne({
      where: { version },
    });

    if (!appVersion) {
      throw new Error(`Version ${version} not found`);
    }

    appVersion.isLatest = true;
    const saved = await this.versionRepository.save(appVersion);
    this.emitPublished(saved, actorUserId);
    return saved;
  }

  private emitPublished(appVersion: AppVersion, actorUserId?: string) {
    this.eventEmitter.emit('app-version.published', {
      appVersionId: appVersion.id,
      version: appVersion.version,
      actorUserId,
    });
    this.logger.log(`Emitted app-version.published for v${appVersion.version}`);
  }

  /**
   * Get versions newer than a specific version
   */
  async getVersionsAfter(currentVersion: string): Promise<AppVersion[]> {
    const versions = await this.versionRepository.find({
      order: { releasedAt: 'ASC' },
    });

    return versions.filter((v) => this.compareVersions(currentVersion, v.version) < 0);
  }

  /**
   * Check if version has mandatory updates
   */
  async hasMandatoryUpdates(currentVersion: string): Promise<boolean> {
    const newerVersions = await this.getVersionsAfter(currentVersion);
    return newerVersions.some((v) => v.isMandatory);
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
