import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../../auth/auth.service';
import { AuthWithPermissions } from '../../auth/decorators/auth.decorator';

@ApiTags('Admin - Password Policies')
@ApiBearerAuth()
@Controller('admin/password-policies')
export class PasswordPoliciesController {
  constructor(private readonly authService: AuthService) {}

  @Get()
  @AuthWithPermissions('settings.read')
  @ApiOperation({ summary: 'List password policies' })
  async list(@Query('facilityId') facilityId?: string) {
    return this.authService.getPasswordPolicies(facilityId);
  }

  @Post()
  @AuthWithPermissions('settings.update')
  @ApiOperation({ summary: 'Create password policy' })
  async create(@Body() dto: any) {
    return this.authService.createPasswordPolicy(dto);
  }

  @Patch(':id')
  @AuthWithPermissions('settings.update')
  @ApiOperation({ summary: 'Update password policy' })
  async update(@Param('id') id: string, @Body() dto: any) {
    return this.authService.updatePasswordPolicy(id, dto);
  }

  @Delete(':id')
  @AuthWithPermissions('settings.update')
  @ApiOperation({ summary: 'Delete password policy' })
  async remove(@Param('id') id: string) {
    await this.authService.deletePasswordPolicy(id);
    return { success: true };
  }
}
