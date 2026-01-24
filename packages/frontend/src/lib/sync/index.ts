// Glide-HIMS Offline Sync Library
// Provides offline-first data synchronization using IndexedDB

export { db, clearAllData, getClientId } from './db';
export type { SyncableEntityType, SyncOperation, SyncQueueItem, CachedEntity } from './db';

export {
  queueOperation,
  saveEntity,
  createEntity,
  updateEntity,
  deleteEntity,
  getEntity,
  getEntities,
  getPendingCount,
  getPendingOperations,
  retryFailed,
  clearOldSynced,
} from './syncQueue';

export {
  getSyncStatus,
  subscribeSyncStatus,
  canSync,
  sync,
  syncNow,
  initializeSync,
  getConflicts,
  resolveConflict,
} from './syncManager';
export type { SyncResult, SyncStatus } from './syncManager';

export {
  useSyncStatus,
  useSync,
  usePendingCount,
  useSyncConflicts,
  useOnlineStatus,
} from './hooks';
