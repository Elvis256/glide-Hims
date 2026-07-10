import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

interface AuditLog {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  method: string;
  statusCode: number;
  duration: number;
  changes?: any;
}

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private auditLogs: AuditLog[] = [];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();

    const auditLog: AuditLog = {
      timestamp: new Date(),
      userId: request.user?.userId || 'anonymous',
      action: this.getActionFromMethod(request.method),
      resource: request.path,
      method: request.method,
      statusCode: 0,
      duration: 0,
    };

    return next.handle().pipe(
      tap(
        (data) => {
          auditLog.statusCode = response.statusCode;
          auditLog.duration = Date.now() - startTime;

          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
            auditLog.changes = request.body;
          }

          this.logAudit(auditLog);
        },
        (error) => {
          auditLog.statusCode = error.status || 500;
          auditLog.duration = Date.now() - startTime;
          this.logAudit(auditLog);
        },
      ),
    );
  }

  private getActionFromMethod(method: string): string {
    const actions: Record<string, string> = {
      GET: 'READ',
      POST: 'CREATE',
      PUT: 'UPDATE',
      PATCH: 'UPDATE',
      DELETE: 'DELETE',
    };
    return actions[method] || method;
  }

  private logAudit(log: AuditLog): void {
    console.log('[AUDIT]', JSON.stringify(log));
    this.auditLogs.push(log);

    // Keep only last 10000 logs in memory
    if (this.auditLogs.length > 10000) {
      this.auditLogs = this.auditLogs.slice(-5000);
    }
  }

  getLogs(limit = 100): AuditLog[] {
    return this.auditLogs.slice(-limit);
  }
}
