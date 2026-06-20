import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Request,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';
import { SystemRbacService } from '../services/system-rbac.service';

@ApiTags('Admin - System RBAC')
@ApiBearerAuth()
@Controller('admin/system-rbac')
export class SystemRbacController {
  constructor(private readonly rbacService: SystemRbacService) {}

  private requireSystemAdmin(req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System administrator access required');
    }
  }

  // ===== Roles =====

  @Get('roles')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'List system admin roles' })
  async listRoles(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.rbacService.listRoles();
  }

  @Get('roles/:id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Get system admin role' })
  async getRole(@Param('id') id: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    return this.rbacService.getRole(id);
  }

  @Post('roles')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Create system admin role' })
  async createRole(@Body() dto: { name: string; description?: string; permissions: string[] }, @Request() req: any) {
    this.requireSystemAdmin(req);
    return this.rbacService.createRole(dto);
  }

  @Patch('roles/:id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Update system admin role' })
  async updateRole(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; permissions?: string[] },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    return this.rbacService.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Delete system admin role' })
  async deleteRole(@Param('id') id: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    await this.rbacService.deleteRole(id);
    return { success: true };
  }

  // ===== Assignments =====

  @Get('assignments')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'List role assignments' })
  async listAssignments(@Query('userId') userId: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    return this.rbacService.listAssignments(userId);
  }

  @Post('assignments')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Assign role to system admin' })
  async assignRole(
    @Body() dto: { userId: string; roleId: string; scopedTenantId?: string },
    @Request() req: any,
  ) {
    this.requireSystemAdmin(req);
    return this.rbacService.assignRole(dto.userId, dto.roleId, dto.scopedTenantId);
  }

  @Delete('assignments/:id')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Remove role assignment' })
  async removeAssignment(@Param('id') id: string, @Request() req: any) {
    this.requireSystemAdmin(req);
    await this.rbacService.removeAssignment(id);
    return { success: true };
  }

  // ===== Permissions Reference =====

  @Get('permissions')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'List available system permissions' })
  async getPermissions(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.rbacService.getAvailablePermissions();
  }

  @Get('my-permissions')
  @AuthWithPermissions('system.manage')
  @ApiOperation({ summary: 'Get current user system permissions' })
  async getMyPermissions(@Request() req: any) {
    this.requireSystemAdmin(req);
    return this.rbacService.getUserPermissions(req.user.id || req.user.sub);
  }
}
