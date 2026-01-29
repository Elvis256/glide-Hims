import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.entity';
import { RolePermission } from '../../../database/entities/role-permission.entity';

export const PERMISSIONS_KEY = 'permissions';

@Injectable()
export class PermissionsGuard implements CanActivate {
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

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.id) {
      return false;
    }

    // Super Admin has all permissions
    if (user.roles?.includes('Super Admin')) {
      return true;
    }

    // Get user's roles
    const userRoleRepository = this.dataSource.getRepository(UserRole);
    const rolePermissionRepository = this.dataSource.getRepository(RolePermission);
    
    const userRoles = await userRoleRepository.find({
      where: { userId: user.id },
    });

    if (userRoles.length === 0) {
      return false;
    }

    // Get all permissions for user's roles
    const roleIds = userRoles.map(ur => ur.roleId);
    const rolePermissions = await rolePermissionRepository
      .createQueryBuilder('rp')
      .leftJoinAndSelect('rp.permission', 'permission')
      .where('rp.roleId IN (:...roleIds)', { roleIds })
      .getMany();

    const userPermissionCodes = rolePermissions
      .filter(rp => rp.permission)
      .map(rp => rp.permission.code);

    // Check if user has ALL required permissions
    return requiredPermissions.every(perm => userPermissionCodes.includes(perm));
  }
}
