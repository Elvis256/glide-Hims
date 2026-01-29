import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
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
  DollarSign,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface AssetDisposal {
  id: string;
  disposalNumber: string;
  assetCode: string;
  assetName: string;
  category: string;
  department: string;
  purchaseDate: string;
  purchaseCost: number;
  currentValue: number;
  disposalMethod: 'SALE' | 'SCRAP' | 'DONATION' | 'TRADE_IN' | 'WRITE_OFF';
  disposalValue: number;
  reason: string;
  requestedBy: string;
  requestedDate: string;
  approvedBy?: string;
  approvedDate?: string;
  disposalDate?: string;
  status: 'PENDING' | 'APPROVED' | 'COMPLETED' | 'REJECTED';
  notes?: string;
  buyer?: string;
}

// Empty data - to be populated from API
const mockDisposals: AssetDisposal[] = [];

const methods = ['All', 'SALE', 'SCRAP', 'DONATION', 'TRADE_IN', 'WRITE_OFF'];
const statuses = ['All', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED'];
const categories = ['Vehicles', 'Medical Equipment', 'IT Equipment', 'Lab Equipment', 'Furniture', 'Building'];

export default function AssetDisposalPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedDisposal, setSelectedDisposal] = useState<AssetDisposal | null>(null);

  const [formData, setFormData] = useState({
    assetCode: '',
    assetName: '',
    category: '',
    department: '',
    purchaseCost: 0,
    currentValue: 0,
    disposalMethod: 'SALE' as const,
    disposalValue: 0,
    reason: '',
    buyer: '',
  });

  const { data: disposals, isLoading } = useQuery({
    queryKey: ['asset-disposals', selectedMethod, selectedStatus],
    queryFn: async () => mockDisposals,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-disposals'] });
      setShowModal(false);
      resetForm();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-disposals'] });
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-disposals'] });
    },
  });

  const resetForm = () => {
    setFormData({
      assetCode: '',
      assetName: '',
      category: '',
      department: '',
      purchaseCost: 0,
      currentValue: 0,
      disposalMethod: 'SALE',
      disposalValue: 0,
      reason: '',
      buyer: '',
    });
  };

  const filteredDisposals = disposals?.filter((d) => {
    const matchesSearch =
      d.assetName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.disposalNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.assetCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMethod = selectedMethod === 'All' || d.disposalMethod === selectedMethod;
    const matchesStatus = selectedStatus === 'All' || d.status === selectedStatus;
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
            <Clock className="w-3 h-3" /> Pending
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Approved
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
            <CheckCircle className="w-3 h-3" /> Completed
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

  const getMethodBadge = (method: string) => {
    const colors: Record<string, string> = {
      SALE: 'bg-green-100 text-green-700',
      SCRAP: 'bg-gray-100 text-gray-700',
      DONATION: 'bg-blue-100 text-blue-700',
      TRADE_IN: 'bg-purple-100 text-purple-700',
      WRITE_OFF: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded ${colors[method] || 'bg-gray-100'}`}>
        {method.replace('_', ' ')}
      </span>
    );
  };

  const pendingCount = disposals?.filter((d) => d.status === 'PENDING').length || 0;
  const totalDisposalValue = disposals?.filter((d) => d.status === 'COMPLETED').reduce((sum, d) => sum + d.disposalValue, 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Asset Disposal</h1>
          <p className="text-gray-600">Manage asset disposal requests and tracking</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Disposal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Disposals</p>
              <p className="text-xl font-bold text-gray-900">{disposals?.length || 0}</p>
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
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-xl font-bold text-green-600">
                {disposals?.filter((d) => d.status === 'COMPLETED').length || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Recovered</p>
              <p className="text-lg font-bold text-purple-600">{formatCurrency(totalDisposalValue)}</p>
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
              placeholder="Search by disposal number, asset..."
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
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {methods.map((method) => (
                <option key={method} value={method}>
                  {method === 'All' ? 'All Methods' : method.replace('_', ' ')}
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

        {/* Disposals List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredDisposals && filteredDisposals.length > 0 ? (
          <div className="divide-y">
            {filteredDisposals.map((disposal) => (
              <div key={disposal.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{disposal.disposalNumber}</span>
                      {getStatusBadge(disposal.status)}
                      {getMethodBadge(disposal.disposalMethod)}
                    </div>
                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">{disposal.assetName}</span>
                      <span className="text-gray-500"> ({disposal.assetCode})</span>
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-4 h-4" />
                        {disposal.department}
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Book Value: {formatCurrency(disposal.currentValue)}
                      </span>
                      {disposal.disposalValue > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <DollarSign className="w-4 h-4" />
                          Disposal: {formatCurrency(disposal.disposalValue)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{disposal.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedDisposal(disposal)}
                      className="p-2 hover:bg-gray-100 rounded-lg"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5 text-gray-500" />
                    </button>
                    {disposal.status === 'PENDING' && (
                      <button
                        onClick={() => approveMutation.mutate(disposal.id)}
                        disabled={approveMutation.isPending}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                      >
                        Approve
                      </button>
                    )}
                    {disposal.status === 'APPROVED' && (
                      <button
                        onClick={() => completeMutation.mutate(disposal.id)}
                        disabled={completeMutation.isPending}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Trash2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No disposal records found</p>
          </div>
        )}
      </div>

      {/* New Disposal Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">New Asset Disposal</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Asset Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.assetCode}
                    onChange={(e) => setFormData({ ...formData, assetCode: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select...</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.assetName}
                  onChange={(e) => setFormData({ ...formData, assetName: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Purchase Cost
                  </label>
                  <input
                    type="number"
                    value={formData.purchaseCost}
                    onChange={(e) => setFormData({ ...formData, purchaseCost: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current Book Value
                  </label>
                  <input
                    type="number"
                    value={formData.currentValue}
                    onChange={(e) => setFormData({ ...formData, currentValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disposal Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.disposalMethod}
                    onChange={(e) => setFormData({ ...formData, disposalMethod: e.target.value as any })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="SALE">Sale</option>
                    <option value="SCRAP">Scrap</option>
                    <option value="DONATION">Donation</option>
                    <option value="TRADE_IN">Trade-In</option>
                    <option value="WRITE_OFF">Write-Off</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Disposal Value
                  </label>
                  <input
                    type="number"
                    value={formData.disposalValue}
                    onChange={(e) => setFormData({ ...formData, disposalValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {formData.disposalMethod === 'SALE' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Buyer
                  </label>
                  <input
                    type="text"
                    value={formData.buyer}
                    onChange={(e) => setFormData({ ...formData, buyer: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason for Disposal <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {formData.currentValue > formData.disposalValue && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium">Potential Loss</p>
                    <p>Disposal value is less than book value. Loss: {formatCurrency(formData.currentValue - formData.disposalValue)}</p>
                  </div>
                </div>
              )}
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
                onClick={() => createMutation.mutate(formData)}
                disabled={
                  !formData.assetCode ||
                  !formData.assetName ||
                  !formData.reason ||
                  createMutation.isPending
                }
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disposal Details Modal */}
      {selectedDisposal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{selectedDisposal.disposalNumber}</h2>
              <div className="flex items-center gap-2">
                {getMethodBadge(selectedDisposal.disposalMethod)}
                {getStatusBadge(selectedDisposal.status)}
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500">Asset</p>
                <p className="font-medium">{selectedDisposal.assetName}</p>
                <p className="text-sm text-gray-600">{selectedDisposal.assetCode} • {selectedDisposal.category}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Purchase Cost</p>
                  <p className="font-medium">{formatCurrency(selectedDisposal.purchaseCost)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Book Value</p>
                  <p className="font-medium">{formatCurrency(selectedDisposal.currentValue)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Disposal Value</p>
                  <p className="font-medium text-green-600">{formatCurrency(selectedDisposal.disposalValue)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500">Reason</p>
                <p className="text-gray-700">{selectedDisposal.reason}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Requested By</p>
                  <p className="font-medium">{selectedDisposal.requestedBy}</p>
                  <p className="text-gray-500">{new Date(selectedDisposal.requestedDate).toLocaleDateString()}</p>
                </div>
                {selectedDisposal.approvedBy && (
                  <div>
                    <p className="text-gray-500">Approved By</p>
                    <p className="font-medium">{selectedDisposal.approvedBy}</p>
                    <p className="text-gray-500">{new Date(selectedDisposal.approvedDate!).toLocaleDateString()}</p>
                  </div>
                )}
              </div>

              {selectedDisposal.buyer && (
                <div>
                  <p className="text-sm text-gray-500">Buyer</p>
                  <p className="font-medium">{selectedDisposal.buyer}</p>
                </div>
              )}

              {selectedDisposal.notes && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <p className="text-sm text-gray-500">Notes</p>
                  <p className="text-gray-700">{selectedDisposal.notes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end">
              <button
                onClick={() => setSelectedDisposal(null)}
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
