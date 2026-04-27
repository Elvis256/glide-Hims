import { Controller, Post, Get, Body, Param, BadRequestException, HttpCode } from '@nestjs/common';
import { LicenseService } from './license.service';

@Controller('api/v1/admin/licenses')
export class LicenseController {
  constructor(private licenseService: LicenseService) {}

  @Post('validate')
  @HttpCode(200)
  async validateLicense(@Body() dto: { license_key: string }) {
    try {
      const isValid = await this.licenseService.validateLicense(dto.license_key);
      return { valid: isValid };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  @Post()
  async createLicense(@Body() dto: any) {
    return this.licenseService.createLicense(dto);
  }

  @Get(':license_key')
  async getLicense(@Param('license_key') licenseKey: string) {
    const license = await this.licenseService.getLicenseByKey(licenseKey);
    if (!license) throw new BadRequestException('License not found');
    return license;
  }

  @Post(':license_key/revoke')
  @HttpCode(200)
  async revokeLicense(@Param('license_key') licenseKey: string) {
    await this.licenseService.revokeLicense(licenseKey);
    return { revoked: true };
  }
}
