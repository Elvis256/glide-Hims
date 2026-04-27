import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpException,
  HttpStatus,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LicenseService, GenerateLicenseDto } from './license.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Licensing')
@Controller('license')
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  private requireSystemAdmin(req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
  }

  /**
   * Validate a license key (public endpoint for on-premise installations)
   */
  @Post('validate')
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Validate a license key' })
  async validateLicense(@Body() body: { licenseKey: string }) {
    const result = await this.licenseService.validateLicense(body.licenseKey);

    if (!result.valid) {
      throw new HttpException({ valid: false, error: result.error }, HttpStatus.UNAUTHORIZED);
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
   * Generate a new license (system admin only)
   */
  @Post('generate')
  @Auth()
  @ApiOperation({ summary: 'Generate a new license key' })
  async generateLicense(@Body() dto: GenerateLicenseDto, @Request() req: any) {
    this.requireSystemAdmin(req);
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
   * Get the current tenant's active license summary (any authenticated tenant user).
   * Returns null if no license exists yet (e.g. first-time setup before trial creation).
   */
  @Get('me')
  @Auth()
  @ApiOperation({ summary: 'Get the active license for the current tenant' })
  async getMyLicense(@Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return { license: null };
    }
    const licenses = await this.licenseService.listLicenses({ tenantId });
    // Pick the most relevant one: active first, otherwise the most recently issued.
    const active = licenses.find((l) => l.status === 'active') || licenses[0] || null;
    if (!active) {
      return { license: null };
    }
    const now = Date.now();
    const expMs = new Date(active.expiresAt).getTime();
    const daysRemaining = Math.max(0, Math.ceil((expMs - now) / 86400000));
    return {
      license: {
        id: active.id,
        organizationName: active.organizationName,
        licenseType: active.licenseType,
        status: active.status,
        issuedAt: active.issuedAt,
        expiresAt: active.expiresAt,
        daysRemaining,
        maxUsers: active.maxUsers,
        maxFacilities: active.maxFacilities,
        enabledModules: active.enabledModules,
        // Mask the key for non-admins
        licenseKey: req.user?.isSystemAdmin
          ? active.licenseKey
          : active.licenseKey
            ? `${active.licenseKey.slice(0, 6)}…${active.licenseKey.slice(-4)}`
            : null,
      },
    };
  }

  /**
   * Activate / bind a license key to the current tenant (tenant admin or system admin).
   * Used by on-prem customers who receive a key out-of-band and need to apply it.
   */
  @Post('activate')
  @Auth()
  @ApiOperation({ summary: 'Activate a license key for the current tenant' })
  async activateLicense(@Body() body: { licenseKey: string }, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    const isAdmin =
      req.user?.isSystemAdmin ||
      (req.user?.roles || []).some((r: string) =>
        ['Super Admin', 'Tenant Admin', 'Admin'].includes(r),
      );
    if (!isAdmin) {
      throw new ForbiddenException('Tenant admin access required');
    }
    if (!body?.licenseKey) {
      throw new HttpException('licenseKey is required', HttpStatus.BAD_REQUEST);
    }
    const result = await this.licenseService.validateLicense(body.licenseKey);
    if (!result.valid || !result.license) {
      throw new HttpException(
        { valid: false, error: result.error || 'Invalid license key' },
        HttpStatus.BAD_REQUEST,
      );
    }
    // Bind the license to this tenant if it is unassigned, otherwise require a match.
    const license = result.license;
    if (license.tenantId && tenantId && license.tenantId !== tenantId) {
      throw new ForbiddenException('This license is registered to a different organisation');
    }
    if (!license.tenantId && tenantId) {
      license.tenantId = tenantId;
      await this.licenseService['licenseRepository'].save(license);
    }
    return {
      message: 'License activated',
      licenseType: license.licenseType,
      expiresAt: license.expiresAt,
    };
  }

  /**
   * Get license details (system admin only)
   */
  @Get(':licenseKey')
  @Auth()
  @ApiOperation({ summary: 'Get license details' })
  async getLicense(@Param('licenseKey') licenseKey: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.getLicense(licenseKey);

    if (!license) {
      throw new HttpException('License not found', HttpStatus.NOT_FOUND);
    }

    return license;
  }

  /**
   * List all licenses (system admin only)
   */
  @Get()
  @Auth()
  @ApiOperation({ summary: 'List all licenses' })
  async listLicenses(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('licenseType') licenseType?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    this.requireSystemAdmin(req);
    return this.licenseService.listLicenses({
      status,
      licenseType,
      tenantId: tenantId || req.user?.tenantId,
    });
  }

  /**
   * Revoke a license (system admin only)
   */
  @Put(':licenseKey/revoke')
  @Auth()
  @ApiOperation({ summary: 'Revoke a license' })
  async revokeLicense(@Param('licenseKey') licenseKey: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.revokeLicense(licenseKey);
    return { message: 'License revoked', status: license.status };
  }

  /**
   * Extend a license (system admin only)
   */
  @Put(':licenseKey/extend')
  @Auth()
  @ApiOperation({ summary: 'Extend license validity' })
  async extendLicense(
    @Param('licenseKey') licenseKey: string,
    @Body() body: { days: number },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.extendLicense(licenseKey, body.days);
    return {
      message: 'License extended',
      newExpiresAt: license.expiresAt,
    };
  }

  /**
   * Bind license to hardware (requires authentication)
   */
  @Put(':licenseKey/bind-hardware')
  @Auth()
  @ApiOperation({ summary: 'Bind license to hardware ID' })
  async bindToHardware(
    @Param('licenseKey') licenseKey: string,
    @Body() body: { hardwareId: string },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.bindToHardware(licenseKey, body.hardwareId);
    return { message: 'License bound to hardware', hardwareId: license.hardwareId };
  }
}
