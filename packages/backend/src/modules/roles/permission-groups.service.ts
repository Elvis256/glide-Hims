import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PermissionGroup } from '../../database/entities/permission-group.entity';
import { GroupPermission } from '../../database/entities/group-permission.entity';
import { RolePermissionGroup } from '../../database/entities/role-permission-group.entity';
import { Permission } from '../../database/entities/permission.entity';
import { Role } from '../../database/entities/role.entity';

@Injectable()
export class PermissionGroupsService {
  constructor(
    @InjectRepository(PermissionGroup)
    private groupRepository: Repository<PermissionGroup>,
    @InjectRepository(GroupPermission)
    private groupPermRepository: Repository<GroupPermission>,
    @InjectRepository(RolePermissionGroup)
    private roleGroupRepository: Repository<RolePermissionGroup>,
    @InjectRepository(Permission)
    private permissionRepository: Repository<Permission>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
  ) {}

  /**
   * Ensure every permission id in the list is either tenant-owned or global.
   * Prevents tenant A from attaching tenant B's permissions to a group.
   */
  private async assertPermissionsAccessible(permissionIds: string[], tenantId?: string) {
    if (!permissionIds.length) return;
    const perms = await this.permissionRepository.find({ where: { id: In(permissionIds) } });
    if (perms.length !== permissionIds.length) {
      throw new NotFoundException('One or more permissions not found');
    }
    if (!tenantId) return;
    const bad = perms.find((p) => p.tenantId && p.tenantId !== tenantId);
    if (bad) {
      throw new ForbiddenException('Cannot attach a permission that belongs to a different tenant');
    }
  }

  /**
   * Ensure the target role is in the caller's tenant (or global if caller is platform admin).
   */
  private async assertRoleAccessible(roleId: string, tenantId?: string) {
    const role = await this.roleRepository.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role not found');
    if (tenantId) {
      if (role.tenantId && role.tenantId !== tenantId) {
        throw new ForbiddenException('Role belongs to a different tenant');
      }
      if (role.isSystemRole) {
        throw new ForbiddenException('Cannot attach groups to a system role');
      }
    }
    return role;
  }

  async findAll(tenantId?: string): Promise<any[]> {
    const qb = this.groupRepository.createQueryBuilder('g');
    if (tenantId) {
      qb.where('(g.tenant_id = :tenantId OR g.tenant_id IS NULL)', { tenantId });
    }
    const groups = await qb.orderBy('g.name', 'ASC').getMany();

    return Promise.all(
      groups.map(async (g) => {
        const groupPerms = await this.groupPermRepository.find({
          where: { groupId: g.id },
          relations: ['permission'],
        });
        const roleGroups = await this.roleGroupRepository.find({
          where: { groupId: g.id },
          relations: ['role'],
        });
        return {
          ...g,
          permissions: groupPerms.map((gp) => gp.permission),
          permissionCount: groupPerms.length,
          assignedRoles: roleGroups.map((rg) => ({ id: rg.role?.id, name: rg.role?.name })),
        };
      }),
    );
  }

  async findOne(id: string, tenantId?: string): Promise<any> {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const group = await this.groupRepository.findOne({ where });
    if (!group) throw new NotFoundException('Permission group not found');

    const groupPerms = await this.groupPermRepository.find({
      where: { groupId: id },
      relations: ['permission'],
    });
    const roleGroups = await this.roleGroupRepository.find({
      where: { groupId: id },
      relations: ['role'],
    });

    return {
      ...group,
      permissions: groupPerms.map((gp) => gp.permission),
      assignedRoles: roleGroups.map((rg) => ({ id: rg.role?.id, name: rg.role?.name })),
    };
  }

  async create(
    dto: { name: string; description?: string; permissionIds?: string[] },
    tenantId?: string,
  ) {
    const existing = await this.groupRepository.findOne({
      where: { name: dto.name, ...(tenantId ? { tenantId } : {}) },
    });
    if (existing) throw new ConflictException('Permission group name already exists');

    const group = this.groupRepository.create({
      name: dto.name,
      description: dto.description,
      tenantId: tenantId || (null as any),
    });
    const saved = await this.groupRepository.save(group);

    if (dto.permissionIds?.length) {
      await this.assertPermissionsAccessible(dto.permissionIds, tenantId);
      const effectiveTenantId = tenantId || saved.tenantId;
      const groupPerms: GroupPermission[] = dto.permissionIds.map((pid) =>
        this.groupPermRepository.create({
          groupId: saved.id,
          permissionId: pid,
          ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
        } as Partial<GroupPermission>),
      );
      await this.groupPermRepository.save(groupPerms);
    }

    return this.findOne(saved.id, tenantId);
  }

  async update(id: string, dto: { name?: string; description?: string }, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const group = await this.groupRepository.findOne({ where });
    if (!group) throw new NotFoundException('Permission group not found');
    Object.assign(group, dto);
    await this.groupRepository.save(group);
    return this.findOne(id, tenantId);
  }

  async delete(id: string, tenantId?: string) {
    const where: any = { id };
    if (tenantId) where.tenantId = tenantId;
    const group = await this.groupRepository.findOne({ where });
    if (!group) throw new NotFoundException('Permission group not found');
    await this.groupPermRepository.delete({ groupId: id });
    await this.roleGroupRepository.delete({ groupId: id });
    await this.groupRepository.remove(group);
  }

  async setPermissions(groupId: string, permissionIds: string[], tenantId?: string) {
    const group = await this.findOne(groupId, tenantId);
    if (!group) throw new NotFoundException('Permission group not found');
    await this.assertPermissionsAccessible(permissionIds, tenantId);
    await this.groupPermRepository.delete({ groupId });
    if (permissionIds.length > 0) {
      const effectiveTenantId = tenantId || group.tenantId;
      const groupPerms: GroupPermission[] = permissionIds.map((pid) =>
        this.groupPermRepository.create({
          groupId,
          permissionId: pid,
          ...(effectiveTenantId ? { tenantId: effectiveTenantId } : {}),
        } as Partial<GroupPermission>),
      );
      await this.groupPermRepository.save(groupPerms);
    }
    return this.findOne(groupId, tenantId);
  }

  async assignToRole(groupId: string, roleId: string, tenantId?: string) {
    await this.findOne(groupId, tenantId);
    await this.assertRoleAccessible(roleId, tenantId);
    const existing = await this.roleGroupRepository.findOne({
      where: { groupId, roleId },
    });
    if (existing) throw new ConflictException('Group already assigned to this role');

    const roleGroup = this.roleGroupRepository.create({ groupId, roleId });
    await this.roleGroupRepository.save(roleGroup);
    return { message: 'Group assigned to role' };
  }

  async removeFromRole(groupId: string, roleId: string, tenantId?: string) {
    await this.findOne(groupId, tenantId);
    await this.assertRoleAccessible(roleId, tenantId);
    const result = await this.roleGroupRepository.delete({ groupId, roleId });
    if (result.affected === 0) throw new NotFoundException('Group not assigned to this role');
    return { message: 'Group removed from role' };
  }
}
