import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  mdmService,
  ENTITY_TYPE_LABELS,
  MASTER_DATA_ENTITY_TYPES,
  VERSION_ACTIONS,
  APPROVAL_STATUSES,
  type DataVersion,
  type MasterDataEntityType,
  type VersionAction,
  type ApprovalStatus,
} from '../../services/mdm';
import {
  History,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Eye,
  User,
  CheckCircle,
  Clock,
  XCircle,
} from 'lucide-react';

const actionLabels: Record<VersionAction, string> = {
  create: 'Create',
  update: 'Update',
  delete: 'Delete',
  restore: 'Restore',
  approve: 'Approve',
  reject: 'Reject',
};

const statusLabels: Record<ApprovalStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  auto_approved: 'Auto-approved',
};

const formatValue = (value: any): string => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

// The backend only computes changedFields for updates; creates and deletes
// carry the whole record in currentData instead.
const getFieldChanges = (version: DataVersion) =>
  (version.changedFields || []).map((field) => ({
    field,
    old: version.previousData?.[field],
    new: version.currentData?.[field],
  }));

const changedByName = (version: DataVersion) => version.changedByUser?.fullName || version.changedBy;

export default function MasterDataVersionsPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<'All' | MasterDataEntityType>('All');
  const [selectedAction, setSelectedAction] = useState<'All' | VersionAction>('All');
  const [selectedStatus, setSelectedStatus] = useState<'All' | ApprovalStatus>('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<DataVersion | null>(null);

  const { data: versions, isLoading } = useQuery({
    queryKey: ['mdm-versions', selectedEntityType, selectedStatus],
    queryFn: () =>
      mdmService.versions.list({
        entityType: selectedEntityType !== 'All' ? selectedEntityType : undefined,
        approvalStatus: selectedStatus !== 'All' ? selectedStatus : undefined,
      }),
  });

  const filteredVersions = versions?.filter((v) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      ENTITY_TYPE_LABELS[v.entityType]?.toLowerCase().includes(term) ||
      v.entityId?.toLowerCase().includes(term) ||
      changedByName(v)?.toLowerCase().includes(term);
    const matchesAction = selectedAction === 'All' || v.action === selectedAction;
    return matchesSearch && matchesAction;
  });

  const getStatusBadge = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
      case 'auto_approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> {statusLabels[status]}
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  const getActionBadge = (action: VersionAction) => {
    switch (action) {
      case 'create':
      case 'restore':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded">{actionLabels[action]}</span>;
      case 'update':
      case 'approve':
        return <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">{actionLabels[action]}</span>;
      case 'delete':
      case 'reject':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded">{actionLabels[action]}</span>;
      default:
        return null;
    }
  };

  const approvedCount =
    versions?.filter((v) => v.approvalStatus === 'approved' || v.approvalStatus === 'auto_approved')
      .length || 0;

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
              <p className="text-xl font-bold text-green-600">{approvedCount}</p>
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
                {versions?.filter((v) => v.approvalStatus === 'pending').length || 0}
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
                {versions?.filter((v) => v.approvalStatus === 'rejected').length || 0}
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
              placeholder="Search by entity type, record ID or user..."
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
              onChange={(e) => setSelectedEntityType(e.target.value as 'All' | MasterDataEntityType)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Entity Types</option>
              {MASTER_DATA_ENTITY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ENTITY_TYPE_LABELS[type]}
                </option>
              ))}
            </select>

            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as 'All' | VersionAction)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Actions</option>
              {VERSION_ACTIONS.map((action) => (
                <option key={action} value={action}>
                  {actionLabels[action]}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as 'All' | ApprovalStatus)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              {APPROVAL_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
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
                      <p className="font-medium text-gray-900">
                        {ENTITY_TYPE_LABELS[version.entityType] || version.entityType}
                      </p>
                      <p className="text-xs text-gray-500 font-mono">{version.entityId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">v{version.versionNumber}</td>
                  <td className="px-4 py-3">{getActionBadge(version.action)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-700">{changedByName(version)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {new Date(version.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">{getStatusBadge(version.approvalStatus)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedVersion(version)}
                        className="p-1 hover:bg-gray-100 rounded"
                        title="View Changes"
                      >
                        <Eye className="w-4 h-4 text-gray-500" />
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
              <p className="text-gray-600">
                {ENTITY_TYPE_LABELS[selectedVersion.entityType] || selectedVersion.entityType} - v
                {selectedVersion.versionNumber}
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Entity Type</p>
                  <p className="font-medium">
                    {ENTITY_TYPE_LABELS[selectedVersion.entityType] || selectedVersion.entityType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Record ID</p>
                  <p className="font-medium font-mono text-sm">{selectedVersion.entityId}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Action</p>
                  {getActionBadge(selectedVersion.action)}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Changed By</p>
                  <p className="font-medium">{changedByName(selectedVersion)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Changed At</p>
                  <p className="font-medium">{new Date(selectedVersion.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Status</p>
                  {getStatusBadge(selectedVersion.approvalStatus)}
                </div>
                {selectedVersion.approvedBy && (
                  <div>
                    <p className="text-sm text-gray-500">Approved By</p>
                    <p className="font-medium">
                      {selectedVersion.approvedByUser?.fullName || selectedVersion.approvedBy}
                    </p>
                  </div>
                )}
                {selectedVersion.approvedAt && (
                  <div>
                    <p className="text-sm text-gray-500">Approved At</p>
                    <p className="font-medium">
                      {new Date(selectedVersion.approvedAt).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {selectedVersion.changeReason && (
                <div>
                  <p className="text-sm text-gray-500">Change Reason</p>
                  <p className="text-sm text-gray-700">{selectedVersion.changeReason}</p>
                </div>
              )}

              {selectedVersion.approvalNotes && (
                <div>
                  <p className="text-sm text-gray-500">Approval Notes</p>
                  <p className="text-sm text-gray-700">{selectedVersion.approvalNotes}</p>
                </div>
              )}

              {getFieldChanges(selectedVersion).length > 0 ? (
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
                        {getFieldChanges(selectedVersion).map((change) => (
                          <tr key={change.field}>
                            <td className="py-1 font-medium">{change.field}</td>
                            <td className="py-1 text-red-600">{formatValue(change.old)}</td>
                            <td className="py-1 text-green-600">{formatValue(change.new)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Record Data</p>
                  <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-auto max-h-64">
                    {JSON.stringify(selectedVersion.currentData, null, 2)}
                  </pre>
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
