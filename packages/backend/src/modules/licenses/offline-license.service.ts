import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { OfflineLicense } from './offline-license.entity';
import * as crypto from 'crypto';

@Injectable()
export class OfflineLicenseService {
  private readonly LICENSE_SECRET = process.env.LICENSE_SECRET || 'glide-hims-offline-default-secret-change-in-production';

  constructor(
    @InjectRepository(OfflineLicense)
    private readonly licenseRepo: Repository<OfflineLicense>,
  ) {}

  /**
   * Generate offline license key: GLI-STD-{DATE}-{RANDOM}-{SIGNATURE}
   */
  generateLicenseKey(
    type: 'standalone' | 'hybrid' | 'saas',
    organization: string,
  ): string {
    const typeCode = type === 'standalone' ? 'STD' : type === 'hybrid' ? 'HYB' : 'SAA';
    const dateCode = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomCode = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
    
    const baseKey = `GLI-${typeCode}-${dateCode}-${randomCode}`;
    const signature = this.calculateSignature(baseKey);
    
    return `${baseKey}-${signature}`;
  }

  /**
   * Calculate HMAC-SHA256 signature for license key
   */
  private calculateSignature(baseKey: string): string {
    const hmac = crypto.createHmac('sha256', this.LICENSE_SECRET);
    hmac.update(baseKey);
    return hmac.digest('hex').slice(0, 8).toUpperCase();
  }

  /**
   * Validate license key signature (local, no server needed)
   */
  validateLicenseSignature(licenseKey: string): boolean {
    try {
      const parts = licenseKey.split('-');
      if (parts.length !== 5) return false;

      const baseKey = parts.slice(0, 4).join('-');
      const providedSignature = parts[4];
      const expectedSignature = this.calculateSignature(baseKey);

      return providedSignature === expectedSignature;
    } catch {
      return false;
    }
  }

  /**
   * Create offline license record
   */
  async createLicense(
    organizationName: string,
    licenseType: 'standalone' | 'hybrid' | 'saas',
    tier: 'community' | 'professional' | 'enterprise',
    maxDeployments: number = 1,
    maxUsers: number = 50,
    maxPatients: number = 10000,
    expiresAt?: Date,
  ): Promise<OfflineLicense> {
    const licenseKey = this.generateLicenseKey(licenseType, organizationName);
    const hmacSignature = this.calculateSignature(licenseKey);

    const license = this.licenseRepo.create({
      licenseKey,
      organizationName,
      licenseType,
      tier,
      maxDeployments,
      maxUsers,
      maxPatients,
      signature: hmacSignature,
      issuedAt: new Date(),
      expiresAt: expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      isActive: true,
      metadata: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
      },
    });

    return this.licenseRepo.save(license as any);
  }

  /**
   * Validate license (local validation, no network required)
   */
  async validateLicense(licenseKey: string): Promise<{
    valid: boolean;
    expired: boolean;
    active: boolean;
    organization?: string;
    tier?: string;
    message: string;
  }> {
    // Check signature
    if (!this.validateLicenseSignature(licenseKey)) {
      return {
        valid: false,
        expired: false,
        active: false,
        message: 'Invalid license signature',
      };
    }

    // Check database
    const license = await this.licenseRepo.findOne({
      where: { licenseKey },
    });

    if (!license) {
      return {
        valid: false,
        expired: false,
        active: false,
        message: 'License not found in database',
      };
    }

    if (!license.isActive) {
      return {
        valid: false,
        expired: false,
        active: false,
        message: 'License has been revoked',
      };
    }

    if (license.revokedAt) {
      return {
        valid: false,
        expired: false,
        active: false,
        message: `License revoked on ${license.revokedAt}`,
      };
    }

    const now = new Date();
    const isExpired = license.expiresAt && license.expiresAt < now;

    if (isExpired) {
      // 30-day grace period for offline
      const gracePeriodEnd = new Date(license.expiresAt);
      gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 30);

      if (now > gracePeriodEnd) {
        return {
          valid: false,
          expired: true,
          active: true,
          organization: license.organizationName,
          tier: license.tier,
          message: 'License expired and grace period exceeded',
        };
      }

      // Still in grace period
      return {
        valid: true,
        expired: true,
        active: true,
        organization: license.organizationName,
        tier: license.tier,
        message: `License expired but still valid within 30-day grace period (expires ${gracePeriodEnd.toISOString()})`,
      };
    }

    return {
      valid: true,
      expired: false,
      active: true,
      organization: license.organizationName,
      tier: license.tier,
      message: 'License is valid',
    };
  }

  /**
   * Revoke license
   */
  async revokeLicense(licenseKey: string): Promise<OfflineLicense> {
    const license = await this.licenseRepo.findOne({
      where: { licenseKey },
    });

    if (!license) {
      throw new Error('License not found');
    }

    license.isActive = false;
    license.revokedAt = new Date();

    return this.licenseRepo.save(license);
  }

  /**
   * Export license as file (.lic format)
   */
  exportLicenseFile(license: OfflineLicense): string {
    return JSON.stringify(
      {
        licenseKey: license.licenseKey,
        organizationName: license.organizationName,
        licenseType: license.licenseType,
        tier: license.tier,
        maxDeployments: license.maxDeployments,
        maxUsers: license.maxUsers,
        maxPatients: license.maxPatients,
        expiresAt: license.expiresAt,
        isActive: license.isActive,
        metadata: license.metadata,
      },
      null,
      2,
    );
  }

  /**
   * Get all active licenses
   */
  async getActiveLicenses(): Promise<OfflineLicense[]> {
    return this.licenseRepo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
  }
}
