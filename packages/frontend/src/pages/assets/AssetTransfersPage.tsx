import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useFacilityId } from '../../lib/facility';
import assetsService from '../../services/assets';
import type { FixedAsset, AssetTransfer } from '../../services/assets';
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
  MapPin,
  Calendar,
  User,
  FileText,
} from 'lucide-react';

const departments = ['All', 'Radiology', 'Maternity', 'ICU', 'Emergency', 'OPD', 'Laboratory', 'Pharmacy', 'Administration'];
const statuses = ['All', 'pending', 'approved', 'in_transit', 'completed', 'rejected'];

export default function AssetTransfersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<AssetTransfer | null>(null);

  const [formData, setFormData] = useState({
    assetId: '',
    fromDepartment: '',
    fromLocation: '',
    toDepartment: '',
    toLocation: '',
    reason: '',
  });

  // Get assets for dropdown
  const { data: assets = [] } = useQuery({
    queryKey: ['assets', facilityId],
    queryFn: () => assetsService.list(facilityId, {}),
    enabled: !!facilityId,
  });

  // Get transfers
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['asset-transfers', facilityId, selectedStatus],
    queryFn: () => assetsService.getTransfers(facilityId, selectedStatus !== 'All' ? selectedStatus : undefined),
    enabled: !!facilityId,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<AssetTransfer>) => assetsService.initiateTransfer(data),
    onSuccess: () => {
      toast.success('Transfer initiated successfully');
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      setShowModal(false);
      resetForm();
    },
    onError: () => toast.error('Failed to initiate transfer'),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => assetsService.approveTransfer(id),
    onSuccess: () => {
      toast.success('Transfer approved');
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
    },
    onError: () => toast.error('Failed to approve transfer'),
  });

  const completeMutation = useMutation({
    mutationFn: (id: string) => assetsService.completeTransfer(id),
    onSuccess: () => {
      toast.success('Transfer completed');
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
    },
    onError: () => toast.error('Failed to complete transfer'),
  });

  const resetForm = () => {
    setFormData({
      assetId: '',
      fromDepartment: '',
      fromLocation: '',
      toDepartment: '',
      toLocation: '',
      reason: '',
    });
  };

  const filteredTransfers = transfers.filter((t) => {
    const asset = assets.find(a => a.id === t.assetId);
    const assetName = asset?.name || '';
    const assetCode = asset?.assetCode || '';
    const matchesSearch =
      assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      assetCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment =
      selectedDepartment === 'All' ||
      t.fromDepartment === selectedDepartment ||
      t.toDepartment === selectedDepartment;
    const matchesStatus = selectedStatus === 'All' || t.status === selectedStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'in_transit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
            <ArrowRightLeft className="w-3 h-3" /> In Transit
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Completed
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full capitalize">{status}</span>;
    }
  };

  const pendingCount = transfers.filter((t) => t.status === 'pending').length;
  const inTransitCount = transfers.filter((t) => t.status === 'in_transit').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Transfers</h1>
          <p className="text-gray-600">Track and manage asset transfers between departments</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
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
              <p className="text-xl font-bold text-green-600">
                {transfers.filter((t) => t.status === 'completed').length}
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
              placeholder="Search by transfer number, asset..."
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
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept === 'All' ? 'All Departments' : dept}
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
                  {status === 'All' ? 'All Statuses' : status.replace('_', ' ')}
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
              const asset = assets.find(a => a.id === transfer.assetId);
              return (
              <div key={transfer.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">TRF-{transfer.id.slice(0, 8).toUpperCase()}</span>
                      {getStatusBadge(transfer.status)}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">{asset?.name || 'Unknown Asset'}</span>
                      <span className="text-gray-500"> ({asset?.assetCode || 'N/A'})</span>
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {transfer.fromDepartment || 'N/A'}
                      </span>
                      <ArrowRightLeft className="w-4 h-4 text-gray-400" />
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {transfer.toDepartment || 'N/A'}
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
                        {transfer.createdAt ? new Date(transfer.createdAt).toLocaleDateString() : 'N/A'}
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
                    {transfer.status === 'pending' && (
                      <button
                        onClick={() => approveMutation.mutate(transfer.id)}
                        disabled={approveMutation.isPending}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Approve
                      </button>
                    )}
                    {(transfer.status === 'approved' || transfer.status === 'in_transit') && (
                      <button
                        onClick={() => completeMutation.mutate(transfer.id)}
                        disabled={completeMutation.isPending}
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
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">New Asset Transfer</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Asset <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.assetId}
                  onChange={(e) => {
                    const asset = assets.find(a => a.id === e.target.value);
                    setFormData({ 
                      ...formData, 
                      assetId: e.target.value,
                      fromDepartment: asset?.department || '',
                      fromLocation: asset?.location || '',
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select an asset...</option>
                  {assets.map(a => (
                    <option key={a.id} value={a.id}>{a.assetCode} - {a.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.fromDepartment}
                    onChange={(e) => setFormData({ ...formData, fromDepartment: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {departments.filter((d) => d !== 'All').map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    From Location
                  </label>
                  <input
                    type="text"
                    value={formData.fromLocation}
                    onChange={(e) => setFormData({ ...formData, fromLocation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Department <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.toDepartment}
                    onChange={(e) => setFormData({ ...formData, toDepartment: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {departments.filter((d) => d !== 'All').map((dept) => (
                      <option key={dept} value={dept}>
                        {dept}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    To Location
                  </label>
                  <input
                    type="text"
                    value={formData.toLocation}
                    onChange={(e) => setFormData({ ...formData, toLocation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Transfer <span className="text-red-500">*</span>
                </label>
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
                  setShowModal(false);
                  resetForm();
                }}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate({
                  assetId: formData.assetId,
                  facilityId,
                  fromDepartment: formData.fromDepartment,
                  fromLocation: formData.fromLocation,
                  toDepartment: formData.toDepartment,
                  toLocation: formData.toLocation,
                  reason: formData.reason,
                })}
                disabled={
                  !formData.assetId ||
                  !formData.fromDepartment ||
                  !formData.toDepartment ||
                  !formData.reason ||
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
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">TRF-{selectedTransfer.id.slice(0, 8).toUpperCase()}</h2>
              {getStatusBadge(selectedTransfer.status)}
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Asset</p>
                <p className="font-medium">{assets.find(a => a.id === selectedTransfer.assetId)?.name || 'Unknown'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">From</p>
                  <p className="font-medium">{selectedTransfer.fromDepartment || 'N/A'}</p>
                  <p className="text-sm text-gray-600">{selectedTransfer.fromLocation || ''}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">To</p>
                  <p className="font-medium">{selectedTransfer.toDepartment || 'N/A'}</p>
                  <p className="text-sm text-gray-600">{selectedTransfer.toLocation || ''}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Reason</p>
                <p className="text-gray-700">{selectedTransfer.reason || 'N/A'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Created</p>
                  <p className="text-gray-500">{selectedTransfer.createdAt ? new Date(selectedTransfer.createdAt).toLocaleDateString() : 'N/A'}</p>
                </div>
                {selectedTransfer.approvedAt && (
                  <div>
                    <p className="text-gray-500">Approved</p>
                    <p className="text-gray-500">{new Date(selectedTransfer.approvedAt).toLocaleDateString()}</p>
                  </div>
                )}
                {selectedTransfer.completedAt && (
                  <div>
                    <p className="text-gray-500">Completed</p>
                    <p className="text-gray-500">{new Date(selectedTransfer.completedAt).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {selectedTransfer.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-700">{selectedTransfer.notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setSelectedTransfer(null)}
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
