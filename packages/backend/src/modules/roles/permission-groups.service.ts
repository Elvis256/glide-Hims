import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PermissionGroup } from '../../database/entities/permission-group.entity';
import { GroupPermission } from '../../database/entities/group-permission.entity';
import { RolePermissionGroup } from '../../database/entities/role-permission-group.entity';
import { Permission } from '../../database/entities/permission.entity';

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
  ) {}

  async findAll(tenantId?: string): Promise<any[]> {
    const qb = this.groupRepository.createQueryBuilder('g');
    if (tenantId) {
      qb.where('(g.tenant_id = :tenantId OR g.tenant_id IS NULL)', { tenantId });
    }
    const groups = await qb.orderBy('g.name', 'ASC').getMany();

    return Promise.all(groups.map(async (g) => {
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
        permissions: groupPerms.map(gp => gp.permission),
        permissionCount: groupPerms.length,
        assignedRoles: roleGroups.map(rg => ({ id: rg.role?.id, name: rg.role?.name })),
      };
    }));
  }

  async findOne(id: string): Promise<any> {
    const group = await this.groupRepository.findOne({ where: { id } });
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
      permissions: groupPerms.map(gp => gp.permission),
      assignedRoles: roleGroups.map(rg => ({ id: rg.role?.id, name: rg.role?.name })),
    };
  }

  async create(dto: { name: string; description?: string; permissionIds?: string[] }, tenantId?: string) {
    const existing = await this.groupRepository.findOne({ where: { name: dto.name } });
    if (existing) throw new ConflictException('Permission group name already exists');

    const group = this.groupRepository.create({
      name: dto.name,
      description: dto.description,
      tenantId: tenantId || (null as any),
    });
    const saved = await this.groupRepository.save(group);

    if (dto.permissionIds?.length) {
      const groupPerms = dto.permissionIds.map(pid => this.groupPermRepository.create({
        groupId: saved.id,
        permissionId: pid,
      }));
      await this.groupPermRepository.save(groupPerms);
    }

    return this.findOne(saved.id);
  }

  async update(id: string, dto: { name?: string; description?: string }) {
    const group = await this.groupRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Permission group not found');
    Object.assign(group, dto);
    await this.groupRepository.save(group);
    return this.findOne(id);
  }

  async delete(id: string) {
    const group = await this.groupRepository.findOne({ where: { id } });
    if (!group) throw new NotFoundException('Permission group not found');
    await this.groupPermRepository.delete({ groupId: id });
    await this.roleGroupRepository.delete({ groupId: id });
    await this.groupRepository.remove(group);
  }

  async setPermissions(groupId: string, permissionIds: string[]) {
    await this.groupPermRepository.delete({ groupId });
    if (permissionIds.length > 0) {
      const groupPerms = permissionIds.map(pid => this.groupPermRepository.create({
        groupId,
        permissionId: pid,
      }));
      await this.groupPermRepository.save(groupPerms);
    }
    return this.findOne(groupId);
  }

  async assignToRole(groupId: string, roleId: string) {
    const existing = await this.roleGroupRepository.findOne({
      where: { groupId, roleId },
    });
    if (existing) throw new ConflictException('Group already assigned to this role');

    const roleGroup = this.roleGroupRepository.create({ groupId, roleId });
    await this.roleGroupRepository.save(roleGroup);
    return { message: 'Group assigned to role' };
  }

  async removeFromRole(groupId: string, roleId: string) {
    const result = await this.roleGroupRepository.delete({ groupId, roleId });
    if (result.affected === 0) throw new NotFoundException('Group not assigned to this role');
    return { message: 'Group removed from role' };
  }
}
