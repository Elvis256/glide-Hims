import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { License } from '../../database/entities/license.entity';

const LICENSE_FILE_PATH = '/etc/glide-hims/license.json';

/**
 * Seeds the local database with license data from the offline license file
 * on application startup. Only active on on-premise and hybrid deployments.
 */
@Injectable()
export class LicenseBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LicenseBootstrapService.name);

  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    const mode = this.configService.get<string>('DEPLOYMENT_MODE');
    if (mode !== 'on-premise' && mode !== 'hybrid') return;

    try {
      await this.bootstrapLicense();
    } catch (err) {
      this.logger.error(`License bootstrap failed: ${(err as Error).message}`);
    }
  }

  async bootstrapLicense() {
    const filePath = this.configService.get<string>('LICENSE_FILE_PATH') || LICENSE_FILE_PATH;

    if (!fs.existsSync(filePath)) {
      this.logger.debug(`No offline license file at ${filePath} — skipping bootstrap`);
      return;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      this.logger.error(`Invalid JSON in license file ${filePath}`);
      return;
    }

    if (!data.licenseKey || !data.signature) {
      this.logger.error('License file missing required fields (licenseKey, signature)');
      return;
    }

    // Verify HMAC signature before trusting the file
    const secretKey = data.secretKey || this.configService.get<string>('LICENSE_SECRET_KEY') || '';
    if (!this.verifyFileSignature(data, secretKey)) {
      this.logger.error('License file signature verification failed — file may be tampered');
      return;
    }

    const existing = await this.licenseRepository.findOne({
      where: { licenseKey: data.licenseKey },
    });

    if (existing) {
      // Update only if the file has a later expiry (i.e. a renewed license)
      const fileExpiry = new Date(data.expiresAt).getTime();
      const dbExpiry = existing.expiresAt.getTime();

      if (fileExpiry > dbExpiry) {
        existing.expiresAt = new Date(data.expiresAt);
        existing.signature = data.signature;
        existing.status = data.status || 'active';
        existing.maxUsers = data.maxUsers ?? existing.maxUsers;
        existing.maxFacilities = data.maxFacilities ?? existing.maxFacilities;
        existing.enabledModules = data.enabledModules ?? existing.enabledModules;
        existing.features = data.features ?? existing.features;
        existing.validationFailures = 0;
        await this.licenseRepository.save(existing);
        this.logger.log(
          `License updated from offline file: ${data.licenseKey} (new expiry: ${data.expiresAt})`,
        );
      } else {
        this.logger.debug(`License ${data.licenseKey} already up-to-date in local DB — skipping`);
      }
      return;
    }

    // Insert new license from file
    const license = this.licenseRepository.create({
      licenseKey: data.licenseKey,
      organizationName: data.organizationName || 'Unknown',
      email: data.email || null,
      licenseType: data.licenseType || 'standard',
      maxUsers: data.maxUsers ?? 50,
      maxFacilities: data.maxFacilities ?? 5,
      enabledModules: data.enabledModules || [],
      features: data.features || {},
      issuedAt: data.issuedAt ? new Date(data.issuedAt) : new Date(),
      expiresAt: new Date(data.expiresAt),
      status: data.status || 'active',
      signature: data.signature,
      hardwareId: data.hardwareId || null,
      tenantId: data.tenantId || null,
    });

    await this.licenseRepository.save(license);
    this.logger.log(`License bootstrapped from offline file: ${data.licenseKey}`);
  }

  private verifyFileSignature(data: Record<string, any>, secretKey: string): boolean {
    if (!secretKey || !data.signature) return false;

    const payload = JSON.stringify({
      key: data.licenseKey,
      org: data.organizationName,
      type: data.licenseType,
      users: data.maxUsers,
      facilities: data.maxFacilities,
      status: data.status,
      expiresAt: data.expiresAt ? new Date(data.expiresAt).toISOString() : undefined,
    });

    const expected = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');

    if (expected.length !== data.signature.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(data.signature));
  }
}
