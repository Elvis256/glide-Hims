import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
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

  @Get('api/v1/health')
  @Public()
  @ApiOperation({ summary: 'Health check endpoint (versioned)' })
  getHealthV1() {
    return this.getHealth();
  }
}
