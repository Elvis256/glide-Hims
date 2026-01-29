import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CloudUpload,
  Clock,
  RefreshCw,
  Trash2,
  Eye,
  Filter,
  Search,
  Loader2,
  AlertTriangle,
  CheckCircle,
  FileText,
  User,
  Stethoscope,
  FlaskConical,
  Pill,
  DollarSign,
  ChevronDown,
} from 'lucide-react';

interface OfflineQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  data: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: 'PENDING' | 'FAILED' | 'SYNCING';
}

// Empty data - to be populated from API
const mockQueueItems: OfflineQueueItem[] = [];

const entityIcons: Record<string, React.ReactNode> = {
  PATIENT: <User className="w-4 h-4" />,
  ENCOUNTER: <Stethoscope className="w-4 h-4" />,
  LAB_ORDER: <FlaskConical className="w-4 h-4" />,
  PRESCRIPTION: <Pill className="w-4 h-4" />,
  BILLING: <DollarSign className="w-4 h-4" />,
  VITALS: <FileText className="w-4 h-4" />,
};

export default function OfflineQueuePage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const { data: queueItems, isLoading } = useQuery({
    queryKey: ['offline-queue'],
    queryFn: async () => mockQueueItems,
  });

  const syncItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await new Promise(resolve => setTimeout(resolve, 1000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-queue'] });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await new Promise(resolve => setTimeout(resolve, 500));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-queue'] });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 2000));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['offline-queue'] });
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

  const items = queueItems || mockQueueItems;

  const filteredItems = items.filter((item) => {
    const matchesSearch = item.entityId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.entityType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'All' || item.entityType === selectedType;
    const matchesStatus = selectedStatus === 'All' || item.status === selectedStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const entityTypes = ['All', ...new Set(items.map(i => i.entityType))];
  const statuses = ['All', 'PENDING', 'FAILED', 'SYNCING'];

  const pendingCount = items.filter(i => i.status === 'PENDING').length;
  const failedCount = items.filter(i => i.status === 'FAILED').length;

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
          <h1 className="text-2xl font-bold text-gray-900">Offline Queue</h1>
          <p className="text-gray-600">Items waiting to be synced to the server</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending || pendingCount === 0}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {syncAllMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CloudUpload className="w-4 h-4" />
            )}
            Sync All ({pendingCount})
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-xl font-bold text-gray-900">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Failed</p>
              <p className="text-xl font-bold text-red-600">{failedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total in Queue</p>
              <p className="text-xl font-bold text-gray-900">{items.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by entity ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setShowTypeDropdown(!showTypeDropdown)}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              {selectedType}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showTypeDropdown && (
              <div className="absolute top-full mt-1 w-48 bg-white border rounded-lg shadow-lg z-10">
                {entityTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setSelectedType(type);
                      setShowTypeDropdown(false);
                    }}
                    className="w-full px-4 py-2 text-left hover:bg-gray-50"
                  >
                    {type.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Queue Items Table */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedItems.length === filteredItems.length && filteredItems.length > 0}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedItems(filteredItems.map(i => i.id));
                    } else {
                      setSelectedItems([]);
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Entity</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Operation</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Created</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Retries</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filteredItems.map((item) => (
              <React.Fragment key={item.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(item.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedItems([...selectedItems, item.id]);
                        } else {
                          setSelectedItems(selectedItems.filter(id => id !== item.id));
                        }
                      }}
                      className="rounded"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-gray-100 rounded">
                        {entityIcons[item.entityType] || <FileText className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.entityType.replace('_', ' ')}</p>
                        <p className="text-xs text-gray-500">{item.entityId}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      item.operation === 'CREATE' ? 'bg-green-100 text-green-700' :
                      item.operation === 'UPDATE' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {item.operation}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatTimeAgo(item.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'PENDING' ? (
                      <span className="flex items-center gap-1 text-orange-600 text-sm">
                        <Clock className="w-4 h-4" />
                        Pending
                      </span>
                    ) : item.status === 'FAILED' ? (
                      <span className="flex items-center gap-1 text-red-600 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        Failed
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-blue-600 text-sm">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Syncing
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.retryCount > 0 && (
                      <span className="text-orange-600">{item.retryCount}x</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowDetails(showDetails === item.id ? null : item.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View details"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => syncItemMutation.mutate(item.id)}
                        disabled={syncItemMutation.isPending}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Retry sync"
                      >
                        <RefreshCw className="w-4 h-4 text-blue-500" />
                      </button>
                      <button
                        onClick={() => deleteItemMutation.mutate(item.id)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Delete from queue"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </td>
                </tr>
                {showDetails === item.id && (
                  <tr>
                    <td colSpan={7} className="px-4 py-3 bg-gray-50">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Data:</p>
                        <pre className="text-xs bg-gray-100 p-3 rounded overflow-x-auto">
                          {JSON.stringify(item.data, null, 2)}
                        </pre>
                        {item.lastError && (
                          <p className="text-sm text-red-600">
                            <strong>Last Error:</strong> {item.lastError}
                          </p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500">No items in the offline queue</p>
          </div>
        )}
      </div>
    </div>
  );
}
