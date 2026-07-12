import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
import { ConfigService } from '@nestjs/config';
import { LicenseService, GenerateLicenseDto } from './license.service';
import { UpdateClientService } from './update-client.service';
import { Auth } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { withSystemContext } from '../../common/context/tenant-context';

@ApiTags('Licensing')
@Controller('license')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    private readonly configService: ConfigService,
    private readonly updateClientService: UpdateClientService,
  ) {}

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
    // Key-based validation is a trusted server flow (HMAC-signed key): must
    // see the license row regardless of tenant GUC, so runs as system.
    const result = await withSystemContext(() =>
      this.licenseService.validateLicense(body.licenseKey),
    );

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
    // Activation must see (and bind) an unassigned license row, which the
    // tenant GUC would hide under RLS. Caller authority is already checked
    // above and the key itself is HMAC-signed, so the lookup+bind runs as
    // system with an explicit tenant-match guard in between.
    const license = await withSystemContext(async () => {
      const result = await this.licenseService.validateLicense(body.licenseKey);
      if (!result.valid || !result.license) {
        throw new HttpException(
          { valid: false, error: result.error || 'Invalid license key' },
          HttpStatus.BAD_REQUEST,
        );
      }
      // Bind the license to this tenant if it is unassigned, otherwise require a match.
      const lic = result.license;
      if (lic.tenantId && tenantId && lic.tenantId !== tenantId) {
        throw new ForbiddenException('This license is registered to a different organisation');
      }
      if (!lic.tenantId && tenantId) {
        lic.tenantId = tenantId;
        await this.licenseService['licenseRepository'].save(lic);
      }
      return lic;
    });
    return {
      message: 'License activated',
      licenseType: license.licenseType,
      expiresAt: license.expiresAt,
    };
  }

  /**
   * Re-sign all licenses with the current LICENSE_SECRET_KEY (system admin only).
   * Use after rotating the secret key to prevent source-bundle 403 errors.
   */
  @Post('re-sign-all')
  @Auth()
  @ApiOperation({ summary: 'Re-sign all license signatures with current secret key' })
  async reSignAll(@Request() req: any) {
    this.requireSystemAdmin(req);
    const count = await this.licenseService.reSignStaleSignatures();
    return { message: `Re-signed ${count} license(s)`, updated: count };
  }

  // ==================== License Lifecycle Endpoints ====================

  /**
   * Get upcoming license renewals grouped by urgency (system admin only).
   */
  @Get('renewals')
  @Auth()
  @ApiOperation({ summary: 'Get upcoming license renewals grouped by urgency' })
  async getRenewals(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.licenseService.checkLicenseRenewals();
  }

  /**
   * Get license usage analytics across all tenants (system admin only).
   */
  @Get('analytics')
  @Auth()
  @ApiOperation({ summary: 'Get license usage analytics' })
  async getAnalytics(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.licenseService.getLicenseUsageAnalytics();
  }

  /**
   * Batch extend all licenses expiring within a given number of days (system admin only).
   */
  @Post('batch/extend')
  @Auth()
  @ApiOperation({ summary: 'Batch extend licenses expiring within N days' })
  async batchExtend(@Body() body: { days: number; withinDays: number }, @Request() req: any) {
    this.requireSystemAdmin(req);
    if (!body?.days || !body?.withinDays) {
      throw new HttpException('Both "days" and "withinDays" are required', HttpStatus.BAD_REQUEST);
    }
    return this.licenseService.batchExtendExpiring(body.days, body.withinDays);
  }

  /**
   * Batch suspend all licenses expired beyond their grace period (system admin only).
   */
  @Post('batch/suspend-delinquent')
  @Auth()
  @ApiOperation({ summary: 'Batch suspend delinquent licenses past grace period' })
  async batchSuspendDelinquent(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.licenseService.batchSuspendDelinquent();
  }

  /**
   * Rotate a license key: generates a new key, copies all settings, revokes old (system admin only).
   */
  @Post(':key/rotate')
  @Auth()
  @ApiOperation({ summary: 'Rotate a license key' })
  async rotateKey(@Param('key') key: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    const newLicense = await this.licenseService.rotateKey(key);
    return {
      message: 'License key rotated',
      oldKey: key,
      newLicenseKey: newLicense.licenseKey,
      organizationName: newLicense.organizationName,
      licenseType: newLicense.licenseType,
      expiresAt: newLicense.expiresAt,
      status: newLicense.status,
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
   * Update license fields in-place (system admin only). Allows upgrade /
   * downgrade of tier, change of module set, user/facility limits, and
   * expiry — without revoking and re-issuing.
   */
  @Patch(':licenseKey')
  @Auth()
  @ApiOperation({ summary: 'Update an existing license (modules, limits, tier, expiry)' })
  async updateLicense(
    @Param('licenseKey') licenseKey: string,
    @Body()
    body: {
      licenseType?: 'trial' | 'standard' | 'professional' | 'enterprise';
      maxUsers?: number;
      maxFacilities?: number;
      enabledModules?: string[];
      features?: Record<string, boolean>;
      expiresAt?: string;
      organizationName?: string;
      email?: string;
    },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.updateLicense(licenseKey, body);
    return {
      message: 'License updated',
      license: {
        licenseKey: license.licenseKey,
        licenseType: license.licenseType,
        maxUsers: license.maxUsers,
        maxFacilities: license.maxFacilities,
        enabledModules: license.enabledModules,
        expiresAt: license.expiresAt,
        status: license.status,
      },
    };
  }

  /**
   * Suspend a license (reversible).
   */
  @Put(':licenseKey/suspend')
  @Auth()
  @ApiOperation({ summary: 'Suspend a license (reversible)' })
  async suspendLicense(@Param('licenseKey') licenseKey: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.suspendLicense(licenseKey);
    return { message: 'License suspended', status: license.status };
  }

  /**
   * Reactivate a suspended license.
   */
  @Put(':licenseKey/reactivate')
  @Auth()
  @ApiOperation({ summary: 'Reactivate a suspended license' })
  async reactivateLicense(@Param('licenseKey') licenseKey: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    const license = await this.licenseService.reactivateLicense(licenseKey);
    return { message: 'License reactivated', status: license.status };
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

  // ==================== Offline License & Update Endpoints ====================

  /**
   * Export a license for offline / on-premise use. Returns all fields needed
   * to bootstrap an on-premise installation including the secret key for
   * local HMAC verification.
   */
  @Get(':key/export')
  @Auth()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @ApiOperation({ summary: 'Export license for offline on-premise use' })
  async exportLicense(@Param('key') key: string) {
    const license = await this.licenseService.getLicense(key);
    if (!license) {
      throw new HttpException('License not found', HttpStatus.NOT_FOUND);
    }
    if (license.status !== 'active') {
      throw new HttpException(`License is ${license.status}`, HttpStatus.FORBIDDEN);
    }

    return {
      licenseKey: license.licenseKey,
      organizationName: license.organizationName,
      licenseType: license.licenseType,
      maxUsers: license.maxUsers,
      maxFacilities: license.maxFacilities,
      enabledModules: license.enabledModules,
      features: license.features,
      status: license.status,
      issuedAt: license.issuedAt,
      expiresAt: license.expiresAt,
      signature: license.signature,
    };
  }

  /**
   * Reissue (extend) a standalone license. Returns updated license data
   * in the same format as the export endpoint for easy download.
   */
  @Post(':id/reissue')
  @Auth()
  @ApiOperation({ summary: 'Reissue / extend a standalone license' })
  async reissueLicense(
    @Param('id') id: string,
    @Body() body: { extensionDays?: number },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);

    const days = body?.extensionDays ?? 365;
    if (days < 1 || days > 730) {
      throw new HttpException('extensionDays must be between 1 and 730', HttpStatus.BAD_REQUEST);
    }

    // id can be either a licenseKey or uuid — try key first
    let license = await this.licenseService.getLicense(id);
    if (!license) {
      throw new HttpException('License not found', HttpStatus.NOT_FOUND);
    }

    license = await this.licenseService.extendLicense(license.licenseKey, days);

    return {
      message: `License extended by ${days} days`,
      license: {
        licenseKey: license.licenseKey,
        organizationName: license.organizationName,
        licenseType: license.licenseType,
        maxUsers: license.maxUsers,
        maxFacilities: license.maxFacilities,
        enabledModules: license.enabledModules,
        features: license.features,
        status: license.status,
        issuedAt: license.issuedAt,
        expiresAt: license.expiresAt,
        signature: license.signature,
      },
    };
  }

  /**
   * Trigger an update on the current on-premise instance. Only available
   * when DEPLOYMENT_MODE is on-premise or hybrid. SystemAdmin only.
   */
  @Post('trigger-update')
  @Auth()
  @ApiOperation({ summary: 'Trigger on-premise update (on-premise/hybrid only)' })
  async triggerUpdate(@Request() req: any) {
    this.requireSystemAdmin(req);

    const mode = this.configService.get<string>('DEPLOYMENT_MODE');
    if (mode !== 'on-premise' && mode !== 'hybrid') {
      throw new HttpException(
        'Update trigger is only available on on-premise or hybrid deployments',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.updateClientService.triggerUpdate();
    return { message: 'Update triggered', status: 'accepted' };
  }
}
