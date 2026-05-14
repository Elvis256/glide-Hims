import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  Users,
  Search,
  Building2,
  Plus,
  Loader2,
  X,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
  ArrowRightLeft,
} from 'lucide-react';
import { useFacilityId } from '../../lib/facility';
import { useAuthStore } from '../../store/auth';
import assetsService from '../../services/assets';
import type { AssetAllocation, AllocationStatus } from '../../services/assets';
import facilitiesService from '../../services/facilities';
import api from '../../services/api';

interface UserLite {
  id: string;
  fullName: string;
  departmentId?: string;
}

const STATUS_OPTIONS: ('All' | AllocationStatus)[] = [
  'All',
  'requested',
  'dept_head_approved',
  'allocated',
  'returned',
  'rejected',
  'cancelled',
];

const STATUS_LABEL: Record<AllocationStatus, string> = {
  requested: 'Requested',
  dept_head_approved: 'Dept. Head Approved',
  allocated: 'Allocated',
  returned: 'Returned',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export default function AssetAllocationPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore.getState().user?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'All' | AllocationStatus>('All');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [decisionFor, setDecisionFor] = useState<{
    allocation: AssetAllocation;
    decision: 'approved' | 'rejected';
  } | null>(null);
  const [decisionComments, setDecisionComments] = useState('');
  const [returnFor, setReturnFor] = useState<AssetAllocation | null>(null);
  const [returnDraft, setReturnDraft] = useState({
    returnDate: new Date().toISOString().slice(0, 10),
    conditionOnReturn: '',
    notes: '',
  });

  const [formData, setFormData] = useState({
    assetId: '',
    custodianId: '',
    departmentId: '',
    expectedReturnDate: '',
    purpose: '',
  });

  const resetForm = () =>
    setFormData({
      assetId: '',
      custodianId: '',
      departmentId: '',
      expectedReturnDate: '',
      purpose: '',
    });

  const { data: assets = [] } = useQuery({
    queryKey: ['assets', facilityId],
    queryFn: () => assetsService.list(facilityId, {}),
    enabled: !!facilityId,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', facilityId],
    queryFn: () => facilitiesService.departments.list(facilityId),
    enabled: !!facilityId,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['facility-users', facilityId],
    queryFn: async () => {
      const { data } = await api.get('/users', { params: { facilityId } });
      const list = Array.isArray(data) ? data : data?.data || [];
      return list as UserLite[];
    },
    enabled: !!facilityId,
  });

  const { data: allocations = [], isLoading } = useQuery({
    queryKey: ['asset-allocations', facilityId, selectedStatus],
    queryFn: () =>
      assetsService.listAllocations(facilityId, {
        status: selectedStatus !== 'All' ? selectedStatus : undefined,
      }),
    enabled: !!facilityId,
  });

  const departmentName = (id?: string) =>
    (id && departments.find((d) => d.id === id)?.name) || '—';

  const custodianName = (alloc: AssetAllocation) => {
    if (alloc.custodian) {
      const full = [alloc.custodian.firstName, alloc.custodian.lastName]
        .filter(Boolean)
        .join(' ')
        .trim();
      if (full) return full;
    }
    const u = users.find((u) => u.id === alloc.custodianId);
    return u?.fullName || alloc.custodianId;
  };

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      assetsService.createAllocation({
        assetId: data.assetId,
        facilityId,
        departmentId: data.departmentId || undefined,
        custodianId: data.custodianId,
        expectedReturnDate: data.expectedReturnDate || undefined,
        purpose: data.purpose || undefined,
        requestedBy: currentUserId,
      }),
    onSuccess: () => {
      toast.success('Allocation requested');
      queryClient.invalidateQueries({ queryKey: ['asset-allocations'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to create allocation'),
  });

  const approveMutation = useMutation({
    mutationFn: (input: { id: string; decision: 'approved' | 'rejected'; comments?: string }) =>
      assetsService.approveAllocation(input.id, {
        decision: input.decision,
        comments: input.comments,
      }),
    onSuccess: (_d, vars) => {
      toast.success(vars.decision === 'approved' ? 'Allocation approved' : 'Allocation rejected');
      queryClient.invalidateQueries({ queryKey: ['asset-allocations'] });
      setDecisionFor(null);
      setDecisionComments('');
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to record decision'),
  });

  const issueMutation = useMutation({
    mutationFn: (id: string) => assetsService.issueAllocation(id),
    onSuccess: () => {
      toast.success('Asset issued');
      queryClient.invalidateQueries({ queryKey: ['asset-allocations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to issue asset'),
  });

  const returnMutation = useMutation({
    mutationFn: (input: {
      id: string;
      returnDate: string;
      conditionOnReturn?: string;
      notes?: string;
    }) =>
      assetsService.returnAllocation(input.id, {
        returnDate: input.returnDate,
        conditionOnReturn: input.conditionOnReturn || undefined,
        notes: input.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Asset returned');
      queryClient.invalidateQueries({ queryKey: ['asset-allocations'] });
      setReturnFor(null);
      setReturnDraft({
        returnDate: new Date().toISOString().slice(0, 10),
        conditionOnReturn: '',
        notes: '',
      });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Failed to record return'),
  });

  const filtered = useMemo(
    () =>
      allocations.filter((a) => {
        const term = searchTerm.toLowerCase();
        if (!term) return true;
        const asset = a.asset || assets.find((x) => x.id === a.assetId);
        return (
          (asset?.name || '').toLowerCase().includes(term) ||
          (asset?.assetCode || '').toLowerCase().includes(term) ||
          custodianName(a).toLowerCase().includes(term) ||
          (a.allocationNumber || '').toLowerCase().includes(term)
        );
      }),
    [allocations, assets, users, searchTerm],
  );

  const counts = useMemo(() => {
    const c: Record<AllocationStatus, number> = {
      requested: 0,
      dept_head_approved: 0,
      allocated: 0,
      returned: 0,
      rejected: 0,
      cancelled: 0,
    };
    for (const a of allocations) c[a.status] = (c[a.status] || 0) + 1;
    return c;
  }, [allocations]);

  const statusBadge = (status: AllocationStatus) => {
    const map: Record<AllocationStatus, { cls: string; icon?: React.ReactNode }> = {
      requested: { cls: 'bg-yellow-100 text-yellow-700', icon: <Clock className="w-3 h-3" /> },
      dept_head_approved: {
        cls: 'bg-blue-100 text-blue-700',
        icon: <CheckCircle className="w-3 h-3" />,
      },
      allocated: { cls: 'bg-green-100 text-green-700', icon: <CheckCircle className="w-3 h-3" /> },
      returned: { cls: 'bg-gray-100 text-gray-700', icon: <RotateCcw className="w-3 h-3" /> },
      rejected: { cls: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
      cancelled: { cls: 'bg-gray-100 text-gray-600', icon: <XCircle className="w-3 h-3" /> },
    };
    const e = map[status];
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${e.cls}`}
      >
        {e.icon}
        {STATUS_LABEL[status]}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Users className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Asset Allocation</h1>
            <p className="text-sm text-gray-500">Request, approve, issue and return asset allocations</p>
          </div>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          New Allocation
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-yellow-500">
          <p className="text-sm text-gray-500">Requested</p>
          <p className="text-2xl font-bold text-yellow-600">{counts.requested}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-blue-500">
          <p className="text-sm text-gray-500">Dept. Approved</p>
          <p className="text-2xl font-bold text-blue-600">{counts.dept_head_approved}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-green-500">
          <p className="text-sm text-gray-500">Allocated</p>
          <p className="text-2xl font-bold text-green-600">{counts.allocated}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-gray-400">
          <p className="text-sm text-gray-500">Returned</p>
          <p className="text-2xl font-bold text-gray-700">{counts.returned}</p>
        </div>
        <div className="bg-white rounded-lg border p-4 border-l-4 border-l-red-500">
          <p className="text-sm text-gray-500">Rejected</p>
          <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by asset or custodian..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg"
          />
        </div>
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as 'All' | AllocationStatus)}
          className="px-4 py-2 border rounded-lg"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s === 'All' ? 'All Statuses' : STATUS_LABEL[s as AllocationStatus]}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-12 text-center">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No allocations found matching your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Allocation #
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Asset
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Custodian
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Department
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Allocation Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Expected Return
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((a) => {
                const asset = a.asset || assets.find((x) => x.id === a.assetId);
                return (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {a.allocationNumber}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{asset?.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{asset?.assetCode || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{custodianName(a)}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="flex items-center gap-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        {departmentName(a.departmentId)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {a.allocationDate ? format(new Date(a.allocationDate), 'PP') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {a.expectedReturnDate ? format(new Date(a.expectedReturnDate), 'PP') : '—'}
                    </td>
                    <td className="px-4 py-3">{statusBadge(a.status)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        {a.status === 'requested' && (
                          <>
                            <button
                              onClick={() => {
                                setDecisionFor({ allocation: a, decision: 'approved' });
                                setDecisionComments('');
                              }}
                              className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setDecisionFor({ allocation: a, decision: 'rejected' });
                                setDecisionComments('');
                              }}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {a.status === 'dept_head_approved' && (
                          <button
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Issue asset "${asset?.name || a.assetId}" to ${custodianName(a)}?`,
                                )
                              ) {
                                issueMutation.mutate(a.id);
                              }
                            }}
                            disabled={issueMutation.isPending}
                            className="px-3 py-1 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5" />
                            Issue
                          </button>
                        )}
                        {a.status === 'allocated' && (
                          <button
                            onClick={() => {
                              setReturnFor(a);
                              setReturnDraft({
                                returnDate: new Date().toISOString().slice(0, 10),
                                conditionOnReturn: '',
                                notes: '',
                              });
                            }}
                            className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-800 inline-flex items-center gap-1"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Return
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* New Allocation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Allocation Request</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.assetId}
                  onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select an asset...</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetCode} - {a.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custodian <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.custodianId}
                  onChange={(e) => setFormData({ ...formData, custodianId: e.target.value })}
                  required
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select user...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select
                  value={formData.departmentId}
                  onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">Select department...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Return Date
                </label>
                <input
                  type="date"
                  value={formData.expectedReturnDate}
                  onChange={(e) =>
                    setFormData({ ...formData, expectedReturnDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <textarea
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Why is this allocation needed?"
                />
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate(formData)}
                disabled={
                  !formData.assetId || !formData.custodianId || createMutation.isPending
                }
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve / Reject Modal */}
      {decisionFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {decisionFor.decision === 'approved' ? 'Approve' : 'Reject'} Allocation
              </h2>
              <button
                onClick={() => {
                  setDecisionFor(null);
                  setDecisionComments('');
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div>
                  <span className="text-gray-500">Allocation:</span>{' '}
                  <span className="font-medium">{decisionFor.allocation.allocationNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500">Custodian:</span>{' '}
                  {custodianName(decisionFor.allocation)}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Comments</label>
                <textarea
                  rows={3}
                  value={decisionComments}
                  onChange={(e) => setDecisionComments(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="Optional comments"
                />
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => {
                  setDecisionFor(null);
                  setDecisionComments('');
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  approveMutation.mutate({
                    id: decisionFor.allocation.id,
                    decision: decisionFor.decision,
                    comments: decisionComments || undefined,
                  })
                }
                disabled={approveMutation.isPending}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 inline-flex items-center gap-2 ${
                  decisionFor.decision === 'approved'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {approveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm {decisionFor.decision === 'approved' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      {returnFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Return Asset</h2>
              <button
                onClick={() => setReturnFor(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded p-3 text-sm">
                <div>
                  <span className="text-gray-500">Allocation:</span>{' '}
                  <span className="font-medium">{returnFor.allocationNumber}</span>
                </div>
                <div>
                  <span className="text-gray-500">Custodian:</span> {custodianName(returnFor)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={returnDraft.returnDate}
                  onChange={(e) =>
                    setReturnDraft({ ...returnDraft, returnDate: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition on Return
                </label>
                <input
                  type="text"
                  value={returnDraft.conditionOnReturn}
                  onChange={(e) =>
                    setReturnDraft({ ...returnDraft, conditionOnReturn: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="e.g. Good, working order"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={returnDraft.notes}
                  onChange={(e) => setReturnDraft({ ...returnDraft, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setReturnFor(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  returnMutation.mutate({
                    id: returnFor.id,
                    returnDate: returnDraft.returnDate,
                    conditionOnReturn: returnDraft.conditionOnReturn,
                    notes: returnDraft.notes,
                  })
                }
                disabled={!returnDraft.returnDate || returnMutation.isPending}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {returnMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
