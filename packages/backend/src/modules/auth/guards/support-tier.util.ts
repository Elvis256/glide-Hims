import { DataSource } from 'typeorm';
import { SupportAccessTier } from '../../../database/entities/support-access-grant.entity';

export interface TierCheckResult {
  tier: SupportAccessTier;
  allowed: boolean;
}

const SYSTEM_ENDPOINT_REGEX =
  /^\/(api\/v1\/)?(tenants|setup|settings|support-access|users\/(system-admins|tenant-admins|system-reset-password))/;
const METADATA_ENDPOINT_REGEX = /^\/(api\/v1\/)?(analytics|dashboard|facilities)/;

/**
 * Get the effective support tier for a system admin accessing a tenant.
 * - Own tenant: returns FULL_SUPPORT (system admin always has full access to their home org)
 * - Cross-tenant: queries support_access_grants for an active grant
 */
export async function getActiveSupportTier(
  dataSource: DataSource,
  userId: string,
  tenantId: string,
): Promise<SupportAccessTier> {
  // Check if this is the user's own/home tenant — full access always
  const userResult = await dataSource.query(
    `SELECT tenant_id FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId],
  );
  if (userResult.length > 0 && userResult[0].tenant_id === tenantId) {
    return SupportAccessTier.FULL_SUPPORT;
  }

  // Cross-tenant: check for an active support access grant
  const result = await dataSource.query(
    `SELECT access_tier FROM support_access_grants
     WHERE granted_to_id = $1 AND tenant_id = $2
     AND revoked_at IS NULL AND expires_at > NOW()
     AND deleted_at IS NULL
     ORDER BY access_tier DESC
     LIMIT 1`,
    [userId, tenantId],
  );
  return result.length > 0 ? result[0].access_tier : SupportAccessTier.NONE;
}

export function checkSystemAdminAccess(
  tier: SupportAccessTier,
  path: string,
  method: string,
): boolean {
  // System management endpoints — always allowed
  if (SYSTEM_ENDPOINT_REGEX.test(path)) {
    return true;
  }

  // No grant — blocked
  if (tier === SupportAccessTier.NONE) {
    return false;
  }

  // METADATA: GET only on analytics/dashboard/facilities
  if (tier === SupportAccessTier.METADATA) {
    return method === 'GET' && METADATA_ENDPOINT_REGEX.test(path);
  }

  // CLINICAL_READ: GET only on any endpoint
  if (tier === SupportAccessTier.CLINICAL_READ) {
    return method === 'GET';
  }

  // FULL_SUPPORT: all methods
  return tier === SupportAccessTier.FULL_SUPPORT;
}
