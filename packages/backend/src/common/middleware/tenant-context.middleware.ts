import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Observable } from 'rxjs';
import { Facility } from '../../database/entities/facility.entity';

export interface TenantContext {
  tenantId: string;
  facilityId: string;
}

/**
 * Interceptor that resolves tenant context from the facility ID.
 * Runs AFTER guards so req.user is available from Passport JWT.
 * Attaches req.tenantContext = { tenantId, facilityId } for downstream use.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantContextInterceptor.name);

  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const facilityId = this.extractFacilityId(request);
    const user = request.user;

    if (facilityId && user) {
      try {
        const facility = await this.facilityRepository.findOne({
          where: { id: facilityId },
          select: ['id', 'tenantId'],
        });

        if (facility) {
          request.tenantContext = {
            tenantId: facility.tenantId,
            facilityId: facility.id,
          } as TenantContext;
        } else {
          this.logger.warn(`Facility not found: ${facilityId}`);
          request.tenantContext = null;
        }
      } catch (error) {
        this.logger.error(`Failed to resolve tenant context: ${(error as Error).message}`);
        request.tenantContext = null;
      }
    } else {
      request.tenantContext = null;
    }

    return next.handle();
  }

  private extractFacilityId(request: any): string | null {
    const headerFacility = request.headers?.['x-facility-id'];
    if (headerFacility) return headerFacility;

    if (request.query?.facilityId) return request.query.facilityId;

    if (request.user?.facilityId) return request.user.facilityId;

    return null;
  }
}
