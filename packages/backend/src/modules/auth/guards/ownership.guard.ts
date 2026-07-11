import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  RESOURCE_OWNERSHIP_KEY,
  ResourceOwnershipConfig,
} from '../decorators/resource-ownership.decorator';
import { isSuperAdmin } from '../../../common/constants/roles.constants';

@Injectable()
export class OwnershipGuard implements CanActivate {
  private readonly logger = new Logger(OwnershipGuard.name);

  constructor(
    private reflector: Reflector,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config = this.reflector.getAllAndOverride<ResourceOwnershipConfig>(
      RESOURCE_OWNERSHIP_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!config) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return false;

    // Super Admin bypass
    if (this.isSuperAdmin(user)) return true;

    // Check bypass permission
    if (config.bypassPermission && user.permissions?.includes(config.bypassPermission)) {
      return true;
    }

    // Get resource ID from route params
    const resourceId = request.params?.id;
    if (!resourceId) return true; // No specific resource, let service handle filtering

    try {
      const entityMeta = this.dataSource.entityMetadatas.find(
        (meta) => meta.name === config.entity || meta.tableName === config.entity,
      );

      if (!entityMeta) {
        this.logger.warn(`Entity "${config.entity}" not found for ownership check`);
        throw new ForbiddenException('Unable to verify resource ownership');
      }

      const tableName = entityMeta.tableName;
      const ownerColumn = this.resolveColumnName(entityMeta, config.ownerField);

      if (!ownerColumn) {
        this.logger.warn(`Owner field "${config.ownerField}" not found on ${config.entity}`);
        throw new ForbiddenException('Unable to verify resource ownership');
      }

      // Build ownership query
      const conditions: string[] = [];
      const params: any[] = [];
      // Tenant isolation: always require resource belongs to user's tenant
      let tenantClause = '';
      if (user.tenantId) {
        const tenantColumn = this.resolveColumnName(entityMeta, 'tenantId');
        if (tenantColumn) {
          tenantClause = ` AND "${tenantColumn}" = $${params.length + 1}`;
          params.push(user.tenantId);
        }
      }

      // Check direct ownership
      conditions.push(`"${ownerColumn}" = $${params.length + 1}`);
      params.push(user.sub || user.id);

      // Check facility access
      if (config.allowFacilityAccess && user.facilityId) {
        const facilityColumn = this.resolveColumnName(entityMeta, 'facilityId');
        if (facilityColumn) {
          conditions.push(`"${facilityColumn}" = $${params.length + 1}`);
          params.push(user.facilityId);
        }
      }

      // Check createdBy (if entity has it)
      const createdByColumn = this.resolveColumnName(entityMeta, 'createdById');
      if (createdByColumn) {
        conditions.push(`"${createdByColumn}" = $${params.length + 1}`);
        params.push(user.sub || user.id);
      }

      const query = `SELECT id FROM "${tableName}" WHERE id = $${params.length + 1}${tenantClause} AND (${conditions.join(' OR ')})`;
      params.push(resourceId);

      const result = await this.dataSource.query(query, params);

      if (result.length === 0) {
        this.logger.warn(
          `Ownership denied: user ${user.sub} tried to access ${config.entity}:${resourceId}`,
        );
        throw new ForbiddenException('You do not have access to this resource');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) throw error;
      this.logger.error(`Ownership check failed: ${error.message}`);
      throw new ForbiddenException('Unable to verify resource ownership');
    }
  }

  private isSuperAdmin(user: any): boolean {
    if (!user.roles) return false;
    const roles = Array.isArray(user.roles)
      ? user.roles.map((r: any) => (typeof r === 'string' ? r : r.name))
      : [];
    return user.isSystemAdmin || isSuperAdmin(roles);
  }

  private resolveColumnName(entityMeta: any, propertyName: string): string | null {
    const column = entityMeta.columns.find(
      (col: any) => col.propertyName === propertyName || col.databaseName === propertyName,
    );
    return column?.databaseName || null;
  }
}
