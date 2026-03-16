import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../../database/entities/role.entity';
import { Permission } from '../../database/entities/permission.entity';
import { RolePermission } from '../../database/entities/role-permission.entity';
import { UserRole } from '../../database/entities/user-role.entity';
import { PermissionGroup } from '../../database/entities/permission-group.entity';
import { GroupPermission } from '../../database/entities/group-permission.entity';
import { RolePermissionGroup } from '../../database/entities/role-permission-group.entity';
import { RolesService } from './roles.service';
import { PermissionGroupsService } from './permission-groups.service';
import { RolesController, PermissionsController } from './roles.controller';
import { PermissionGroupsController } from './permission-groups.controller';

@Module({
  imports: [TypeOrmModule.forFeature([
    Role, Permission, RolePermission, UserRole,
    PermissionGroup, GroupPermission, RolePermissionGroup,
  ])],
  controllers: [RolesController, PermissionsController, PermissionGroupsController],
  providers: [RolesService, PermissionGroupsService],
  exports: [RolesService, PermissionGroupsService],
})
export class RolesModule {}
