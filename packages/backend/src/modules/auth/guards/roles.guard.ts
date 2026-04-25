import { Injectable, CanActivate, ExecutionContext, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { isSuperAdmin } from '../../../common/constants/roles.constants';
import { getActiveSupportTier, checkSystemAdminAccess } from './support-tier.util';

@Injectable()
export class RolesGuard implements CanActivate {
  private readonly logger = new Logger('SuperAdminAudit');

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No roles required - allow access (just authentication is enough)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;
    if (!user || !user.roles) {
      return false;
    }

    // Super Admin has access to everything - but log the bypass
    if (isSuperAdmin(user.roles)) {
      this.logSuperAdminAccess(request, requiredRoles);
      return true;
    }

    // System admins: enforce support tier on clinical/operational endpoints
    if (user.isSystemAdmin) {
      const path = request.url || '';
      const tenantId = user.tenantId;
      if (!tenantId) {
        return false;
      }

      const tier = await getActiveSupportTier(this.dataSource, user.id, tenantId);
      const allowed = checkSystemAdminAccess(tier, path, request.method);
      if (allowed) {
        this.logSuperAdminAccess(request, requiredRoles);
      }
      return allowed;
    }

    return requiredRoles.some((role) => user.roles.includes(role));
  }

  /**
   * Log Super Admin role bypass for audit trail
   */
  private logSuperAdminAccess(request: any, requiredRoles: string[]): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      type: 'SUPER_ADMIN_ROLE_BYPASS',
      userId: request.user?.id,
      username: request.user?.username || request.user?.email,
      ip: request.ip || request.connection?.remoteAddress,
      method: request.method,
      path: request.url,
      bypassedRoles: requiredRoles,
      userAgent: request.headers?.['user-agent']?.substring(0, 100),
    };

    this.logger.warn(JSON.stringify(logEntry));
  }
}
