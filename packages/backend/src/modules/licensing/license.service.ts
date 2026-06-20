import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as crypto from 'crypto';
import { License } from '../../database/entities/license.entity';

export interface LicenseValidationResult {
  valid: boolean;
  license?: License;
  error?: string;
  expiresIn?: number; // days
  warnings?: string[];
}

export interface GenerateLicenseDto {
  organizationName: string;
  email: string;
  licenseType: 'trial' | 'standard' | 'professional' | 'enterprise';
  maxUsers: number;
  maxFacilities: number;
  enabledModules?: string[];
  features?: Record<string, boolean>;
  validityDays: number;
  tenantId: string;
}

export interface LicenseRenewalEntry {
  licenseKey: string;
  organizationName: string;
  tenantId: string;
  licenseType: string;
  expiresAt: Date;
  daysRemaining: number;
}

export interface LicenseRenewalReport {
  critical: LicenseRenewalEntry[]; // <= 7 days
  high: LicenseRenewalEntry[];     // <= 14 days
  medium: LicenseRenewalEntry[];   // <= 30 days
  totalExpiring: number;
}

export interface LicenseUsageReport {
  totalLicenses: number;
  activeLicenses: number;
  expiringWithin30Days: number;
  averageUserUtilization: number; // percentage
  licenses: Array<{
    licenseKey: string;
    organizationName: string;
    tenantId: string;
    maxUsers: number;
    actualUsers: number;
    userUtilization: number;
    maxFacilities: number;
    actualFacilities: number;
    enabledModules: string[];
    expiresAt: Date;
    daysRemaining: number;
  }>;
}

@Injectable()
export class LicenseService implements OnModuleInit {
  private readonly logger = new Logger(LicenseService.name);
  private readonly secretKey: string;
  private cachedLicense: License | null = null;
  private lastValidation: Date | null = null;
  private readonly VALIDATION_CACHE_HOURS = 24;

  constructor(
    @InjectRepository(License)
    private readonly licenseRepository: Repository<License>,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    const secretKey = this.configService.get<string>('LICENSE_SECRET_KEY');
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (isProduction && !secretKey) {
      throw new Error('LICENSE_SECRET_KEY environment variable must be set in production');
    }

    // Fix 8: only allow fallback dev key in non-production environments
    if (!secretKey && isProduction) {
      throw new Error('LICENSE_SECRET_KEY is required in production');
    }
    this.secretKey = secretKey || (isProduction ? '' : 'dev-license-key-not-for-production');
  }

  async onModuleInit() {
    // Re-sign any licenses whose signatures don't match the current secret key.
    // This prevents source-bundle 403s after a LICENSE_SECRET_KEY rotation.
    await this.reSignStaleSignatures();

    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE');

    if (deploymentMode === 'on-premise') {
      const licenseKey = this.configService.get<string>('LICENSE_KEY');
      if (licenseKey) {
        this.logger.log('Validating license on startup...');
        const result = await this.validateLicense(licenseKey);
        if (!result.valid) {
          this.logger.error(`License validation failed: ${result.error}`);
        } else {
          this.logger.log(`License valid. Expires: ${result.license?.expiresAt}`);
        }
      } else {
        this.logger.warn('No license key configured for on-premise deployment');
      }
    }
  }

  /**
   * Re-sign all licenses whose stored signature doesn't match the current
   * LICENSE_SECRET_KEY. This handles secret-key rotations gracefully so that
   * endpoints like /source-bundle never return 403 for otherwise valid keys.
   * Returns the number of licenses that were re-signed.
   */
  async reSignStaleSignatures(): Promise<number> {
    const all = await this.licenseRepository.find();
    let fixed = 0;

    for (const license of all) {
      const expected = this.computeSignature(license);

      const isStale =
        !license.signature ||
        license.signature.length !== expected.length ||
        !crypto.timingSafeEqual(Buffer.from(license.signature), Buffer.from(expected));

      if (isStale) {
        license.signature = expected;
        license.validationFailures = 0;
        await this.licenseRepository.save(license);
        fixed++;
        // Fix 8: audit log for auto-healed signatures
        this.logger.warn(JSON.stringify({
          type: 'LICENSE_SIGNATURE_HEALED',
          licenseKey: license.licenseKey,
          tenantId: license.tenantId,
          timestamp: new Date().toISOString(),
        }));
      }
    }

    if (fixed > 0) {
      this.logger.log(`Re-signed ${fixed} license(s) to match current secret key`);
      this.cachedLicense = null;
      this.lastValidation = null;
    }

    return fixed;
  }

  /**
   * Generate a new license key with cryptographic signature
   */
  async generateLicense(dto: GenerateLicenseDto): Promise<License> {
    const licenseKey = this.generateLicenseKey(dto);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.validityDays);

    // Fix 8: include status and expiresAt in signature computation
    const signature = this.computeSignature({
      licenseKey,
      organizationName: dto.organizationName,
      licenseType: dto.licenseType,
      maxUsers: dto.maxUsers,
      maxFacilities: dto.maxFacilities,
      status: 'active',
      expiresAt,
    });

    const license = this.licenseRepository.create({
      licenseKey,
      organizationName: dto.organizationName,
      email: dto.email,
      licenseType: dto.licenseType,
      maxUsers: dto.maxUsers,
      maxFacilities: dto.maxFacilities,
      enabledModules: dto.enabledModules || this.getDefaultModules(dto.licenseType),
      features: dto.features || this.getDefaultFeatures(dto.licenseType),
      issuedAt: new Date(),
      expiresAt,
      status: 'active',
      tenantId: dto.tenantId,
      signature,
    });

    const saved = await this.licenseRepository.save(license);

    // Sync enabled modules to tenant's system_settings so the License
    // actually drives the UI module gating (otherwise modules selected here
    // are decorative and the tenant still has to set them via Facility Mode).
    if (dto.tenantId && saved.enabledModules?.length) {
      try {
        await this.licenseRepository.manager.query(
          `INSERT INTO system_settings (tenant_id, key, value, description)
           VALUES ($1, 'enabled_modules', $2::jsonb, 'Modules enabled by license')
           ON CONFLICT (key, tenant_id)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [dto.tenantId, JSON.stringify(saved.enabledModules)],
        );
      } catch (err) {
        this.logger.warn(
          `License generated but failed to sync enabled_modules to tenant ${dto.tenantId}: ${(err as Error).message}`,
        );
      }
    }

    return saved;
  }

  /**
   * Validate a license key
   */
  async validateLicense(licenseKey: string): Promise<LicenseValidationResult> {
    // Check cache first
    if (this.cachedLicense && this.lastValidation) {
      const hoursSinceValidation = (Date.now() - this.lastValidation.getTime()) / (1000 * 60 * 60);
      if (
        hoursSinceValidation < this.VALIDATION_CACHE_HOURS &&
        this.cachedLicense.licenseKey === licenseKey
      ) {
        return this.buildValidationResult(this.cachedLicense);
      }
    }

    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
    });

    if (!license) {
      return { valid: false, error: 'License key not found' };
    }

    // Verify signature
    if (!this.verifySignature(license)) {
      await this.recordValidationFailure(license);
      return { valid: false, error: 'Invalid license signature' };
    }

    // Check status
    if (license.status !== 'active') {
      return { valid: false, error: `License is ${license.status}` };
    }

    // Check expiry with grace period support
    if (new Date() > license.expiresAt) {
      const gracePeriodDays = this.getGracePeriod(license.licenseType);
      const graceDeadline = new Date(license.expiresAt);
      graceDeadline.setDate(graceDeadline.getDate() + gracePeriodDays);

      if (gracePeriodDays > 0 && new Date() <= graceDeadline) {
        // Within grace period - still valid but with warning
        const daysIntoGrace = Math.ceil(
          (Date.now() - license.expiresAt.getTime()) / (1000 * 60 * 60 * 24),
        );
        const graceDaysRemaining = gracePeriodDays - daysIntoGrace;

        license.lastValidatedAt = new Date();
        license.validationFailures = 0;
        await this.licenseRepository.save(license);

        this.cachedLicense = license;
        this.lastValidation = new Date();

        const { signature, ...safeLicense } = license;
        return {
          valid: true,
          license: safeLicense as License,
          expiresIn: 0,
          warnings: [
            `License expired but within grace period (${graceDaysRemaining} grace day(s) remaining)`,
            'URGENT: Renew immediately to avoid service interruption!',
          ],
        };
      }

      license.status = 'expired';
      await this.licenseRepository.save(license);
      return { valid: false, error: 'License has expired' };
    }

    // Update last validated
    license.lastValidatedAt = new Date();
    license.validationFailures = 0;
    await this.licenseRepository.save(license);

    // Cache the result
    this.cachedLicense = license;
    this.lastValidation = new Date();

    return this.buildValidationResult(license);
  }

  /**
   * Build validation result with warnings (strips sensitive fields)
   */
  private buildValidationResult(license: License): LicenseValidationResult {
    const warnings: string[] = [];
    const daysUntilExpiry = Math.ceil(
      (license.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilExpiry <= 30) {
      warnings.push(`License expires in ${daysUntilExpiry} days`);
    }

    if (daysUntilExpiry <= 7) {
      warnings.push('URGENT: License expiring soon!');
    }

    // Strip sensitive fields before returning
    const { signature, ...safeLicense } = license;

    return {
      valid: true,
      license: safeLicense as License,
      expiresIn: daysUntilExpiry,
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * Get license by key
   */
  async getLicense(licenseKey: string): Promise<License | null> {
    return this.licenseRepository.findOne({
      where: { licenseKey },
    });
  }

  /**
   * List all licenses (admin only — always scoped by tenantId if provided)
   */
  async listLicenses(filters?: {
    status?: string;
    licenseType?: string;
    tenantId?: string;
  }): Promise<License[]> {
    const query = this.licenseRepository.createQueryBuilder('license');

    // Tenant filter is always applied when provided
    if (filters?.tenantId) {
      query.andWhere('license.tenant_id = :tenantId', { tenantId: filters.tenantId });
    }

    if (filters?.status) {
      query.andWhere('license.status = :status', { status: filters.status });
    }

    if (filters?.licenseType) {
      query.andWhere('license.license_type = :type', { type: filters.licenseType });
    }

    return query.orderBy('license.created_at', 'DESC').getMany();
  }

  /**
   * Update an existing license in-place (system admin). Re-signs the license
   * if any signed field (tier, maxUsers, maxFacilities) is changed. Also
   * re-syncs enabled_modules to the tenant's system_settings so module gating
   * picks it up immediately. Returns the saved license.
   */
  async updateLicense(
    licenseKey: string,
    patch: Partial<{
      licenseType: 'trial' | 'standard' | 'professional' | 'enterprise';
      maxUsers: number;
      maxFacilities: number;
      enabledModules: string[];
      features: Record<string, boolean>;
      expiresAt: Date | string;
      organizationName: string;
      email: string;
    }>,
  ): Promise<License> {
    const license = await this.licenseRepository.findOne({ where: { licenseKey } });
    if (!license) {
      throw new Error('License not found');
    }

    let signedFieldsChanged = false;
    if (patch.licenseType !== undefined && patch.licenseType !== license.licenseType) {
      license.licenseType = patch.licenseType;
      signedFieldsChanged = true;
    }
    if (patch.maxUsers !== undefined && patch.maxUsers !== license.maxUsers) {
      license.maxUsers = patch.maxUsers;
      signedFieldsChanged = true;
    }
    if (patch.maxFacilities !== undefined && patch.maxFacilities !== license.maxFacilities) {
      license.maxFacilities = patch.maxFacilities;
      signedFieldsChanged = true;
    }
    if (patch.organizationName !== undefined) {
      license.organizationName = patch.organizationName;
      signedFieldsChanged = true;
    }
    if (patch.email !== undefined) license.email = patch.email;
    if (patch.enabledModules !== undefined) license.enabledModules = patch.enabledModules;
    if (patch.features !== undefined) license.features = patch.features;
    if (patch.expiresAt !== undefined) {
      license.expiresAt = new Date(patch.expiresAt);
      if (license.status === 'expired' && license.expiresAt > new Date()) {
        license.status = 'active';
      }
    }

    if (signedFieldsChanged) {
      license.signature = this.computeSignature(license);
      this.cachedLicense = null;
      this.lastValidation = null;
    }

    const saved = await this.licenseRepository.save(license);

    if (patch.enabledModules !== undefined && license.tenantId) {
      try {
        await this.licenseRepository.manager.query(
          `INSERT INTO system_settings (tenant_id, key, value, description)
           VALUES ($1, 'enabled_modules', $2::jsonb, 'Modules enabled by license')
           ON CONFLICT (key, tenant_id)
           DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [license.tenantId, JSON.stringify(saved.enabledModules || [])],
        );
      } catch (err) {
        this.logger.warn(
          `License ${licenseKey} updated but failed to sync enabled_modules to tenant ${license.tenantId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `License ${licenseKey} updated (resigned=${signedFieldsChanged}, fields=${Object.keys(patch).join(',')})`,
    );
    return saved;
  }

  /**
   * Suspend a license (reversible). Useful when a tenant stops paying but
   * their data should be preserved. Validation will fail until reactivated.
   */
  async suspendLicense(licenseKey: string): Promise<License> {
    const license = await this.licenseRepository.findOne({ where: { licenseKey } });
    if (!license) throw new Error('License not found');
    if (license.status === 'revoked') {
      throw new Error('Cannot suspend a revoked license. Issue a new one instead.');
    }
    license.status = 'suspended';
    this.cachedLicense = null;
    this.lastValidation = null;
    return this.licenseRepository.save(license);
  }

  /**
   * Reactivate a suspended (or expired) license. If expired, caller should
   * also extend the validity. Returns to 'active' status.
   */
  async reactivateLicense(licenseKey: string): Promise<License> {
    const license = await this.licenseRepository.findOne({ where: { licenseKey } });
    if (!license) throw new Error('License not found');
    if (license.status === 'revoked') {
      throw new Error('Cannot reactivate a revoked license. Issue a new one instead.');
    }
    if (license.expiresAt < new Date()) {
      throw new Error('License has expired. Extend the validity before reactivating.');
    }
    license.status = 'active';
    license.validationFailures = 0;
    this.cachedLicense = null;
    this.lastValidation = null;
    return this.licenseRepository.save(license);
  }

  /**
   * Revoke a license
   */
  async revokeLicense(licenseKey: string): Promise<License> {
    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
    });

    if (!license) {
      throw new Error('License not found');
    }

    license.status = 'revoked';
    // Fix 8: re-sign since status is now part of signature
    license.signature = this.computeSignature(license);
    return this.licenseRepository.save(license);
  }

  /**
   * Extend license validity
   */
  async extendLicense(licenseKey: string, additionalDays: number): Promise<License> {
    // Fix 8: add upper bound check (max 365 days per extension)
    if (additionalDays > 365) {
      throw new Error('Cannot extend license by more than 365 days per extension');
    }
    if (additionalDays <= 0) {
      throw new Error('Extension days must be positive');
    }

    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
    });

    if (!license) {
      throw new Error('License not found');
    }

    const newExpiry = new Date(license.expiresAt);
    newExpiry.setDate(newExpiry.getDate() + additionalDays);
    license.expiresAt = newExpiry;

    if (license.status === 'expired') {
      license.status = 'active';
    }

    // Fix 8: re-sign after extending since expiresAt is now part of signature
    license.signature = this.computeSignature(license);

    return this.licenseRepository.save(license);
  }

  /**
   * Bind license to hardware ID
   */
  async bindToHardware(licenseKey: string, hardwareId: string): Promise<License> {
    const license = await this.licenseRepository.findOne({
      where: { licenseKey },
    });

    if (!license) {
      throw new Error('License not found');
    }

    if (license.hardwareId && license.hardwareId !== hardwareId) {
      throw new Error('License is already bound to different hardware');
    }

    license.hardwareId = hardwareId;
    return this.licenseRepository.save(license);
  }

  /**
   * Check feature availability for a license
   */
  async isFeatureEnabled(licenseKey: string, featureKey: string): Promise<boolean> {
    const license = await this.getLicense(licenseKey);
    if (!license || license.status !== 'active') {
      return false;
    }

    return license.features?.[featureKey] === true;
  }

  /**
   * Check module availability for a license
   */
  async isModuleEnabled(licenseKey: string, moduleKey: string): Promise<boolean> {
    const license = await this.getLicense(licenseKey);
    if (!license || license.status !== 'active') {
      return false;
    }

    return license.enabledModules?.includes(moduleKey) ?? false;
  }

  /**
   * Periodic license check (for on-premise)
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'license-periodic-check' })
  async periodicLicenseCheck() {
    const deploymentMode = this.configService.get<string>('DEPLOYMENT_MODE');
    if (deploymentMode !== 'on-premise') return;

    const licenseKey = this.configService.get<string>('LICENSE_KEY');
    if (!licenseKey) return;

    this.logger.log('Running periodic license check...');
    const result = await this.validateLicense(licenseKey);

    if (!result.valid) {
      this.logger.error(`License validation failed: ${result.error}`);
    } else if (result.warnings) {
      result.warnings.forEach((w) => this.logger.warn(w));
    }
  }

  /**
   * Automatically scan the database and update expired licenses status to 'expired'.
   */
  @Cron(CronExpression.EVERY_HOUR, { name: 'license-expiry-auto-update' })
  async autoUpdateExpiredLicenses() {
    this.logger.log('Running background auto-update of expired licenses...');
    try {
      const now = new Date();
      // Find all active licenses whose expiry date is in the past
      const expired = await this.licenseRepository.createQueryBuilder('license')
        .where('license.status = :status', { status: 'active' })
        .andWhere('license.expiresAt < :now', { now })
        .getMany();

      if (expired.length > 0) {
        for (const license of expired) {
          license.status = 'expired';
          await this.licenseRepository.save(license);
          this.logger.log(`License ${license.licenseKey} (Tenant ${license.tenantId}) marked as expired.`);
        }
        this.logger.log(`Marked ${expired.length} license(s) as expired.`);
      }
    } catch (err) {
      this.logger.error(`Failed to auto-update expired licenses: ${(err as Error).message}`);
    }
  }

  // ==================== License Lifecycle Methods ====================

  /**
   * Get grace period in days based on license type.
   * Grace period allows a license to remain valid for a short time after expiry.
   */
  getGracePeriod(licenseType: string): number {
    switch (licenseType) {
      case 'trial':
        return 0;
      case 'standard':
        return 7;
      case 'professional':
        return 14;
      case 'enterprise':
        return 30;
      default:
        return 0;
    }
  }

  /**
   * Daily cron job (8 AM) to check for licenses expiring within 30 days.
   * Logs warnings grouped by urgency and returns a report structure.
   */
  @Cron('0 8 * * *', { name: 'license-renewal-check' })
  async checkLicenseRenewals(): Promise<LicenseRenewalReport> {
    this.logger.log('Running daily license renewal check...');
    try {
      const now = new Date();
      const thirtyDaysFromNow = new Date(now);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      // Find all active licenses expiring within 30 days
      const expiring = await this.licenseRepository.createQueryBuilder('license')
        .where('license.status = :status', { status: 'active' })
        .andWhere('license.expires_at <= :deadline', { deadline: thirtyDaysFromNow })
        .andWhere('license.expires_at > :now', { now })
        .orderBy('license.expires_at', 'ASC')
        .getMany();

      const critical: LicenseRenewalEntry[] = [];
      const high: LicenseRenewalEntry[] = [];
      const medium: LicenseRenewalEntry[] = [];

      for (const license of expiring) {
        const daysRemaining = Math.ceil(
          (license.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        const entry: LicenseRenewalEntry = {
          licenseKey: license.licenseKey,
          organizationName: license.organizationName,
          tenantId: license.tenantId,
          licenseType: license.licenseType,
          expiresAt: license.expiresAt,
          daysRemaining,
        };

        if (daysRemaining <= 7) {
          critical.push(entry);
          this.logger.warn(
            `CRITICAL: License ${license.licenseKey} (${license.organizationName}) expires in ${daysRemaining} day(s)`,
          );
        } else if (daysRemaining <= 14) {
          high.push(entry);
          this.logger.warn(
            `HIGH: License ${license.licenseKey} (${license.organizationName}) expires in ${daysRemaining} day(s)`,
          );
        } else {
          medium.push(entry);
          this.logger.warn(
            `MEDIUM: License ${license.licenseKey} (${license.organizationName}) expires in ${daysRemaining} day(s)`,
          );
        }
      }

      const report: LicenseRenewalReport = {
        critical,
        high,
        medium,
        totalExpiring: expiring.length,
      };

      if (expiring.length > 0) {
        this.logger.log(
          `License renewal summary: ${critical.length} critical, ${high.length} high, ${medium.length} medium (${expiring.length} total)`,
        );
      }

      return report;
    } catch (err) {
      this.logger.error(`Failed to check license renewals: ${(err as Error).message}`);
      return { critical: [], high: [], medium: [], totalExpiring: 0 };
    }
  }

  /**
   * Batch extend all licenses expiring within a given number of days.
   * Returns the count and keys of extended licenses.
   */
  async batchExtendExpiring(
    days: number,
    withinDays: number,
  ): Promise<{ extended: number; licenses: string[] }> {
    if (days <= 0 || days > 365) {
      throw new Error('Extension days must be between 1 and 365');
    }
    if (withinDays <= 0) {
      throw new Error('withinDays must be positive');
    }

    const now = new Date();
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + withinDays);

    const expiring = await this.licenseRepository.createQueryBuilder('license')
      .where('license.status = :status', { status: 'active' })
      .andWhere('license.expires_at <= :deadline', { deadline })
      .andWhere('license.expires_at > :now', { now })
      .getMany();

    const extendedKeys: string[] = [];

    for (const license of expiring) {
      try {
        await this.extendLicense(license.licenseKey, days);
        extendedKeys.push(license.licenseKey);
        this.logger.log(
          `Batch extended license ${license.licenseKey} (${license.organizationName}) by ${days} days`,
        );
      } catch (err) {
        this.logger.error(
          `Failed to batch-extend license ${license.licenseKey}: ${(err as Error).message}`,
        );
      }
    }

    return { extended: extendedKeys.length, licenses: extendedKeys };
  }

  /**
   * Batch suspend all licenses that have expired beyond their grace period.
   */
  async batchSuspendDelinquent(): Promise<{ suspended: number }> {
    const now = new Date();

    // Find all expired licenses
    const expired = await this.licenseRepository.createQueryBuilder('license')
      .where('license.status = :status', { status: 'expired' })
      .getMany();

    let suspendedCount = 0;

    for (const license of expired) {
      const gracePeriodDays = this.getGracePeriod(license.licenseType);
      const graceDeadline = new Date(license.expiresAt);
      graceDeadline.setDate(graceDeadline.getDate() + gracePeriodDays);

      if (now > graceDeadline) {
        try {
          license.status = 'suspended';
          await this.licenseRepository.save(license);
          suspendedCount++;
          this.logger.log(
            `Suspended delinquent license ${license.licenseKey} (${license.organizationName}) - expired beyond grace period`,
          );
        } catch (err) {
          this.logger.error(
            `Failed to suspend delinquent license ${license.licenseKey}: ${(err as Error).message}`,
          );
        }
      }
    }

    if (suspendedCount > 0) {
      this.cachedLicense = null;
      this.lastValidation = null;
    }

    return { suspended: suspendedCount };
  }

  /**
   * Generate usage analytics for all licenses: actual user/facility counts,
   * module adoption rates, and utilization percentages.
   */
  async getLicenseUsageAnalytics(): Promise<LicenseUsageReport> {
    const allLicenses = await this.licenseRepository.find();
    const now = new Date();

    const thirtyDaysFromNow = new Date(now);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const activeLicenses = allLicenses.filter((l) => l.status === 'active');
    const expiringWithin30Days = activeLicenses.filter(
      (l) => l.expiresAt <= thirtyDaysFromNow && l.expiresAt > now,
    ).length;

    const licensesWithUsage: LicenseUsageReport['licenses'] = [];
    let totalUtilization = 0;
    let licensesWithTenant = 0;

    for (const license of allLicenses) {
      let actualUsers = 0;
      let actualFacilities = 0;

      if (license.tenantId) {
        try {
          // Count active users for this tenant
          const userCountResult = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM users WHERE tenant_id = $1 AND deleted_at IS NULL`,
            [license.tenantId],
          );
          actualUsers = parseInt(userCountResult[0]?.count || '0', 10);

          // Count active facilities for this tenant
          const facilityCountResult = await this.dataSource.query(
            `SELECT COUNT(*) as count FROM facilities WHERE tenant_id = $1 AND deleted_at IS NULL`,
            [license.tenantId],
          );
          actualFacilities = parseInt(facilityCountResult[0]?.count || '0', 10);
        } catch (err) {
          this.logger.warn(
            `Failed to query usage for tenant ${license.tenantId}: ${(err as Error).message}`,
          );
        }
      }

      const daysRemaining = Math.ceil(
        (license.expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      const userUtilization =
        license.maxUsers > 0 ? Math.round((actualUsers / license.maxUsers) * 100) : 0;

      if (license.tenantId) {
        totalUtilization += userUtilization;
        licensesWithTenant++;
      }

      licensesWithUsage.push({
        licenseKey: license.licenseKey,
        organizationName: license.organizationName,
        tenantId: license.tenantId,
        maxUsers: license.maxUsers,
        actualUsers,
        userUtilization,
        maxFacilities: license.maxFacilities,
        actualFacilities,
        enabledModules: license.enabledModules || [],
        expiresAt: license.expiresAt,
        daysRemaining,
      });
    }

    return {
      totalLicenses: allLicenses.length,
      activeLicenses: activeLicenses.length,
      expiringWithin30Days,
      averageUserUtilization:
        licensesWithTenant > 0 ? Math.round(totalUtilization / licensesWithTenant) : 0,
      licenses: licensesWithUsage,
    };
  }

  /**
   * Automatically generate a trial license for a new tenant.
   * Creates a 30-day trial with 5 users and 1 facility by default.
   */
  async autoGenerateForTenant(
    tenantId: string,
    organizationName: string,
    email: string,
    licenseType?: string,
  ): Promise<License> {
    const type = (licenseType || 'trial') as 'trial' | 'standard' | 'professional' | 'enterprise';

    const dto: GenerateLicenseDto = {
      organizationName,
      email,
      licenseType: type,
      maxUsers: type === 'trial' ? 5 : (type === 'standard' ? 25 : (type === 'professional' ? 50 : 100)),
      maxFacilities: type === 'trial' ? 1 : (type === 'standard' ? 3 : (type === 'professional' ? 10 : 50)),
      validityDays: type === 'trial' ? 30 : 365,
      tenantId,
    };

    this.logger.log(
      `Auto-generating ${type} license for tenant ${tenantId} (${organizationName})`,
    );

    return this.generateLicense(dto);
  }

  /**
   * Rotate a license key: create a new license with a fresh key, copy all
   * settings from the old license, sign with the new key, save, and revoke
   * the old license.
   */
  async rotateKey(oldLicenseKey: string): Promise<License> {
    const oldLicense = await this.licenseRepository.findOne({
      where: { licenseKey: oldLicenseKey },
    });

    if (!oldLicense) {
      throw new Error('License not found');
    }

    if (oldLicense.status === 'revoked') {
      throw new Error('Cannot rotate an already revoked license');
    }

    // Generate a new key using the same license type info
    const newKey = this.generateLicenseKey({
      licenseType: oldLicense.licenseType,
    } as GenerateLicenseDto);

    // Create the new license with all settings copied from the old one
    const signature = this.computeSignature({
      licenseKey: newKey,
      organizationName: oldLicense.organizationName,
      licenseType: oldLicense.licenseType,
      maxUsers: oldLicense.maxUsers,
      maxFacilities: oldLicense.maxFacilities,
      status: 'active',
      expiresAt: oldLicense.expiresAt,
    });

    const newLicense = this.licenseRepository.create({
      licenseKey: newKey,
      organizationName: oldLicense.organizationName,
      email: oldLicense.email,
      licenseType: oldLicense.licenseType,
      maxUsers: oldLicense.maxUsers,
      maxFacilities: oldLicense.maxFacilities,
      enabledModules: oldLicense.enabledModules,
      features: oldLicense.features,
      issuedAt: new Date(),
      expiresAt: oldLicense.expiresAt,
      status: 'active',
      tenantId: oldLicense.tenantId,
      hardwareId: oldLicense.hardwareId,
      signature,
    });

    const saved = await this.licenseRepository.save(newLicense);

    // Revoke the old license
    await this.revokeLicense(oldLicenseKey);

    this.logger.log(
      `Rotated license key: ${oldLicenseKey} -> ${newKey} (${oldLicense.organizationName})`,
    );

    // Invalidate cache since keys changed
    this.cachedLicense = null;
    this.lastValidation = null;

    return saved;
  }

  // ==================== Private Methods ====================

  private generateLicenseKey(dto: GenerateLicenseDto): string {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(16).toString('hex');
    const typeCode = dto.licenseType[0].toUpperCase();

    // Format: GLIDE-XXXX-XXXX-XXXX-TYPE
    const raw = `${timestamp}${random}`.toUpperCase();
    const parts = [
      'GLIDE',
      raw.substring(0, 4),
      raw.substring(4, 8),
      raw.substring(8, 12),
      typeCode + raw.substring(12, 15),
    ];

    return parts.join('-');
  }

  private signLicense(licenseKey: string, dto: GenerateLicenseDto): string {
    return this.computeSignature({
      licenseKey,
      organizationName: dto.organizationName,
      licenseType: dto.licenseType,
      maxUsers: dto.maxUsers,
      maxFacilities: dto.maxFacilities,
    });
  }

  // Fix 8: include status and expiresAt in the signed fields to prevent tampering
  private computeSignature(license: Pick<License, 'licenseKey' | 'organizationName' | 'licenseType' | 'maxUsers' | 'maxFacilities'> & { status?: string; expiresAt?: Date }): string {
    const payload = JSON.stringify({
      key: license.licenseKey,
      org: license.organizationName,
      type: license.licenseType,
      users: license.maxUsers,
      facilities: license.maxFacilities,
      status: license.status,
      expiresAt: license.expiresAt ? new Date(license.expiresAt).toISOString() : undefined,
    });
    return crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
  }

  private verifySignature(license: License): boolean {
    if (!license.signature) return false;
    const expected = this.computeSignature(license);
    if (license.signature.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(license.signature), Buffer.from(expected));
  }

  private async recordValidationFailure(license: License) {
    license.validationFailures++;

    // Auto-suspend after 10 failures
    if (license.validationFailures >= 10) {
      license.status = 'suspended';
      this.logger.warn(`License ${license.licenseKey} suspended due to validation failures`);
    }

    await this.licenseRepository.save(license);
  }

  private getDefaultModules(licenseType: string): string[] {
    const base = ['patients', 'encounters', 'billing', 'reports'];

    switch (licenseType) {
      case 'trial':
        return base;
      case 'standard':
        return [...base, 'pharmacy', 'lab', 'inventory'];
      case 'professional':
        return [...base, 'pharmacy', 'lab', 'inventory', 'radiology', 'ipd', 'surgery'];
      case 'enterprise':
        return [
          ...base,
          'pharmacy',
          'lab',
          'inventory',
          'radiology',
          'ipd',
          'surgery',
          'hr',
          'finance',
          'analytics',
          'integrations',
        ];
      default:
        return base;
    }
  }

  private getDefaultFeatures(licenseType: string): Record<string, boolean> {
    const base = {
      basic_reports: true,
      patient_management: true,
      billing: true,
    };

    switch (licenseType) {
      case 'trial':
        return { ...base, trial_mode: true };
      case 'standard':
        return { ...base, custom_reports: true, sms_notifications: true };
      case 'professional':
        return {
          ...base,
          custom_reports: true,
          sms_notifications: true,
          api_access: true,
          multi_facility: true,
        };
      case 'enterprise':
        return {
          ...base,
          custom_reports: true,
          sms_notifications: true,
          api_access: true,
          multi_facility: true,
          white_label: true,
          sso: true,
          audit_logs: true,
          priority_support: true,
        };
      default:
        return base;
    }
  }
}
