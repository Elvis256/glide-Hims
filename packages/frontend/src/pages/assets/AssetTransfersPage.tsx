import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Loader2,
  Eye,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  Calendar,
  X,
} from 'lucide-react';
import { useFacilityId } from '../../lib/facility';
import { useAuthStore } from '../../store/auth';
import assetsService from '../../services/assets';
import type {
  AssetTransfer,
  AssetTransferApproval,
  TransferStage,
} from '../../services/assets';
import facilitiesService from '../../services/facilities';
import api from '../../services/api';

interface UserLite {
  id: string;
  fullName: string;
  departmentId?: string;
}

const STATUS_OPTIONS = ['All', 'pending', 'in_progress', 'in_transit', 'approved', 'completed', 'rejected', 'cancelled'];

const STAGE_ORDER: TransferStage[] = ['origin_dept_head', 'receiving_dept_head', 'store_keeper'];
const STAGE_LABEL: Record<TransferStage, string> = {
  origin_dept_head: 'Origin Department Head',
  receiving_dept_head: 'Receiving Department Head',
  store_keeper: 'Store Keeper',
};

export default function AssetTransfersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore.getState().user?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<AssetTransfer | null>(null);
  const [completeFor, setCompleteFor] = useState<AssetTransfer | null>(null);

  const [stageDraft, setStageDraft] = useState<{
    transferId: string;
    stage: TransferStage;
    decision: 'approved' | 'rejected';
    comments: string;
  } | null>(null);

  const [completeDraft, setCompleteDraft] = useState({ conditionOnReceipt: '', notes: '' });

  const [formData, setFormData] = useState({
    assetId: '',
    toFacilityId: '',
    toDepartmentId: '',
    toCustodianId: '',
    transferDate: new Date().toISOString().slice(0, 10),
    reason: '',
  });

  const resetForm = () =>
    setFormData({
      assetId: '',
      toFacilityId: facilityId || '',
      toDepartmentId: '',
      toCustodianId: '',
      transferDate: new Date().toISOString().slice(0, 10),
      reason: '',
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

  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['asset-transfers', facilityId, selectedStatus],
    queryFn: () =>
      assetsService.listTransfers(
        facilityId,
        selectedStatus !== 'All' ? selectedStatus : undefined,
      ),
    enabled: !!facilityId,
  });

  const departmentName = (id?: string) =>
    (id && departments.find((d) => d.id === id)?.name) || '—';

  const userName = (id?: string) =>
    (id && users.find((u) => u.id === id)?.fullName) || id || '—';

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => {
      const asset = assets.find((a) => a.id === data.assetId);
      return assetsService.initiateTransfer(data.assetId, {
        toFacilityId: data.toFacilityId || facilityId,
        toDepartmentId: data.toDepartmentId || undefined,
        toCustodianId: data.toCustodianId || undefined,
        transferDate: data.transferDate,
        reason: data.reason || undefined,
        fromDepartmentId: asset?.departmentId,
      });
    },
    onSuccess: () => {
      toast.success('Transfer initiated');
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      setShowCreateModal(false);
      resetForm();
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to initiate transfer'),
  });

  const approveMutation = useMutation({
    mutationFn: (input: {
      transferId: string;
      stage: TransferStage;
      decision: 'approved' | 'rejected';
      comments?: string;
    }) =>
      assetsService.approveTransferStage(input.transferId, {
        stage: input.stage,
        decision: input.decision,
        comments: input.comments,
      }),
    onSuccess: (updated) => {
      toast.success('Approval recorded');
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      setStageDraft(null);
      if (selectedTransfer && updated && updated.id === selectedTransfer.id) {
        setSelectedTransfer(updated);
      }
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to record decision'),
  });

  const completeMutation = useMutation({
    mutationFn: (input: { id: string; conditionOnReceipt?: string; notes?: string }) =>
      assetsService.completeTransfer(input.id, {
        receivedBy: currentUserId,
        conditionOnReceipt: input.conditionOnReceipt || undefined,
        notes: input.notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Transfer completed');
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      setCompleteFor(null);
      setCompleteDraft({ conditionOnReceipt: '', notes: '' });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || 'Failed to complete transfer'),
  });

  const filteredTransfers = useMemo(
    () =>
      transfers.filter((t) => {
        const asset = t.asset || assets.find((a) => a.id === t.assetId);
        const term = searchTerm.toLowerCase();
        const matchesSearch =
          !term ||
          (asset?.name || '').toLowerCase().includes(term) ||
          (asset?.assetCode || '').toLowerCase().includes(term) ||
          (t.transferNumber || '').toLowerCase().includes(term);
        const matchesDept =
          selectedDepartmentId === 'All' ||
          t.fromDepartmentId === selectedDepartmentId ||
          t.toDepartmentId === selectedDepartmentId;
        const matchesStatus = selectedStatus === 'All' || t.status === selectedStatus;
        return matchesSearch && matchesDept && matchesStatus;
      }),
    [transfers, assets, searchTerm, selectedDepartmentId, selectedStatus],
  );

  const getStatusBadge = (status: string) => {
    const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
      pending: {
        cls: 'bg-yellow-100 text-yellow-700',
        icon: <Clock className="w-3 h-3" />,
        label: 'Pending',
      },
      in_progress: {
        cls: 'bg-amber-100 text-amber-700',
        icon: <Clock className="w-3 h-3" />,
        label: 'In Progress',
      },
      approved: {
        cls: 'bg-blue-100 text-blue-700',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Approved',
      },
      in_transit: {
        cls: 'bg-purple-100 text-purple-700',
        icon: <ArrowRightLeft className="w-3 h-3" />,
        label: 'In Transit',
      },
      completed: {
        cls: 'bg-green-100 text-green-700',
        icon: <CheckCircle className="w-3 h-3" />,
        label: 'Completed',
      },
      rejected: {
        cls: 'bg-red-100 text-red-700',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Rejected',
      },
      cancelled: {
        cls: 'bg-gray-100 text-gray-700',
        icon: <XCircle className="w-3 h-3" />,
        label: 'Cancelled',
      },
    };
    const entry = map[status];
    if (!entry) {
      return (
        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full capitalize">
          {status.replace(/_/g, ' ')}
        </span>
      );
    }
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${entry.cls}`}
      >
        {entry.icon} {entry.label}
      </span>
    );
  };

  const decisionBadge = (decision: AssetTransferApproval['decision']) => {
    if (decision === 'approved')
      return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Approved</span>;
    if (decision === 'rejected')
      return <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Rejected</span>;
    return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">Pending</span>;
  };

  const pendingCount = transfers.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;
  const inTransitCount = transfers.filter((t) => t.status === 'in_transit').length;
  const completedCount = transfers.filter((t) => t.status === 'completed').length;

  const allApproved = (t: AssetTransfer) =>
    !!t.approvals && t.approvals.length > 0 && t.approvals.every((a) => a.decision === 'approved');
  const canComplete = (t: AssetTransfer) =>
    (t.status === 'in_transit' || t.status === 'approved' || t.status === 'in_progress') &&
    allApproved(t);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Transfers</h1>
          <p className="text-gray-600">Track and manage asset transfers between departments</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Transfers</p>
              <p className="text-xl font-bold text-gray-900">{transfers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Approval</p>
              <p className="text-xl font-bold text-yellow-600">{pendingCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ArrowRightLeft className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Transit</p>
              <p className="text-xl font-bold text-purple-600">{inTransitCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-bold text-green-600">{completedCount}</p>
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
              placeholder="Search by transfer number, asset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            <Filter className="w-4 h-4" />
            Filters
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {showFilters && (
          <div className="p-4 bg-gray-50 border-b flex flex-wrap gap-4">
            <select
              value={selectedDepartmentId}
              onChange={(e) => setSelectedDepartmentId(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Statuses' : s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Transfers List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredTransfers.length > 0 ? (
          <div className="divide-y">
            {filteredTransfers.map((transfer) => {
              const asset = transfer.asset || assets.find((a) => a.id === transfer.assetId);
              return (
                <div key={transfer.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-medium text-gray-900">
                          {transfer.transferNumber || `TRF-${transfer.id.slice(0, 8).toUpperCase()}`}
                        </span>
                        {getStatusBadge(transfer.status)}
                      </div>
                      <p className="text-sm text-gray-700 mb-2">
                        <span className="font-medium">{asset?.name || 'Unknown Asset'}</span>
                        <span className="text-gray-500"> ({asset?.assetCode || 'N/A'})</span>
                      </p>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {departmentName(transfer.fromDepartmentId)}
                        </span>
                        <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                        <span className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          {departmentName(transfer.toDepartmentId)}
                        </span>
                      </div>
                      {transfer.reason && (
                        <p className="mt-2 text-sm text-gray-600">
                          <span className="text-gray-500">Reason:</span> {transfer.reason}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {transfer.transferDate
                            ? format(new Date(transfer.transferDate), 'PP')
                            : transfer.createdAt
                              ? format(new Date(transfer.createdAt), 'PP')
                              : 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedTransfer(transfer)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                        title="View Details"
                      >
                        <Eye className="w-5 h-5 text-gray-500" />
                      </button>
                      {canComplete(transfer) && (
                        <button
                          onClick={() => {
                            setCompleteFor(transfer);
                            setCompleteDraft({ conditionOnReceipt: '', notes: '' });
                          }}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <ArrowRightLeft className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No transfers found</p>
          </div>
        )}
      </div>

      {/* New Transfer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">New Asset Transfer</h2>
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
                  Select Asset <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.assetId}
                  onChange={(e) => setFormData({ ...formData, assetId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">To Facility</label>
                <input
                  type="text"
                  value={formData.toFacilityId || facilityId}
                  onChange={(e) => setFormData({ ...formData, toFacilityId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  placeholder="Facility ID"
                />
                <p className="text-xs text-gray-500 mt-1">Defaults to current facility.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.toDepartmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, toDepartmentId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Custodian
                  </label>
                  <select
                    value={formData.toCustodianId}
                    onChange={(e) =>
                      setFormData({ ...formData, toCustodianId: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transfer Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.transferDate}
                  onChange={(e) => setFormData({ ...formData, transferDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Explain why this transfer is needed..."
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
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
                  !formData.assetId ||
                  !formData.toDepartmentId ||
                  !formData.transferDate ||
                  createMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Details Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedTransfer.transferNumber ||
                    `TRF-${selectedTransfer.id.slice(0, 8).toUpperCase()}`}
                </h2>
                <div className="mt-1">{getStatusBadge(selectedTransfer.status)}</div>
              </div>
              <button
                onClick={() => {
                  setSelectedTransfer(null);
                  setStageDraft(null);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Asset</p>
                <p className="font-medium">
                  {(selectedTransfer.asset ||
                    assets.find((a) => a.id === selectedTransfer.assetId))?.name || 'Unknown'}{' '}
                  <span className="text-gray-500 text-sm">
                    (
                    {(selectedTransfer.asset ||
                      assets.find((a) => a.id === selectedTransfer.assetId))?.assetCode || 'N/A'}
                    )
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">From Department</p>
                  <p className="font-medium">{departmentName(selectedTransfer.fromDepartmentId)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">To Department</p>
                  <p className="font-medium">{departmentName(selectedTransfer.toDepartmentId)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Transfer Date</p>
                  <p className="font-medium">
                    {selectedTransfer.transferDate
                      ? format(new Date(selectedTransfer.transferDate), 'PP')
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Custodian</p>
                  <p className="font-medium">{userName(selectedTransfer.toCustodianId)}</p>
                </div>
              </div>

              {selectedTransfer.reason && (
                <div>
                  <p className="text-sm text-gray-500">Reason</p>
                  <p className="text-gray-700">{selectedTransfer.reason}</p>
                </div>
              )}

              {/* Approval Timeline */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Approvals</p>
                <div className="space-y-3">
                  {STAGE_ORDER.map((stage) => {
                    const approval = selectedTransfer.approvals?.find((a) => a.stage === stage);
                    const decision = approval?.decision || 'pending';
                    return (
                      <div key={stage} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-gray-800">{STAGE_LABEL[stage]}</div>
                          {decisionBadge(decision)}
                        </div>
                        {approval && (
                          <div className="mt-2 text-xs text-gray-500 grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-gray-400">Decided by:</span>{' '}
                              {approval.decidedBy ? userName(approval.decidedBy) : '—'}
                            </div>
                            <div>
                              <span className="text-gray-400">When:</span>{' '}
                              {approval.decidedAt
                                ? format(new Date(approval.decidedAt), 'PPp')
                                : '—'}
                            </div>
                            {approval.comments && (
                              <div className="col-span-2">
                                <span className="text-gray-400">Comments:</span>{' '}
                                {approval.comments}
                              </div>
                            )}
                          </div>
                        )}
                        {decision === 'pending' && (
                          <div className="mt-3">
                            {stageDraft &&
                            stageDraft.transferId === selectedTransfer.id &&
                            stageDraft.stage === stage ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={2}
                                  value={stageDraft.comments}
                                  onChange={(e) =>
                                    setStageDraft({ ...stageDraft, comments: e.target.value })
                                  }
                                  placeholder="Comments (optional)"
                                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                                />
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => setStageDraft(null)}
                                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() =>
                                      approveMutation.mutate({
                                        transferId: selectedTransfer.id,
                                        stage,
                                        decision: stageDraft.decision,
                                        comments: stageDraft.comments || undefined,
                                      })
                                    }
                                    disabled={approveMutation.isPending}
                                    className={`px-3 py-1 text-sm text-white rounded ${
                                      stageDraft.decision === 'approved'
                                        ? 'bg-green-600 hover:bg-green-700'
                                        : 'bg-red-600 hover:bg-red-700'
                                    } disabled:opacity-50`}
                                  >
                                    Confirm{' '}
                                    {stageDraft.decision === 'approved' ? 'Approve' : 'Reject'}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() =>
                                    setStageDraft({
                                      transferId: selectedTransfer.id,
                                      stage,
                                      decision: 'approved',
                                      comments: '',
                                    })
                                  }
                                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() =>
                                    setStageDraft({
                                      transferId: selectedTransfer.id,
                                      stage,
                                      decision: 'rejected',
                                      comments: '',
                                    })
                                  }
                                  className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="p-6 border-t flex justify-between">
              {canComplete(selectedTransfer) ? (
                <button
                  onClick={() => {
                    setCompleteFor(selectedTransfer);
                    setCompleteDraft({ conditionOnReceipt: '', notes: '' });
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Complete Transfer
                </button>
              ) : (
                <span />
              )}
              <button
                onClick={() => {
                  setSelectedTransfer(null);
                  setStageDraft(null);
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Complete Transfer Modal */}
      {completeFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Complete Transfer</h2>
              <button
                onClick={() => setCompleteFor(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Condition on Receipt
                </label>
                <input
                  type="text"
                  value={completeDraft.conditionOnReceipt}
                  onChange={(e) =>
                    setCompleteDraft({ ...completeDraft, conditionOnReceipt: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. Good, working order"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={completeDraft.notes}
                  onChange={(e) => setCompleteDraft({ ...completeDraft, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => setCompleteFor(null)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  completeMutation.mutate({
                    id: completeFor.id,
                    conditionOnReceipt: completeDraft.conditionOnReceipt,
                    notes: completeDraft.notes,
                  })
                }
                disabled={completeMutation.isPending}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {completeMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Complete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
