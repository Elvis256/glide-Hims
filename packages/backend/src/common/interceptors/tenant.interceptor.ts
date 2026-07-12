import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ForbiddenException,
  Logger,
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
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  private readonly logger = new Logger('TenantContext');

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

    // ── Bind the RLS tenant store for this request's async chain ──────────
    // Resolution order:
    //  1. Tenant user            -> their JWT tenant
    //  2. System admin           -> explicit ?tenantId=/x-tenant-id override
    //                               (scoped support access), else full system
    //                               context (cross-tenant); mutations logged
    //  3. Patient-portal request -> tenant stamped on req by PatientPortalGuard
    //  4. Public route           -> explicit ?tenantId= (public branding/
    //                               careers pages), else default-deny
    // Only values matching a UUID make it into the store: the GUC is compared
    // with ::uuid in the policies, so a malformed value would error every query.
    let store: { tenantId?: string; isSystemContext?: boolean };
    if (tenantId) {
      store = { tenantId };
    } else if (request.user?.isSystemAdmin) {
      const override = this.sanitizeUuid(
        request.query?.tenantId ?? request.headers?.['x-tenant-id'],
      );
      store = override ? { tenantId: override } : { isSystemContext: true };
      if (store.isSystemContext && !SAFE_METHODS.has(request.method)) {
        this.logger.log(
          `System-context ${request.method} ${request.url} by admin ${request.user.id || request.user.sub}`,
        );
      }
    } else {
      const portalOrPublicTenant = this.sanitizeUuid(
        request.tenantId ?? (isPublic ? request.query?.tenantId : undefined),
      );
      store = { tenantId: portalOrPublicTenant };
    }
    tenantContext.enterWith(store);

    return next.handle();
  }

  private sanitizeUuid(value: unknown): string | undefined {
    return typeof value === 'string' && UUID_RE.test(value) ? value : undefined;
  }
}
