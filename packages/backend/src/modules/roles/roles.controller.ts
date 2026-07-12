import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  Put,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import {
  CreateRoleDto,
  UpdateRoleDto,
  CreatePermissionDto,
  AssignPermissionDto,
  BulkUpdatePermissionsDto,
  SetParentRoleDto,
} from './dto/role.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @AuthWithPermissions('roles.create')
  @ApiOperation({ summary: 'Create role' })
  async createRole(@Body() dto: CreateRoleDto, @Request() req: any) {
    const role = await this.rolesService.createRole(dto, req.user?.tenantId, req.user);
    return { message: 'Role created', data: role };
  }

  @Get()
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'List all roles' })
  async findAllRoles(@Request() req: any) {
    return this.rolesService.findAllRoles(req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'Get role with permissions' })
  async findOneRole(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.rolesService.findRoleWithPermissions(id, req.user?.tenantId);
  }

  @Get(':id/users')
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'List users assigned to this role' })
  async getRoleUsers(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.rolesService.getRoleUsers(id, req.user?.tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Update role' })
  async updateRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRoleDto,
    @Request() req: any,
  ) {
    const role = await this.rolesService.updateRole(id, dto, req.user?.tenantId, req.user);
    return { message: 'Role updated', data: role };
  }

  @Delete(':id')
  @AuthWithPermissions('roles.delete')
  @ApiOperation({ summary: 'Delete role' })
  async removeRole(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.rolesService.removeRole(id, req.user?.tenantId);
    return { message: 'Role deleted' };
  }

  @Post(':id/clone')
  @AuthWithPermissions('roles.create')
  @ApiOperation({ summary: 'Duplicate a role with all its direct permissions' })
  async cloneRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { name: string; description?: string },
    @Request() req: any,
  ) {
    const role = await this.rolesService.cloneRole(
      id,
      body.name,
      req.user?.tenantId,
      body.description,
    );
    return { message: 'Role cloned', data: role };
  }

  @Post(':id/permissions')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Assign permission to role' })
  async assignPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionDto,
    @Request() req: any,
  ) {
    await this.rolesService.assignPermission(id, dto, req.user?.tenantId, req.user);
    return { message: 'Permission assigned' };
  }

  @Put(':id/permissions')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Bulk update role permissions' })
  async bulkUpdatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpdatePermissionsDto,
    @Request() req: any,
  ) {
    await this.rolesService.bulkUpdatePermissions(
      id,
      dto.permissions,
      req.user?.tenantId,
      req.user,
    );
    return { message: 'Permissions updated' };
  }

  @Patch(':id/parent')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Set parent role for inheritance' })
  async setParentRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SetParentRoleDto,
    @Request() req: any,
  ) {
    const role = await this.rolesService.setParentRole(
      id,
      body.parentRoleId,
      req.user?.tenantId,
      req.user,
    );
    return { message: 'Parent role updated', data: role };
  }

  @Delete(':id/permissions/:permissionId')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Remove permission from role' })
  async removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Request() req: any,
  ) {
    await this.rolesService.removePermission(id, permissionId, req.user?.tenantId);
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
  async createPermission(@Body() dto: CreatePermissionDto, @Request() req: any) {
    const permission = await this.rolesService.createPermission(dto, req.user?.tenantId, req.user);
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
