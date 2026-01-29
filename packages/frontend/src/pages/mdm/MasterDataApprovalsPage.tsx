import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Eye,
  ThumbsUp,
  ThumbsDown,
  User,
  Database,
  AlertTriangle,
  MessageSquare,
} from 'lucide-react';

interface PendingApproval {
  id: string;
  entityType: string;
  entityId: string;
  entityName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  requestedBy: string;
  requestedAt: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  changes: Record<string, { old: any; new: any }>;
  notes?: string;
}

// Data - will be populated from API
const mockApprovals: PendingApproval[] = [];

const entityTypes = ['All', 'Drug', 'Supplier', 'Service', 'Ward', 'Department', 'Equipment'];
const priorities = ['All', 'HIGH', 'MEDIUM', 'LOW'];
const actions = ['All', 'CREATE', 'UPDATE', 'DELETE'];

export default function MasterDataApprovalsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('All');
  const [selectedPriority, setSelectedPriority] = useState('All');
  const [selectedAction, setSelectedAction] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['mdm-approvals', selectedEntityType, selectedPriority],
    queryFn: async () => mockApprovals,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mdm-approvals'] });
      setSelectedApproval(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return { id, reason };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mdm-approvals'] });
      setSelectedApproval(null);
      setShowRejectModal(false);
      setRejectionReason('');
    },
  });

  const filteredApprovals = approvals?.filter((a) => {
    const matchesSearch =
      a.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedEntityType === 'All' || a.entityType === selectedEntityType;
    const matchesPriority = selectedPriority === 'All' || a.priority === selectedPriority;
    const matchesAction = selectedAction === 'All' || a.action === selectedAction;
    return matchesSearch && matchesType && matchesPriority && matchesAction;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'HIGH':
        return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">High</span>;
      case 'MEDIUM':
        return <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">Medium</span>;
      case 'LOW':
        return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">Low</span>;
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

  const pendingCount = approvals?.length || 0;
  const highPriorityCount = approvals?.filter((a) => a.priority === 'HIGH').length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Master Data Approvals</h1>
          <p className="text-gray-600">Review and approve pending master data changes</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approvals</p>
              <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">High Priority</p>
              <p className="text-xl font-bold text-red-600">{highPriorityCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Database className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Entity Types</p>
              <p className="text-xl font-bold text-gray-900">
                {new Set(approvals?.map((a) => a.entityType)).size || 0}
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
              placeholder="Search by entity name or requester..."
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
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {priorities.map((priority) => (
                <option key={priority} value={priority}>
                  {priority === 'All' ? 'All Priorities' : priority}
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
          </div>
        )}

        {/* Approval List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredApprovals && filteredApprovals.length > 0 ? (
          <div className="divide-y">
            {filteredApprovals.map((approval) => (
              <div key={approval.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-medium text-gray-900">{approval.entityName}</h3>
                      {getActionBadge(approval.action)}
                      {getPriorityBadge(approval.priority)}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Database className="w-4 h-4" />
                        {approval.entityType}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        {approval.requestedBy}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {new Date(approval.requestedAt).toLocaleString()}
                      </span>
                    </div>
                    {approval.notes && (
                      <p className="mt-2 text-sm text-gray-600 flex items-center gap-1">
                        <MessageSquare className="w-4 h-4" />
                        {approval.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedApproval(approval)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5 text-gray-500" />
                    </button>
                    <button
                      onClick={() => approveMutation.mutate(approval.id)}
                      disabled={approveMutation.isPending}
                      className="p-2 bg-green-100 hover:bg-green-200 rounded-lg"
                      title="Approve"
                    >
                      <ThumbsUp className="w-5 h-5 text-green-600" />
                    </button>
                    <button
                      onClick={() => {
                        setSelectedApproval(approval);
                        setShowRejectModal(true);
                      }}
                      className="p-2 bg-red-100 hover:bg-red-200 rounded-lg"
                      title="Reject"
                    >
                      <ThumbsDown className="w-5 h-5 text-red-600" />
                    </button>
                  </div>
                </div>

                {/* Changes Preview */}
                {Object.keys(approval.changes).length > 0 && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-gray-500 mb-2">Changes:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(approval.changes).map(([field, change]) => (
                        <span key={field} className="text-xs bg-white px-2 py-1 rounded border">
                          <span className="font-medium">{field}:</span>{' '}
                          <span className="text-red-600">{String(change.old)}</span>
                          {' → '}
                          <span className="text-green-600">{String(change.new)}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
            <p className="text-gray-500">No pending approvals</p>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {showRejectModal && selectedApproval && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Reject Change Request</h2>
              <p className="text-gray-600">{selectedApproval.entityName}</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                placeholder="Please provide a reason for rejection..."
              />
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedApproval(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  rejectMutation.mutate({ id: selectedApproval.id, reason: rejectionReason })
                }
                disabled={!rejectionReason.trim() || rejectMutation.isPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {rejectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
