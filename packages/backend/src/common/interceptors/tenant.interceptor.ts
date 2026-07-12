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
import { tenantContext } from '../context/tenant-context';

/**
 * Extracts tenantId from the JWT payload and stores it on `request.tenantId`
 * so that controllers/services can access the current tenant context.
 *
 * For non-public, authenticated routes: rejects requests that have no
 * tenantId unless the user is a system admin (who may operate cross-tenant).
 *
 * Also binds the AsyncLocalStorage tenant store for the remainder of this
 * request's async chain (enterWith). The RLS driver patch reads that store
 * and forwards it to Postgres as the `app.tenant` GUC on every query, so
 * row-level security policies scope reads/writes to the request tenant. A
 * store is ALWAYS bound for authenticated requests — a system admin without
 * a tenant gets an empty tenant (default-deny on RLS-protected tables)
 * instead of inheriting the trusted background-job context.
 *
 * Note: the previous SET LOCAL approach was ineffective because the
 * queryRunner was released immediately; see common/database/rls-driver-patch.ts
 * for the working mechanism. Services must STILL explicitly filter by
 * tenantId — RLS is defense-in-depth, not a replacement.
 */
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
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

    // Bind the RLS tenant store to this request's async chain. Public /
    // unauthenticated routes get an empty store (default-deny) too — they
    // should never touch tenant-scoped tables directly.
    tenantContext.enterWith({ tenantId: tenantId || undefined });

    return next.handle();
  }
}
