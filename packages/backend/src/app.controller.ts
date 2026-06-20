import { Controller, Get, Inject, Optional } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from './modules/auth/decorators/public.decorator';
import { AuthWithPermissions } from './modules/auth/decorators/auth.decorator';
import { TenantsService } from './modules/tenants/tenants.service';
import { DataSource } from 'typeorm';
import { CacheService } from './modules/cache/cache.service';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(
    @Optional() @Inject(TenantsService) private tenantService?: TenantsService,
    @Optional() @Inject(DataSource) private dataSource?: DataSource,
    @Optional() @Inject(CacheService) private cacheService?: CacheService,
  ) {}

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
  @ApiOperation({ summary: 'Health check endpoint (liveness/readiness)' })
  async getHealth() {
    // F-12: keep the public response minimal. Probe DB so readiness checks still
    // work, but do NOT expose uptime, memory, or cache state to anonymous callers.
    let dbOk = false;
    if (this.dataSource) {
      try {
        await this.dataSource.query('SELECT 1');
        dbOk = true;
      } catch {
        dbOk = false;
      }
    } else {
      dbOk = true;
    }
    return { status: dbOk ? 'ok' : 'degraded' };
  }

  @Get('health/details')
  @AuthWithPermissions('admin.read')
  @ApiOperation({ summary: 'Detailed health: DB, cache, uptime, memory (admin only)' })
  async getHealthDetails() {
    const checks: { db: 'ok' | 'fail'; cache: 'ok' | 'fail' | 'skipped' } = {
      db: 'fail',
      cache: 'skipped',
    };
    let dbLatencyMs: number | null = null;

    if (this.dataSource) {
      try {
        const t0 = Date.now();
        await this.dataSource.query('SELECT 1');
        dbLatencyMs = Date.now() - t0;
        checks.db = 'ok';
      } catch {
        checks.db = 'fail';
      }
    }

    if (this.cacheService) {
      try {
        const probeKey = `__health__${Date.now()}`;
        await this.cacheService.set(probeKey, '1', 5);
        const v = await this.cacheService.get(probeKey);
        checks.cache = v === '1' ? 'ok' : 'fail';
      } catch {
        checks.cache = 'fail';
      }
    }

    const overall = checks.db === 'ok' && checks.cache !== 'fail' ? 'ok' : 'degraded';
    return {
      status: overall,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks: { ...checks, dbLatencyMs },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      },
    };
  }

  @Get('system/initialized')
  @Public()
  @ApiOperation({ summary: 'Check if system is initialized (boolean only)' })
  async getSystemInitialized() {
    // F-08: only report the boolean; do not leak the exact tenant count to
    // anonymous callers.
    try {
      if (!this.tenantService) {
        return { initialized: false };
      }
      const tenants = await this.tenantService.findAll();
      return { initialized: !!(tenants && tenants.total > 0) };
    } catch {
      return { initialized: false };
    }
  }
}
