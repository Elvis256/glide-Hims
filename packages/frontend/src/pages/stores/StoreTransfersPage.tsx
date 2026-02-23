import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  Search,
  Plus,
  Filter,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  ArrowRight,
  MapPin,
  Calendar,
  User,
  Eye,
  MoreVertical,
  Loader2,
} from 'lucide-react';
import { CURRENCY_SYMBOL } from '../../lib/currency';
import { storesService } from '../../services/stores';
import { useFacilityId } from '../../lib/facility';

export default function StoreTransfersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [transferForm, setTransferForm] = useState({ itemSearch: '', itemId: '', quantity: '', fromLocation: '', toLocation: '', reason: '' });

  const { data: storesList = [] } = useQuery({
    queryKey: ['stores-list'],
    queryFn: () => storesService.stores.list(),
    staleTime: 60000,
  });

  const storeNames = storesList.length > 0 ? storesList.map(s => s.name) : ['Main Store', 'Pharmacy Store', 'Surgical Store', 'Emergency Store', 'Lab Store', 'Radiology Store'];

  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['stock-movements', 'transfer', facilityId],
    queryFn: () => storesService.movements.list(),
    staleTime: 30000,
  });

  const transfers = useMemo(() => movements.filter(m => m.type === 'transfer'), [movements]);

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-search-transfer', transferForm.itemSearch],
    queryFn: () => storesService.items.search(transferForm.itemSearch),
    enabled: transferForm.itemSearch.length > 2,
    staleTime: 30000,
  });

  const transferMutation = useMutation({
    mutationFn: ({ itemId, quantity, from, to }: { itemId: string; quantity: number; from: string; to: string }) =>
      storesService.movements.transfer(itemId, quantity, from, to),
    onSuccess: () => {
      toast.success('Transfer initiated successfully');
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      setShowNewTransfer(false);
      setTransferForm({ itemSearch: '', itemId: '', quantity: '', fromLocation: '', toLocation: '', reason: '' });
    },
    onError: () => toast.error('Failed to initiate transfer'),
  });

  const filteredTransfers = useMemo(() => {
    return transfers.filter((transfer) => {
      const matchesSearch =
        (transfer.fromLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (transfer.toLocation || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        transfer.itemId.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [searchTerm, transfers]);

  const statusCounts = useMemo(() => ({
    pending: 0,
    approved: 0,
    'in-transit': transfers.length,
    received: 0,
  }), [transfers]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Transfers</h1>
          <p className="text-gray-600">Manage transfers between stores and locations</p>
        </div>
        <button
          onClick={() => setShowNewTransfer(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          New Transfer
        </button>
      </div>

      {/* Status Cards */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-600">{statusCounts.pending}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{statusCounts.approved}</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">In Transit</p>
              <p className="text-2xl font-bold text-purple-600">{statusCounts['in-transit']}</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-lg">
              <Truck className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
        <div className="p-4 bg-white border rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Received (MTD)</p>
              <p className="text-2xl font-bold text-green-600">{statusCounts.received}</p>
            </div>
            <div className="p-3 bg-green-100 rounded-lg">
              <Package className="w-6 h-6 text-green-600" />
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
            placeholder="Search by transfer number or store..."
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
          <option value="in-transit">In Transit</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <button className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Filter className="w-4 h-4" />
          More Filters
        </button>
      </div>

      {/* Transfers Table */}
      <div className="flex-1 bg-white border rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="overflow-auto flex-1">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center h-full py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : (
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Reference</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Route</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Item</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Quantity</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Performed By</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Date</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    <ArrowRightLeft className="w-12 h-12 mx-auto text-gray-300 mb-2" />
                    <p className="font-medium">No transfers found</p>
                    <p className="text-sm">Create a new transfer to get started</p>
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-blue-600">{transfer.reference || transfer.id.slice(0, 8)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{transfer.fromLocation || '—'}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-900">{transfer.toLocation || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{transfer.itemId}</span>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {transfer.quantity}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <User className="w-3 h-3" />
                        {transfer.performedBy}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-3 h-3" />
                        {new Date(transfer.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-gray-100 rounded" title="View Details">
                          <Eye className="w-4 h-4 text-gray-500" />
                        </button>
                        <button className="p-1 hover:bg-gray-100 rounded">
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          )}
        </div>
        <div className="flex-shrink-0 px-4 py-3 bg-gray-50 border-t text-sm text-gray-600">
          Showing {filteredTransfers.length} of {transfers.length} transfers
        </div>
      </div>

      {/* New Transfer Modal */}
      {showNewTransfer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">New Transfer Request</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Item</label>
                <input
                  type="text"
                  value={transferForm.itemSearch}
                  onChange={(e) => setTransferForm({ ...transferForm, itemSearch: e.target.value })}
                  placeholder="Search for item..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {inventoryData && inventoryData.length > 0 && !transferForm.itemId && (
                  <div className="mt-1 border rounded-lg bg-white shadow-sm max-h-32 overflow-auto">
                    {inventoryData.map((item) => (
                      <button
                        key={item.id}
                        className="w-full px-3 py-2 text-left hover:bg-gray-50 text-sm"
                        onClick={() => setTransferForm({ ...transferForm, itemId: item.id, itemSearch: item.name })}
                      >
                        {item.name} ({item.code})
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  value={transferForm.quantity}
                  onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                  placeholder="Enter quantity"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Store</label>
                <select
                  value={transferForm.fromLocation}
                  onChange={(e) => setTransferForm({ ...transferForm, fromLocation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select source store</option>
                  {storeNames.map((store) => (
                    <option key={store} value={store}>{store}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Store</label>
                <select
                  value={transferForm.toLocation}
                  onChange={(e) => setTransferForm({ ...transferForm, toLocation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select destination store</option>
                  {storeNames.map((store) => (
                    <option key={store} value={store}>{store}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNewTransfer(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!transferForm.itemId || !transferForm.quantity || !transferForm.fromLocation || !transferForm.toLocation || transferMutation.isPending}
                onClick={() => transferMutation.mutate({ itemId: transferForm.itemId, quantity: Number(transferForm.quantity), from: transferForm.fromLocation, to: transferForm.toLocation })}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {transferMutation.isPending ? 'Processing...' : 'Initiate Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
