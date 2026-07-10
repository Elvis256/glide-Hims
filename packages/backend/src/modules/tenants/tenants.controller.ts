import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  BadRequestException,
  Request,
  ForbiddenException,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, TenantListQueryDto } from './dto/tenant.dto';
import { ChangeFacilityModeDto } from './dto/change-facility-mode.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Throttle } from '@nestjs/throttler';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('public/list')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: 'List active tenants (public - for login page)' })
  async publicList() {
    return this.tenantsService.findAllPublic();
  }

  @Get('public/by-slug/:slug')
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'Resolve tenant by slug (public - for login page)' })
  async publicBySlug(@Param('slug') slug: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 100) {
      throw new BadRequestException('Invalid organization code');
    }
    return this.tenantsService.findBySlug(slug);
  }

  @Post()
  @AuthWithPermissions('tenants.create')
  @ApiOperation({ summary: 'Create tenant' })
  async create(@Body() dto: CreateTenantDto, @Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    const tenant = await this.tenantsService.create(dto);
    return { message: 'Tenant created', data: tenant };
  }

  @Get()
  @AuthWithPermissions('tenants.read')
  @ApiOperation({ summary: 'List all tenants' })
  async findAll(@Query() query: TenantListQueryDto, @Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.tenantsService.findAll(query);
  }

  @Get('with-stats')
  @AuthWithPermissions('tenants.read')
  @ApiOperation({ summary: 'List all tenants with user/facility counts and setup status' })
  async findAllWithStats(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.tenantsService.findAllWithStats();
  }

  @Get('facility-presets')
  @AuthWithPermissions('tenants.read')
  @ApiOperation({ summary: 'List available facility-mode presets' })
  async facilityPresets(@Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.tenantsService.listFacilityPresets();
  }

  @Get(':id')
  @AuthWithPermissions('tenants.read')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('tenants.update')
  @ApiOperation({ summary: 'Update tenant' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTenantDto,
    @Request() req: any,
  ) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    const tenant = await this.tenantsService.update(id, dto);
    return { message: 'Tenant updated', data: tenant };
  }

  @Delete(':id')
  @AuthWithPermissions('tenants.delete')
  @ApiOperation({ summary: 'Delete tenant' })
  async remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    await this.tenantsService.remove(id);
    return { message: 'Tenant deleted' };
  }

  @Patch(':id/facility-mode')
  @AuthWithPermissions('tenants.update')
  @ApiOperation({
    summary: "Change a tenant's facility mode (promote/demote)",
    description:
      'Updates tenants.settings.facilityMode and the matching system_settings rows. ' +
      "When syncEnabledModules is true (default), the tenant's enabled module list is " +
      'refreshed from the new preset so the change takes effect immediately. No data is ' +
      'destroyed on demotion — hidden modules return on promotion back.',
  })
  async changeFacilityMode(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeFacilityModeDto,
    @Request() req: any,
  ) {
    if (!req.user?.isSystemAdmin) {
      throw new ForbiddenException('System admin access required');
    }
    const result = await this.tenantsService.changeFacilityMode(id, dto.facilityMode, {
      syncEnabledModules: dto.syncEnabledModules,
    });
    return { message: 'Facility mode updated', data: result };
  }
}
