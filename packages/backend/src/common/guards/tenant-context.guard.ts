import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Fail-closed tenant context enforcement.
 *
 * Asserts that every authenticated request carries a `tenantId` on
 * `req.user`, unless the user is a platform-level system admin
 * (`req.user.isSystemAdmin === true`).
 *
 * In normal operation this is a no-op because the JWT strategy populates
 * `tenantId` from the user record. The guard is defence-in-depth: if any
 * future code path somehow strips or omits `tenantId` (token forging,
 * impersonation flow bug, malformed migration), service-layer reads that
 * filter with `tenantId ? { tenantId } : {}` would otherwise silently
 * return cross-tenant data. Throwing here makes that failure mode
 * impossible.
 *
 * Apply at controller class level on modules that expose tenant-bound
 * reads (encounters, EHR, billing, etc.). System-admin-only controllers
 * should not use it.
 */
@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user;

    if (!user) {
      // Auth guard should have rejected first; if we reach here, fail
      // closed rather than treating the request as unscoped.
      throw new ForbiddenException('Authentication required');
    }

    if (user.isSystemAdmin) {
      return true;
    }

    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context missing for non-admin user');
    }

    return true;
  }
}
