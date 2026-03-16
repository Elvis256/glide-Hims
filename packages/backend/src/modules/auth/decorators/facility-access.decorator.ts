import { SetMetadata } from '@nestjs/common';

export const FACILITY_ACCESS_KEY = 'requireFacilityAccess';

/**
 * Marks a controller or method as requiring facility access validation.
 * When applied, the FacilityGuard will verify that the authenticated user
 * has an active role assignment for the target facility.
 */
export const RequireFacilityAccess = () => SetMetadata(FACILITY_ACCESS_KEY, true);
