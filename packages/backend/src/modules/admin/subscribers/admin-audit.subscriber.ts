import { EventSubscriber, EntitySubscriberInterface, InsertEvent, UpdateEvent, RemoveEvent } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { AdminAuditLog, AdminAuditAction, AdminAuditEntityType } from '../../database/entities/admin-audit-log.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Organization } from '../../database/entities/organization.entity';
import { User } from '../../database/entities/user.entity';
import { License } from '../../database/entities/license.entity';
import { AdminAuditService } from '../services/admin-audit.service';

/**
 * TypeORM Subscriber for auto-logging entity changes
 * Captures INSERT, UPDATE, DELETE events and records them in AdminAuditLog
 *
 * Only tracks entities that should be audit-logged:
 * - Tenant, Organization, License (structural changes)
 * - User (access changes)
 * - Not: logs themselves, temporary data, internal state
 */
@Injectable()
@EventSubscriber()
export class AdminAuditSubscriber implements EntitySubscriberInterface {
  constructor(private auditService: AdminAuditService) {}

  /**
   * Listen to all entities, but only log tracked ones
   */
  listenTo() {
    return [AdminAuditLog, Tenant, Organization, User, License];
  }

  /**
   * Track INSERT (CREATE) events
   */
  async afterInsert(event: InsertEvent<any>): Promise<void> {
    // Ignore audit log inserts (would be recursive)
    if (event.entity instanceof AdminAuditLog) {
      return;
    }

    const { entityType, description, label } = this.mapEntity(event.entity);

    if (!entityType) {
      return; // Not a tracked entity
    }

    await this.auditService.logAction({
      tenantId: event.entity.tenantId,
      action: AdminAuditAction.CREATE,
      entityType,
      entityId: event.entity.id,
      entityLabel: label,
      description: `${description} created`,
      newValues: this.sanitizeValues(event.entity),
      systemGenerated: true,
      result: 'success',
    });
  }

  /**
   * Track UPDATE events
   * Only logs if meaningful values changed (ignores timestamps)
   */
  async afterUpdate(event: UpdateEvent<any>): Promise<void> {
    if (event.entity instanceof AdminAuditLog) {
      return;
    }

    const { entityType, description, label } = this.mapEntity(event.entity);

    if (!entityType) {
      return;
    }

    // Get old values from database before update
    const oldEntity = await event.manager.findOne(event.entity.constructor, {
      where: { id: event.entity.id },
    });

    // Find what changed
    const changes = this.diffObjects(oldEntity, event.entity);

    if (Object.keys(changes).length === 0) {
      return; // Nothing meaningful changed
    }

    await this.auditService.logAction({
      tenantId: event.entity.tenantId,
      action: AdminAuditAction.UPDATE,
      entityType,
      entityId: event.entity.id,
      entityLabel: label,
      description: `${description} updated: ${Object.keys(changes).join(', ')}`,
      oldValues: oldEntity ? this.sanitizeValues(oldEntity) : undefined,
      newValues: this.sanitizeValues(event.entity),
      systemGenerated: true,
      result: 'success',
    });
  }

  /**
   * Track DELETE events
   */
  async beforeRemove(event: RemoveEvent<any>): Promise<void> {
    if (event.entity instanceof AdminAuditLog) {
      return;
    }

    const { entityType, description, label } = this.mapEntity(event.entity);

    if (!entityType) {
      return;
    }

    await this.auditService.logAction({
      tenantId: event.entity.tenantId,
      action: AdminAuditAction.DELETE,
      entityType,
      entityId: event.entity.id,
      entityLabel: label,
      description: `${description} deleted`,
      oldValues: this.sanitizeValues(event.entity),
      systemGenerated: true,
      result: 'success',
    });
  }

  /**
   * Map entity type to audit log entity type
   */
  private mapEntity(
    entity: any,
  ): { entityType?: AdminAuditEntityType; description: string; label?: string } {
    if (entity instanceof Tenant) {
      return {
        entityType: AdminAuditEntityType.TENANT,
        description: 'Tenant',
        label: entity.name,
      };
    }

    if (entity instanceof Organization) {
      return {
        entityType: AdminAuditEntityType.ORGANIZATION,
        description: 'Organization',
        label: entity.name,
      };
    }

    if (entity instanceof User) {
      return {
        entityType: AdminAuditEntityType.USER,
        description: 'User',
        label: entity.email,
      };
    }

    if (entity instanceof License) {
      return {
        entityType: AdminAuditEntityType.LICENSE,
        description: 'License',
        label: entity.licenseKey,
      };
    }

    return { description: 'Unknown Entity' };
  }

  /**
   * Compare two objects and return changed fields
   */
  private diffObjects(oldObj: any, newObj: any): Record<string, any> {
    if (!oldObj) {
      return {};
    }

    const changes: Record<string, any> = {};

    // Check new object's keys
    for (const key of Object.keys(newObj)) {
      // Skip internal, temporal, and audit fields
      if (
        key.startsWith('_') ||
        ['id', 'createdAt', 'updatedAt', 'deletedAt'].includes(key) ||
        typeof newObj[key] === 'function'
      ) {
        continue;
      }

      const oldValue = oldObj[key];
      const newValue = newObj[key];

      // Detect actual changes
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = { old: oldValue, new: newValue };
      }
    }

    return changes;
  }

  /**
   * Remove sensitive data before storing in audit log
   */
  private sanitizeValues(entity: any): Record<string, any> {
    const sanitized = { ...entity };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'hash', 'token', 'secret', 'apiKey', 'privateKey', 'mfaSecret'];

    sensitiveFields.forEach((field) => {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    });

    // Remove internal fields
    Object.keys(sanitized).forEach((key) => {
      if (key.startsWith('_') || typeof sanitized[key] === 'function') {
        delete sanitized[key];
      }
    });

    return sanitized;
  }
}
