import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { ForbiddenException } from '@nestjs/common';

/**
 * Auto-populates tenant_id on INSERT if the entity has a tenantId field
 * and it's not already set. Prevents cross-tenant updates by validating
 * tenant_id on UPDATE. Works with queryRunner metadata set by services.
 */
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  beforeInsert(event: InsertEvent<any>): void {
    if (event.entity && 'tenantId' in event.entity && !event.entity.tenantId) {
      // Check if tenantId was set via queryRunner metadata
      const tenantId = event.queryRunner?.data?.tenantId;
      if (tenantId) {
        event.entity.tenantId = tenantId;
      }
    }
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    const tenantId = event.queryRunner?.data?.tenantId;
    if (!tenantId || !event.entity) return;

    // Prevent cross-tenant updates: if entity has a tenantId it must match
    if ('tenantId' in event.entity && event.entity.tenantId && event.entity.tenantId !== tenantId) {
      throw new ForbiddenException(
        'Cross-tenant update denied: entity tenant_id does not match request tenant',
      );
    }

    // Ensure tenant_id is preserved on updates
    if ('tenantId' in event.entity && !event.entity.tenantId) {
      event.entity.tenantId = tenantId;
    }
  }
}
