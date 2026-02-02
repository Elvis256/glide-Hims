import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';

interface SecurityLogEntry {
  timestamp: string;
  method: string;
  path: string;
  userId?: string;
  userEmail?: string;
  ip: string;
  userAgent?: string;
  statusCode?: number;
  duration?: number;
  action?: string;
  error?: string;
}

/**
 * Security Audit Interceptor
 * Logs all authenticated requests for security monitoring
 * Tracks: who accessed what, when, from where
 */
@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  private readonly sensitiveRoutes = [
    '/auth/login',
    '/auth/change-password',
    '/users',
    '/roles',
    '/patients',
    '/prescriptions',
    '/billing',
    '/settings',
  ];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    const logEntry: SecurityLogEntry = {
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
    };

    // Get user info from JWT payload if available
    const user = (request as any).user;
    if (user) {
      logEntry.userId = user.sub || user.id;
      logEntry.userEmail = user.email;
    }

    // Determine action type
    logEntry.action = this.getActionType(request.method, request.path);

    return next.handle().pipe(
      tap(() => {
        logEntry.statusCode = response.statusCode;
        logEntry.duration = Date.now() - startTime;

        // Log sensitive operations
        if (this.isSensitiveRoute(request.path)) {
          this.logSecurityEvent(logEntry);
        }
      }),
      catchError((error) => {
        logEntry.statusCode = error.status || 500;
        logEntry.duration = Date.now() - startTime;
        logEntry.error = error.message;

        // Always log errors on sensitive routes
        if (this.isSensitiveRoute(request.path) || (logEntry.statusCode && logEntry.statusCode >= 400)) {
          this.logSecurityEvent(logEntry, true);
        }

        throw error;
      }),
    );
  }

  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  private isSensitiveRoute(path: string): boolean {
    return this.sensitiveRoutes.some((route) => path.includes(route));
  }

  private getActionType(method: string, path: string): string {
    const actions: Record<string, string> = {
      GET: 'READ',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };

    let action = actions[method] || 'ACCESS';

    if (path.includes('/login')) action = 'LOGIN';
    if (path.includes('/logout')) action = 'LOGOUT';
    if (path.includes('/change-password')) action = 'PASSWORD_CHANGE';
    if (path.includes('/dispense')) action = 'DISPENSE';
    if (path.includes('/prescriptions') && method === 'POST') action = 'PRESCRIBE';

    return action;
  }

  private logSecurityEvent(entry: SecurityLogEntry, isError = false): void {
    const logLevel = isError ? 'WARN' : 'INFO';
    const logPrefix = '[SECURITY]';

    // Format for structured logging
    const logMessage = {
      level: logLevel,
      ...entry,
    };

    if (isError) {
      console.warn(`${logPrefix} ${entry.action}`, JSON.stringify(logMessage));
    } else {
      console.log(`${logPrefix} ${entry.action}`, JSON.stringify(logMessage));
    }

    // In production, you would send this to:
    // - A dedicated security log file
    // - SIEM system (Splunk, ELK, etc.)
    // - Database audit table
    // - Cloud logging service (CloudWatch, Stackdriver, etc.)
  }
}
