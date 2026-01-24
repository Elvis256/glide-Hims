import { db, entityTableMap } from './db';
import type { SyncQueueItem, SyncableEntityType, SyncOperation, CachedEntity } from './db';
import { v4 as uuidv4 } from 'uuid';

/**
 * Add an operation to the sync queue
 */
export async function queueOperation(
  entityType: SyncableEntityType,
  entityId: string,
  operation: SyncOperation,
  payload: Record<string, any>,
  previousPayload?: Record<string, any>,
): Promise<number> {
  const item: SyncQueueItem = {
    entityType,
    entityId,
    operation,
    payload,
    previousPayload,
    clientVersion: Date.now(),
    clientTimestamp: Date.now(),
    status: 'pending',
    retryCount: 0,
    createdAt: Date.now(),
  };

  return db.syncQueue.add(item);
}

/**
 * Save entity to local cache and queue for sync
 */
export async function saveEntity<T extends Record<string, any>>(
  entityType: SyncableEntityType,
  entity: T,
  isNew: boolean = false,
): Promise<T> {
  const table = entityTableMap[entityType];
  if (!table) throw new Error(`Unknown entity type: ${entityType}`);

  // Get existing for comparison
  const existing = await table.get(entity.id);
  const previousPayload = existing?.data;

  // Determine operation
  const operation: SyncOperation = isNew ? 'create' : 'update';

  // Save to local cache
  const cached: CachedEntity = {
    id: entity.id,
    entityType,
    data: entity,
    version: Date.now(),
    lastSyncedAt: existing?.lastSyncedAt || 0,
    isDeleted: false,
  };
  await table.put(cached);

  // Queue for sync
  await queueOperation(entityType, entity.id, operation, entity, previousPayload);

  return entity;
}

/**
 * Create a new entity with a UUID
 */
export async function createEntity<T extends Record<string, any>>(
  entityType: SyncableEntityType,
  data: Omit<T, 'id'>,
): Promise<T> {
  const entity = {
    ...data,
    id: uuidv4(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as T;

  return saveEntity(entityType, entity, true);
}

/**
 * Update an existing entity
 */
export async function updateEntity<T extends Record<string, any>>(
  entityType: SyncableEntityType,
  id: string,
  updates: Partial<T>,
): Promise<T | null> {
  const table = entityTableMap[entityType];
  if (!table) throw new Error(`Unknown entity type: ${entityType}`);

  const existing = await table.get(id);
  if (!existing) return null;

  const updated = {
    ...existing.data,
    ...updates,
    updatedAt: new Date().toISOString(),
  } as unknown as T;

  return saveEntity(entityType, updated, false);
}

/**
 * Delete an entity (soft delete)
 */
export async function deleteEntity(
  entityType: SyncableEntityType,
  id: string,
): Promise<boolean> {
  const table = entityTableMap[entityType];
  if (!table) throw new Error(`Unknown entity type: ${entityType}`);

  const existing = await table.get(id);
  if (!existing) return false;

  // Mark as deleted locally
  existing.isDeleted = true;
  existing.data.deletedAt = new Date().toISOString();
  await table.put(existing);

  // Queue delete operation
  await queueOperation(entityType, id, 'delete', { id }, existing.data);

  return true;
}

/**
 * Get entity from local cache
 */
export async function getEntity<T extends Record<string, any>>(
  entityType: SyncableEntityType,
  id: string,
): Promise<T | null> {
  const table = entityTableMap[entityType];
  if (!table) return null;

  const cached = await table.get(id);
  if (!cached || cached.isDeleted) return null;

  return cached.data as T;
}

/**
 * Get all entities of a type from local cache
 */
export async function getEntities<T extends Record<string, any>>(
  entityType: SyncableEntityType,
  filter?: (entity: T) => boolean,
): Promise<T[]> {
  const table = entityTableMap[entityType];
  if (!table) return [];

  const all = await table.where('isDeleted').equals(0).toArray();
  const results = all.map((c: CachedEntity) => c.data as T);

  if (filter) {
    return results.filter(filter);
  }

  return results;
}

/**
 * Get pending sync operations count
 */
export async function getPendingCount(): Promise<number> {
  return db.syncQueue.where('status').equals('pending').count();
}

/**
 * Get all pending sync operations
 */
export async function getPendingOperations(): Promise<SyncQueueItem[]> {
  return db.syncQueue.where('status').equals('pending').toArray();
}

/**
 * Mark operations as syncing
 */
export async function markAsSyncing(ids: number[]): Promise<void> {
  await db.syncQueue.where('id').anyOf(ids).modify({ status: 'syncing' });
}

/**
 * Mark operation as synced
 */
export async function markAsSynced(id: number): Promise<void> {
  await db.syncQueue.update(id, { status: 'synced' });
}

/**
 * Mark operation as failed
 */
export async function markAsFailed(id: number, errorMessage: string): Promise<void> {
  const item = await db.syncQueue.get(id);
  if (item) {
    await db.syncQueue.update(id, {
      status: 'failed',
      errorMessage,
      retryCount: item.retryCount + 1,
    });
  }
}

/**
 * Mark operation as having a conflict
 */
export async function markAsConflict(id: number, conflictId: string): Promise<void> {
  await db.syncQueue.update(id, { status: 'conflict', conflictId });
}

/**
 * Retry failed operations
 */
export async function retryFailed(): Promise<void> {
  await db.syncQueue.where('status').equals('failed').modify({ status: 'pending' });
}

/**
 * Clear synced operations older than specified days
 */
export async function clearOldSynced(daysOld: number = 7): Promise<number> {
  const cutoff = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  const old = await db.syncQueue
    .where('status').equals('synced')
    .and((item: SyncQueueItem) => item.createdAt < cutoff)
    .toArray();
  
  const ids = old.map((o: SyncQueueItem) => o.id!).filter((id: number) => id !== undefined);
  await db.syncQueue.bulkDelete(ids);
  return ids.length;
}
