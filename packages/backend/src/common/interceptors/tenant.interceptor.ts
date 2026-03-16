import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { DataSource } from 'typeorm';

/**
 * Sets PostgreSQL session variable `app.tenant_id` from the JWT payload
 * so that all queries within the request can reference the current tenant.
 * This is the foundation for Row-Level Security (RLS) and is also read
 * by TenantSubscriber to auto-populate tenant_id on INSERT/UPDATE.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.user?.tenantId;

    if (tenantId) {
      // Store tenantId on the request for services to access
      request.tenantId = tenantId;
    }

    return next.handle();
  }
}
