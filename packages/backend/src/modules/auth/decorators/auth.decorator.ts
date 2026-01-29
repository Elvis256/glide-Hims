import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { Roles } from './roles.decorator';
import { RequirePermissions } from './permissions.decorator';

/**
 * Auth decorator for protecting endpoints
 * @param roles - Role names (e.g., 'Admin', 'Doctor') - user must have one of these roles
 */
export function Auth(...roles: string[]) {
  const decorators = [
    UseGuards(AuthGuard('jwt'), RolesGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
  ];

  // Only add Roles decorator if roles are specified
  if (roles.length > 0) {
    decorators.unshift(Roles(...roles));
  }

  return applyDecorators(...decorators);
}

/**
 * AuthWithPermissions decorator for protecting endpoints with specific permissions
 * @param permissions - Permission codes (e.g., 'patients.read', 'patients.create')
 */
export function AuthWithPermissions(...permissions: string[]) {
  const decorators = [
    UseGuards(AuthGuard('jwt'), PermissionsGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions' }),
  ];

  if (permissions.length > 0) {
    decorators.unshift(RequirePermissions(...permissions));
  }

  return applyDecorators(...decorators);
}
