import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { AdminService } from '../services/admin.service';
import { AdminGuard } from '../../../common/guards/admin.guard';
import { IsAdmin } from '../../../common/decorators/current-tenant.decorator';
import { CreateTenantDto, UpdateTenantDto } from '../dto/tenant.dto';

@Controller('api/v1/admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Post('tenants')
  async createTenant(@Body() data: CreateTenantDto) {
    const tenant = await this.adminService.createTenant(data);
    return {
      statusCode: 201,
      data: tenant,
      message: 'Tenant created successfully',
    };
  }

  @Get('tenants')
  async getAllTenants(@Query('limit') limit = 50, @Query('offset') offset = 0) {
    const [tenants, count] = await this.adminService.getAllTenants(limit, offset);
    return {
      statusCode: 200,
      data: tenants,
      pagination: { total: count, limit, offset },
    };
  }

  @Get('tenants/:id')
  async getTenantById(@Param('id') id: string) {
    const tenant = await this.adminService.getTenantById(id);
    return {
      statusCode: 200,
      data: tenant,
    };
  }

  @Patch('tenants/:id')
  async updateTenant(@Param('id') id: string, @Body() data: UpdateTenantDto) {
    const tenant = await this.adminService.updateTenant(id, data);
    return {
      statusCode: 200,
      data: tenant,
      message: 'Tenant updated successfully',
    };
  }

  @Patch('tenants/:id/suspend')
  async suspendTenant(@Param('id') id: string) {
    const tenant = await this.adminService.suspendTenant(id);
    return {
      statusCode: 200,
      data: tenant,
      message: 'Tenant suspended',
    };
  }

  @Patch('tenants/:id/activate')
  async activateTenant(@Param('id') id: string) {
    const tenant = await this.adminService.activateTenant(id);
    return {
      statusCode: 200,
      data: tenant,
      message: 'Tenant activated',
    };
  }

  @Delete('tenants/:id')
  async deleteTenant(@Param('id') id: string) {
    await this.adminService.deleteTenant(id);
    return {
      statusCode: 200,
      message: 'Tenant deleted successfully',
    };
  }

  @Get('metrics/system')
  async getSystemMetrics() {
    const metrics = await this.adminService.getSystemMetrics();
    return {
      statusCode: 200,
      data: metrics,
    };
  }
}
