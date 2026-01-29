import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  GitMerge,
  AlertTriangle,
  CheckCircle,
  X,
  ChevronDown,
  ChevronRight,
  Clock,
  User,
  ArrowRight,
  Loader2,
  Eye,
  FileText,
  Database,
} from 'lucide-react';

interface SyncConflict {
  id: string;
  entityType: string;
  entityId: string;
  facilityId: string;
  clientId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  conflictFields: string[];
  createdAt: string;
  status: 'PENDING' | 'RESOLVED';
}

// Empty data - to be populated from API
const mockConflicts: SyncConflict[] = [];

export default function ConflictResolutionPage() {
  const queryClient = useQueryClient();
  const [expandedConflict, setExpandedConflict] = useState<string | null>(null);
  const [selectedResolutions, setSelectedResolutions] = useState<Record<string, Record<string, 'local' | 'server'>>>({});

  const { data: conflicts, isLoading } = useQuery({
    queryKey: ['sync-conflicts'],
    queryFn: async () => mockConflicts,
  });

  const resolveConflictMutation = useMutation({
    mutationFn: async ({ conflictId, resolution }: { conflictId: string; resolution: 'USE_LOCAL' | 'USE_SERVER' | 'MERGE' }) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] });
    },
  });

  const resolveAllMutation = useMutation({
    mutationFn: async (resolution: 'USE_LOCAL' | 'USE_SERVER') => {
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sync-conflicts'] });
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

  const handleFieldResolution = (conflictId: string, field: string, choice: 'local' | 'server') => {
    setSelectedResolutions(prev => ({
      ...prev,
      [conflictId]: {
        ...(prev[conflictId] || {}),
        [field]: choice,
      },
    }));
  };

  const handleMergeResolve = (conflict: SyncConflict) => {
    const resolutions = selectedResolutions[conflict.id] || {};
    const allFieldsResolved = conflict.conflictFields.every(field => resolutions[field]);
    
    if (!allFieldsResolved) {
      alert('Please resolve all conflicting fields before merging');
      return;
    }
    
    resolveConflictMutation.mutate({ conflictId: conflict.id, resolution: 'MERGE' });
  };

  const items = conflicts || mockConflicts;
  const pendingConflicts = items.filter(c => c.status === 'PENDING');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conflict Resolution</h1>
          <p className="text-gray-600">Resolve data conflicts between local and server versions</p>
        </div>
        {pendingConflicts.length > 0 && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => resolveAllMutation.mutate('USE_LOCAL')}
              disabled={resolveAllMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Keep All Local
            </button>
            <button
              onClick={() => resolveAllMutation.mutate('USE_SERVER')}
              disabled={resolveAllMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Accept All Server
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Conflicts</p>
              <p className="text-xl font-bold text-orange-600">{pendingConflicts.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Resolved Today</p>
              <p className="text-xl font-bold text-green-600">
                {items.filter(c => c.status === 'RESOLVED').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Conflicts List */}
      {pendingConflicts.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-12 text-center">
          <CheckCircle className="w-16 h-16 text-green-300 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No Conflicts</h2>
          <p className="text-gray-500">All data is synchronized. No conflicts to resolve.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingConflicts.map((conflict) => (
            <div key={conflict.id} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              {/* Conflict Header */}
              <div
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                onClick={() => setExpandedConflict(expandedConflict === conflict.id ? null : conflict.id)}
              >
                <div className="flex items-center gap-3">
                  {expandedConflict === conflict.id ? (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  )}
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <GitMerge className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {conflict.entityType.replace('_', ' ')} Conflict
                    </p>
                    <p className="text-sm text-gray-500">
                      ID: {conflict.entityId} • {conflict.conflictFields.length} conflicting field(s)
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatTimeAgo(conflict.createdAt)}
                  </span>
                </div>
              </div>

              {/* Expanded Conflict Details */}
              {expandedConflict === conflict.id && (
                <div className="border-t p-4 bg-gray-50">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
                    {/* Local Version */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-blue-600" />
                        <h3 className="font-medium text-blue-800">Local Version</h3>
                        <span className="text-xs text-blue-600 ml-auto">Your device</span>
                      </div>
                      <div className="space-y-2">
                        {conflict.conflictFields.map((field) => (
                          <div key={field} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-700 capitalize">{field}</p>
                              <p className="text-sm text-gray-600">
                                {String(conflict.localVersion[field] || '—')}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFieldResolution(conflict.id, field, 'local');
                              }}
                              className={`px-3 py-1 text-xs rounded-full ${
                                selectedResolutions[conflict.id]?.[field] === 'local'
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                            >
                              Use This
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Server Version */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Database className="w-4 h-4 text-green-600" />
                        <h3 className="font-medium text-green-800">Server Version</h3>
                        <span className="text-xs text-green-600 ml-auto">Cloud</span>
                      </div>
                      <div className="space-y-2">
                        {conflict.conflictFields.map((field) => (
                          <div key={field} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-gray-700 capitalize">{field}</p>
                              <p className="text-sm text-gray-600">
                                {String(conflict.serverVersion[field] || '—')}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFieldResolution(conflict.id, field, 'server');
                              }}
                              className={`px-3 py-1 text-xs rounded-full ${
                                selectedResolutions[conflict.id]?.[field] === 'server'
                                  ? 'bg-green-600 text-white'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                            >
                              Use This
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Resolution Actions */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t">
                    <button
                      onClick={() => resolveConflictMutation.mutate({ conflictId: conflict.id, resolution: 'USE_LOCAL' })}
                      disabled={resolveConflictMutation.isPending}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                    >
                      Keep All Local
                    </button>
                    <button
                      onClick={() => resolveConflictMutation.mutate({ conflictId: conflict.id, resolution: 'USE_SERVER' })}
                      disabled={resolveConflictMutation.isPending}
                      className="px-4 py-2 border rounded-lg hover:bg-gray-100"
                    >
                      Accept All Server
                    </button>
                    <button
                      onClick={() => handleMergeResolve(conflict)}
                      disabled={resolveConflictMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      {resolveConflictMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <GitMerge className="w-4 h-4" />
                      )}
                      Merge Selected
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Help Section */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="font-medium text-blue-800 mb-2">How to Resolve Conflicts</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• <strong>Keep Local:</strong> Use the data from your device (may overwrite changes made elsewhere)</li>
          <li>• <strong>Accept Server:</strong> Use the data from the server (discards your local changes)</li>
          <li>• <strong>Merge:</strong> Select which version to use for each field individually</li>
        </ul>
      </div>
    </div>
  );
}
