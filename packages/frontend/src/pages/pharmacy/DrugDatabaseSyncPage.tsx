import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  RefreshCw,
  Database,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import { pharmacyService, DrugSyncLogEntry, DrugSyncStatus } from '../../services/pharmacy';

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
          <CheckCircle className="h-3 w-3" /> Completed
        </span>
      );
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" /> Running
        </span>
      );
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <XCircle className="h-3 w-3" /> Failed
        </span>
      );
    default:
      return <span className="text-xs text-gray-500">{status}</span>;
  }
}

export default function DrugDatabaseSyncPage() {
  const queryClient = useQueryClient();
  const [labelDrugName, setLabelDrugName] = useState('');

  const { data: syncStatus, isLoading: loadingStatus } = useQuery({
    queryKey: ['drug-sync-status'],
    queryFn: () => pharmacyService.drugSync.getStatus(),
    refetchInterval: 10000,
  });

  const { data: syncLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ['drug-sync-logs'],
    queryFn: () => pharmacyService.drugSync.getLogs(),
    refetchInterval: 10000,
  });

  const syncInteractionsMutation = useMutation({
    mutationFn: () => pharmacyService.drugSync.syncInteractions(),
    onSuccess: () => {
      toast.success('Drug interaction sync started');
      queryClient.invalidateQueries({ queryKey: ['drug-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['drug-sync-logs'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Failed to start interaction sync'),
  });

  const syncLabelsMutation = useMutation({
    mutationFn: (drugName: string) => pharmacyService.drugSync.syncLabels(drugName),
    onSuccess: () => {
      toast.success('Drug label sync started');
      setLabelDrugName('');
      queryClient.invalidateQueries({ queryKey: ['drug-sync-status'] });
      queryClient.invalidateQueries({ queryKey: ['drug-sync-logs'] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || 'Failed to start label sync'),
  });

  const isSyncing =
    syncStatus?.isRunning ||
    syncInteractionsMutation.isPending ||
    syncLabelsMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Drug Database Sync</h1>
        <p className="text-sm text-gray-500 mt-1">
          Synchronize drug interaction and label data from OpenFDA
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <Database className="h-6 w-6 text-blue-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {loadingStatus ? '—' : syncStatus?.totalDrugs ?? 0}
          </div>
          <div className="text-xs text-gray-500">Total Drugs</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <AlertTriangle className="h-6 w-6 text-orange-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {loadingStatus ? '—' : syncStatus?.totalInteractions ?? 0}
          </div>
          <div className="text-xs text-gray-500">Interactions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <Clock className="h-6 w-6 text-green-500 mx-auto mb-1" />
          <div className="text-sm font-semibold text-gray-900">
            {loadingStatus ? '—' : formatDateTime(syncStatus?.lastSyncDate ?? null)}
          </div>
          <div className="text-xs text-gray-500">Last Sync</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 text-center">
          <CheckCircle className="h-6 w-6 text-teal-500 mx-auto mb-1" />
          <div className="text-2xl font-bold text-gray-900">
            {loadingStatus ? '—' : syncStatus?.lastSyncRecordsAdded ?? 0}
          </div>
          <div className="text-xs text-gray-500">Last Records Added</div>
        </div>
      </div>

      {/* Sync Progress Indicator */}
      {isSyncing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
          <div>
            <div className="text-sm font-medium text-blue-900">Sync in progress...</div>
            <div className="text-xs text-blue-700">
              Syncing {syncStatus?.runningSyncType || 'data'} from OpenFDA. This may take a few minutes.
            </div>
          </div>
        </div>
      )}

      {/* Sync Actions */}
      <div className="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Sync Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Sync Interactions */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Sync Drug Interactions
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Check all local drugs against OpenFDA for new interaction data.
            </p>
            <button
              onClick={() => syncInteractionsMutation.mutate()}
              disabled={isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${syncInteractionsMutation.isPending ? 'animate-spin' : ''}`} />
              Sync Interactions
            </button>
          </div>

          {/* Sync Labels */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Sync Drug Labels
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Fetch FDA label data (warnings, contraindications) for a specific drug.
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={labelDrugName}
                  onChange={(e) => setLabelDrugName(e.target.value)}
                  placeholder="Drug name (e.g., Amoxicillin)"
                  className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && labelDrugName.trim()) {
                      syncLabelsMutation.mutate(labelDrugName.trim());
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (labelDrugName.trim()) {
                    syncLabelsMutation.mutate(labelDrugName.trim());
                  }
                }}
                disabled={isSyncing || !labelDrugName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <RefreshCw className={`h-4 w-4 ${syncLabelsMutation.isPending ? 'animate-spin' : ''}`} />
                Sync
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sync History */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Sync History</h2>
        </div>
        {loadingLogs ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : syncLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Database className="h-12 w-12 text-gray-300 mx-auto" />
            <p className="mt-2 text-sm">No sync history yet. Start a sync above.</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Processed
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Added
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Failed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Started
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Completed
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Error
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {syncLogs.map((log: DrugSyncLogEntry) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                    {log.syncType}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(log.status)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">
                    {log.recordsProcessed}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">
                    {log.recordsAdded}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-red-600">
                    {log.recordsFailed}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(log.startedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDateTime(log.completedAt)}
                  </td>
                  <td className="px-4 py-3 text-sm text-red-600 max-w-xs truncate">
                    {log.errorMessage || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
