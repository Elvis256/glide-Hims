import { Injectable, Logger, OnModuleInit, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SystemAdminRole,
  SystemAdminRoleAssignment,
  BUILT_IN_SYSTEM_ROLES,
  SYSTEM_PERMISSIONS,
} from '../../../database/entities/system-admin-role.entity';

@Injectable()
export class SystemRbacService implements OnModuleInit {
  private readonly logger = new Logger(SystemRbacService.name);

  constructor(
    @InjectRepository(SystemAdminRole)
    private readonly roleRepo: Repository<SystemAdminRole>,
    @InjectRepository(SystemAdminRoleAssignment)
    private readonly assignmentRepo: Repository<SystemAdminRoleAssignment>,
  ) {}

  async onModuleInit() {
    await this.seedBuiltInRoles();
  }

  private async seedBuiltInRoles(): Promise<void> {
    for (const roleDef of BUILT_IN_SYSTEM_ROLES) {
      const existing = await this.roleRepo.findOne({ where: { name: roleDef.name } });
      if (!existing) {
        await this.roleRepo.save(
          this.roleRepo.create({
            name: roleDef.name,
            description: roleDef.description,
            permissions: roleDef.permissions,
            isBuiltIn: true,
            isActive: true,
          }),
        );
        this.logger.log(`Seeded built-in system role: ${roleDef.name}`);
      }
    }
  }

  // ===== Roles CRUD =====

  async listRoles(): Promise<SystemAdminRole[]> {
    return this.roleRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async getRole(id: string): Promise<SystemAdminRole> {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('System admin role not found');
    return role;
  }

  async createRole(dto: { name: string; description?: string; permissions: string[] }): Promise<SystemAdminRole> {
    const existing = await this.roleRepo.findOne({ where: { name: dto.name } });
    if (existing) throw new BadRequestException(`Role "${dto.name}" already exists`);

    // Validate permissions
    const validPerms = Object.keys(SYSTEM_PERMISSIONS);
    const invalid = dto.permissions.filter((p) => !validPerms.includes(p));
    if (invalid.length > 0) {
      throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}`);
    }

    return this.roleRepo.save(
      this.roleRepo.create({
        name: dto.name,
        description: dto.description,
        permissions: dto.permissions,
        isBuiltIn: false,
        isActive: true,
      }),
    );
  }

  async updateRole(id: string, dto: { name?: string; description?: string; permissions?: string[] }): Promise<SystemAdminRole> {
    const role = await this.getRole(id);
    if (role.isBuiltIn && dto.permissions) {
      throw new ForbiddenException('Cannot modify permissions of built-in roles');
    }

    if (dto.permissions) {
      const validPerms = Object.keys(SYSTEM_PERMISSIONS);
      const invalid = dto.permissions.filter((p) => !validPerms.includes(p));
      if (invalid.length > 0) {
        throw new BadRequestException(`Invalid permissions: ${invalid.join(', ')}`);
      }
    }

    if (dto.name !== undefined) role.name = dto.name;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.permissions !== undefined) role.permissions = dto.permissions;

    return this.roleRepo.save(role);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.getRole(id);
    if (role.isBuiltIn) throw new ForbiddenException('Cannot delete built-in roles');

    const assignments = await this.assignmentRepo.count({ where: { systemAdminRoleId: id } });
    if (assignments > 0) {
      throw new BadRequestException(`Cannot delete role with ${assignments} active assignment(s). Remove assignments first.`);
    }
    await this.roleRepo.softRemove(role);
  }

  // ===== Assignments =====

  async listAssignments(userId?: string): Promise<SystemAdminRoleAssignment[]> {
    const where: any = {};
    if (userId) where.userId = userId;
    return this.assignmentRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async assignRole(userId: string, roleId: string, scopedTenantId?: string): Promise<SystemAdminRoleAssignment> {
    const role = await this.getRole(roleId);
    if (!role.isActive) throw new BadRequestException('Cannot assign inactive role');

    const existing = await this.assignmentRepo.findOne({
      where: { userId, systemAdminRoleId: roleId, scopedTenantId: scopedTenantId || undefined },
    });
    if (existing) throw new BadRequestException('User already has this role assignment');

    return this.assignmentRepo.save(
      this.assignmentRepo.create({ userId, systemAdminRoleId: roleId, scopedTenantId }),
    );
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    const assignment = await this.assignmentRepo.findOne({ where: { id: assignmentId } });
    if (!assignment) throw new NotFoundException('Assignment not found');
    await this.assignmentRepo.softRemove(assignment);
  }

  // ===== Permission Checking =====

  async getUserPermissions(userId: string, tenantId?: string): Promise<string[]> {
    const assignments = await this.assignmentRepo.find({ where: { userId } });
    if (assignments.length === 0) {
      // Backwards compat: if no RBAC assignments, assume full access (legacy system admin)
      return Object.keys(SYSTEM_PERMISSIONS);
    }

    const perms = new Set<string>();
    for (const assignment of assignments) {
      // If scoped to a specific tenant, only apply when accessing that tenant
      if (assignment.scopedTenantId && tenantId && assignment.scopedTenantId !== tenantId) {
        continue;
      }
      const role = await this.roleRepo.findOne({ where: { id: assignment.systemAdminRoleId, isActive: true } });
      if (role) {
        role.permissions.forEach((p) => perms.add(p));
      }
    }
    return [...perms];
  }

  async hasPermission(userId: string, permission: string, tenantId?: string): Promise<boolean> {
    const perms = await this.getUserPermissions(userId, tenantId);
    return perms.includes(permission);
  }

  // ===== Reference Data =====

  getAvailablePermissions(): Record<string, string> {
    return { ...SYSTEM_PERMISSIONS };
  }
}
