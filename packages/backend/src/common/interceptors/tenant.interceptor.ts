import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';

/**
 * Extracts tenantId from the JWT payload and stores it on `request.tenantId`
 * so that controllers/services can access the current tenant context.
 *
 * For non-public, authenticated routes: rejects requests that have no
 * tenantId unless the user is a system admin (who may operate cross-tenant).
 *
 * Note: Previously this interceptor also set a PostgreSQL session variable
 * via SET LOCAL, but that approach was ineffective because the queryRunner
 * was released immediately and the session variable did not persist to actual
 * request queries. Services must explicitly filter by tenantId in queries.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    // Check if this is a public route (no auth required)
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (tenantId) {
      // Store tenantId on the request for services to access
      request.tenantId = tenantId;
    } else if (!isPublic && request.user && !request.user.isSystemAdmin) {
      // Authenticated non-admin users MUST have a tenantId
      throw new ForbiddenException('Tenant context is required for this operation');
    }

    return next.handle();
  }
}
