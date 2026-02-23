import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Wrench,
  Search,
  Plus,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  AlertTriangle,
  FileText,
  Eye,
  MoreVertical,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { CURRENCY_SYMBOL } from '../../lib/currency';
import { storesService } from '../../services/stores';
import { useFacilityId } from '../../lib/facility';

const adjustmentReasons = [
  { value: 'breakage', label: 'Breakage', icon: Package, color: 'text-orange-600 bg-orange-100' },
  { value: 'damage', label: 'Damage', icon: AlertTriangle, color: 'text-red-600 bg-red-100' },
  { value: 'loss', label: 'Loss', icon: Minus, color: 'text-red-600 bg-red-100' },
  { value: 'found', label: 'Found', icon: Plus, color: 'text-green-600 bg-green-100' },
  { value: 'correction', label: 'Correction', icon: RefreshCw, color: 'text-blue-600 bg-blue-100' },
  { value: 'theft', label: 'Theft', icon: XCircle, color: 'text-red-600 bg-red-100' },
];

export default function StockAdjustmentsPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewAdjustment, setShowNewAdjustment] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ itemSearch: '', itemId: '', type: '', newQty: '', reason: '' });

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock-movements', 'adjustment', facilityId],
    queryFn: () => storesService.movements.list(),
    staleTime: 30000,
  });

  const adjustments = useMemo(() => movements.filter(m => m.type === 'adjustment'), [movements]);

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-search', adjustForm.itemSearch],
    queryFn: () => storesService.items.search(adjustForm.itemSearch),
    enabled: adjustForm.itemSearch.length > 2,
    staleTime: 30000,
  });

  const adjustMutation = useMutation({
    mutationFn: ({ itemId, qty, reason }: { itemId: string; qty: number; reason: string }) =>
      storesService.movements.adjust(itemId, { quantity: qty, type: 'adjustment', reason }),
    onSuccess: () => {
      toast.success('Adjustment submitted for approval');
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      setShowNewAdjustment(false);
      setAdjustForm({ itemSearch: '', itemId: '', type: '', newQty: '', reason: '' });
    },
    onError: () => toast.error('Failed to submit adjustment'),
  });

  const filteredAdjustments = useMemo(() => {
    return adjustments.filter((adj) => {
      const matchesSearch =
        adj.itemId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (adj.reference || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [searchTerm, adjustments]);

  const stats = useMemo(() => ({
    pending: 0,
    negativeAdj: adjustments.filter((a) => a.quantity < 0).length,
    positiveAdj: adjustments.filter((a) => a.quantity > 0).length,
    totalLossValue: 0,
  }), [adjustments]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stock Adjustments</h1>
          <p className="text-gray-600">Manage stock corrections, breakage, damage, and losses</p>
        </div>
        <button
          onClick={() => setShowNewAdjustment(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Adjustment
        </button>
      </div>

      {/* Stats Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Stock Reductions</p>
              <p className="text-2xl font-bold text-red-700">{stats.negativeAdj}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <TrendingDown className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Stock Additions</p>
              <p className="text-2xl font-bold text-green-700">{stats.positiveAdj}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">MTD Loss Value ({CURRENCY_SYMBOL})</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalLossValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Reason Filters */}
      <div className="flex-shrink-0 flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Quick filter:</span>
        {adjustmentReasons.map((reason) => (
          <button
            key={reason.value}
            onClick={() => setTypeFilter(typeFilter === reason.value ? 'all' : reason.value)}
            className={`flex items-center gap-1 px-3 py-1 text-sm rounded-lg border transition-colors ${
              typeFilter === reason.value ? reason.color + ' border-current' : 'bg-white hover:bg-gray-50'
            }`}
          >
            <reason.icon className="w-3 h-3" />
            {reason.label}
          </button>
        ))}
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by adjustment number, item name, or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Adjustments Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : filteredAdjustments.length === 0 ? (
            <div className="flex-1 flex items-center justify-center h-full text-gray-500">
              <div className="text-center py-12">
                <Wrench className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <p className="text-lg font-medium">No Adjustments</p>
                <p className="text-sm">Create a new adjustment to get started</p>
              </div>
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item ID</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Performed By</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAdjustments.map((adj) => (
                <tr key={adj.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-blue-600">{adj.reference || adj.id.slice(0, 8)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{adj.itemId}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-medium ${adj.quantity < 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-gray-600 max-w-xs truncate">{adj.reason || '—'}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{adj.performedBy}</td>
                  <td className="px-4 py-3 text-gray-600">{new Date(adj.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <button className="p-1 hover:bg-gray-100 rounded" title="View">
                      <Eye className="w-4 h-4 text-gray-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredAdjustments.length} of {adjustments.length} adjustments
        </div>
      </div>

      {/* New Adjustment Modal */}
      {showNewAdjustment && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Stock Adjustment</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Item</label>
                <input
                  type="text"
                  placeholder="Search for item..."
                  value={adjustForm.itemSearch}
                  onChange={(e) => setAdjustForm({ ...adjustForm, itemSearch: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {inventoryData && inventoryData.length > 0 && (
                  <div className="mt-1 border rounded-lg bg-white shadow-sm max-h-32 overflow-auto">
                    {inventoryData.map((item) => (
                      <button
                        key={item.id}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                        onClick={() => setAdjustForm({ ...adjustForm, itemId: item.id, itemSearch: item.name })}
                      >
                        {item.name} ({item.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adjustment Type</label>
                <select
                  value={adjustForm.type}
                  onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select type</option>
                  {adjustmentReasons.map((reason) => (
                    <option key={reason.value} value={reason.value}>{reason.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
                <input
                  type="number"
                  value={adjustForm.newQty}
                  onChange={(e) => setAdjustForm({ ...adjustForm, newQty: e.target.value })}
                  placeholder="Enter new quantity"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason/Description</label>
                <textarea
                  rows={3}
                  value={adjustForm.reason}
                  onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Provide detailed reason for adjustment..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supporting Documents</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center text-gray-500">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-sm">Click to upload or drag and drop</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewAdjustment(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!adjustForm.itemId || !adjustForm.newQty || !adjustForm.reason || adjustMutation.isPending}
                onClick={() => adjustMutation.mutate({ itemId: adjustForm.itemId, qty: Number(adjustForm.newQty), reason: adjustForm.reason })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {adjustMutation.isPending ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
