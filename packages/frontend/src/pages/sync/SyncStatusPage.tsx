import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  RefreshCw,
  Cloud,
  CloudOff,
  CheckCircle,
  AlertTriangle,
  Clock,
  Database,
  Wifi,
  WifiOff,
  Loader2,
  Play,
  Settings,
  BarChart3,
} from 'lucide-react';

interface SyncStatus {
  clientId: string;
  facilityId: string;
  lastSyncAt: string;
  pendingPushCount: number;
  pendingPullCount: number;
  conflictCount: number;
  isOnline: boolean;
  syncInProgress: boolean;
}

interface EntitySyncStatus {
  entityType: string;
  lastSyncAt: string;
  pendingCount: number;
  errorCount: number;
}

// Empty data - to be populated from API
const mockSyncStatus: SyncStatus = {
  clientId: '',
  facilityId: '',
  lastSyncAt: new Date().toISOString(),
  pendingPushCount: 0,
  pendingPullCount: 0,
  conflictCount: 0,
  isOnline: true,
  syncInProgress: false,
};

const mockEntityStatus: EntitySyncStatus[] = [];

export default function SyncStatusPage() {
  const queryClient = useQueryClient();
  const [isOnline] = useState(navigator.onLine);

  const { data: syncStatus, isLoading } = useQuery({
    queryKey: ['sync-status'],
    queryFn: async () => {
      // In production, call: syncService.getStatus(facilityId, clientId)
      return mockSyncStatus;
    },
    refetchInterval: 30000,
  });

  const { data: entityStatus } = useQuery({
    queryKey: ['entity-sync-status'],
    queryFn: async () => mockEntityStatus,
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      // In production, call sync push/pull
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  const retryFailedMutation = useMutation({
    mutationFn: async () => {
      // In production, call syncService.retryFailed
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-status'] });
    },
  });

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const status = syncStatus || mockSyncStatus;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sync Status</h1>
          <p className="text-gray-600">Monitor offline data synchronization</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => retryFailedMutation.mutate()}
            disabled={retryFailedMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            {retryFailedMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            Retry Failed
          </button>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || !isOnline}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {syncMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync Now
          </button>
        </div>
      </div>

      {/* Connection Status Banner */}
      <div className={`flex items-center gap-3 p-4 rounded-lg ${isOnline ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        {isOnline ? (
          <>
            <Wifi className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-medium text-green-800">Connected to Server</p>
              <p className="text-sm text-green-600">Data will sync automatically</p>
            </div>
          </>
        ) : (
          <>
            <WifiOff className="w-6 h-6 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Offline Mode</p>
              <p className="text-sm text-red-600">Changes will be saved locally and synced when online</p>
            </div>
          </>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Last Sync</p>
              <p className="text-2xl font-bold text-gray-900">{formatTimeAgo(status.lastSyncAt)}</p>
            </div>
            <Clock className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Upload</p>
              <p className="text-2xl font-bold text-orange-600">{status.pendingPushCount}</p>
            </div>
            <Cloud className="w-10 h-10 text-orange-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Download</p>
              <p className="text-2xl font-bold text-blue-600">{status.pendingPullCount}</p>
            </div>
            <CloudOff className="w-10 h-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Conflicts</p>
              <p className="text-2xl font-bold text-red-600">{status.conflictCount}</p>
            </div>
            <AlertTriangle className="w-10 h-10 text-red-200" />
          </div>
        </div>
      </div>

      {/* Entity Sync Status Table */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Database className="w-5 h-5" />
            Entity Sync Status
          </h2>
          <button className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1">
            <Settings className="w-4 h-4" />
            Configure
          </button>
        </div>
        {(entityStatus || mockEntityStatus).length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Entity Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Last Synced</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Pending</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Errors</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(entityStatus || mockEntityStatus).map((entity) => (
                  <tr key={entity.entityType} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{entity.entityType.replace('_', ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatTimeAgo(entity.lastSyncAt)}
                    </td>
                    <td className="px-4 py-3">
                      {entity.pendingCount > 0 ? (
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                          {entity.pendingCount} pending
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entity.errorCount > 0 ? (
                        <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                          {entity.errorCount} errors
                        </span>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entity.errorCount > 0 ? (
                        <span className="flex items-center gap-1 text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          Error
                        </span>
                      ) : entity.pendingCount > 0 ? (
                        <span className="flex items-center gap-1 text-orange-600">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="w-4 h-4" />
                          Synced
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No entities configured for sync</p>
          </div>
        )}
      </div>

      {/* Sync Activity Log */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Recent Sync Activity
          </h2>
        </div>
        <div className="p-4 space-y-3">
          {/* Empty state - activity logs to be populated from API */}
          <div className="text-center py-8">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No sync activity yet</p>
          </div>
        </div>
      </div>
    </div>
  );
}
