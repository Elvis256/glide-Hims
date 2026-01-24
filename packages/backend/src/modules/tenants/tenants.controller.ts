import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto } from './dto/tenant.dto';
import { Auth } from '../auth/decorators/auth.decorator';

@ApiTags('tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Auth('Super Admin')
  @ApiOperation({ summary: 'Create tenant' })
  async create(@Body() dto: CreateTenantDto) {
    const tenant = await this.tenantsService.create(dto);
    return { message: 'Tenant created', data: tenant };
  }

  @Get()
  @Auth('Super Admin')
  @ApiOperation({ summary: 'List all tenants' })
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  @Auth('Super Admin')
  @ApiOperation({ summary: 'Get tenant by ID' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @Auth('Super Admin')
  @ApiOperation({ summary: 'Update tenant' })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTenantDto) {
    const tenant = await this.tenantsService.update(id, dto);
    return { message: 'Tenant updated', data: tenant };
  }

  @Delete(':id')
  @Auth('Super Admin')
  @ApiOperation({ summary: 'Delete tenant' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.tenantsService.remove(id);
    return { message: 'Tenant deleted' };
  }
}
