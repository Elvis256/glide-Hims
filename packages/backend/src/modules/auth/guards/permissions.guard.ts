import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource, In } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';
import { UserPermission } from '../../../database/entities/user-permission.entity';
import { Role } from '../../../database/entities/role.entity';
import { RolePermissionGroup } from '../../../database/entities/role-permission-group.entity';
import { GroupPermission } from '../../../database/entities/group-permission.entity';
import { isSuperAdmin } from '../../../common/constants/roles.constants';
import { CacheService } from '../../cache/cache.service';
import { getActiveSupportTier, checkSystemAdminAccess } from './support-tier.util';

export const PERMISSIONS_KEY = 'permissions';
export const FACILITY_KEY = 'requireFacility';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger('SuperAdminAudit');

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
    private cacheService: CacheService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // @SystemAdminOnly() bypass: short-circuit when the route demands sysadmin.
    const systemAdminOnly = this.reflector.getAllAndOverride<boolean>('systemAdminOnly', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (systemAdminOnly) {
      const req = context.switchToHttp().getRequest();
      if (!req.user?.isSystemAdmin) {
        return false;
      }
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.id) {
      return false;
    }

    // Super Admin role (tenant-scoped) — full bypass within their tenant
    if (isSuperAdmin(user.roles)) {
      this.logSuperAdminAccess(request, requiredPermissions);
      return true;
    }

    // System admin — tiered access based on endpoint category
    if (user.isSystemAdmin) {
      const path = request.url || '';
      const tenantId = user.tenantId;

      // System-level endpoints (no tenant context required): tenants/deployments/system management.
      // System admins always need access to these regardless of tenant context.
      const isSystemLevelEndpoint =
        path.startsWith('/api/v1/tenants') ||
        path.startsWith('/api/v1/deployments') ||
        path.startsWith('/api/v1/system') ||
        path.startsWith('/api/v1/licenses') ||
        path.startsWith('/api/v1/license') ||
        path.startsWith('/api/v1/updates') ||
        path.startsWith('/api/v1/settings/platform') ||
        path.startsWith('/api/v1/settings/facility-presets') ||
        path.startsWith('/api/v1/settings/module-registry') ||
        path.startsWith('/api/v1/leads') ||
        path.startsWith('/api/v1/downloads') ||
        path.includes('/users/system-admins') ||
        path.includes('/users/tenant-admins') ||
        path.includes('/system-reset-password') ||
        path.includes('/system-create-admin') ||
        // Creating/updating other system admins is a system-level op even though
        // the route is /users. Detect via request body flag.
        (path.startsWith('/api/v1/users') && request.body?.isSystemAdmin === true);

      if (isSystemLevelEndpoint) {
        this.logSuperAdminAccess(request, requiredPermissions);
        return true;
      }

      // For tenant-scoped endpoints, system admin must have entered a tenant context first
      if (!tenantId) {
        this.logAccessDenied(request, requiredPermissions, 'SYSTEM_ADMIN_NO_TENANT_CONTEXT');
        return false;
      }

      const tier = await getActiveSupportTier(this.dataSource, user.id, tenantId);
      const allowed = checkSystemAdminAccess(tier, path, request.method);
      if (allowed) {
        this.logSuperAdminAccess(request, requiredPermissions);
      } else {
        this.logAccessDenied(request, requiredPermissions, 'SUPPORT_TIER_INSUFFICIENT');
      }
      return allowed;
    }

    const targetFacilityId = this.extractFacilityId(request);

    // SECURITY: Include tenantId in cache key to prevent cross-tenant permission leakage
    const tenantId = user.tenantId || 'global';
    const cacheKey = `perms:${tenantId}:${user.id}:${targetFacilityId || 'global'}`;
    const userPermissionCodes = await this.cacheService.getOrSet<string[]>(
      cacheKey,
      () => this.resolveUserPermissions(user.id, targetFacilityId),
      60,
    );

    if (userPermissionCodes.length === 0) {
      this.logAccessDenied(request, requiredPermissions, 'NO_PERMISSIONS');
      return false;
    }

    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissionCodes.includes(perm),
    );

    if (!hasAllPermissions) {
      this.logAccessDenied(request, requiredPermissions, 'MISSING_PERMISSIONS');
    }

    return hasAllPermissions;
  }

  private async resolveUserPermissions(
    userId: string,
    targetFacilityId: string | null,
  ): Promise<string[]> {
    const userRoleRepository = this.dataSource.getRepository(UserRole);
    const rolePermissionRepository = this.dataSource.getRepository(RolePermission);
    const userPermissionRepository = this.dataSource.getRepository(UserPermission);
    const roleRepository = this.dataSource.getRepository(Role);

    // Get user's roles (filtered by facility if applicable)
    let userRolesQuery = userRoleRepository
      .createQueryBuilder('ur')
      .where('ur.userId = :userId', { userId });

    if (targetFacilityId) {
      userRolesQuery = userRolesQuery.andWhere(
        '(ur.facilityId = :facilityId OR ur.facilityId IS NULL)',
        { facilityId: targetFacilityId },
      );
    }

    const userRoles = await userRolesQuery.getMany();
    const userPermissionCodes: string[] = [];

    if (userRoles.length > 0) {
      const roleIds = userRoles.map((ur) => ur.roleId);

      // Collect all role IDs including inherited parent roles
      const allRoleIds = new Set<string>(roleIds);
      for (const roleId of roleIds) {
        const parentIds = await this.getParentRoleIds(roleRepository, roleId);
        parentIds.forEach((id) => allRoleIds.add(id));
      }

      const allRoleIdsArray = [...allRoleIds];

      // Get direct role permissions (including inherited roles)
      const rolePermissions = await rolePermissionRepository
        .createQueryBuilder('rp')
        .leftJoinAndSelect('rp.permission', 'permission')
        .where('rp.roleId IN (:...roleIds)', { roleIds: allRoleIdsArray })
        .getMany();

      rolePermissions
        .filter((rp) => rp.permission)
        .forEach((rp) => userPermissionCodes.push(rp.permission.code));

      // Get permissions from permission groups assigned to these roles
      try {
        const rolePermGroupRepo = this.dataSource.getRepository(RolePermissionGroup);
        const groupPermRepo = this.dataSource.getRepository(GroupPermission);

        const roleGroups = await rolePermGroupRepo.find({
          where: { roleId: In(allRoleIdsArray) },
        });

        if (roleGroups.length > 0) {
          const groupIds = roleGroups.map((rg) => rg.groupId);
          const groupPerms = await groupPermRepo.find({
            where: { groupId: In(groupIds) },
            relations: ['permission'],
          });
          groupPerms
            .filter((gp) => gp.permission)
            .forEach((gp) => userPermissionCodes.push(gp.permission.code));
        }
      } catch {
        // Permission groups tables may not exist yet - gracefully skip
      }
    }

    // Direct user permissions
    const directPermissions = await userPermissionRepository
      .createQueryBuilder('up')
      .leftJoinAndSelect('up.permission', 'permission')
      .where('up.userId = :userId', { userId })
      .getMany();

    directPermissions
      .filter((up) => up.permission)
      .forEach((up) => {
        if (!userPermissionCodes.includes(up.permission.code)) {
          userPermissionCodes.push(up.permission.code);
        }
      });

    return userPermissionCodes;
  }

  /**
   * Walk up the role inheritance chain and collect all parent role IDs.
   */
  private async getParentRoleIds(roleRepo: any, roleId: string, maxDepth = 10): Promise<string[]> {
    const parentIds: string[] = [];
    const visited = new Set<string>([roleId]);
    let currentId = roleId;

    for (let i = 0; i < maxDepth; i++) {
      const role = await roleRepo.findOne({
        where: { id: currentId },
        select: ['id', 'parentRoleId'],
      });
      if (!role?.parentRoleId || visited.has(role.parentRoleId)) break;
      visited.add(role.parentRoleId);
      parentIds.push(role.parentRoleId);
      currentId = role.parentRoleId;
    }

    return parentIds;
  }

  private extractFacilityId(request: any): string | null {
    // Always prefer JWT-authenticated facility ID
    if (request.user?.facilityId) return request.user.facilityId;
    // Only system admins may specify a different facility via header/query/params
    if (request.user?.isSystemAdmin) {
      const headerFacility = request.headers?.['x-facility-id'];
      if (headerFacility) return headerFacility;
      if (request.query?.facilityId) return request.query.facilityId;
      if (request.params?.facilityId) return request.params.facilityId;
    }
    return null;
  }

  private logSuperAdminAccess(request: any, requiredPermissions: string[]): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SUPER_ADMIN_PERMISSION_BYPASS',
      userId: request.user?.id,
      username: request.user?.username || request.user?.email,
      ip: request.ip || request.connection?.remoteAddress,
      method: request.method,
      path: request.url,
      bypassedPermissions: requiredPermissions,
      facilityId: this.extractFacilityId(request),
      userAgent: request.headers?.['user-agent']?.substring(0, 100),
    };
    this.logger.warn(JSON.stringify(logEntry));
  }

  private logAccessDenied(request: any, requiredPermissions: string[], reason: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'ACCESS_DENIED',
      reason,
      userId: request.user?.id,
      username: request.user?.username || request.user?.email,
      ip: request.ip || request.connection?.remoteAddress,
      method: request.method,
      path: request.url,
      requiredPermissions,
      facilityId: this.extractFacilityId(request),
    };
    this.logger.warn(JSON.stringify(logEntry));
  }
}
