import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../../modules/auth/decorators/public.decorator';

/**
 * Sets PostgreSQL session variable `app.tenant_id` from the JWT payload
 * so that all queries within the request can reference the current tenant.
 * This is the foundation for Row-Level Security (RLS) and is also read
 * by TenantSubscriber to auto-populate tenant_id on INSERT/UPDATE.
 *
 * For non-public, authenticated routes: rejects requests that have no
 * tenantId unless the user is a system admin (who may operate cross-tenant).
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(
    private readonly dataSource: DataSource,
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

      // Set PostgreSQL session variable for RLS policies.
      // SET LOCAL scopes the variable to the current transaction.
      const queryRunner = this.dataSource.createQueryRunner();
      try {
        await queryRunner.connect();
        await queryRunner.query(`SET LOCAL "app.tenant_id" = $1`, [tenantId]);
      } finally {
        await queryRunner.release();
      }
    } else if (!isPublic && request.user && !request.user.isSystemAdmin) {
      // Authenticated non-admin users MUST have a tenantId
      throw new ForbiddenException('Tenant context is required for this operation');
    }

    return next.handle();
  }
}
