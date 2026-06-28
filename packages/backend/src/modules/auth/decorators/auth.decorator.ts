import { applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { RolesGuard } from '../guards/roles.guard';
import { PermissionsGuard } from '../guards/permissions.guard';
import { OwnershipGuard } from '../guards/ownership.guard';
import { ModuleGuard } from '../guards/module.guard';
import { GlobalJwtAuthGuard } from '../guards/global-jwt.guard';
import { Roles } from './roles.decorator';
import { RequirePermissions } from './permissions.decorator';
import { RequireModule } from './module.decorator';
import { ResourceOwnership, ResourceOwnershipConfig } from './resource-ownership.decorator';

/**
 * Auth decorator for protecting endpoints
 * @param roles - Role names (e.g., 'Admin', 'Doctor') - user must have one of these roles
 */
export function Auth(...roles: string[]) {
  const decorators = [
    UseGuards(GlobalJwtAuthGuard, RolesGuard),
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
    UseGuards(GlobalJwtAuthGuard, PermissionsGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions' }),
  ];

  if (permissions.length > 0) {
    decorators.unshift(RequirePermissions(...permissions));
  }

  return applyDecorators(...decorators);
}

/**
 * AuthWithModule — permissions + module enforcement.
 * Checks the user has the required permission AND the module is enabled for the tenant.
 * @param module - Module code (e.g., 'pharmacy', 'emergency', 'ipd')
 * @param permissions - Permission codes
 */
export function AuthWithModule(module: string, ...permissions: string[]) {
  const decorators = [
    RequireModule(module),
    UseGuards(AuthGuard('jwt'), PermissionsGuard, ModuleGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions or module not enabled' }),
  ];

  if (permissions.length > 0) {
    decorators.unshift(RequirePermissions(...permissions));
  }

  return applyDecorators(...decorators);
}

/**
 * AuthWithOwnership decorator — permissions + row-level ownership check.
 * Checks that the user has the required permission AND owns/has access to the resource.
 * @param permission - Required permission code
 * @param ownershipConfig - Resource ownership configuration
 */
export function AuthWithOwnership(permission: string, ownershipConfig: ResourceOwnershipConfig) {
  return applyDecorators(
    RequirePermissions(permission),
    ResourceOwnership(ownershipConfig),
    UseGuards(AuthGuard('jwt'), PermissionsGuard, OwnershipGuard),
    ApiBearerAuth(),
    ApiUnauthorizedResponse({ description: 'Unauthorized' }),
    ApiForbiddenResponse({ description: 'Insufficient permissions or access denied' }),
  );
}
