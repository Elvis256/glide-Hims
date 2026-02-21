import api from './api';

export interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  localData: Record<string, any>;
  serverData: Record<string, any>;
  conflictType: string;
  deviceId: string;
  status: 'unresolved' | 'resolved';
  resolvedBy?: string;
  resolvedAt?: string;
  resolution?: 'local' | 'server' | 'merged';
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
  getConflicts: async (): Promise<SyncConflict[]> => {
    const response = await api.get('/sync/conflicts');
    return response.data?.data || response.data || [];
  },
  resolveConflict: async (id: string, resolution: 'local' | 'server' | 'merged', mergedData?: any): Promise<void> => {
    await api.put(`/sync/conflicts/${id}/resolve`, { resolution, mergedData });
  },
  getStatus: async (): Promise<SyncStatus> => {
    const response = await api.get('/sync/status');
    return response.data;
  },
  retryFailed: async (): Promise<void> => {
    await api.post('/sync/retry-failed');
  },
};
