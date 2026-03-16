import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { CreateRoleDto, UpdateRoleDto, CreatePermissionDto, AssignPermissionDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
  ) {}

  // Roles
  async createRole(dto: CreateRoleDto, tenantId?: string): Promise<Role> {
    const existing = await this.roleRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role name already exists');
    const role = this.roleRepository.create({ ...dto, status: 'active', ...(tenantId ? { tenantId } : {}) });
    return this.roleRepository.save(role);
  }

  async findAllRoles(tenantId?: string) {
    let roles: Role[];
    if (tenantId) {
      // Return both shared system roles (NULL tenant) and tenant-specific roles
      roles = await this.roleRepository
        .createQueryBuilder('role')
        .where('role.tenant_id = :tenantId OR role.tenant_id IS NULL', { tenantId })
        .orderBy('role.name', 'ASC')
        .getMany();
    } else {
      roles = await this.roleRepository.find({ order: { name: 'ASC' } });
    }
    
    // Get user counts and permissions for each role
    const rolesWithDetails = await Promise.all(
      roles.map(async (role) => {
        // Count users with this role
        const userCount = await this.rolePermissionRepository.manager
          .getRepository('UserRole')
          .count({ where: { roleId: role.id } });
        
        // Get permissions
        const rolePermissions = await this.rolePermissionRepository.find({
          where: { roleId: role.id },
          relations: ['permission'],
        });
        
        return {
          ...role,
          userCount,
          permissions: rolePermissions.map((rp) => rp.permission),
        };
      })
    );
    
    return rolesWithDetails;
  }

  async findOneRole(id: string, tenantId?: string) {
    let role: Role | null;
    if (tenantId) {
      role = await this.roleRepository
        .createQueryBuilder('role')
        .where('role.id = :id', { id })
        .andWhere('(role.tenant_id = :tenantId OR role.tenant_id IS NULL)', { tenantId })
        .getOne();
    } else {
      role = await this.roleRepository.findOne({ where: { id } });
    }
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findRoleWithPermissions(id: string, tenantId?: string) {
    const role = await this.findOneRole(id, tenantId);
    let rolePermissionsQuery = this.rolePermissionRepository
      .createQueryBuilder('rp')
      .leftJoinAndSelect('rp.permission', 'permission')
      .where('rp.roleId = :roleId', { roleId: id });
    
    if (tenantId) {
      rolePermissionsQuery = rolePermissionsQuery.andWhere(
        '(rp.tenant_id = :tenantId OR rp.tenant_id IS NULL)', { tenantId }
      );
    }
    
    const rolePermissions = await rolePermissionsQuery.getMany();
    return {
      ...role,
      permissions: rolePermissions.map((rp) => rp.permission),
    };
  }

  async updateRole(id: string, dto: UpdateRoleDto, tenantId?: string): Promise<Role> {
    const role = await this.findOneRole(id);
    if (role.isSystemRole && dto.name && dto.name !== role.name) {
      throw new ConflictException('Cannot rename system roles');
    }
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  async removeRole(id: string, tenantId?: string): Promise<void> {
    const role = await this.findOneRole(id);
    if (role.isSystemRole) throw new ConflictException('Cannot delete system roles');
    await this.roleRepository.softRemove(role);
  }

  async assignPermission(roleId: string, dto: AssignPermissionDto, tenantId?: string) {
    await this.findOneRole(roleId, tenantId);
    // Permissions are shared (NULL tenant_id), so don't filter by tenant
    const permission = await this.permissionRepository.findOne({ where: { id: dto.permissionId } });
    if (!permission) throw new NotFoundException('Permission not found');

    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId: dto.permissionId },
    });
    if (existing) throw new ConflictException('Permission already assigned');

    return this.rolePermissionRepository.save(
      this.rolePermissionRepository.create({ roleId, permissionId: dto.permissionId }),
    );
  }

  async removePermission(roleId: string, permissionId: string, tenantId?: string): Promise<void> {
    const rp = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });
    if (!rp) throw new NotFoundException('Role permission not found');
    await this.rolePermissionRepository.remove(rp);
  }

  async bulkUpdatePermissions(roleId: string, permissions: Record<string, boolean>, tenantId?: string): Promise<void> {
    await this.findOneRole(roleId, tenantId);
    
    for (const [permCode, enabled] of Object.entries(permissions)) {
      // Permissions are shared (NULL tenant_id) — find by code only
      const permission = await this.permissionRepository.findOne({ where: { code: permCode } });
      if (!permission) continue;

      const existing = await this.rolePermissionRepository.findOne({
        where: { roleId, permissionId: permission.id },
      });

      if (enabled && !existing) {
        await this.rolePermissionRepository.save(
          this.rolePermissionRepository.create({ roleId, permissionId: permission.id }),
        );
      } else if (!enabled && existing) {
        await this.rolePermissionRepository.remove(existing);
      }
    }
  }

  // Permissions
  async createPermission(dto: CreatePermissionDto, tenantId?: string): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Permission code already exists');
    return this.permissionRepository.save(this.permissionRepository.create(dto));
  }

  async findAllPermissions(module?: string, tenantId?: string) {
    const qb = this.permissionRepository.createQueryBuilder('permission');
    
    if (module) {
      qb.where('permission.module = :module', { module });
    }
    // Include shared permissions (NULL tenant) and tenant-specific ones
    if (tenantId) {
      qb.andWhere('(permission.tenant_id = :tenantId OR permission.tenant_id IS NULL)', { tenantId });
    }
    
    return qb.orderBy('permission.module', 'ASC').addOrderBy('permission.code', 'ASC').getMany();
  }
}
