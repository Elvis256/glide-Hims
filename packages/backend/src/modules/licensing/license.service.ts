import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  ) {
    const secretKey = this.configService.get<string>('LICENSE_SECRET_KEY');
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    if (isProduction && !secretKey) {
      throw new Error('LICENSE_SECRET_KEY environment variable must be set in production');
    }

    this.secretKey = secretKey || 'dev-license-key-not-for-production';
  }

  async onModuleInit() {
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
   * Generate a new license key with cryptographic signature
   */
  async generateLicense(dto: GenerateLicenseDto): Promise<License> {
    const licenseKey = this.generateLicenseKey(dto);
    const signature = this.signLicense(licenseKey, dto);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + dto.validityDays);

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

    // Check expiry
    if (new Date() > license.expiresAt) {
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
      const payload = JSON.stringify({
        key: license.licenseKey,
        org: license.organizationName,
        type: license.licenseType,
        users: license.maxUsers,
        facilities: license.maxFacilities,
      });
      license.signature = crypto
        .createHmac('sha256', this.secretKey)
        .update(payload)
        .digest('hex');
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
    return this.licenseRepository.save(license);
  }

  /**
   * Extend license validity
   */
  async extendLicense(licenseKey: string, additionalDays: number): Promise<License> {
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
    const payload = JSON.stringify({
      key: licenseKey,
      org: dto.organizationName,
      type: dto.licenseType,
      users: dto.maxUsers,
      facilities: dto.maxFacilities,
    });

    return crypto.createHmac('sha256', this.secretKey).update(payload).digest('hex');
  }

  private verifySignature(license: License): boolean {
    if (!license.signature) return false;

    const payload = JSON.stringify({
      key: license.licenseKey,
      org: license.organizationName,
      type: license.licenseType,
      users: license.maxUsers,
      facilities: license.maxFacilities,
    });

    const expectedSignature = crypto
      .createHmac('sha256', this.secretKey)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(Buffer.from(license.signature), Buffer.from(expectedSignature));
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
