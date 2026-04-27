import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../guards/permissions.guard';

export const SYSTEM_ADMIN_ONLY_KEY = 'systemAdminOnly';

/**
 * Marks a controller or route as requiring `req.user.isSystemAdmin === true`.
 * The `PermissionsGuard` checks this metadata and short-circuits to grant
 * access for sysadmins (and deny everyone else) without running tenant RBAC.
 *
 * Use INSTEAD of writing `if (!req.user?.isSystemAdmin) throw new ForbiddenException(...)`
 * inside controller method bodies.
 */
export const SystemAdminOnly = () =>
  applyDecorators(
    SetMetadata(SYSTEM_ADMIN_ONLY_KEY, true),
    UseGuards(AuthGuard('jwt'), PermissionsGuard),
  );

