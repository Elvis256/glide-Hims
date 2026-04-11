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
    const existing = await this.roleRepository.findOne({ where: { name: dto.name, ...(tenantId ? { tenantId } : {}) } });
    if (existing) throw new ConflictException('Role name already exists');
    const role = this.roleRepository.create({ ...dto, status: 'active', ...(tenantId ? { tenantId } : {}) });
    return this.roleRepository.save(role);
  }

  async findAllRoles(tenantId?: string) {
    let roles: Role[];
    if (tenantId) {
      // SECURITY: Include tenant-specific roles AND system roles (isSystemRole=true)
      roles = await this.roleRepository
        .createQueryBuilder('role')
        .leftJoinAndSelect('role.parentRole', 'parentRole')
        .where('(role.tenant_id = :tenantId OR role.is_system_role = true)', { tenantId })
        .orderBy('role.name', 'ASC')
        .getMany();
    } else {
      roles = await this.roleRepository.find({
        relations: ['parentRole'],
        order: { name: 'ASC' },
      });
    }
    
    // Get user counts and permissions (including inherited) for each role
    const rolesWithDetails = await Promise.all(
      roles.map(async (role) => {
        const userCount = await this.rolePermissionRepository.manager
          .getRepository('UserRole')
          .count({ where: { roleId: role.id } });
        
        const { direct, inherited, all } = await this.resolveRolePermissions(role.id);
        
        // Get full permission objects for the combined set
        const allPermCodes = all;
        let permissions: Permission[] = [];
        if (allPermCodes.length > 0) {
          permissions = await this.permissionRepository
            .createQueryBuilder('p')
            .where('p.code IN (:...codes)', { codes: allPermCodes })
            .orderBy('p.module', 'ASC')
            .addOrderBy('p.code', 'ASC')
            .getMany();
        }
        
        return {
          ...role,
          userCount,
          permissions,
          directPermissionCount: direct.length,
          inheritedPermissionCount: inherited.length,
          parentRoleName: role.parentRole?.name || null,
        };
      })
    );
    
    return rolesWithDetails;
  }

  async findOneRole(id: string, tenantId?: string) {
    let role: Role | null;
    if (tenantId) {
      // SECURITY: Include tenant-specific roles AND system roles
      role = await this.roleRepository
        .createQueryBuilder('role')
        .where('role.id = :id', { id })
        .andWhere('(role.tenant_id = :tenantId OR role.is_system_role = true)', { tenantId })
        .getOne();
    } else {
      role = await this.roleRepository.findOne({ where: { id } });
    }
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async findRoleWithPermissions(id: string, tenantId?: string) {
    const role = await this.findOneRole(id, tenantId);
    
    // Load parent role info
    let parentRole: Role | null = null;
    if (role.parentRoleId) {
      // SECURITY: Use proper tenant filtering for parent lookup
      parentRole = await this.roleRepository.findOne({ 
        where: tenantId 
          ? [{ id: role.parentRoleId, tenantId }, { id: role.parentRoleId, isSystemRole: true }]
          : { id: role.parentRoleId }
      });
    }

    const { direct, inherited, all } = await this.resolveRolePermissions(id);
    
    // Get full permission objects
    let permissions: Permission[] = [];
    if (all.length > 0) {
      permissions = await this.permissionRepository
        .createQueryBuilder('p')
        .where('p.code IN (:...codes)', { codes: all })
        .orderBy('p.module', 'ASC')
        .addOrderBy('p.code', 'ASC')
        .getMany();
    }

    return {
      ...role,
      parentRoleName: parentRole?.name || null,
      permissions,
      directPermissionCodes: direct,
      inheritedPermissionCodes: inherited,
      directPermissionCount: direct.length,
      inheritedPermissionCount: inherited.length,
    };
  }

  async updateRole(id: string, dto: UpdateRoleDto, tenantId?: string): Promise<Role> {
    const role = await this.findOneRole(id, tenantId);
    if (role.isSystemRole && dto.name && dto.name !== role.name) {
      throw new ConflictException('Cannot rename system roles');
    }
    Object.assign(role, dto);
    return this.roleRepository.save(role);
  }

  async setParentRole(id: string, parentRoleId: string | null, tenantId?: string): Promise<Role> {
    const role = await this.findOneRole(id, tenantId);
    
    if (parentRoleId) {
      // Validate parent exists
      const parentRole = await this.findOneRole(parentRoleId, tenantId);
      
      // Prevent self-referencing
      if (parentRole.id === role.id) {
        throw new ConflictException('A role cannot be its own parent');
      }
      
      // Prevent cycles: walk up from parent to ensure we don't hit this role
      let currentId = parentRoleId;
      const visited = new Set<string>([role.id]);
      for (let depth = 0; depth < 10; depth++) {
        if (visited.has(currentId)) {
          throw new ConflictException('Setting this parent would create a circular inheritance');
        }
        visited.add(currentId);
        const current = await this.roleRepository.findOne({ where: { id: currentId } });
        if (!current?.parentRoleId) break;
        currentId = current.parentRoleId;
      }
    }

    role.parentRoleId = parentRoleId ?? (null as any);
    return this.roleRepository.save(role);
  }

  async removeRole(id: string, tenantId?: string): Promise<void> {
    const role = await this.findOneRole(id, tenantId);
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
    await this.findOneRole(roleId, tenantId);
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

  /**
   * Resolve all permission codes for a role, walking up the inheritance chain.
   * Returns { direct: string[], inherited: string[], all: string[] }
   */
  async resolveRolePermissions(roleId: string): Promise<{ direct: string[]; inherited: string[]; all: string[] }> {
    // Get direct permissions for this role
    const directRps = await this.rolePermissionRepository.find({
      where: { roleId },
      relations: ['permission'],
    });
    const direct = directRps.map((rp) => rp.permission?.code).filter(Boolean);

    // Walk inheritance chain (max 10 levels to prevent cycles)
    const inherited: string[] = [];
    let currentRole = await this.roleRepository.findOne({ where: { id: roleId } });
    let depth = 0;
    const visitedRoleIds = new Set<string>([roleId]);

    while (currentRole?.parentRoleId && depth < 10) {
      if (visitedRoleIds.has(currentRole.parentRoleId)) break; // cycle detection
      visitedRoleIds.add(currentRole.parentRoleId);

      const parentRps = await this.rolePermissionRepository.find({
        where: { roleId: currentRole.parentRoleId },
        relations: ['permission'],
      });
      inherited.push(...parentRps.map((rp) => rp.permission?.code).filter(Boolean));

      currentRole = await this.roleRepository.findOne({ where: { id: currentRole.parentRoleId } });
      depth++;
    }

    const all = [...new Set([...direct, ...inherited])];
    return { direct, inherited: [...new Set(inherited)], all };
  }

  /**
   * Resolve all permission codes for multiple roles (merging inheritance).
   */
  async resolvePermissionsForRoles(roleIds: string[]): Promise<string[]> {
    const allPerms = new Set<string>();
    for (const roleId of roleIds) {
      const { all } = await this.resolveRolePermissions(roleId);
      all.forEach((p) => allPerms.add(p));
    }
    return [...allPerms];
  }
}
