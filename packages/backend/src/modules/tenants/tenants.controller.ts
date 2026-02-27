import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, OnboardTenantDto } from './dto/tenant.dto';
import { AuthWithPermissions } from '../auth/decorators/auth.decorator';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @AuthWithPermissions('tenants.create')
  @ApiOperation({ summary: 'Create tenant' })
  async create(@Body() dto: CreateTenantDto) {
    const tenant = await this.tenantsService.create(dto);
    return { message: 'Tenant created', data: tenant };
  }

  @Post('onboard')
  @AuthWithPermissions('tenants.create')
  @ApiOperation({ summary: 'Onboard new tenant with facility and admin user' })
  async onboard(@Body() dto: OnboardTenantDto) {
    const result = await this.tenantsService.onboard(dto);
    return { message: 'Tenant onboarded successfully', data: result };
  }

  @Get('me')
  @AuthWithPermissions('tenants.manage_own')
  @ApiOperation({ summary: 'Get current tenant settings' })
  async getMyTenant(@Req() req: any) {
    const tenantId = req.tenantId || req.user?.tenantId;
    return this.tenantsService.findOne(tenantId);
  }

  @Patch('me')
  @AuthWithPermissions('tenants.manage_own')
  @ApiOperation({ summary: 'Update current tenant settings' })
  async updateMyTenant(@Req() req: any, @Body() dto: UpdateTenantDto) {
    const tenantId = req.tenantId || req.user?.tenantId;
    // Prevent status change via self-service
    delete dto.status;
    const tenant = await this.tenantsService.update(tenantId, dto);
    return { message: 'Tenant settings updated', data: tenant };
  }

  @Get()
  @AuthWithPermissions('tenants.read')
  @ApiOperation({ summary: 'List all tenants' })
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @AuthWithPermissions('tenants.read')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @AuthWithPermissions('tenants.update')
  @ApiOperation({ summary: 'Update tenant' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.tenantsService.update(id, dto);
    return { message: 'Tenant updated', data: tenant };
  }

  @Delete(':id')
  @AuthWithPermissions('tenants.delete')
  @ApiOperation({ summary: 'Delete tenant' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.tenantsService.remove(id);
    return { message: 'Tenant deleted' };
  }
}
