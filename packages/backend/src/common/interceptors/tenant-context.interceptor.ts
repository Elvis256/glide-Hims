import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * TenantContextInterceptor - Extracts tenant ID from request and makes it available to services
 * Can be applied globally or per-controller/route
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Try to get tenant ID from multiple sources (in order of priority):
    // 1. Header: X-Tenant-ID
    // 2. Query param: tenantId
    // 3. User context (if authenticated via JWT/session)
    // 4. URL subdomain (e.g., tenant1.example.com)

    let tenantId =
      request.headers['x-tenant-id'] ||
      request.query.tenantId ||
      request.user?.tenantId ||
      extractTenantFromSubdomain(request.hostname);

    if (!tenantId) {
      throw new BadRequestException(
        'Tenant ID not provided. Use X-Tenant-ID header, tenantId query param, or subdomain.',
      );
    }

    // Store tenant ID in request context for use in services
    request.tenantId = tenantId;

    return next.handle();
  }
}

/**
 * Extract tenant ID from subdomain (e.g., tenant1.example.com -> tenant1)
 */
function extractTenantFromSubdomain(hostname: string): string | null {
  const parts = hostname.split('.');
  if (parts.length > 2) {
    return parts[0];
  }
  return null;
}
