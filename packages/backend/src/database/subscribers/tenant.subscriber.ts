import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';

/**
 * Auto-populates tenant_id on INSERT if the entity has a tenantId field
 * and it's not already set. Works with queryRunner metadata set by services.
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
}
