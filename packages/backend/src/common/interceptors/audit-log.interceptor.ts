import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { DataSource } from 'typeorm';
import { AuditLogService } from './audit-log.service';
import { SupportAccessTier } from '../../database/entities/support-access-grant.entity';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private auditLogService: AuditLogService,
    private dataSource: DataSource,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;

    // Only audit mutations (POST, PUT, PATCH, DELETE)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    // Skip auth endpoints
    if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        try {
          // Determine action and entity from URL
          const action = this.getAction(method);
          const { entityType, entityId } = this.parseUrl(url, response);

          // Only log if we have a user (authenticated request)
          if (user?.id) {
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

            const statusCode = context.switchToHttp().getResponse()?.statusCode;

            await this.auditLogService.log({
              userId: user.id,
              tenantId: user.tenantId,
              action,
              entityType,
              entityId,
              newValue: this.sanitizeBody(body),
              ipAddress: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
              actorType,
              supportAccessTier,
              reason,
              requestMethod: method,
              requestUrl: url,
              statusCode,
            });
          }
        } catch (error) {
          // Log error but don't fail the request
          this.logger.error('Audit log error:', error);
        }
      }),
    );
  }

  private getAction(method: string): string {
    const actions: Record<string, string> = {
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return actions[method] || method;
  }

  private parseUrl(url: string, response: any): { entityType: string; entityId?: string } {
    const parts = url.split('/').filter(Boolean);
    const apiIndex = parts.indexOf('v1');

    if (apiIndex >= 0 && parts.length > apiIndex + 1) {
      const entityType = parts[apiIndex + 1];
      const potentialId = parts[apiIndex + 2];

      // Check if potentialId is a valid UUID (not an action like 'check-duplicates')
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const entityId =
        potentialId && uuidRegex.test(potentialId) ? potentialId : response?.data?.id;

      return { entityType, entityId };
    }

    return { entityType: 'unknown' };
  }

  private sanitizeBody(body: any): Record<string, any> | undefined {
    if (!body) return undefined;

    const sanitized = { ...body };
    delete sanitized.password;
    delete sanitized.passwordHash;
    delete sanitized.mfaSecret;
    delete sanitized.refreshToken;

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
}
