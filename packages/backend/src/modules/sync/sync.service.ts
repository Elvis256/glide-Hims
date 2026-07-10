import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In, DataSource } from 'typeorm';
import {
  SyncQueue,
  SyncOperation,
  SyncStatus,
  SyncableEntity,
} from '../../database/entities/sync-queue.entity';
import {
  SyncConflict,
  ConflictResolution,
  ConflictType,
} from '../../database/entities/sync-conflict.entity';
import { PushChangesDto, SyncChangeDto, ResolveConflictDto } from './dto/sync.dto';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncQueue)
    private syncQueueRepo: Repository<SyncQueue>,
    @InjectRepository(SyncConflict)
    private conflictRepo: Repository<SyncConflict>,
    private dataSource: DataSource,
  ) {}

  // Entity table mapping
  private readonly entityTableMap: Record<SyncableEntity, string> = {
    [SyncableEntity.PATIENT]: 'patients',
    [SyncableEntity.ENCOUNTER]: 'encounters',
    [SyncableEntity.VITAL_SIGN]: 'vitals',
    [SyncableEntity.CLINICAL_NOTE]: 'clinical_notes',
    [SyncableEntity.PRESCRIPTION]: 'prescriptions',
    [SyncableEntity.LAB_ORDER]: 'lab_orders',
    [SyncableEntity.LAB_RESULT]: 'lab_results',
    [SyncableEntity.IMAGING_ORDER]: 'imaging_orders',
    [SyncableEntity.ADMISSION]: 'admissions',
    [SyncableEntity.INVOICE]: 'invoices',
    [SyncableEntity.PAYMENT]: 'payments',
    [SyncableEntity.ANTENATAL_VISIT]: 'antenatal_visits',
    [SyncableEntity.POSTNATAL_VISIT]: 'postnatal_visits',
    [SyncableEntity.IMMUNIZATION]: 'immunization_schedules',
  };

  // Whitelist of valid table names for sync operations (defense-in-depth)
  private readonly VALID_SYNC_TABLES = new Set(Object.values(this.entityTableMap));

  private static readonly SAFE_IDENTIFIER_PATTERN = /^[a-z_][a-z0-9_]*$/i;

  private validateTableName(tableName: string): string {
    if (!this.VALID_SYNC_TABLES.has(tableName)) {
      throw new BadRequestException(`Invalid sync table: ${tableName}`);
    }
    return tableName;
  }

  private validateColumnName(columnName: string): string {
    if (!SyncService.SAFE_IDENTIFIER_PATTERN.test(columnName)) {
      throw new BadRequestException(`Invalid column name: ${columnName}`);
    }
    return `"${columnName}"`;
  }

  async pushChanges(
    dto: PushChangesDto,
    userId: string,
    tenantId?: string,
  ): Promise<{
    synced: number;
    conflicts: number;
    failed: number;
    results: { entityId: string; status: string; conflictId?: string }[];
  }> {
    const results: { entityId: string; status: string; conflictId?: string }[] = [];
    let synced = 0;
    let conflicts = 0;
    let failed = 0;

    for (const change of dto.changes) {
      try {
        const result = await this.processSingleChange(dto, change, userId, tenantId);
        results.push(result);

        if (result.status === 'synced') synced++;
        else if (result.status === 'conflict') conflicts++;
        else failed++;
      } catch (error) {
        this.logger.error(`Error processing change for ${change.entityId}: ${error.message}`);
        results.push({ entityId: change.entityId, status: 'failed' });
        failed++;
      }
    }

    return { synced, conflicts, failed, results };
  }

  private async processSingleChange(
    dto: PushChangesDto,
    change: SyncChangeDto,
    userId: string,
    tenantId?: string,
  ): Promise<{ entityId: string; status: string; conflictId?: string }> {
    // Wrap conflict detection + change application in a single transaction
    return this.dataSource.transaction(async (manager) => {
      // Create queue entry
      const queueEntry = manager.create(SyncQueue, {
        facilityId: dto.facilityId,
        clientId: dto.clientId,
        deviceName: dto.deviceName,
        deviceType: dto.deviceType,
        entityType: change.entityType,
        entityId: change.entityId,
        operation: change.operation,
        clientVersion: change.clientVersion,
        clientTimestamp: change.clientTimestamp,
        payload: change.payload,
        previousPayload: change.previousPayload,
        status: SyncStatus.PROCESSING,
        userId,
        ...(tenantId ? { tenantId } : {}),
      });

      await manager.save(queueEntry);

      // Check for conflicts (for updates and deletes)
      if (change.operation !== SyncOperation.CREATE) {
        const conflict = await this.detectConflict(dto.facilityId, change, tenantId);

        if (conflict) {
          queueEntry.status = SyncStatus.CONFLICT;
          queueEntry.conflictId = conflict.id;
          await manager.save(queueEntry);
          return { entityId: change.entityId, status: 'conflict', conflictId: conflict.id };
        }
      }

      // Apply the change
      try {
        await this.applyChange(change, tenantId);
        queueEntry.status = SyncStatus.SYNCED;
        queueEntry.syncedAt = new Date();
        await manager.save(queueEntry);
        return { entityId: change.entityId, status: 'synced' };
      } catch (error) {
        queueEntry.status = SyncStatus.FAILED;
        queueEntry.errorMessage = error.message;
        queueEntry.retryCount++;
        await manager.save(queueEntry);
        return { entityId: change.entityId, status: 'failed' };
      }
    });
  }

  private async detectConflict(
    facilityId: string,
    change: SyncChangeDto,
    tenantId?: string,
  ): Promise<SyncConflict | null> {
    const tableName = this.entityTableMap[change.entityType];
    if (!tableName) return null;
    this.validateTableName(tableName);

    // Get current server version
    let detectSql = `SELECT *, EXTRACT(EPOCH FROM "updated_at") * 1000 as server_timestamp FROM "${tableName}" WHERE "id" = $1`;
    const detectParams: any[] = [change.entityId];
    if (tenantId) {
      detectSql += ` AND "tenant_id" = $${detectParams.length + 1}`;
      detectParams.push(tenantId);
    }
    const serverRecord = await this.dataSource.query(detectSql, detectParams);

    if (!serverRecord || serverRecord.length === 0) {
      // Record doesn't exist on server
      if (change.operation === SyncOperation.DELETE) {
        return null; // Already deleted, no conflict
      }
      if (change.operation === SyncOperation.UPDATE) {
        // Client trying to update non-existent record - create conflict
        const conflict = this.conflictRepo.create({
          facilityId,
          entityType: change.entityType,
          entityId: change.entityId,
          conflictType: ConflictType.DELETE_EDIT,
          clientVersion: change.clientVersion,
          serverVersion: 0,
          clientTimestamp: change.clientTimestamp,
          serverTimestamp: Date.now(),
          clientPayload: change.payload,
          serverPayload: {},
          conflictingFields: Object.keys(change.payload),
          resolution: ConflictResolution.PENDING,
          clientId: '',
          clientUserId: '',
          ...(tenantId ? { tenantId } : {}),
        });
        return this.conflictRepo.save(conflict) as Promise<SyncConflict>;
      }
      return null;
    }

    const serverData = serverRecord[0];
    const serverTimestamp = Number(serverData.server_timestamp);

    // Check if server version is newer than client's known version
    if (serverTimestamp > change.clientTimestamp) {
      // Detect conflicting fields
      const conflictingFields = this.findConflictingFields(
        change.previousPayload || {},
        change.payload,
        serverData,
      );

      if (conflictingFields.length > 0) {
        const conflict = this.conflictRepo.create({
          facilityId,
          entityType: change.entityType,
          entityId: change.entityId,
          conflictType: ConflictType.CONCURRENT_EDIT,
          clientVersion: change.clientVersion,
          serverVersion: serverData.version || 1,
          clientTimestamp: change.clientTimestamp,
          serverTimestamp,
          clientPayload: change.payload,
          serverPayload: serverData,
          basePayload: change.previousPayload,
          conflictingFields,
          suggestedMerge:
            this.attemptAutoMerge(change.payload, serverData, conflictingFields) || undefined,
          resolution: ConflictResolution.PENDING,
          clientId: '',
          clientUserId: '',
          ...(tenantId ? { tenantId } : {}),
        });
        return this.conflictRepo.save(conflict) as Promise<SyncConflict>;
      }
    }

    return null;
  }

  private findConflictingFields(
    basePayload: Record<string, any>,
    clientPayload: Record<string, any>,
    serverPayload: Record<string, any>,
  ): string[] {
    const conflicts: string[] = [];
    const allKeys = new Set([...Object.keys(clientPayload), ...Object.keys(serverPayload)]);

    for (const key of allKeys) {
      // Skip metadata fields
      if (['id', 'created_at', 'updated_at', 'deleted_at', 'version'].includes(key)) continue;

      const baseValue = basePayload[key];
      const clientValue = clientPayload[key];
      const serverValue = serverPayload[key];

      // Both changed from base
      if (clientValue !== baseValue && serverValue !== baseValue) {
        // And they changed it to different values
        if (JSON.stringify(clientValue) !== JSON.stringify(serverValue)) {
          conflicts.push(key);
        }
      }
    }

    return conflicts;
  }

  private attemptAutoMerge(
    clientPayload: Record<string, any>,
    serverPayload: Record<string, any>,
    conflictingFields: string[],
  ): Record<string, any> | null {
    // Simple merge: take server values for conflicts, client for non-conflicts
    // This is a conservative approach - real implementation might be smarter
    if (conflictingFields.length === 0) {
      return { ...serverPayload, ...clientPayload };
    }
    return null; // Can't auto-merge if there are real conflicts
  }

  private async applyChange(change: SyncChangeDto, tenantId?: string): Promise<void> {
    const tableName = this.entityTableMap[change.entityType];
    if (!tableName) throw new BadRequestException(`Unknown entity type: ${change.entityType}`);
    this.validateTableName(tableName);

    switch (change.operation) {
      case SyncOperation.CREATE: {
        const insertPayload: any = { ...change.payload };
        if (tenantId) insertPayload.tenant_id = tenantId;
        const columns = Object.keys(insertPayload).map((k) => this.validateColumnName(k));
        await this.dataSource.query(
          `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
          Object.values(insertPayload),
        );
        break;
      }

      case SyncOperation.UPDATE: {
        const filteredKeys = Object.keys(change.payload).filter((k) => !['id'].includes(k));
        const setClauses = filteredKeys
          .map((k, i) => `${this.validateColumnName(k)} = $${i + 2}`)
          .join(', ');
        const updateValues = filteredKeys.map((k) => change.payload[k]);
        let updateSql = `UPDATE "${tableName}" SET ${setClauses}, "updated_at" = NOW() WHERE "id" = $1`;
        const updateParams: any[] = [change.entityId, ...updateValues];
        if (tenantId) {
          updateSql += ` AND "tenant_id" = $${updateParams.length + 1}`;
          updateParams.push(tenantId);
        }
        await this.dataSource.query(updateSql, updateParams);
        break;
      }

      case SyncOperation.DELETE: {
        let deleteSql = `UPDATE "${tableName}" SET "deleted_at" = NOW() WHERE "id" = $1`;
        const deleteParams: any[] = [change.entityId];
        if (tenantId) {
          deleteSql += ` AND "tenant_id" = $${deleteParams.length + 1}`;
          deleteParams.push(tenantId);
        }
        await this.dataSource.query(deleteSql, deleteParams);
        break;
      }
    }
  }

  async pullChanges(
    facilityId: string,
    clientId: string,
    since: number,
    entityTypes?: SyncableEntity[],
    limit: number = 100,
    tenantId?: string,
  ): Promise<{
    changes: any[];
    serverTimestamp: number;
    hasMore: boolean;
  }> {
    const sinceDate = new Date(since);
    const changes: any[] = [];
    const typesToPull = entityTypes || Object.values(SyncableEntity);

    for (const entityType of typesToPull) {
      const tableName = this.entityTableMap[entityType];
      if (!tableName) continue;
      this.validateTableName(tableName);

      let pullSql = `SELECT *, 
          CASE WHEN "deleted_at" IS NOT NULL THEN 'delete' 
               WHEN "created_at" > $1 THEN 'create' 
               ELSE 'update' END as operation,
          EXTRACT(EPOCH FROM "updated_at") * 1000 as timestamp
         FROM "${tableName}" 
         WHERE "facility_id" = $2 AND "updated_at" > $1`;
      const pullParams: any[] = [sinceDate, facilityId];
      if (tenantId) {
        pullSql += ` AND "tenant_id" = $${pullParams.length + 1}`;
        pullParams.push(tenantId);
      }
      pullSql += ` ORDER BY "updated_at" ASC LIMIT $${pullParams.length + 1}`;
      pullParams.push(limit);

      const records = await this.dataSource.query(pullSql, pullParams);

      for (const record of records) {
        changes.push({
          entityType,
          entityId: record.id,
          operation: record.operation,
          timestamp: Number(record.timestamp),
          payload: record,
        });
      }
    }

    // Sort by timestamp
    changes.sort((a, b) => a.timestamp - b.timestamp);

    // Limit total results
    const limitedChanges = changes.slice(0, limit);
    const hasMore = changes.length > limit;

    return {
      changes: limitedChanges,
      serverTimestamp: Date.now(),
      hasMore,
    };
  }

  async getConflicts(
    facilityId: string,
    clientId?: string,
    tenantId?: string,
  ): Promise<SyncConflict[]> {
    const where: any = { facilityId, resolution: ConflictResolution.PENDING };
    if (clientId) where.clientId = clientId;
    if (tenantId) where.tenantId = tenantId;

    return this.conflictRepo.find({
      where,
      order: { createdAt: 'ASC' },
    });
  }

  async resolveConflict(
    id: string,
    dto: ResolveConflictDto,
    userId: string,
    tenantId?: string,
  ): Promise<SyncConflict> {
    const conflictWhere: any = { id };
    if (tenantId) conflictWhere.tenantId = tenantId;
    const conflict = await this.conflictRepo.findOne({ where: conflictWhere });
    if (!conflict) throw new NotFoundException('Conflict not found');

    if (conflict.resolution !== ConflictResolution.PENDING) {
      throw new BadRequestException('Conflict already resolved');
    }

    return this.dataSource.transaction(async (manager) => {
      conflict.resolution = dto.resolution;
      conflict.resolvedById = userId;
      conflict.resolvedAt = new Date();
      conflict.resolutionNotes = dto.notes;

      // Apply resolution
      let payloadToApply: Record<string, any> | null = null;

      switch (dto.resolution) {
        case ConflictResolution.CLIENT_WINS:
          payloadToApply = conflict.clientPayload;
          break;
        case ConflictResolution.SERVER_WINS:
          // No action needed - server already has the data
          break;
        case ConflictResolution.MERGED:
        case ConflictResolution.MANUAL:
          if (!dto.resolvedPayload) {
            throw new BadRequestException(
              'Resolved payload required for MERGED or MANUAL resolution',
            );
          }
          payloadToApply = dto.resolvedPayload;
          conflict.resolvedPayload = dto.resolvedPayload;
          break;
      }

      if (payloadToApply) {
        await this.applyChange(
          {
            entityType: conflict.entityType,
            entityId: conflict.entityId,
            operation: SyncOperation.UPDATE,
            clientVersion: conflict.clientVersion,
            clientTimestamp: conflict.clientTimestamp,
            payload: payloadToApply,
          },
          tenantId,
        );
      }

      // Update related sync queue entry
      const queueWhere: any = { conflictId: id };
      if (tenantId) queueWhere.tenantId = tenantId;
      await manager.update(SyncQueue, queueWhere, {
        status: SyncStatus.SYNCED,
        syncedAt: new Date(),
      });

      return manager.save(SyncConflict, conflict);
    });
  }

  async getSyncStatus(
    facilityId: string,
    clientId: string,
    tenantId?: string,
  ): Promise<{
    pendingCount: number;
    conflictCount: number;
    lastSyncAt: Date | null;
    failedCount: number;
  }> {
    const syncQueueWhere: any = { facilityId, clientId };
    if (tenantId) syncQueueWhere.tenantId = tenantId;
    const conflictBaseWhere: any = { facilityId, clientId };
    if (tenantId) conflictBaseWhere.tenantId = tenantId;

    const [pendingCount, conflictCount, failedCount, lastSync] = await Promise.all([
      this.syncQueueRepo.count({
        where: { ...syncQueueWhere, status: SyncStatus.PENDING },
      }),
      this.conflictRepo.count({
        where: { ...conflictBaseWhere, resolution: ConflictResolution.PENDING },
      }),
      this.syncQueueRepo.count({
        where: { ...syncQueueWhere, status: SyncStatus.FAILED },
      }),
      this.syncQueueRepo.findOne({
        where: { ...syncQueueWhere, status: SyncStatus.SYNCED },
        order: { syncedAt: 'DESC' },
      }),
    ]);

    return {
      pendingCount,
      conflictCount,
      failedCount,
      lastSyncAt: lastSync?.syncedAt || null,
    };
  }

  async retryFailed(facilityId: string, clientId: string, tenantId?: string): Promise<number> {
    const retryWhere: any = { facilityId, clientId, status: SyncStatus.FAILED };
    if (tenantId) retryWhere.tenantId = tenantId;
    const result = await this.syncQueueRepo.update(retryWhere, { status: SyncStatus.PENDING });
    return result.affected || 0;
  }
}
