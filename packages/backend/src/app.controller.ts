import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator';
import { TenantsService } from './modules/tenants/tenants.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(@Optional() @Inject(TenantsService) private tenantService?: TenantsService) {}

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
      const tenants = await this.tenantService.findAll();
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
