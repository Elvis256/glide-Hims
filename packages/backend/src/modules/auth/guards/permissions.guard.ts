import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';
import { UserPermission } from '../../../database/entities/user-permission.entity';
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

    // No permissions required - allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.id) {
      return false;
    }

    // Super Admin has all permissions - but log the bypass
    if (isSuperAdmin(user.roles)) {
      this.logSuperAdminAccess(request, requiredPermissions);
      return true;
    }

    // Extract target facility from request (header, query, or body)
    const targetFacilityId = this.extractFacilityId(request);

    // Get user's roles (filtered by facility if applicable)
    const userRoleRepository = this.dataSource.getRepository(UserRole);
    const rolePermissionRepository = this.dataSource.getRepository(RolePermission);
    const userPermissionRepository = this.dataSource.getRepository(UserPermission);
    
    let userRolesQuery = userRoleRepository
      .createQueryBuilder('ur')
      .where('ur.userId = :userId', { userId: user.id });
    
    // If a target facility is specified, only get roles for that facility (or global roles)
    if (targetFacilityId) {
      userRolesQuery = userRolesQuery.andWhere(
        '(ur.facilityId = :facilityId OR ur.facilityId IS NULL)',
        { facilityId: targetFacilityId }
      );
    }
    
    const userRoles = await userRolesQuery.getMany();

    // Collect all permission codes from roles
    const userPermissionCodes: string[] = [];

    if (userRoles.length > 0) {
      // Get all permissions for user's roles
      const roleIds = userRoles.map(ur => ur.roleId);
      const rolePermissions = await rolePermissionRepository
        .createQueryBuilder('rp')
        .leftJoinAndSelect('rp.permission', 'permission')
        .where('rp.roleId IN (:...roleIds)', { roleIds })
        .getMany();

      rolePermissions
        .filter(rp => rp.permission)
        .forEach(rp => userPermissionCodes.push(rp.permission.code));
    }

    // Also get direct user permissions (these apply regardless of facility)
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

    // If no permissions at all, deny access
    if (userPermissionCodes.length === 0) {
      this.logAccessDenied(request, requiredPermissions, 'NO_PERMISSIONS');
      return false;
    }

    // Check if user has ALL required permissions
    const hasAllPermissions = requiredPermissions.every(perm => userPermissionCodes.includes(perm));
    
    if (!hasAllPermissions) {
      this.logAccessDenied(request, requiredPermissions, 'MISSING_PERMISSIONS');
    }
    
    return hasAllPermissions;
  }

  /**
   * Extract facility ID from the request
   * Checks: header, query param, body
   */
  private extractFacilityId(request: any): string | null {
    // Check header first (preferred for API calls)
    const headerFacility = request.headers?.['x-facility-id'];
    if (headerFacility) return headerFacility;
    
    // Check query parameter
    if (request.query?.facilityId) return request.query.facilityId;
    
    // Check body
    if (request.body?.facilityId) return request.body.facilityId;
    
    // Check route params
    if (request.params?.facilityId) return request.params.facilityId;
    
    return null;
  }

  /**
   * Log Super Admin permission bypass for audit trail
   */
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
    
    // Log to dedicated audit logger (in production, send to SIEM/audit database)
    this.logger.warn(JSON.stringify(logEntry));
  }

  /**
   * Log access denied for security monitoring
   */
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
