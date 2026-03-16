import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource, In } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';
import { UserPermission } from '../../../database/entities/user-permission.entity';
import { Role } from '../../../database/entities/role.entity';
import { RolePermissionGroup } from '../../../database/entities/role-permission-group.entity';
import { GroupPermission } from '../../../database/entities/group-permission.entity';
import { SYSTEM_ROLES, isSuperAdmin } from '../../../common/constants/roles.constants';

export const PERMISSIONS_KEY = 'permissions';
export const FACILITY_KEY = 'requireFacility';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger('SuperAdminAudit');

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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

    if (isSuperAdmin(user.roles)) {
      this.logSuperAdminAccess(request, requiredPermissions);
      return true;
    }

    const targetFacilityId = this.extractFacilityId(request);

    const userRoleRepository = this.dataSource.getRepository(UserRole);
    const rolePermissionRepository = this.dataSource.getRepository(RolePermission);
    const userPermissionRepository = this.dataSource.getRepository(UserPermission);
    const roleRepository = this.dataSource.getRepository(Role);

    // Get user's roles (filtered by facility if applicable)
    let userRolesQuery = userRoleRepository
      .createQueryBuilder('ur')
      .where('ur.userId = :userId', { userId: user.id });
    
    if (targetFacilityId) {
      userRolesQuery = userRolesQuery.andWhere(
        '(ur.facilityId = :facilityId OR ur.facilityId IS NULL)',
        { facilityId: targetFacilityId }
      );
    }
    
    const userRoles = await userRolesQuery.getMany();
    const userPermissionCodes: string[] = [];

    if (userRoles.length > 0) {
      const roleIds = userRoles.map(ur => ur.roleId);
      
      // Collect all role IDs including inherited parent roles
      const allRoleIds = new Set<string>(roleIds);
      for (const roleId of roleIds) {
        const parentIds = await this.getParentRoleIds(roleRepository, roleId);
        parentIds.forEach(id => allRoleIds.add(id));
      }
      
      const allRoleIdsArray = [...allRoleIds];

      // Get direct role permissions (including inherited roles)
      const rolePermissions = await rolePermissionRepository
        .createQueryBuilder('rp')
        .leftJoinAndSelect('rp.permission', 'permission')
        .where('rp.roleId IN (:...roleIds)', { roleIds: allRoleIdsArray })
        .getMany();

      rolePermissions
        .filter(rp => rp.permission)
        .forEach(rp => userPermissionCodes.push(rp.permission.code));

      // Get permissions from permission groups assigned to these roles
      try {
        const rolePermGroupRepo = this.dataSource.getRepository(RolePermissionGroup);
        const groupPermRepo = this.dataSource.getRepository(GroupPermission);
        
        const roleGroups = await rolePermGroupRepo.find({
          where: { roleId: In(allRoleIdsArray) },
        });
        
        if (roleGroups.length > 0) {
          const groupIds = roleGroups.map(rg => rg.groupId);
          const groupPerms = await groupPermRepo.find({
            where: { groupId: In(groupIds) },
            relations: ['permission'],
          });
          groupPerms
            .filter(gp => gp.permission)
            .forEach(gp => userPermissionCodes.push(gp.permission.code));
        }
      } catch {
        // Permission groups tables may not exist yet - gracefully skip
      }
    }

    // Direct user permissions
    const directPermissions = await userPermissionRepository
      .createQueryBuilder('up')
      .leftJoinAndSelect('up.permission', 'permission')
      .where('up.userId = :userId', { userId: user.id })
      .getMany();

    directPermissions
      .filter(up => up.permission)
      .forEach(up => {
        if (!userPermissionCodes.includes(up.permission.code)) {
          userPermissionCodes.push(up.permission.code);
        }
      });

    if (userPermissionCodes.length === 0) {
      this.logAccessDenied(request, requiredPermissions, 'NO_PERMISSIONS');
      return false;
    }

    const hasAllPermissions = requiredPermissions.every(perm => userPermissionCodes.includes(perm));
    
    if (!hasAllPermissions) {
      this.logAccessDenied(request, requiredPermissions, 'MISSING_PERMISSIONS');
    }
    
    return hasAllPermissions;
  }

  /**
   * Walk up the role inheritance chain and collect all parent role IDs.
   */
  private async getParentRoleIds(roleRepo: any, roleId: string, maxDepth = 10): Promise<string[]> {
    const parentIds: string[] = [];
    const visited = new Set<string>([roleId]);
    let currentId = roleId;

    for (let i = 0; i < maxDepth; i++) {
      const role = await roleRepo.findOne({ where: { id: currentId }, select: ['id', 'parentRoleId'] });
      if (!role?.parentRoleId || visited.has(role.parentRoleId)) break;
      visited.add(role.parentRoleId);
      parentIds.push(role.parentRoleId);
      currentId = role.parentRoleId;
    }

    return parentIds;
  }

  private extractFacilityId(request: any): string | null {
    const headerFacility = request.headers?.['x-facility-id'];
    if (headerFacility) return headerFacility;
    if (request.query?.facilityId) return request.query.facilityId;
    if (request.body?.facilityId) return request.body.facilityId;
    if (request.params?.facilityId) return request.params.facilityId;
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
