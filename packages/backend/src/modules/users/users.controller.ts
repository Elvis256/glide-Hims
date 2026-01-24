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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRoleDto, UserListQueryDto } from './dto/user.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Auth('Admin')
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({ status: 201, description: 'User created successfully' })
  @ApiResponse({ status: 409, description: 'Username or email already exists' })
  async create(@Body() createUserDto: CreateUserDto) {
    const user = await this.usersService.create(createUserDto);
    return { message: 'User created successfully', data: user };
  }

  @Get()
  @Auth('Admin')
  @ApiOperation({ summary: 'Get all users with pagination' })
  @ApiResponse({ status: 200, description: 'List of users' })
  async findAll(@Query() query: UserListQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  @Auth('Admin')
  @ApiOperation({ summary: 'Get user by ID with roles' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findOneWithRoles(id);
  }

  @Patch(':id')
  @Auth('Admin')
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
  @Auth('Admin')
  @ApiOperation({ summary: 'Delete user (soft delete)' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.remove(id);
    return { message: 'User deleted successfully' };
  }

  @Post(':id/roles')
  @Auth('Admin')
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
  @Auth('Admin')
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
  @Auth('Admin')
  @ApiOperation({ summary: 'Activate user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User activated successfully' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.activateUser(id);
    return { message: 'User activated successfully' };
  }

  @Post(':id/deactivate')
  @Auth('Admin')
  @ApiOperation({ summary: 'Deactivate user' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'User deactivated successfully' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    await this.usersService.deactivateUser(id);
    return { message: 'User deactivated successfully' };
  }
}
