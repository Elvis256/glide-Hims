import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { MODULE_KEY } from '../decorators/module.decorator';
import { CacheService } from '../../cache/cache.service';
import { getPreset } from '../../../common/constants/facility-presets.constants';
import { presetModulesToSidebarCodes } from '../../../config/module-registry';

/**
 * Guard that enforces tenant-level module access.
 *
 * Checks whether the required module (set via @RequireModule decorator) is
 * enabled for the requesting user's tenant. Enabled modules are resolved from:
 *   1. system_settings.enabled_modules (custom override)
 *   2. tenant.settings.enabledModules (JSONB on tenant record)
 *   3. system_settings.facility_mode (preset lookup)
 *
 * System admins bypass this check.
 * 'admin' and 'registration' modules are always allowed.
 */
@Injectable()
export class ModuleGuard implements CanActivate {
  private readonly logger = new Logger('ModuleGuard');

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModules = this.reflector.getAllAndOverride<string[]>(MODULE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @RequireModule decorator → allow
    if (!requiredModules || requiredModules.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user || !user.id) {
      return false;
    }

    // System admins bypass module checks
    if (user.isSystemAdmin) {
      return true;
    }

    // Always-allowed modules
    const alwaysAllowed = ['admin', 'registration'];
    if (requiredModules.every((m) => alwaysAllowed.includes(m))) {
      return true;
    }

    const tenantId = user.tenantId;
    if (!tenantId) {
      return false;
    }

    // Get tenant's enabled sidebar modules (cached 30s)
    const cacheKey = `tenant_modules:${tenantId}`;
    let enabledSidebarCodes: string[] | null = await this.cacheService.get(cacheKey);

    if (enabledSidebarCodes === null || enabledSidebarCodes === undefined) {
      const resolved = await this.resolveTenantModules(tenantId);
      if (resolved === null) {
        // DB error — fail open (don't block all users due to transient DB issue)
        // but DON'T cache the error state so the next request retries
        this.logger.warn(`Module resolution failed for tenant ${tenantId}, allowing access (fail-open)`);
        return true;
      }
      enabledSidebarCodes = resolved;
      await this.cacheService.set(cacheKey, enabledSidebarCodes, 30);
    }

    // No modules configured → tenant hasn't set up yet → allow all
    if (enabledSidebarCodes.length === 0) {
      return true;
    }

    // Check: user needs at least ONE of the required modules to be enabled
    const hasAccess = requiredModules.some(
      (mod) => alwaysAllowed.includes(mod) || enabledSidebarCodes!.includes(mod),
    );

    if (!hasAccess) {
      this.logger.warn(
        `Module access denied: user ${user.id} (tenant ${tenantId}) tried to access module [${requiredModules.join(', ')}] — enabled: [${enabledSidebarCodes.join(', ')}]`,
      );
      throw new ForbiddenException(
        `This feature is not enabled for your organization. Contact your administrator to enable the "${requiredModules[0]}" module.`,
      );
    }

    return true;
  }

  /**
   * Resolve enabled sidebar module codes for a tenant.
   * Resolution:
   *   - License (if active) defines the UPPER BOUND of allowed modules.
   *   - Tenant config (system_settings or tenant.settings) may NARROW that set.
   *   - With no license and no tenant config, falls back to facility_mode preset.
   *   - Empty result = allow-all (tenant hasn't configured anything yet).
   */
  private async resolveTenantModules(tenantId: string): Promise<string[] | null> {
    try {
      // License upper bound (if any active license exists)
      const licenseRow = await this.dataSource.query(
        `SELECT enabled_modules FROM licenses
           WHERE tenant_id = $1 AND status = 'active' AND expires_at > now()
           ORDER BY expires_at DESC LIMIT 1`,
        [tenantId],
      );
      let licenseModules: string[] | null = null;
      if (licenseRow.length > 0 && licenseRow[0].enabled_modules) {
        const raw =
          typeof licenseRow[0].enabled_modules === 'string'
            ? JSON.parse(licenseRow[0].enabled_modules)
            : licenseRow[0].enabled_modules;
        if (Array.isArray(raw) && raw.length > 0) {
          licenseModules = presetModulesToSidebarCodes(raw);
        }
      }

      // 1. Tenant override via system_settings
      const customRow = await this.dataSource.query(
        `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'enabled_modules' AND deleted_at IS NULL LIMIT 1`,
        [tenantId],
      );
      if (customRow.length > 0) {
        const val =
          typeof customRow[0].value === 'string'
            ? JSON.parse(customRow[0].value)
            : customRow[0].value;
        if (Array.isArray(val) && val.length > 0) {
          const codes = presetModulesToSidebarCodes(val);
          return licenseModules ? codes.filter((c) => licenseModules!.includes(c)) : codes;
        }
      }

      // 2. tenant.settings.enabledModules
      const tenantRow = await this.dataSource.query(
        `SELECT settings FROM tenants WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [tenantId],
      );
      if (tenantRow.length > 0 && tenantRow[0].settings) {
        const settings =
          typeof tenantRow[0].settings === 'string'
            ? JSON.parse(tenantRow[0].settings)
            : tenantRow[0].settings;
        if (
          settings.enabledModules &&
          Array.isArray(settings.enabledModules) &&
          settings.enabledModules.length > 0
        ) {
          const codes = presetModulesToSidebarCodes(settings.enabledModules);
          return licenseModules ? codes.filter((c) => licenseModules!.includes(c)) : codes;
        }
      }

      // 3. License alone (no tenant config) — use the license's modules as the enabled set
      if (licenseModules) {
        return licenseModules;
      }

      // 4. Fall back to facility_mode preset
      const modeRow = await this.dataSource.query(
        `SELECT value FROM system_settings WHERE tenant_id = $1 AND key = 'facility_mode' AND deleted_at IS NULL LIMIT 1`,
        [tenantId],
      );
      if (modeRow.length > 0) {
        const mode =
          typeof modeRow[0].value === 'string' ? JSON.parse(modeRow[0].value) : modeRow[0].value;
        const preset = getPreset(mode);
        if (preset) {
          return presetModulesToSidebarCodes(preset.enabledModules);
        }
      }

      return [];
    } catch (err) {
      this.logger.error(`Failed to resolve tenant modules for ${tenantId}: ${err}`);
      return null;
    }
  }
}
