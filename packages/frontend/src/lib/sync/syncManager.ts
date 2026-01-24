import {
  db,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  getClientId,
  entityTableMap,
} from './db';
import type {
  SyncableEntityType,
  CachedEntity,
} from './db';
import {
  getPendingOperations,
  markAsSyncing,
  markAsSynced,
  markAsFailed,
  markAsConflict,
  clearOldSynced,
} from './syncQueue';
import { api } from '../../services/api';

export interface SyncResult {
  success: boolean;
  pushed: number;
  pulled: number;
  conflicts: number;
  errors: string[];
}

export interface SyncStatus {
  isOnline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  conflictCount: number;
  lastSyncAt: Date | null;
}

let isSyncing = false;
let syncListeners: ((status: SyncStatus) => void)[] = [];

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<SyncStatus> {
  const pendingCount = await db.syncQueue.where('status').equals('pending').count();
  const conflictCount = await db.conflicts.where('resolved').equals(0).count();
  const lastSync = await getLastSyncTimestamp();

  return {
    isOnline: navigator.onLine,
    isSyncing,
    pendingCount,
    conflictCount,
    lastSyncAt: lastSync ? new Date(lastSync) : null,
  };
}

/**
 * Subscribe to sync status changes
 */
export function subscribeSyncStatus(listener: (status: SyncStatus) => void): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
}

async function notifyListeners(): Promise<void> {
  const status = await getSyncStatus();
  syncListeners.forEach(listener => listener(status));
}

/**
 * Check if we should attempt to sync
 */
export function canSync(): boolean {
  return navigator.onLine && !isSyncing;
}

/**
 * Main sync function - push local changes and pull remote changes
 */
export async function sync(facilityId: string): Promise<SyncResult> {
  if (!canSync()) {
    return { success: false, pushed: 0, pulled: 0, conflicts: 0, errors: ['Cannot sync: offline or already syncing'] };
  }

  isSyncing = true;
  await notifyListeners();

  const result: SyncResult = { success: true, pushed: 0, pulled: 0, conflicts: 0, errors: [] };
  const clientId = await getClientId();

  try {
    // Phase 1: Push local changes
    const pushResult = await pushChanges(facilityId, clientId);
    result.pushed = pushResult.synced;
    result.conflicts += pushResult.conflicts;
    if (pushResult.errors.length > 0) {
      result.errors.push(...pushResult.errors);
    }

    // Phase 2: Pull remote changes
    const pullResult = await pullChanges(facilityId, clientId);
    result.pulled = pullResult.count;
    if (pullResult.error) {
      result.errors.push(pullResult.error);
    }

    // Update last sync timestamp
    await setLastSyncTimestamp(Date.now());

    // Clean up old synced items
    await clearOldSynced(7);

  } catch (error: any) {
    result.success = false;
    result.errors.push(error.message || 'Unknown sync error');
  } finally {
    isSyncing = false;
    await notifyListeners();
  }

  return result;
}

/**
 * Push local changes to server
 */
async function pushChanges(
  facilityId: string,
  clientId: string,
): Promise<{ synced: number; conflicts: number; errors: string[] }> {
  const pending = await getPendingOperations();
  if (pending.length === 0) {
    return { synced: 0, conflicts: 0, errors: [] };
  }

  const ids = pending.map(p => p.id!).filter(id => id !== undefined);
  await markAsSyncing(ids);

  try {
    const response = await api.post('/sync/push', {
      facilityId,
      clientId,
      deviceName: navigator.userAgent,
      deviceType: /mobile/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      changes: pending.map(p => ({
        entityType: p.entityType,
        entityId: p.entityId,
        operation: p.operation,
        clientVersion: p.clientVersion,
        clientTimestamp: p.clientTimestamp,
        payload: p.payload,
        previousPayload: p.previousPayload,
      })),
    });

    const data = response.data;
    let synced = 0;
    let conflicts = 0;
    const errors: string[] = [];

    // Process results
    for (let i = 0; i < pending.length; i++) {
      const item = pending[i];
      const result = data.results[i];

      if (result.status === 'synced') {
        await markAsSynced(item.id!);
        synced++;
      } else if (result.status === 'conflict') {
        await markAsConflict(item.id!, result.conflictId);

        // Store conflict locally
        await db.conflicts.put({
          id: result.conflictId,
          entityType: item.entityType,
          entityId: item.entityId,
          clientPayload: item.payload,
          serverPayload: {}, // Will be fetched
          conflictingFields: [],
          createdAt: Date.now(),
          resolved: false,
        });

        conflicts++;
      } else {
        await markAsFailed(item.id!, 'Sync failed');
        errors.push(`Failed to sync ${item.entityType}:${item.entityId}`);
      }
    }

    return { synced, conflicts, errors };
  } catch (error: any) {
    // Mark all as failed
    for (const id of ids) {
      await markAsFailed(id, error.message || 'Network error');
    }
    return { synced: 0, conflicts: 0, errors: [error.message || 'Push failed'] };
  }
}

/**
 * Pull remote changes from server
 */
async function pullChanges(
  facilityId: string,
  clientId: string,
): Promise<{ count: number; error?: string }> {
  const since = await getLastSyncTimestamp();

  try {
    const response = await api.get('/sync/pull', {
      params: { facilityId, clientId, since },
    });

    const data = response.data;
    let count = 0;

    // Apply each change to local cache
    for (const change of data.changes) {
      const table = entityTableMap[change.entityType as SyncableEntityType];
      if (!table) continue;

      if (change.operation === 'delete') {
        // Mark as deleted
        const existing = await table.get(change.entityId);
        if (existing) {
          existing.isDeleted = true;
          existing.lastSyncedAt = change.timestamp;
          await table.put(existing);
        }
      } else {
        // Create or update
        const cached: CachedEntity = {
          id: change.entityId,
          entityType: change.entityType,
          data: change.payload,
          version: change.timestamp,
          lastSyncedAt: change.timestamp,
          isDeleted: false,
        };
        await table.put(cached);
      }
      count++;
    }

    // If there are more changes, schedule another pull
    if (data.hasMore) {
      setTimeout(() => pullChanges(facilityId, clientId), 100);
    }

    return { count };
  } catch (error: any) {
    return { count: 0, error: error.message || 'Pull failed' };
  }
}

/**
 * Initialize sync - set up event listeners
 */
export function initializeSync(facilityId: string): void {
  // Sync when coming back online
  window.addEventListener('online', () => {
    console.log('Back online, syncing...');
    sync(facilityId);
  });

  // Update status when going offline
  window.addEventListener('offline', () => {
    console.log('Went offline');
    notifyListeners();
  });

  // Periodic sync every 5 minutes if online
  setInterval(() => {
    if (canSync()) {
      sync(facilityId);
    }
  }, 5 * 60 * 1000);

  // Initial status update
  notifyListeners();
}

/**
 * Force sync now
 */
export async function syncNow(facilityId: string): Promise<SyncResult> {
  return sync(facilityId);
}

/**
 * Get pending conflicts
 */
export async function getConflicts() {
  return db.conflicts.where('resolved').equals(0).toArray();
}

/**
 * Resolve a conflict locally
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'client' | 'server' | 'merged',
  mergedData?: Record<string, any>,
): Promise<void> {
  const conflict = await db.conflicts.get(conflictId);
  if (!conflict) return;

  // Apply resolution to local cache
  const table = entityTableMap[conflict.entityType];
  if (table) {
    let dataToApply: Record<string, any>;
    if (resolution === 'client') {
      dataToApply = conflict.clientPayload;
    } else if (resolution === 'server') {
      dataToApply = conflict.serverPayload;
    } else {
      dataToApply = mergedData || conflict.clientPayload;
    }

    const cached: CachedEntity = {
      id: conflict.entityId,
      entityType: conflict.entityType,
      data: dataToApply,
      version: Date.now(),
      lastSyncedAt: Date.now(),
      isDeleted: false,
    };
    await table.put(cached);
  }

  // Mark as resolved
  conflict.resolved = true;
  await db.conflicts.put(conflict);

  // Remove from sync queue
  await db.syncQueue.where('conflictId').equals(conflictId).delete();
}
