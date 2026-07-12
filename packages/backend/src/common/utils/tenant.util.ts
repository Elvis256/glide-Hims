import { BadRequestException } from '@nestjs/common';

/**
 * Asserts that tenantId is present and returns it as a non-optional string.
 * Use at the top of any service method that handles tenant-scoped data.
 *
 * Callers that legitimately need cross-tenant access (system admin dashboards)
 * should NOT use this guard — they should use explicit `if (tenantId)` checks
 * and document why cross-tenant access is acceptable.
 *
 * @example
 *   async getReport(tenantId?: string) {
 *     const tid = requireTenantId(tenantId);
 *     // tid is now `string`, not `string | undefined`
 *   }
 */
export function requireTenantId(tenantId: string | undefined | null): string {
  if (!tenantId) {
    throw new BadRequestException('Missing tenant context');
  }
  return tenantId;
}
