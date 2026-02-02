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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, UserListQueryDto, LinkEmployeeDto, AssignPermissionDto } from './dto/user.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @AuthWithPermissions('users.create')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { message: 'User created successfully', data: user };
  }

  @Get()
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(@Query() query: UserListQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get user by ID with roles' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneWithRoles(id);
  }

  @Patch(':id')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Update user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    const user = await this.usersService.update(id, updateUserDto);
    return { message: 'User updated successfully', data: user };
  }

  @Delete(':id')
  @AuthWithPermissions('users.delete')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }

  @Post(':id/roles')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Role assigned successfully' })
  async assignRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() assignRoleDto: AssignRoleDto,
  ) {
    const userRole = await this.usersService.assignRole(id, assignRoleDto);
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
  ) {
    await this.usersService.removeRole(id, roleId);
    return { message: 'Role removed successfully' };
  }

  @Post(':id/activate')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Activate user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.activateUser(id);
    return { message: 'User activated successfully' };
  }

  @Post(':id/deactivate')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.deactivateUser(id);
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
  ) {
    const employee = await this.usersService.linkUserToEmployee(id, linkEmployeeDto.employeeId);
    return { message: 'User linked to employee successfully', data: employee };
  }

  @Delete(':id/unlink-employee')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Unlink user from employee profile' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User unlinked from employee successfully' })
  @ApiResponse({ status: 404, description: 'No employee profile linked to this user' })
  async unlinkEmployee(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.unlinkUserFromEmployee(id);
    return { message: 'User unlinked from employee successfully' };
  }

  @Get(':id/employee')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get employee profile linked to user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Employee profile' })
  async getEmployee(@Param('id', ParseUUIDPipe) id: string) {
    const employee = await this.usersService.getEmployeeByUserId(id);
    return { data: employee };
  }

  // Direct Permission Management Endpoints
  @Get(':id/permissions')
  @AuthWithPermissions('users.read')
  @ApiOperation({ summary: 'Get direct permissions assigned to a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'List of direct permissions' })
  async getUserPermissions(@Param('id', ParseUUIDPipe) id: string) {
    const permissions = await this.usersService.getUserPermissions(id);
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
    const permission = await this.usersService.assignPermission(id, dto, req.user.sub);
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
  ) {
    await this.usersService.removePermission(id, permissionId);
    return { message: 'Permission removed successfully' };
  }

  @Post(':id/permissions/bulk')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Assign multiple permissions directly to a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Permissions assigned successfully' })
  async assignMultiplePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: { permissionIds: string[] },
    @Request() req: any,
  ) {
    const permissions = await this.usersService.assignMultiplePermissions(id, dto.permissionIds, req.user.sub);
    return { message: `${permissions.length} permissions assigned successfully`, data: permissions };
  }

  @Delete(':id/permissions')
  @AuthWithPermissions('users.update')
  @ApiOperation({ summary: 'Remove all direct permissions from a user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'All permissions removed successfully' })
  async removeAllPermissions(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.removeAllUserPermissions(id);
    return { message: 'All direct permissions removed successfully' };
  }
}
