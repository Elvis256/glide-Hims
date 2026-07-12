import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { isSuperAdmin } from '../../common/constants/roles.constants';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  AssignPermissionDto,
} from './dto/role.dto';
import { requireTenantId } from '../../common/utils/tenant.util';

/**
 * Authenticated caller context used to gate privileged role/permission mutations.
 * Passed from controllers as `req.user` so the service can decide whether the
 * caller is allowed to escalate role flags (isSystemRole) or grant permission
 * codes the caller does not already hold (the classic "tenant admin promotes
 * self to Super Admin" path).
 */
export interface RoleMutationCaller {
  id?: string;
  userId?: string;
  isSystemAdmin?: boolean;
  roles?: string[];
}

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    private dataSource: DataSource,
  ) {}

  // Roles
  async createRole(
    dto: CreateRoleDto,
    tenantId?: string,
    caller?: RoleMutationCaller,
  ): Promise<Role> {
    const tid = requireTenantId(tenantId);
    const existing = await this.roleRepository.findOne({
      where: { name: dto.name, tenantId: tid },
    });
    if (existing) throw new ConflictException('Role name already exists');
    // SECURITY: isSystemRole on the DTO is user-controlled. Only a platform
    // system administrator may flag a role as a global "system role" — that
    // flag makes the role visible/assignable across every tenant and exempts
    // it from tenant-scoped mutation guards. Silently drop the flag for
    // anyone else.
    const sanitized: any = { ...dto };
    if (sanitized.isSystemRole && !caller?.isSystemAdmin) {
      sanitized.isSystemRole = false;
    }
    const role = this.roleRepository.create({
      ...sanitized,
      status: 'active',
      tenantId: tid,
    });
    const saved = await this.roleRepository.save(role);
    return Array.isArray(saved) ? saved[0] : saved;
  }

  /**
   * Throws if `role` is a global system role and the caller is operating in
   * tenant context (tenantId set). Only platform admins (no tenantId) may
   * mutate system roles, since those roles are shared across every tenant.
   */
  private assertMutable(role: Role, tenantId?: string): void {
    if (role.isSystemRole && tenantId) {
      throw new ForbiddenException(
        'System roles are shared across all tenants and can only be modified by a platform administrator',
      );
    }
  }

  async findAllRoles(tenantId?: string) {
    const tid = requireTenantId(tenantId);
    let roles: Role[];
    // SECURITY: Include tenant-specific roles AND system roles (isSystemRole=true)
    roles = await this.roleRepository
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.parentRole', 'parentRole')
      .where('(role.tenant_id = :tenantId OR role.is_system_role = true)', { tenantId: tid })
      .orderBy('role.name', 'ASC')
      .getMany();

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
      }),
    );

    return rolesWithDetails;
  }

  async findOneRole(id: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    // SECURITY: Include tenant-specific roles AND system roles
    const role = await this.roleRepository
      .createQueryBuilder('role')
      .where('role.id = :id', { id })
      .andWhere('(role.tenant_id = :tenantId OR role.is_system_role = true)', { tenantId: tid })
      .getOne();
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
          ? [
              { id: role.parentRoleId, tenantId },
              { id: role.parentRoleId, isSystemRole: true },
            ]
          : { id: role.parentRoleId },
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

  async updateRole(
    id: string,
    dto: UpdateRoleDto,
    tenantId?: string,
    caller?: RoleMutationCaller,
  ): Promise<Role> {
    const role = await this.findOneRole(id, tenantId);
    this.assertMutable(role, tenantId);
    if (role.isSystemRole && dto.name && dto.name !== role.name) {
      throw new ConflictException('Cannot rename system roles');
    }
    // Strip privilege-escalation flags unless caller is a platform admin.
    const sanitized = { ...dto };
    if ('isSystemRole' in sanitized && !caller?.isSystemAdmin) {
      delete sanitized.isSystemRole;
    }
    Object.assign(role, sanitized);
    return this.roleRepository.save(role);
  }

  /**
   * Returns the set of permission codes the caller currently holds (direct +
   * role-derived, including inheritance). Used to prevent privilege
   * escalation: a caller may not grant a permission they do not already hold.
   * System admins and tenant-level Super Admin bypass this check.
   */
  async resolveUserEffectivePermissions(userId: string): Promise<Set<string>> {
    const rows: Array<{ code: string }> = await this.dataSource.query(
      `
      SELECT DISTINCT p.code FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        INNER JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = $1 AND ur.deleted_at IS NULL
      UNION
      SELECT DISTINCT p.code FROM permissions p
        INNER JOIN role_permissions rp ON rp.permission_id = p.id
        INNER JOIN roles r ON r.id = rp.role_id
        INNER JOIN user_roles ur ON ur.role_id IN (
          WITH RECURSIVE chain(id, parent_role_id) AS (
            SELECT id, parent_role_id FROM roles WHERE id = r.id
            UNION ALL
            SELECT rr.id, rr.parent_role_id
              FROM roles rr INNER JOIN chain c ON rr.id = c.parent_role_id
          ) SELECT id FROM chain
        )
        WHERE ur.user_id = $1 AND ur.deleted_at IS NULL
      UNION
      SELECT DISTINCT p.code FROM permissions p
        INNER JOIN user_permissions up ON up.permission_id = p.id
        WHERE up.user_id = $1
      `,
      [userId],
    );
    return new Set(rows.map((r) => r.code));
  }

  /**
   * Throws ForbiddenException if `caller` does not already hold every
   * permission code in `requested`. System admins and tenant-level Super
   * Admins bypass — they are the privileged authorities for their tier.
   */
  private async assertCallerCanGrant(
    caller: RoleMutationCaller | undefined,
    requested: string[],
  ): Promise<void> {
    if (!requested.length) return;
    if (caller?.isSystemAdmin) return;
    if (isSuperAdmin(caller?.roles)) return;
    const callerId = caller?.id || caller?.userId;
    if (!callerId) {
      throw new ForbiddenException('Cannot grant permissions without an authenticated caller');
    }
    const held = await this.resolveUserEffectivePermissions(callerId);
    const missing = requested.filter((code) => !held.has(code));
    if (missing.length) {
      throw new ForbiddenException(
        `You cannot grant permissions you do not already hold: ${missing.join(', ')}`,
      );
    }
  }

  async setParentRole(
    id: string,
    parentRoleId: string | null,
    tenantId?: string,
    caller?: RoleMutationCaller,
  ): Promise<Role> {
    const role = await this.findOneRole(id, tenantId);
    this.assertMutable(role, tenantId);

    if (parentRoleId) {
      // Validate parent exists
      const parentRole = await this.findOneRole(parentRoleId, tenantId);

      // Prevent self-referencing
      if (parentRole.id === role.id) {
        throw new ConflictException('A role cannot be its own parent');
      }

      // SECURITY: parenting grants the role every permission the parent
      // carries (incl. inherited). Without this check, a caller with
      // roles.update could parent a role they hold to a system role like
      // Super Admin — full privilege escalation.
      const parentPerms = await this.resolveRolePermissions(parentRole.id);
      await this.assertCallerCanGrant(caller, parentPerms.all);

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

  async getRoleUsers(roleId: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const role = await this.findOneRole(roleId, tenantId);
    const rows = await this.dataSource
      .getRepository('UserRole')
      .createQueryBuilder('ur')
      .innerJoin('users', 'u', 'u.id = ur.user_id')
      .leftJoin('facilities', 'f', 'f.id = ur.facility_id')
      .where('ur.role_id = :roleId', { roleId })
      .andWhere('u.tenant_id = :tid', { tid })
      .andWhere('u.deleted_at IS NULL')
      .select([
        'u.id AS id',
        'u.username AS username',
        'u.full_name AS "fullName"',
        'u.email AS email',
        'u.status AS status',
        'f.name AS "facilityName"',
      ])
      .getRawMany();
    return { role: { id: role.id, name: role.name }, users: rows, count: rows.length };
  }

  async removeRole(id: string, tenantId?: string): Promise<void> {
    const role = await this.findOneRole(id, tenantId);
    if (role.isSystemRole) throw new ConflictException('Cannot delete system roles');
    const userCount = await this.dataSource
      .getRepository('UserRole')
      .createQueryBuilder('ur')
      .where('ur.role_id = :id', { id })
      .getCount();
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role: ${userCount} user(s) are still assigned. Reassign them first.`,
      );
    }
    await this.roleRepository.softRemove(role);
  }

  async assignPermission(
    roleId: string,
    dto: AssignPermissionDto,
    tenantId?: string,
    caller?: RoleMutationCaller,
  ) {
    const role = await this.findOneRole(roleId, tenantId);
    this.assertMutable(role, tenantId);
    // Permissions are shared (NULL tenant_id), so don't filter by tenant
    const permission = await this.permissionRepository.findOne({ where: { id: dto.permissionId } });
    if (!permission) throw new NotFoundException('Permission not found');

    // SECURITY: prevent privilege escalation — caller cannot grant a code
    // they do not already hold.
    await this.assertCallerCanGrant(caller, [permission.code]);

    const existing = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId: dto.permissionId },
    });
    if (existing) throw new ConflictException('Permission already assigned');

    return this.rolePermissionRepository.save(
      this.rolePermissionRepository.create({ roleId, permissionId: dto.permissionId }),
    );
  }

  async removePermission(roleId: string, permissionId: string, tenantId?: string): Promise<void> {
    const role = await this.findOneRole(roleId, tenantId);
    this.assertMutable(role, tenantId);
    const rp = await this.rolePermissionRepository.findOne({
      where: { roleId, permissionId },
    });
    if (!rp) throw new NotFoundException('Role permission not found');
    await this.rolePermissionRepository.remove(rp);
  }

  async bulkUpdatePermissions(
    roleId: string,
    permissions: Record<string, boolean>,
    tenantId?: string,
    caller?: RoleMutationCaller,
  ): Promise<void> {
    const role = await this.findOneRole(roleId, tenantId);
    this.assertMutable(role, tenantId);

    // Only check codes the caller is trying to ENABLE — disabling is allowed
    // for anyone with roles.update (it strips privileges, not grants them).
    const toGrant = Object.entries(permissions)
      .filter(([, enabled]) => !!enabled)
      .map(([code]) => code);
    await this.assertCallerCanGrant(caller, toGrant);

    await this.dataSource.transaction(async (manager) => {
      for (const [permCode, enabled] of Object.entries(permissions)) {
        // Permissions are shared (NULL tenant_id) — find by code only
        const permission = await manager.findOne(Permission, { where: { code: permCode } });
        if (!permission) continue;

        const existing = await manager.findOne(RolePermission, {
          where: { roleId, permissionId: permission.id },
        });

        if (enabled && !existing) {
          await manager.save(
            manager.create(RolePermission, { roleId, permissionId: permission.id }),
          );
        } else if (!enabled && existing) {
          await manager.remove(existing);
        }
      }
    });
  }

  // Permissions
  async createPermission(
    dto: CreatePermissionDto,
    tenantId?: string,
    caller?: RoleMutationCaller,
  ): Promise<Permission> {
    // Permission catalog defines the privilege vocabulary the RBAC system
    // checks against. Allowing tenant users to mint new permission codes is
    // a privilege-escalation surface — they could create codes that later
    // logic comes to trust, or shadow existing codes.
    if (!caller?.isSystemAdmin) {
      throw new ForbiddenException('Only platform administrators may create permission codes');
    }
    const tid = requireTenantId(tenantId);
    const existing = await this.permissionRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new ConflictException('Permission code already exists');
    return this.permissionRepository.save(
      this.permissionRepository.create({ ...dto, tenantId: tid }),
    );
  }

  /**
   * Clone an existing role (and its directly-assigned permissions) into a new
   * tenant-scoped role with a different name. Inherited permissions from a
   * parent role are NOT copied — set the same parent on the clone if needed.
   */
  async cloneRole(
    sourceRoleId: string,
    newName: string,
    tenantId?: string,
    description?: string,
  ): Promise<Role> {
    const tid = requireTenantId(tenantId);
    const source = await this.findOneRole(sourceRoleId, tenantId);

    const nameClash = await this.roleRepository.findOne({
      where: { name: newName, tenantId: tid },
    });
    if (nameClash) throw new ConflictException('Role name already exists');

    return this.dataSource.transaction(async (manager) => {
      const clone = manager.create(Role, {
        name: newName,
        description: description ?? `Cloned from ${source.name}`,
        status: 'active',
        isSystemRole: false, // clones are always tenant-scoped, never system
        parentRoleId: source.parentRoleId ?? undefined,
        tenantId: tid,
      } as any);
      const saved = await manager.save(clone);

      // Copy direct permissions only (parent inheritance is preserved via parentRoleId).
      const directRps = await manager.find(RolePermission, { where: { roleId: source.id } });
      if (directRps.length > 0) {
        const newRps = directRps.map((rp) =>
          manager.create(RolePermission, { roleId: saved.id, permissionId: rp.permissionId }),
        );
        await manager.save(newRps);
      }
      return saved;
    });
  }

  async findAllPermissions(module?: string, tenantId?: string) {
    const tid = requireTenantId(tenantId);
    const qb = this.permissionRepository.createQueryBuilder('permission');

    if (module) {
      qb.where('permission.module = :module', { module });
    }
    // Include shared permissions (NULL tenant) and tenant-specific ones
    qb.andWhere('(permission.tenant_id = :tenantId OR permission.tenant_id IS NULL)', {
      tenantId: tid,
    });

    return qb.orderBy('permission.module', 'ASC').addOrderBy('permission.code', 'ASC').getMany();
  }

  /**
   * Resolve all permission codes for a role, walking up the inheritance chain.
   * Returns { direct: string[], inherited: string[], all: string[] }
   */
  async resolveRolePermissions(
    roleId: string,
  ): Promise<{ direct: string[]; inherited: string[]; all: string[] }> {
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
