import { SetMetadata } from '@nestjs/common';
import { PERMISSIONS_KEY } from '../guards/permissions.guard';

/**
 * Decorator to require specific permissions for an endpoint.
 * Usage: @RequirePermissions('patients.read', 'patients.create')
 */
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata(PERMISSIONS_KEY, permissions);
