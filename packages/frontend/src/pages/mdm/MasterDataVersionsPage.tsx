import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  History,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Eye,
  GitCompare,
  RotateCcw,
  Database,
  Calendar,
  User,
  FileText,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';

interface DataVersion {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  version: number;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  changedBy: string;
  changedAt: string;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  changes: Record<string, { old: any; new: any }>;
  approvedBy?: string;
  approvedAt?: string;
}

// Data - will be populated from API
const mockVersions: DataVersion[] = [];

const entityTypes = ['All', 'Drug', 'Supplier', 'Service', 'Department', 'Ward', 'Equipment'];
const actions = ['All', 'CREATE', 'UPDATE', 'DELETE'];
const statuses = ['All', 'APPROVED', 'PENDING', 'REJECTED'];

export default function MasterDataVersionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('All');
  const [selectedAction, setSelectedAction] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<DataVersion | null>(null);
  const [compareVersions, setCompareVersions] = useState<DataVersion[]>([]);

  const { data: versions, isLoading } = useQuery({
    queryKey: ['mdm-versions', selectedEntityType, selectedAction, selectedStatus],
    queryFn: async () => mockVersions,
  });

  const filteredVersions = versions?.filter((v) => {
    const matchesSearch =
      v.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.changedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedEntityType === 'All' || v.entityType === selectedEntityType;
    const matchesAction = selectedAction === 'All' || v.action === selectedAction;
    const matchesStatus = selectedStatus === 'All' || v.status === selectedStatus;
    return matchesSearch && matchesType && matchesAction && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'CREATE':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">Create</span>;
      case 'UPDATE':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">Update</span>;
      case 'DELETE':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">Delete</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Data Versions</h1>
          <p className="text-gray-600">Track and compare changes to master data records</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <History className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Versions</p>
              <p className="text-xl font-bold text-gray-900">{versions?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-xl font-bold text-green-600">
                {versions?.filter((v) => v.status === 'APPROVED').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-xl font-bold text-yellow-600">
                {versions?.filter((v) => v.status === 'PENDING').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <XCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Rejected</p>
              <p className="text-xl font-bold text-red-600">
                {versions?.filter((v) => v.status === 'REJECTED').length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="p-4 border-b flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by entity name or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4">
            <select
              value={selectedEntityType}
              onChange={(e) => setSelectedEntityType(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type === 'All' ? 'All Entity Types' : type}
                </option>
              ))}
            </select>

            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action === 'All' ? 'All Actions' : action}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status === 'All' ? 'All Statuses' : status}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Version List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredVersions && filteredVersions.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Entity</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Version</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Action</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Changed By</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Changed At</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredVersions.map((version) => (
                <tr key={version.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{version.entityName}</p>
                      <p className="text-sm text-gray-500">{version.entityType}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">v{version.version}</td>
                  <td className="px-4 py-3">{getActionBadge(version.action)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{version.changedBy}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(version.changedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(version.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedVersion(version)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View Changes"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => {
                          if (compareVersions.length < 2) {
                            setCompareVersions([...compareVersions, version]);
                          }
                        }}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="Compare"
                      >
                        <GitCompare className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No version history found</p>
          </div>
        )}
      </div>

      {/* Version Details Modal */}
      {selectedVersion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Version Details</h2>
              <p className="text-gray-600">{selectedVersion.entityName} - v{selectedVersion.version}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Entity Type</p>
                  <p className="font-medium">{selectedVersion.entityType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Action</p>
                  {getActionBadge(selectedVersion.action)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Changed By</p>
                  <p className="font-medium">{selectedVersion.changedBy}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Changed At</p>
                  <p className="font-medium">{new Date(selectedVersion.changedAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedVersion.status)}
                </div>
                {selectedVersion.approvedBy && (
                  <div>
                    <p className="text-sm text-gray-500">Approved By</p>
                    <p className="font-medium">{selectedVersion.approvedBy}</p>
                  </div>
                )}
              </div>

              {Object.keys(selectedVersion.changes).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Changes</p>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-gray-500">
                          <th className="pb-2">Field</th>
                          <th className="pb-2">Old Value</th>
                          <th className="pb-2">New Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(selectedVersion.changes).map(([field, change]) => (
                          <tr key={field}>
                            <td className="py-1 font-medium">{field}</td>
                            <td className="py-1 text-red-600">{String(change.old)}</td>
                            <td className="py-1 text-green-600">{String(change.new)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setSelectedVersion(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
