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
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, UserListQueryDto, LinkEmployeeDto, AssignPermissionDto, AssignMultiplePermissionsDto } from './dto/user.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { AuthService } from '../auth/auth.service';
import { AdminResetPasswordDto } from '../auth/dto/auth.dto';
import { RateLimitGuard } from '../auth/guards/rate-limit.guard';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {}

  @Post('backfill-employees')
  @AuthWithPermissions('users.create')
  @ApiOperation({ summary: 'Backfill employee records for users without one' })
  @ApiResponse({ status: 201, description: 'Backfill completed' })
  async backfillEmployees(@Request() req: any) {
    const result = await this.usersService.backfillEmployees(req.user?.tenantId);
    return { message: `Backfill complete: ${result.created} created, ${result.skipped} skipped`, data: result };
  }

  @Post()
  @AuthWithPermissions('users.create')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async create(@Body() createUserDto: CreateUserDto, @Request() req: any) {
    // Only system admins can create other system admins
    if (createUserDto.isSystemAdmin && !req.user?.isSystemAdmin) {
      createUserDto.isSystemAdmin = false;
    }
    const tenantId = req.user?.tenantId;
    const user = await this.usersService.create(createUserDto, tenantId);
    return { message: 'User created successfully', data: user };
  }

  @Get('system-admins')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'List system administrator users' })
  @ApiResponse({ status: 200, description: 'List of system admin users' })
  async findSystemAdmins(@Query() query: UserListQueryDto, @Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.usersService.findSystemAdmins(query);
  }

  @Post('system-reset-password/:id')
  @AuthWithPermissions('users.update')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'System admin: reset password for any user (system admin, tenant admin, etc.)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  async systemResetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @Request() req: any,
  ) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('Only system administrators can perform this action');
    }
    const result = await this.authService.adminResetPassword(id, dto.newPassword, req.user.sub);
    return { message: 'Password reset successfully', data: result };
  }

  @Get('tenant-admins')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'System admin: list all tenant admin users across tenants' })
  @ApiResponse({ status: 200, description: 'List of tenant admin users' })
  async findTenantAdmins(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    const admins = await this.usersService.findTenantAdmins();
    return { data: admins };
  }

  @Get()
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(@Query() query: UserListQueryDto, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId && !req.user?.isSystemAdmin) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.usersService.findAll(query, tenantId);
  }

  @Get(':id')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get user by ID with roles' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId && !req.user?.isSystemAdmin) {
      throw new ForbiddenException('Tenant context required');
    }
    return this.usersService.findOneWithRoles(id, tenantId);
  }

  @Patch(':id')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
    @Request() req: any,
  ) {
    // Prevent privilege escalation: only system admins can grant system admin
    if (updateUserDto.isSystemAdmin && !req.user?.isSystemAdmin) {
      updateUserDto.isSystemAdmin = false;
    }
    const user = await this.usersService.update(id, updateUserDto, req.user?.tenantId);
    return { message: 'User updated successfully', data: user };
  }

  @Delete(':id')
  @AuthWithPermissions('users.delete')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const tenantId = req.user?.tenantId;
    if (!tenantId && !req.user?.isSystemAdmin) {
      throw new ForbiddenException('Tenant context required');
    }
    await this.usersService.remove(id, tenantId);
    return { message: 'User deleted successfully' };
  }

  @Post(':id/roles')
  @AuthWithPermissions('users.update')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignRoleDto: AssignRoleDto,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId && !req.user?.isSystemAdmin) {
      throw new ForbiddenException('Tenant context required');
    }
    const userRole = await this.usersService.assignRole(id, assignRoleDto, tenantId);
    return { message: 'Role assigned successfully', data: userRole };
  }

  @Delete(':id/roles/:roleId')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Remove role from user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'roleId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  async removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Request() req: any,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId && !req.user?.isSystemAdmin) {
      throw new ForbiddenException('Tenant context required');
    }
    await this.usersService.removeRole(id, roleId, tenantId);
    return { message: 'Role removed successfully' };
  }

  @Get(':id/roles')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get roles assigned to user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'List of user roles' })
  async getUserRoles(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const roles = await this.usersService.getUserRoles(id, req.user?.tenantId);
    return { data: roles };
  }

  @Post(':id/activate')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Activate user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.usersService.activateUser(id, req.user?.tenantId);
    return { message: 'User activated successfully' };
  }

  @Post(':id/deactivate')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.usersService.deactivateUser(id, req.user?.tenantId);
    return { message: 'User deactivated successfully' };
  }

  @Post(':id/link-employee')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Link user to existing employee profile' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User linked to employee successfully' })
  @ApiResponse({ status: 404, description: 'User or employee not found' })
  @ApiResponse({ status: 409, description: 'Employee already linked to another user' })
  async linkEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() linkEmployeeDto: LinkEmployeeDto,
    @Request() req: any,
  ) {
    const employee = await this.usersService.linkUserToEmployee(id, linkEmployeeDto.employeeId, req.user?.tenantId);
    return { message: 'User linked to employee successfully', data: employee };
  }

  @Delete(':id/unlink-employee')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Unlink user from employee profile' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User unlinked from employee successfully' })
  @ApiResponse({ status: 404, description: 'No employee profile linked to this user' })
  async unlinkEmployee(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.usersService.unlinkUserFromEmployee(id, req.user?.tenantId);
    return { message: 'User unlinked from employee successfully' };
  }

  @Get(':id/employee')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get employee profile linked to user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Employee profile' })
  async getEmployee(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const employee = await this.usersService.getEmployeeByUserId(id, req.user?.tenantId);
    return { data: employee };
  }

  // Direct Permission Management Endpoints
  @Get(':id/permissions')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get direct permissions assigned to a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'List of direct permissions' })
  async getUserPermissions(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    const permissions = await this.usersService.getUserPermissions(id, req.user?.tenantId);
    return { data: permissions };
  }

  @Post(':id/permissions')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Assign a permission directly to a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Permission assigned successfully' })
  @ApiResponse({ status: 409, description: 'Permission already assigned' })
  async assignPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignPermissionDto,
    @Request() req: any,
  ) {
    const permission = await this.usersService.assignPermission(id, dto, req.user.sub, req.user?.tenantId);
    return { message: 'Permission assigned successfully', data: permission };
  }

  @Delete(':id/permissions/:permissionId')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Remove a direct permission from a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiParam({ name: 'permissionId', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  @ApiResponse({ status: 404, description: 'Permission not assigned to this user' })
  async removePermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
    @Request() req: any,
  ) {
    await this.usersService.removePermission(id, permissionId, req.user?.tenantId);
    return { message: 'Permission removed successfully' };
  }

  @Post(':id/permissions/bulk')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Assign multiple permissions directly to a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Permissions assigned successfully' })
  async assignMultiplePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignMultiplePermissionsDto,
    @Request() req: any,
  ) {
    const permissions = await this.usersService.assignMultiplePermissions(id, dto.permissionIds, req.user.sub, req.user?.tenantId);
    return { message: `${permissions.length} permissions assigned successfully`, data: permissions };
  }

  @Delete(':id/permissions')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Remove all direct permissions from a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'All permissions removed successfully' })
  async removeAllPermissions(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    await this.usersService.removeAllUserPermissions(id, req.user?.tenantId);
    return { message: 'All direct permissions removed successfully' };
  }

  @Post(':id/reset-password')
  @AuthWithPermissions('users.update')
  @UseGuards(RateLimitGuard)
  @ApiOperation({ summary: 'Admin reset password for a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminResetPasswordDto,
    @Request() req: any,
  ) {
    const result = await this.authService.adminResetPassword(id, dto.newPassword, req.user.sub, req.user.tenantId);
    return { message: 'Password reset successfully', data: result };
  }

  @Get(':id/login-history')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get login history for a user (admin)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiQuery({ name: 'limit', required: false, description: 'Number of records (default 50)' })
  @ApiResponse({ status: 200, description: 'Login history' })
  async getLoginHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
  ) {
    const history = await this.authService.getLoginHistoryForUser(id, limit || 50);
    return { data: history };
  }
}
