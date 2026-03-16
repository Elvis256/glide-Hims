import { Controller, Get, Post, Put, Delete, Body, Param, Request, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PermissionGroupsService } from './permission-groups.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('permission-groups')
@Controller('permission-groups')
export class PermissionGroupsController {
  constructor(private readonly service: PermissionGroupsService) {}

  @Get()
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'List all permission groups' })
  async findAll(@Request() req: any) {
    return this.service.findAll(req.user?.tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('roles.read')
  @ApiOperation({ summary: 'Get permission group by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @AuthWithPermissions('roles.create')
  @ApiOperation({ summary: 'Create permission group' })
  async create(@Body() dto: { name: string; description?: string; permissionIds?: string[] }, @Request() req: any) {
    return this.service.create(dto, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Update permission group' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { name?: string; description?: string }) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @AuthWithPermissions('roles.delete')
  @ApiOperation({ summary: 'Delete permission group' })
  async delete(@Param('id', ParseUUIDPipe) id: string) {
    await this.service.delete(id);
    return { message: 'Permission group deleted' };
  }

  @Put(':id/permissions')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Set permissions for group' })
  async setPermissions(@Param('id', ParseUUIDPipe) id: string, @Body() dto: { permissionIds: string[] }) {
    return this.service.setPermissions(id, dto.permissionIds);
  }

  @Post(':id/roles/:roleId')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Assign group to role' })
  async assignToRole(@Param('id', ParseUUIDPipe) id: string, @Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.service.assignToRole(id, roleId);
  }

  @Delete(':id/roles/:roleId')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Remove group from role' })
  async removeFromRole(@Param('id', ParseUUIDPipe) id: string, @Param('roleId', ParseUUIDPipe) roleId: string) {
    return this.service.removeFromRole(id, roleId);
  }
}
