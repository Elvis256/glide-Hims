import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Trash2,
  Search,
  Plus,
  Calendar,
  Package,
  AlertTriangle,
  Clock,
  CheckCircle,
  X,
  Download,
  RefreshCw,
  Loader2,
  User,
  FileText,
} from 'lucide-react';
import { storesService, type InventoryItem } from '../../services';
import { formatCurrency, CURRENCY_SYMBOL } from '../../lib/currency';

// Types for disposal management
interface DisposalLog {
  id: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  quantity: number;
  unit: string;
  reason: 'expired' | 'damaged' | 'obsolete';
  disposalDate: string;
  disposedBy: string;
  value: number;
  notes?: string;
  status: 'pending' | 'approved' | 'completed';
}

interface CreateDisposalDto {
  itemId: string;
  quantity: number;
  reason: 'expired' | 'damaged' | 'obsolete';
  notes?: string;
}

// Placeholder disposal service methods (to be implemented in stores.ts if needed)
const disposalService = {
  list: async (): Promise<DisposalLog[]> => {
    // This would call the API endpoint when available
    return [];
  },
  create: async (data: CreateDisposalDto): Promise<DisposalLog> => {
    // This would call the API endpoint when available
    return {
      id: Date.now().toString(),
      itemId: data.itemId,
      itemName: '',
      itemSku: '',
      quantity: data.quantity,
      unit: 'units',
      reason: data.reason,
      disposalDate: new Date().toISOString(),
      disposedBy: 'Current User',
      value: 0,
      notes: data.notes,
      status: 'pending',
    };
  },
};

export default function StoresDisposalPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [reasonFilter, setReasonFilter] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state for create modal
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [reason, setReason] = useState<'expired' | 'damaged' | 'obsolete'>('expired');
  const [notes, setNotes] = useState('');

  // Fetch disposal logs
  const { data: disposalLogs = [], isLoading, refetch } = useQuery({
    queryKey: ['disposals'],
    queryFn: disposalService.list,
    staleTime: 30000,
  });

  // Fetch inventory items for the create modal dropdown
  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-for-disposal'],
    queryFn: () => storesService.inventory.list({ limit: 1000 }),
    staleTime: 60000,
  });

  const inventoryItems: InventoryItem[] = inventoryData?.data || [];

  // Create disposal mutation
  const createDisposalMutation = useMutation({
    mutationFn: disposalService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['disposals'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      resetForm();
      setShowCreateModal(false);
    },
  });

  const resetForm = () => {
    setSelectedItemId('');
    setQuantity(1);
    setReason('expired');
    setNotes('');
  };

  const handleCreateDisposal = () => {
    if (!selectedItemId || quantity <= 0) return;
    createDisposalMutation.mutate({
      itemId: selectedItemId,
      quantity,
      reason,
      notes: notes || undefined,
    });
  };

  // Filter disposal logs
  const filteredLogs = useMemo(() => {
    return disposalLogs.filter((log) => {
      const matchesSearch =
        log.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.itemSku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesReason = reasonFilter === 'all' || log.reason === reasonFilter;
      return matchesSearch && matchesReason;
    });
  }, [disposalLogs, searchTerm, reasonFilter]);

  // Summary stats
  const totalDisposed = disposalLogs.length;
  const expiredCount = disposalLogs.filter((d) => d.reason === 'expired').length;
  const damagedCount = disposalLogs.filter((d) => d.reason === 'damaged').length;
  const totalValue = disposalLogs.reduce((sum, d) => sum + d.value, 0);

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'expired':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 text-red-700">
            <Clock className="w-3 h-3" />
            Expired
          </span>
        );
      case 'damaged':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-700">
            <AlertTriangle className="w-3 h-3" />
            Damaged
          </span>
        );
      case 'obsolete':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700">
            <Package className="w-3 h-3" />
            Obsolete
          </span>
        );
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-700">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700">
            <CheckCircle className="w-3 h-3" />
            Approved
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disposal Management</h1>
          <p className="text-gray-600">Manage disposal of expired, damaged, or obsolete inventory items</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export Report
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <Plus className="w-4 h-4" />
            Create Disposal
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Disposed</p>
              <p className="text-2xl font-bold text-gray-900">{totalDisposed}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Trash2 className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Expired Items</p>
              <p className="text-2xl font-bold text-red-700">{expiredCount}</p>
            </div>
            <div className="p-3 bg-red-100 rounded-lg">
              <Clock className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600">Damaged Items</p>
              <p className="text-2xl font-bold text-orange-700">{damagedCount}</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Value Lost ({CURRENCY_SYMBOL})</p>
              <p className="text-2xl font-bold text-gray-900">{totalValue.toLocaleString()}</p>
            </div>
            <div className="p-3 bg-gray-100 rounded-lg">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by item name or SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={reasonFilter}
          onChange={(e) => setReasonFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Reasons</option>
          <option value="expired">Expired</option>
          <option value="damaged">Damaged</option>
          <option value="obsolete">Obsolete</option>
        </select>
      </div>

      {/* Disposal Log Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item Details</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reason</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Disposal Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Disposed By</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Value ({CURRENCY_SYMBOL})</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin text-gray-400 mb-2" />
                    <p>Loading disposal records...</p>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <Trash2 className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="font-medium">No disposal records</p>
                    <p className="text-sm">Disposal entries will appear here once created</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900">{log.itemName}</p>
                        <p className="text-sm text-gray-500">SKU: {log.itemSku}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {log.quantity} {log.unit}
                    </td>
                    <td className="px-4 py-3">{getReasonBadge(log.reason)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {new Date(log.disposalDate).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-gray-600">
                        <User className="w-3 h-3" />
                        {log.disposedBy}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatCurrency(log.value)}</td>
                    <td className="px-4 py-3">{getStatusBadge(log.status)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredLogs.length} disposal records
        </div>
      </div>

      {/* Create Disposal Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Create Disposal Entry</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Item Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Item <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select an item --</option>
                  {inventoryItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (SKU: {item.sku}) - Stock: {item.currentStock} {item.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Quantity <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as 'expired' | 'damaged' | 'obsolete')}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="expired">Expired</option>
                  <option value="damaged">Damaged</option>
                  <option value="obsolete">Obsolete</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Additional notes about the disposal..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
                className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDisposal}
                disabled={!selectedItemId || quantity <= 0 || createDisposalMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createDisposalMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Create Disposal
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
