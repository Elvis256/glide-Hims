import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { Facility } from '../../database/entities/facility.entity';
import { isSuperAdmin } from '../constants/roles.constants';

// In-memory cache for facility→tenant mapping
const facilityTenantCache = new Map<string, { tenantId: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TenantInterceptor');

  constructor(private dataSource: DataSource) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Skip for unauthenticated requests (public endpoints)
    if (!user) {
      return next.handle();
    }

    const userTenantId = user.tenantId;

    // Super Admin with no tenant — system-wide access
    if (isSuperAdmin(user.roles) && !userTenantId) {
      // Super Admin can optionally scope to a tenant via header
      const headerTenantId = request.headers?.['x-tenant-id'];
      request.tenantId = headerTenantId || null;
      return next.handle();
    }

    // Set tenantId on request from JWT
    request.tenantId = userTenantId;

    // Validate that x-facility-id header belongs to user's tenant
    const headerFacilityId =
      request.headers?.['x-facility-id'] ||
      request.query?.facilityId ||
      request.body?.facilityId;

    if (headerFacilityId && userTenantId) {
      const facilityTenantId = await this.getFacilityTenantId(headerFacilityId);

      if (facilityTenantId && facilityTenantId !== userTenantId) {
        this.logger.warn(
          `Tenant boundary violation: user ${user.id} (tenant ${userTenantId}) ` +
          `tried to access facility ${headerFacilityId} (tenant ${facilityTenantId})`,
        );
        throw new ForbiddenException('Access denied: facility belongs to a different tenant');
      }
    }

    return next.handle();
  }

  private async getFacilityTenantId(facilityId: string): Promise<string | null> {
    // Check cache
    const cached = facilityTenantCache.get(facilityId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenantId;
    }

    // Query DB
    const facilityRepo = this.dataSource.getRepository(Facility);
    const facility = await facilityRepo.findOne({
      where: { id: facilityId },
      select: ['id', 'tenantId'],
    });

    if (!facility) {
      return null;
    }

    // Cache the result
    facilityTenantCache.set(facilityId, {
      tenantId: facility.tenantId,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return facility.tenantId;
  }
}
