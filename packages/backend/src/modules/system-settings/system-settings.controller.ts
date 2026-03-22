import { Controller, Get, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SystemSettingsService } from './system-settings.service';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { UpsertSystemSettingDto } from './dto/system-settings.dto';

@ApiTags('settings')
@Controller('settings')
export class SystemSettingsController {
  constructor(private readonly systemSettingsService: SystemSettingsService) {}

  @Get()
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'List all system settings' })
  @ApiQuery({ name: 'prefix', required: false, description: 'Filter settings by key prefix' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant' })
  async findAll(
    @Query('prefix') prefix?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    if (prefix) {
      return this.systemSettingsService.getByPrefix(prefix, tenantId);
    }
    return this.systemSettingsService.getAll(tenantId);
  }

  @Get('public/:key')
  @Public()
  @ApiOperation({ summary: 'Get a system setting by key (read-only, no admin required)' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant' })
  async findOnePublic(
    @Param('key') key: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.systemSettingsService.getByKey(key, tenantId);
  }

  @Get(':key')
  @AuthWithPermissions('admin.settings.manage')
  @ApiOperation({ summary: 'Get a system setting by key' })
  @ApiQuery({ name: 'tenantId', required: false, description: 'Filter by tenant' })
  async findOne(
    @Param('key') key: string,
    @Query('tenantId') tenantId?: string,
  ) {
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
  ) {
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
  ) {
    await this.systemSettingsService.delete(key, tenantId);
    return { message: 'Setting deleted' };
  }
}
