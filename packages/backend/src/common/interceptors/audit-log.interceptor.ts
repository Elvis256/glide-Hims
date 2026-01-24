import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditLogService } from './audit-log.service';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private auditLogService: AuditLogService) {}

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
            await this.auditLogService.log({
              userId: user.id,
              action,
              entityType,
              entityId,
              newValue: this.sanitizeBody(body),
              ipAddress: this.getClientIp(request),
              userAgent: request.headers['user-agent'],
            });
          }
        } catch (error) {
          // Log error but don't fail the request
          console.error('Audit log error:', error);
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
      const entityId = parts[apiIndex + 2] || response?.data?.id;
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
