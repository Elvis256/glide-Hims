import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent } from 'typeorm';
import { ForbiddenException } from '@nestjs/common';
import { tenantContext } from '../../common/context/tenant-context';

/**
 * Auto-populates tenant_id on INSERT if the entity has a tenantId field and it
 * is not already set, and prevents cross-tenant updates.
 *
 * The tenant is read from the request's AsyncLocalStorage store first — the
 * same source the RLS driver patch forwards to PostgreSQL as `app.tenant`.
 * queryRunner.data remains a fallback for code that sets it explicitly.
 *
 * Reading only queryRunner.data was the original behaviour and it silently did
 * nothing almost everywhere: exactly one of ~190 services populates that field.
 * Rows therefore reached the database with tenant_id NULL unless the service
 * assigned it by hand, which is invisible on tables without RLS (the row is
 * simply orphaned and escapes tenant filtering) and a hard failure on tables
 * with it — cascade-inserted children such as prescription_items 500'd with
 * "new row violates row-level security policy", so a prescription could not be
 * written at all.
 */
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  /** Request tenant, preferring the ALS store the RLS patch also uses. */
  private resolveTenantId(queryRunnerTenantId?: string): string | undefined {
    const store = tenantContext.getStore();
    // System context deliberately spans tenants; never stamp a tenant onto it.
    if (store?.isSystemContext) return undefined;
    return store?.tenantId ?? queryRunnerTenantId;
  }

  /**
   * Whether the entity's TABLE has a tenant_id column.
   *
   * Deliberately not `'tenantId' in entity`: an entity built from a DTO —
   * `manager.create(PrescriptionItem, item)` for cascade children, for example
   * — has no tenantId key at all, so the `in` check was false and the row was
   * inserted with tenant_id NULL. The mapping is the reliable source.
   */
  private hasTenantColumn(event: InsertEvent<any> | UpdateEvent<any>): boolean {
    return event.metadata?.columns?.some((c) => c.propertyName === 'tenantId') ?? false;
  }

  beforeInsert(event: InsertEvent<any>): void {
    if (!event.entity || !this.hasTenantColumn(event) || event.entity.tenantId) return;
    const tenantId = this.resolveTenantId(event.queryRunner?.data?.tenantId);
    if (tenantId) {
      event.entity.tenantId = tenantId;
    }
  }

  beforeUpdate(event: UpdateEvent<any>): void {
    const tenantId = this.resolveTenantId(event.queryRunner?.data?.tenantId);
    if (!tenantId || !event.entity) return;

    if (!this.hasTenantColumn(event)) return;

    // Prevent cross-tenant updates: if entity has a tenantId it must match
    if (event.entity.tenantId && event.entity.tenantId !== tenantId) {
      throw new ForbiddenException(
        'Cross-tenant update denied: entity tenant_id does not match request tenant',
      );
    }

    // Ensure tenant_id is preserved on updates
    if (!event.entity.tenantId) {
      event.entity.tenantId = tenantId;
    }
  }
}
