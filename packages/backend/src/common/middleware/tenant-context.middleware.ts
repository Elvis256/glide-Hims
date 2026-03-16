import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, Response, NextFunction } from 'express';
import { Facility } from '../../database/entities/facility.entity';

export interface TenantContext {
  tenantId: string;
  facilityId: string;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantContextMiddleware.name);

  constructor(
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const facilityId = this.extractFacilityId(req);
    const user = (req as any).user;

    if (facilityId && user) {
      try {
        const facility = await this.facilityRepository.findOne({
          where: { id: facilityId },
          select: ['id', 'tenantId'],
        });

        if (facility) {
          (req as any).tenantContext = {
            tenantId: facility.tenantId,
            facilityId: facility.id,
          } as TenantContext;
        } else {
          this.logger.warn(`Facility not found: ${facilityId}`);
          (req as any).tenantContext = null;
        }
      } catch (error) {
        this.logger.error(`Failed to resolve tenant context: ${error.message}`);
        (req as any).tenantContext = null;
      }
    } else {
      (req as any).tenantContext = null;
    }

    next();
  }

  private extractFacilityId(req: Request): string | null {
    // Header takes priority
    const headerFacility = req.headers['x-facility-id'] as string;
    if (headerFacility) return headerFacility;

    // Query param fallback
    if (req.query?.facilityId) return req.query.facilityId as string;

    // JWT facilityId as last resort
    const user = (req as any).user;
    if (user?.facilityId) return user.facilityId;

    return null;
  }
}
