import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { UserRole } from '../../../database/entities/user-role.entity';
import { isSuperAdmin } from '../../../common/constants/roles.constants';
import { FACILITY_ACCESS_KEY } from '../decorators/facility-access.decorator';

@Injectable()
export class FacilityGuard implements CanActivate {
  private readonly logger = new Logger(FacilityGuard.name);

  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requireFacility = this.reflector.getAllAndOverride<boolean>(FACILITY_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requireFacility) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const { user } = request;

    if (!user || !user.id) {
      // Auth guard hasn't populated request.user yet (APP_GUARD execution
      // ordering quirk). Let the JWT guard reject the request — denying here
      // would surface as a misleading 403 "Forbidden resource".
      return true;
    }

    const facilityId = this.extractFacilityId(request);

    if (!facilityId) {
      throw new ForbiddenException('Facility context required');
    }

    // Super Admin bypasses facility checks
    if (isSuperAdmin(user.roles)) {
      this.logger.warn(
        JSON.stringify({
          type: 'SUPER_ADMIN_FACILITY_BYPASS',
          userId: user.id,
          username: user.username,
          facilityId,
          method: request.method,
          path: request.url,
        }),
      );
      return true;
    }

    // Verify user has an active role for this facility (or a global role)
    const userRoleRepository = this.dataSource.getRepository(UserRole);
    const hasAccess = await userRoleRepository
      .createQueryBuilder('ur')
      .where('ur.userId = :userId', { userId: user.id })
      .andWhere('(ur.facilityId = :facilityId OR ur.facilityId IS NULL)', { facilityId })
      .getCount();

    if (hasAccess === 0) {
      this.logger.warn(
        JSON.stringify({
          type: 'FACILITY_ACCESS_DENIED',
          userId: user.id,
          username: user.username,
          facilityId,
          method: request.method,
          path: request.url,
        }),
      );
      throw new ForbiddenException('Access denied to this facility');
    }

    return true;
  }

  private extractFacilityId(request: any): string | null {
    // Header takes priority
    const headerFacility = request.headers?.['x-facility-id'];
    if (headerFacility) return headerFacility;

    // Query param
    if (request.query?.facilityId) return request.query.facilityId;

    // Body
    if (request.body?.facilityId) return request.body.facilityId;

    // Route params
    if (request.params?.facilityId) return request.params.facilityId;

    // JWT facilityId as last resort
    const user = request.user;
    if (user?.facilityId) return user.facilityId;

    return null;
  }
}
