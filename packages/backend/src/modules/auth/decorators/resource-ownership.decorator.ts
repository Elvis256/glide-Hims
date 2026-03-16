import { SetMetadata } from '@nestjs/common';

export interface ResourceOwnershipConfig {
  /** Entity type to check ownership for */
  entity: string;
  /** Field on the entity that holds the owner/provider user ID */
  ownerField: string;
  /** Permission that bypasses ownership checks (e.g., 'patients.read-all') */
  bypassPermission?: string;
  /** If true, also allow access if user's facility matches resource's facility */
  allowFacilityAccess?: boolean;
}

export const RESOURCE_OWNERSHIP_KEY = 'resource_ownership';

/**
 * Decorator to enforce row-level security on resource endpoints.
 * Users can only access resources they own/are assigned to,
 * unless they have the bypass permission (e.g., patients.read-all).
 */
export function ResourceOwnership(config: ResourceOwnershipConfig) {
  return SetMetadata(RESOURCE_OWNERSHIP_KEY, config);
}
