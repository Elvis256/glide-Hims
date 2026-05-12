import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger, HttpException } from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { tap, catchError, mergeMap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { SupportAccessTier } from '../../database/entities/support-access-grant.entity';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sensitive GET URL patterns — reading PHI / privileged data is audited.
// Only auth'd GETs that match one of these get a READ row.
const SENSITIVE_READ_PATTERNS: RegExp[] = [
  /\/api\/v1\/patients\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/encounters\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/medical-records(\/|$)/i,
  /\/api\/v1\/clinical\/.*\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/lab\/(orders|results)\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/pharmacy\/prescriptions\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/finance\/invoices\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/users\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/audit-logs(\/|$|\?)/i,
  /\/api\/v1\/tenants\/[0-9a-f-]{36}(\/|$)/i,
  /\/api\/v1\/license\//i,
  /\/api\/v1\/support-access(\/|$)/i,
];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);
  // Cache resolved tables to avoid hitting pg_class on every request.
  private readonly tableCache = new Map<string, string | null>();

  constructor(
    private auditLogService: AuditLogService,
    private dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    // /auth/login and /auth/refresh have their own dedicated audit hooks
    // in the AuthController (so we capture username + failures cleanly).
    if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return next.handle();
    }

    const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isReadable = method === 'GET';

    if (!isMutation && !(isReadable && user?.id && this.isSensitiveRead(url))) {
      return next.handle();
    }

    const action = this.getAction(method);
    const { entityType, entityId } = this.parseUrl(url, undefined);

    // For UPDATE/DELETE on a known UUID-bearing entity, snapshot the old row.
    const oldValuePromise: Promise<Record<string, any> | undefined> =
      ['PUT', 'PATCH', 'DELETE'].includes(method) && entityId
        ? this.snapshot(entityType, entityId)
        : Promise.resolve(undefined);

    return from(oldValuePromise).pipe(
      mergeMap((oldValue) =>
        next.handle().pipe(
          tap(async (response) => {
            try {
              if (!user?.id) return;
              const { entityType: et2, entityId: eid2 } = this.parseUrl(url, response);
              const statusCode = context.switchToHttp().getResponse()?.statusCode;
              await this.writeAudit({
                request,
                action,
                entityType: et2 || entityType,
                entityId: eid2 || entityId,
                body,
                oldValue,
                statusCode,
              });
            } catch (e) {
              this.logger.error('Audit log error (success path):', e);
            }
          }),
          catchError((err) => {
            (async () => {
              try {
                if (!user?.id) return;
                if (!isMutation) return;
                const status = err instanceof HttpException ? err.getStatus() : 500;
                const message =
                  err instanceof Error
                    ? err.message
                    : typeof err === 'string'
                      ? err
                      : 'Unknown error';
                await this.writeAudit({
                  request,
                  action: `${action}_FAILED`,
                  entityType,
                  entityId,
                  body,
                  oldValue,
                  statusCode: status,
                  errorMessage: (message || '').slice(0, 1000),
                });
              } catch (e) {
                this.logger.error('Audit log error (failure path):', e);
              }
            })();
            return throwError(() => err);
          }),
        ),
      ),
    );
  }

  // -- helpers ----------------------------------------------------------------

  private isSensitiveRead(url: string): boolean {
    return SENSITIVE_READ_PATTERNS.some((re) => re.test(url));
  }

  private getAction(method: string): string {
    const actions: Record<string, string> = {
      GET: 'READ',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return actions[method] || method;
  }

  private parseUrl(url: string, response: any): { entityType: string; entityId?: string } {
    const cleanUrl = url.split('?')[0];
    const parts = cleanUrl.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('v1');

    if (apiIndex >= 0 && parts.length > apiIndex + 1) {
      const entityType = parts[apiIndex + 1];
      const potentialId = parts[apiIndex + 2];
      const entityId =
        potentialId && UUID_RE.test(potentialId)
          ? potentialId
          : response?.data?.id || response?.id;
      return { entityType, entityId };
    }
    return { entityType: 'unknown' };
  }

  private sanitize(payload: any): Record<string, any> | undefined {
    if (!payload || typeof payload !== 'object') return undefined;
    const sanitized: Record<string, any> = Array.isArray(payload)
      ? ({ items: payload } as any)
      : { ...payload };
    for (const k of [
      'password',
      'passwordHash',
      'password_hash',
      'mfaSecret',
      'mfa_secret',
      'refreshToken',
      'refresh_token',
      'token',
      'accessToken',
      'access_token',
      'otp',
    ]) {
      delete sanitized[k];
    }
    return sanitized;
  }

  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      request.headers['x-real-ip'] ||
      request.connection?.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  private async resolveTable(entityType: string): Promise<string | null> {
    if (!entityType) return null;
    if (this.tableCache.has(entityType)) return this.tableCache.get(entityType)!;
    const safe = entityType.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!safe || safe.length > 63) {
      this.tableCache.set(entityType, null);
      return null;
    }
    const candidates = Array.from(
      new Set([
        safe,
        safe.endsWith('s') ? safe : `${safe}s`,
        safe.endsWith('ies') ? safe : safe.replace(/y$/, 'ies'),
        safe.replace(/-/g, '_'),
      ]),
    );
    for (const c of candidates) {
      try {
        const r = await this.dataSource.query(`SELECT to_regclass($1) AS t`, [`public.${c}`]);
        if (r[0]?.t) {
          this.tableCache.set(entityType, c);
          return c;
        }
      } catch {
        /* ignore */
      }
    }
    this.tableCache.set(entityType, null);
    return null;
  }

  private async snapshot(
    entityType: string,
    entityId: string,
  ): Promise<Record<string, any> | undefined> {
    try {
      const table = await this.resolveTable(entityType);
      if (!table) return undefined;
      const r = await this.dataSource.query(
        `SELECT row_to_json(t) AS r FROM "${table}" t WHERE id = $1 LIMIT 1`,
        [entityId],
      );
      return this.sanitize(r[0]?.r);
    } catch (e) {
      this.logger.debug?.(`snapshot failed for ${entityType}/${entityId}: ${(e as Error).message}`);
      return undefined;
    }
  }

  private async writeAudit(args: {
    request: any;
    action: string;
    entityType: string;
    entityId?: string;
    body: any;
    oldValue?: Record<string, any>;
    statusCode?: number;
    errorMessage?: string;
  }): Promise<void> {
    const { request, action, entityType, entityId, body, oldValue, statusCode, errorMessage } = args;
    const user = request.user;

    let actorType: string = 'tenant_user';
    let supportAccessTier: number | undefined;

    if (user.isSystemAdmin) {
      const tenantId = user.tenantId;
      if (tenantId) {
        const tierResult = await this.dataSource.query(
          `SELECT access_tier FROM support_access_grants
           WHERE granted_to_id = $1 AND tenant_id = $2
           AND revoked_at IS NULL AND expires_at > NOW()
           AND deleted_at IS NULL
           ORDER BY access_tier DESC
           LIMIT 1`,
          [user.id, tenantId],
        );
        if (tierResult.length > 0 && tierResult[0].access_tier !== SupportAccessTier.NONE) {
          actorType = 'system_support';
          supportAccessTier = tierResult[0].access_tier;
        } else {
          actorType = 'system_admin';
        }
      } else {
        actorType = 'system_admin';
      }
    }

    const reason =
      (request.headers['x-audit-reason'] as string) ||
      (body && typeof body === 'object' ? body.reason || body._reason : undefined) ||
      undefined;

    await this.auditLogService.log({
      userId: user.id,
      tenantId: user.tenantId,
      action,
      entityType,
      entityId,
      oldValue,
      newValue: ['PUT', 'PATCH', 'POST'].includes(request.method)
        ? this.sanitize(body)
        : undefined,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      actorType,
      supportAccessTier,
      reason,
      requestMethod: request.method,
      requestUrl: request.originalUrl || request.url,
      statusCode,
      errorMessage,
    });
  }
}
