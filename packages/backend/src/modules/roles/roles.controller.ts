import { Controller, Get, Post, Body, Patch, Param, Delete, Query, ParseUUIDPipe, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { CreateRoleDto, UpdateRoleDto, CreatePermissionDto, AssignPermissionDto, BulkUpdatePermissionsDto } from './dto/role.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @AuthWithPermissions('roles.create')
  @ApiOperation({ summary: 'Create role' })
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.rolesService.createRole(dto);
    return { message: 'Role created', data: role };
  }

  @Get()
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'List all roles' })
  async findAllRoles() {
    return this.rolesService.findAllRoles();
  }

  @Get(':id')
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'Get role with permissions' })
  async findOneRole(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findRoleWithPermissions(id);
  }

  @Patch(':id')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Update role' })
  async updateRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.rolesService.updateRole(id, dto);
    return { message: 'Role updated', data: role };
  }

  @Delete(':id')
  @AuthWithPermissions('roles.delete')
  @ApiOperation({ summary: 'Delete role' })
  async removeRole(@Param('id', ParseUUIDPipe) id: string) {
    await this.rolesService.removeRole(id);
    return { message: 'Role deleted' };
  }

  @Post(':id/permissions')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Assign permission to role' })
  async assignPermission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignPermissionDto) {
    await this.rolesService.assignPermission(id, dto);
    return { message: 'Permission assigned' };
  }

  @Put(':id/permissions')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Bulk update role permissions' })
  async bulkUpdatePermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: BulkUpdatePermissionsDto) {
    await this.rolesService.bulkUpdatePermissions(id, dto.permissions);
    return { message: 'Permissions updated' };
  }

  @Delete(':id/permissions/:permissionId')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Remove permission from role' })
  async removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    await this.rolesService.removePermission(id, permissionId);
    return { message: 'Permission removed' };
  }
}

@ApiTags('permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @AuthWithPermissions('roles.create')
  @ApiOperation({ summary: 'Create permission' })
  async createPermission(@Body() dto: CreatePermissionDto) {
    const permission = await this.rolesService.createPermission(dto);
    return { message: 'Permission created', data: permission };
  }

  @Get()
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'List all permissions' })
  @ApiQuery({ name: 'module', required: false })
  async findAllPermissions(@Query('module') module?: string) {
    return this.rolesService.findAllPermissions(module);
  }
}
