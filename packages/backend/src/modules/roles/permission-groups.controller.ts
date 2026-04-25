import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PermissionGroupsService } from './permission-groups.service';
import {
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
  SetPermissionGroupPermissionsDto,
} from './dto/role.dto';
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
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    return this.service.findOne(id, req.user?.tenantId);
  }

  @Post()
  @AuthWithPermissions('roles.create')
  @ApiOperation({ summary: 'Create permission group' })
  async create(@Body() dto: CreatePermissionGroupDto, @Request() req: any) {
    return this.service.create(dto, req.user?.tenantId);
  }

  @Put(':id')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Update permission group' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionGroupDto,
    @Request() req: any,
  ) {
    return this.service.update(id, dto, req.user?.tenantId);
  }

  @Delete(':id')
  @AuthWithPermissions('roles.delete')
  @ApiOperation({ summary: 'Delete permission group' })
  async delete(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.service.delete(id, req.user?.tenantId);
    return { message: 'Permission group deleted' };
  }

  @Put(':id/permissions')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Set permissions for group' })
  async setPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetPermissionGroupPermissionsDto,
    @Request() req: any,
  ) {
    return this.service.setPermissions(id, dto.permissionIds, req.user?.tenantId);
  }

  @Post(':id/roles/:roleId')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Assign group to role' })
  async assignToRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Request() req: any,
  ) {
    return this.service.assignToRole(id, roleId, req.user?.tenantId);
  }

  @Delete(':id/roles/:roleId')
  @AuthWithPermissions('roles.update')
  @ApiOperation({ summary: 'Remove group from role' })
  async removeFromRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Request() req: any,
  ) {
    return this.service.removeFromRole(id, roleId, req.user?.tenantId);
  }
}
