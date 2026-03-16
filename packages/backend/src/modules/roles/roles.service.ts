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
    await this.findOneRole(roleId);
    const permission = await this.permissionRepository.findOne({ where: { id: dto.permissionId , ...(tenantId ? { tenantId } : {}) } });
    if (!permission) throw new NotFoundException('Permission not found');

    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId: dto.permissionId , ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException('Permission already assigned');

    return this.rolePermissionRepository.save(
      this.rolePermissionRepository.create({ roleId, permissionId: dto.permissionId }),
    );
  }

  async removePermission(roleId: string, permissionId: string, tenantId?: string): Promise<void> {
    const rp = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId , ...(tenantId ? { tenantId } : {}) },
    });
    if (!rp) throw new NotFoundException('Role permission not found');
    await this.rolePermissionRepository.remove(rp);
  }

  async bulkUpdatePermissions(roleId: string, permissions: Record<string, boolean>, tenantId?: string): Promise<void> {
    await this.findOneRole(roleId);
    
    for (const [permCode, enabled] of Object.entries(permissions)) {
      // Find permission by code
      const permission = await this.permissionRepository.findOne({ where: { code: permCode , ...(tenantId ? { tenantId } : {}) } });
      if (!permission) continue;

      const existing = await this.rolePermissionRepository.findOne({
        where: { roleId, permissionId: permission.id , ...(tenantId ? { tenantId } : {}) },
      });

      if (enabled && !existing) {
        // Add permission
        await this.rolePermissionRepository.save(
          this.rolePermissionRepository.create({ roleId, permissionId: permission.id }),
        );
      } else if (!enabled && existing) {
        // Remove permission
        await this.rolePermissionRepository.remove(existing);
      }
    }
  }

  // Permissions
  async createPermission(dto: CreatePermissionDto, tenantId?: string): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({ where: { code: dto.code , ...(tenantId ? { tenantId } : {}) } });
    if (existing) throw new ConflictException('Permission code already exists');
    return this.permissionRepository.save(this.permissionRepository.create(dto));
  }

  async findAllPermissions(module?: string, tenantId?: string) {
    const where: any = {};
    if (module) where.module = module;
    if (tenantId) where.tenantId = tenantId;
    return this.permissionRepository.find({ where, order: { module: 'ASC', code: 'ASC' } });
  }
}
