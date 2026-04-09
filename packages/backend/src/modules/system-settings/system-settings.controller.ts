import { Controller, Get, Put, Delete, Param, Body, Query, Request, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UpsertSystemSettingDto } from './dto/system-settings.dto';

@ApiTags('settings')
@Controller('settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get('platform-overview')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Get platform-wide overview stats (system admin only)' })
  async getPlatformOverview(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      return { data: null };
    }
    return { data: await this.systemSettingsService.getPlatformOverview() };
  }

  @Get('platform')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Get platform-level settings (no tenantId)' })
  async getPlatformSettings(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      return { data: [] };
    }
    return { data: await this.systemSettingsService.getPlatformSettings() };
  }

  @Put('platform/:key')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Set a platform-level setting (system admin only)' })
  async setPlatformSetting(
    @Param('key') key: string,
    @Body() body: UpsertSystemSettingDto,
    @Request() req: any,
  ) {
    if (!req.user?.isSystemAdmin) {
      return { message: 'Only system administrators can modify platform settings' };
    }
    const setting = await this.systemSettingsService.upsert(
      `platform.${key}`,
      body.value,
      undefined,
      body.description,
    );
    return { message: 'Setting saved', data: setting };
  }

  @Get()
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'List all system settings' })
  @ApiQuery({ name: 'prefix', required: false, description: 'Filter settings by key prefix' })
  async findAll(
    @Query('prefix') prefix?: string,
    @Request() req?: any,
  ) {
    // Security: always scope to caller's tenant to prevent cross-tenant config access
    const tenantId = req?.user?.isSystemAdmin ? undefined : req?.user?.tenantId;
    if (prefix) {
      return this.systemSettingsService.getByPrefix(prefix, tenantId);
    }
    return this.systemSettingsService.getAll(tenantId);
  }

  @Get('public/:key')
  @Public()
  @ApiOperation({ summary: 'Get a public system setting by key (read-only)' })
  async findOnePublic(
    @Param('key') key: string,
  ) {
    // Only allow explicitly public settings — no tenant parameter to prevent cross-tenant leakage
    const publicKeys = [
      'facility_name', 'facility_logo', 'facility_address',
      'login_banner', 'setup_complete', 'deployment_mode',
      'default_language', 'default_currency',
    ];
    if (!publicKeys.includes(key)) {
      throw new ForbiddenException('This setting is not publicly accessible');
    }
    return this.systemSettingsService.getByKey(key);
  }

  @Get(':key')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Get a system setting by key' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant' })
  async findOne(
    @Param('key') key: string,
    @Query('tenantId') tenantId?: string,
    @Request() req?: any,
  ) {
    // Non-system-admins can only access their own tenant's settings
    if (!req?.user?.isSystemAdmin) {
      const scopedTenantId = req?.user?.tenantId;
      if (!scopedTenantId) {
        throw new ForbiddenException('Tenant context required');
      }
      return this.systemSettingsService.getByKey(key, scopedTenantId);
    }
    return this.systemSettingsService.getByKey(key, tenantId);
  }

  @Put(':key')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Create or update a system setting' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Tenant ID' })
  async upsert(
    @Param('key') key: string,
    @Body() body: UpsertSystemSettingDto,
    @Query('tenantId') tenantId?: string,
    @Request() req?: any,
  ) {
    // Non-system-admins can only modify their own tenant's settings
    if (!req?.user?.isSystemAdmin) {
      const scopedTenantId = req?.user?.tenantId;
      if (!scopedTenantId) {
        throw new ForbiddenException('Tenant context required');
      }
      const setting = await this.systemSettingsService.upsert(
        key,
        body.value,
        scopedTenantId,
        body.description,
      );
      return { message: 'Setting saved', data: setting };
    }
    const setting = await this.systemSettingsService.upsert(
      key,
      body.value,
      tenantId,
      body.description,
    );
    return { message: 'Setting saved', data: setting };
  }

  @Delete(':key')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Delete a system setting' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Tenant ID' })
  async remove(
    @Param('key') key: string,
    @Query('tenantId') tenantId?: string,
    @Request() req?: any,
  ) {
    // Non-system-admins can only delete their own tenant's settings
    if (!req?.user?.isSystemAdmin) {
      const scopedTenantId = req?.user?.tenantId;
      if (!scopedTenantId) {
        throw new ForbiddenException('Tenant context required');
      }
      await this.systemSettingsService.delete(key, scopedTenantId);
      return { message: 'Setting deleted' };
    }
    await this.systemSettingsService.delete(key, tenantId);
    return { message: 'Setting deleted' };
  }
}
