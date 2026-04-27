import { Injectable, BadRequestException } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

@Injectable()
export class LicenseService {
  private readonly LICENSE_PREFIX = 'GLI';
  private readonly LICENSE_SECRET = process.env.LICENSE_SECRET || 'change-me-in-production';

  async createLicense(data: any) {
    const licenseKey = this.generateLicenseKey(data.license_type);
    return {
      license_key: licenseKey,
      organization_name: data.organization_name,
      organization_email: data.organization_email,
      license_type: data.license_type,
      deployment_limit: data.deployment_limit || 1,
      user_limit: data.user_limit || 100,
      hospital_limit: data.hospital_limit || 1,
      valid_until: new Date(Date.now() + 30*24*60*60*1000),
      created_at: new Date(),
    };
  }

  async validateLicense(licenseKey: string): Promise<boolean> {
    if (!licenseKey || !licenseKey.startsWith(this.LICENSE_PREFIX)) {
      throw new BadRequestException('Invalid license key format');
    }
    return true;
  }

  async getLicenseByKey(licenseKey: string): Promise<any | null> {
    return null;
  }

  async revokeLicense(licenseKey: string): Promise<void> {
    // TODO: Implement
  }

  private generateLicenseKey(licenseType: string): string {
    const typeCode = (licenseType || 'hybrid').substring(0, 3).toUpperCase();
    const dateCode = new Date().toISOString().split('T')[0].replace(/-/g, '').slice(-6);
    const randomCode = randomBytes(4).toString('hex').toUpperCase().slice(0, 5);
    return `${this.LICENSE_PREFIX}-${typeCode}-${dateCode}-${randomCode}`;
  }
}
