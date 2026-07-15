import api from './api';

/** Mirrors backend ConflictResolution (database/entities/sync-conflict.entity.ts).
 *  'pending' IS the unresolved state — the entity has no separate status column. */
export type ConflictResolution = 'pending' | 'client_wins' | 'server_wins' | 'merged' | 'manual';

/** Mirrors the backend SyncConflict entity. The previous shape here
 *  (localData/serverData/conflictFields/status/deviceId, resolution
 *  'local'|'server'|'merged') matched no column on it. */
export interface SyncConflict {
  id: string;
  tenantId?: string;
  facilityId: string;
  entityType: string;
  entityId: string;
  conflictType: string;
  clientVersion: number;
  serverVersion: number;
  clientTimestamp: number;
  serverTimestamp: number;
  clientPayload: Record<string, any>;
  serverPayload: Record<string, any>;
  basePayload?: Record<string, any>;
  conflictingFields: string[];
  suggestedMerge?: Record<string, any>;
  resolution: ConflictResolution;
  resolvedPayload?: Record<string, any>;
  resolvedById?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  createdAt: string;
}

export interface SyncStatus {
  lastSyncAt: string;
  pendingChanges: number;
  conflicts: number;
  deviceId: string;
  isOnline: boolean;
}

export interface OfflineQueueItem {
  id: string;
  entityType: string;
  action: 'create' | 'update' | 'delete';
  data: Record<string, any>;
  status: 'pending' | 'syncing' | 'synced' | 'failed';
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

export const syncService = {
  push: async (changes: any[]): Promise<any> => {
    const response = await api.post('/sync/push', { changes });
    return response.data;
  },
  pull: async (params?: Record<string, any>): Promise<any> => {
    const response = await api.get('/sync/pull', { params });
    return response.data;
  },
  // facilityId is a REQUIRED query param on GET /sync/conflicts.
  getConflicts: async (facilityId: string, clientId?: string): Promise<SyncConflict[]> => {
    const response = await api.get('/sync/conflicts', {
      params: { facilityId, ...(clientId ? { clientId } : {}) },
    });
    return Array.isArray(response.data) ? response.data : [];
  },
  // Body must match ResolveConflictDto: { resolution, resolvedPayload?, notes? }.
  // resolution is validated with @IsEnum(ConflictResolution) — 'local'/'server'
  // are not members and were rejected with a 400.
  resolveConflict: async (
    id: string,
    resolution: ConflictResolution,
    resolvedPayload?: Record<string, any>,
    notes?: string,
  ): Promise<void> => {
    await api.put(`/sync/conflicts/${id}/resolve`, { resolution, resolvedPayload, notes });
  },
  getStatus: async (): Promise<SyncStatus> => {
    const response = await api.get('/sync/status');
    return response.data;
  },
  retryFailed: async (): Promise<void> => {
    await api.post('/sync/retry-failed');
  },
};
