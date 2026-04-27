import { Injectable, NestMiddleware, BadRequestException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { TenantService } from '../../modules/tenants/services';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private tenantService: TenantService) {}

  async use(req: Request & any, res: Response, next: NextFunction) {
    const host = req.get('Host') || '';
    const [subdomain] = host.split('.');

    // Extract tenant from subdomain
    if (subdomain && subdomain !== 'www') {
      let tenant = null;

      // Check if it's admin subdomain
      if (subdomain === 'admin') {
        req.tenantId = 'admin';
        req.tenantSlug = 'admin';
        req.isAdmin = true;
      } else {
        // Resolve tenant by subdomain
        tenant = await this.tenantService.findBySubdomain(subdomain);
        if (tenant) {
          req.tenantId = tenant.id;
          req.tenantSlug = tenant.slug;
          req.tenant = tenant;
          req.isAdmin = false;
        }
      }
    }

    next();
  }
}
