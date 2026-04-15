import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HardDrive, Download, Trash2, Plus, Loader2, AlertCircle, Database } from 'lucide-react';
import api from '../../services/api';
import { toast } from 'sonner';
import { getApiErrorMessage } from '../../services/api';

interface Backup {
  id: string;
  tenantId: string;
  filename: string;
  filePath: string;
  sizeBytes: number;
  status: string;
  createdBy: string | null;
  notes: string | null;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function BackupManagementPage() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: backups, isLoading } = useQuery<Backup[]>({
    queryKey: ['backups'],
    queryFn: () => api.get('/backups').then(r => r.data?.data ?? r.data ?? r),
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/backups'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup created successfully');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create backup'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/backups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backups'] });
      toast.success('Backup deleted');
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to delete backup'));
      setDeletingId(null);
    },
  });

  const handleDownload = async (backup: Backup) => {
    try {
      const response = await api.get(`/backups/${backup.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', backup.filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, 'Failed to download backup'));
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this backup? This cannot be undone.')) {
      setDeletingId(id);
      deleteMutation.mutate(id);
    }
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      failed: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'in_progress' ? 'In Progress' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <HardDrive className="h-7 w-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Backup Management</h1>
            <p className="text-sm text-gray-500">Create and manage data backups for your organization</p>
          </div>
        </div>
        <button
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {createMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          {createMutation.isPending ? 'Creating Backup…' : 'Create Backup'}
        </button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-4 bg-gray-200 rounded w-1/4" />
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        </div>
      ) : !backups || backups.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Database className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-1">No backups yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first backup to secure your organization's data.
          </p>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create First Backup
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Filename</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {backups.map((backup) => (
                <tr key={backup.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(backup.createdAt).toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatRelativeTime(backup.createdAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 font-mono">
                    {backup.filename}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    {formatBytes(Number(backup.sizeBytes))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {statusBadge(backup.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {backup.status === 'completed' && (
                        <button
                          onClick={() => handleDownload(backup)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(backup.id)}
                        disabled={deletingId === backup.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-red-700 bg-red-50 rounded-md hover:bg-red-100 disabled:opacity-50 transition-colors"
                        title="Delete"
                      >
                        {deletingId === backup.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Info box */}
      <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div>
          <strong>Note:</strong> Backups contain tenant data exported as JSON including
          users, patients, encounters, invoices, inventory, services, roles, and recent audit logs.
          Restore functionality is coming soon.
        </div>
      </div>
    </div>
  );
}
