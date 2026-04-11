import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LicenseService, GenerateLicenseDto } from './license.service';
import { GlobalJwtAuthGuard } from '../auth/guards/global-jwt.guard';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Licensing')
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  /**
   * Validate a license key (public endpoint for on-premise installations)
   */
  @Post('validate')
  @Public()
  @ApiOperation({ summary: 'Validate a license key' })
  async validateLicense(@Body() body: { licenseKey: string }) {
    const result = await this.licenseService.validateLicense(body.licenseKey);
    
    if (!result.valid) {
      throw new HttpException(
        { valid: false, error: result.error },
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      valid: true,
      expiresAt: result.license?.expiresAt,
      expiresIn: result.expiresIn,
      licenseType: result.license?.licenseType,
      maxUsers: result.license?.maxUsers,
      maxFacilities: result.license?.maxFacilities,
      enabledModules: result.license?.enabledModules,
      warnings: result.warnings,
    };
  }

  /**
   * Generate a new license (admin only)
   */
  @Post('generate')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate a new license key' })
  async generateLicense(@Body() dto: GenerateLicenseDto) {
    // TODO: Add system admin check
    const license = await this.licenseService.generateLicense(dto);

    return {
      licenseKey: license.licenseKey,
      organizationName: license.organizationName,
      licenseType: license.licenseType,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
      maxUsers: license.maxUsers,
      maxFacilities: license.maxFacilities,
      enabledModules: license.enabledModules,
    };
  }

  /**
   * Get license details (admin only)
   */
  @Get(':licenseKey')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get license details' })
  async getLicense(@Param('licenseKey') licenseKey: string) {
    const license = await this.licenseService.getLicense(licenseKey);

    if (!license) {
      throw new HttpException('License not found', HttpStatus.NOT_FOUND);
    }

    return license;
  }

  /**
   * List all licenses (admin only)
   */
  @Get()
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all licenses' })
  async listLicenses(
    @Query('status') status?: string,
    @Query('licenseType') licenseType?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.licenseService.listLicenses({ status, licenseType, tenantId });
  }

  /**
   * Revoke a license (admin only)
   */
  @Put(':licenseKey/revoke')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a license' })
  async revokeLicense(@Param('licenseKey') licenseKey: string) {
    const license = await this.licenseService.revokeLicense(licenseKey);
    return { message: 'License revoked', status: license.status };
  }

  /**
   * Extend a license (admin only)
   */
  @Put(':licenseKey/extend')
  @UseGuards(GlobalJwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Extend license validity' })
  async extendLicense(
    @Param('licenseKey') licenseKey: string,
    @Body() body: { days: number },
  ) {
    const license = await this.licenseService.extendLicense(licenseKey, body.days);
    return { 
      message: 'License extended', 
      newExpiresAt: license.expiresAt,
    };
  }

  /**
   * Bind license to hardware (on-premise)
   */
  @Put(':licenseKey/bind-hardware')
  @Public()
  @ApiOperation({ summary: 'Bind license to hardware ID' })
  async bindToHardware(
    @Param('licenseKey') licenseKey: string,
    @Body() body: { hardwareId: string },
  ) {
    const license = await this.licenseService.bindToHardware(
      licenseKey,
      body.hardwareId,
    );
    return { message: 'License bound to hardware', hardwareId: license.hardwareId };
  }
}
