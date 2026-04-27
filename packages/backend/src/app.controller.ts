import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator';
import { TenantService } from './modules/tenants/services';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(@Optional() @Inject(TenantService) private tenantService?: TenantService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'API root - returns basic info' })
  getRoot() {
    return {
      name: 'Glide HIMS API',
      version: '1.0.0',
      status: 'running',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('health')
  @Public()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    return {
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      },
    };
  }

  @Get('system/initialized')
  @Public()
  @ApiOperation({ summary: 'Check if system is initialized (has any tenants)' })
  async getSystemInitialized() {
    try {
      if (!this.tenantService) {
        return {
          initialized: false,
          tenant_count: 0,
        };
      }
      const [tenants] = await this.tenantService.getAllTenants(1);
      return {
        initialized: tenants && tenants.length > 0,
        tenant_count: tenants ? tenants.length : 0,
      };
    } catch (error) {
      return {
        initialized: false,
        tenant_count: 0,
        error: 'Could not check system status',
      };
    }
  }
}
