import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    if (!request.tenantId && !request.isAdmin) {
      throw new ForbiddenException('No tenant context found');
    }

    return true;
  }
}
