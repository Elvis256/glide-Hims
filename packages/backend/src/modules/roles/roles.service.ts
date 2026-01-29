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
  async createRole(dto: CreateRoleDto): Promise<Role> {
    const existing = await this.roleRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Role name already exists');
    const role = this.roleRepository.create({ ...dto, status: 'active' });
    return this.roleRepository.save(role);
  }

  async findAllRoles() {
    const roles = await this.roleRepository.find({ order: { name: 'ASC' } });
    
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

  async findOneRole(id: string) {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findRoleWithPermissions(id: string) {
    const role = await this.findOneRole(id);
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { roleId: id },
      relations: ['permission'],
    });
    return {
      ...role,
      permissions: rolePermissions.map((rp) => rp.permission),
    };
  }

  async updateRole(id: string, dto: UpdateRoleDto): Promise<Role> {
    const role = await this.findOneRole(id);
    if (role.isSystemRole && dto.name && dto.name !== role.name) {
      throw new ConflictException('Cannot rename system roles');
    }
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  async removeRole(id: string): Promise<void> {
    const role = await this.findOneRole(id);
    if (role.isSystemRole) throw new ConflictException('Cannot delete system roles');
    await this.roleRepository.softRemove(role);
  }

  async assignPermission(roleId: string, dto: AssignPermissionDto) {
    await this.findOneRole(roleId);
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

  async removePermission(roleId: string, permissionId: string): Promise<void> {
    const rp = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });
    if (!rp) throw new NotFoundException('Role permission not found');
    await this.rolePermissionRepository.remove(rp);
  }

  async bulkUpdatePermissions(roleId: string, permissions: Record<string, boolean>): Promise<void> {
    await this.findOneRole(roleId);
    
    for (const [permCode, enabled] of Object.entries(permissions)) {
      // Find permission by code
      const permission = await this.permissionRepository.findOne({ where: { code: permCode } });
      if (!permission) continue;

      const existing = await this.rolePermissionRepository.findOne({
        where: { roleId, permissionId: permission.id },
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
  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const existing = await this.permissionRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Permission code already exists');
    return this.permissionRepository.save(this.permissionRepository.create(dto));
  }

  async findAllPermissions(module?: string) {
    const where = module ? { module } : {};
    return this.permissionRepository.find({ where, order: { module: 'ASC', code: 'ASC' } });
  }
}
