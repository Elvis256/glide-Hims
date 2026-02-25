import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  Search,
  Plus,
  CheckCircle,
  Clock,
  XCircle,
  Package,
  ArrowRight,
  Loader2,
  Truck,
  Eye,
  X,
} from 'lucide-react';
import { CURRENCY_SYMBOL } from '../../lib/currency';
import { storesService, type StockTransfer, type TransferStatus, type Store, type Drug } from '../../services/stores';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  in_transit: { label: 'In Transit', color: 'bg-purple-100 text-purple-800', icon: Truck },
  received: { label: 'Received', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function PharmacyTransfersPage() {
  const { hasPermission } = usePermissions();
  if (!hasPermission('pharmacy.inventory')) {
    return <AccessDenied />;
  }

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TransferStatus | 'all'>('all');
  const [showNewTransfer, setShowNewTransfer] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<StockTransfer | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [transferItems, setTransferItems] = useState<{ itemId: string; name: string; quantity: number }[]>([]);
  const [fromStoreId, setFromStoreId] = useState('');
  const [toStoreId, setToStoreId] = useState('');
  const [notes, setNotes] = useState('');

  // Fetch stores
  const { data: stores = [] } = useQuery({
    queryKey: ['stores-list'],
    queryFn: () => storesService.stores.list(),
    staleTime: 60000,
  });

  const pharmacyStores = useMemo(() => stores.filter(s => s.type === 'pharmacy' || s.type === 'main'), [stores]);

  // Fetch transfers
  const { data: transfers = [], isLoading } = useQuery({
    queryKey: ['pharmacy-transfers', statusFilter],
    queryFn: () => storesService.transfers.list(undefined, statusFilter === 'all' ? undefined : statusFilter),
    staleTime: 15000,
    refetchInterval: 30000,
  });

  // Search items for new transfer
  const { data: searchResults = [] } = useQuery({
    queryKey: ['transfer-item-search', itemSearch],
    queryFn: () => storesService.items.search(itemSearch, true),
    enabled: itemSearch.length > 2,
    staleTime: 30000,
  });

  // Create transfer mutation
  const createMutation = useMutation({
    mutationFn: () => storesService.transfers.create({
      fromStoreId,
      toStoreId,
      items: transferItems.map(i => ({ itemId: i.itemId, quantity: i.quantity })),
      notes,
    }),
    onSuccess: () => {
      toast.success('Transfer request created');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-transfers'] });
      resetForm();
    },
    onError: () => toast.error('Failed to create transfer'),
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => storesService.transfers.approve(id),
    onSuccess: () => {
      toast.success('Transfer approved — stock deducted from source');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-transfers'] });
      setSelectedTransfer(null);
    },
    onError: () => toast.error('Failed to approve transfer'),
  });

  // Receive mutation
  const receiveMutation = useMutation({
    mutationFn: (id: string) => storesService.transfers.receive(id),
    onSuccess: () => {
      toast.success('Transfer received — stock added to destination');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-transfers'] });
      setSelectedTransfer(null);
    },
    onError: () => toast.error('Failed to receive transfer'),
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => storesService.transfers.cancel(id),
    onSuccess: () => {
      toast.success('Transfer cancelled');
      queryClient.invalidateQueries({ queryKey: ['pharmacy-transfers'] });
      setSelectedTransfer(null);
    },
    onError: () => toast.error('Failed to cancel transfer'),
  });

  const resetForm = () => {
    setShowNewTransfer(false);
    setTransferItems([]);
    setFromStoreId('');
    setToStoreId('');
    setNotes('');
    setItemSearch('');
  };

  const addItem = (drug: Drug) => {
    if (transferItems.some(i => i.itemId === drug.id)) return;
    setTransferItems(prev => [...prev, { itemId: drug.id, name: drug.name, quantity: 1 }]);
    setItemSearch('');
  };

  const removeItem = (itemId: string) => {
    setTransferItems(prev => prev.filter(i => i.itemId !== itemId));
  };

  const updateQuantity = (itemId: string, qty: number) => {
    setTransferItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity: Math.max(1, qty) } : i));
  };

  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      const matchesSearch = !searchTerm ||
        t.transferNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.fromStore?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.toStore?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [transfers, searchTerm]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, approved: 0, in_transit: 0, received: 0, cancelled: 0 };
    transfers.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });
    return counts;
  }, [transfers]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pharmacy Transfers</h1>
          <p className="text-gray-600">Transfer stock between pharmacy sections (OPD ↔ IPD)</p>
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
      <div className="flex-shrink-0 grid grid-cols-5 gap-3 mb-4">
        {(Object.entries(STATUS_CONFIG) as [TransferStatus, typeof STATUS_CONFIG[TransferStatus]][]).map(([status, cfg]) => {
          const Icon = cfg.icon;
          return (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              className={`p-3 rounded-lg border text-left transition-all ${statusFilter === status ? 'ring-2 ring-blue-500 border-blue-300' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">{cfg.label}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mt-1">{statusCounts[status] || 0}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex-shrink-0 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search transfers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Transfers Table */}
      <div className="flex-1 overflow-auto bg-white rounded-lg border border-gray-200">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Transfer #</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">From → To</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Items</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Date</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                </td>
              </tr>
            ) : filteredTransfers.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-500">
                  <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p>No transfers found</p>
                </td>
              </tr>
            ) : filteredTransfers.map(transfer => {
              const cfg = STATUS_CONFIG[transfer.status] || STATUS_CONFIG.pending;
              return (
                <tr key={transfer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                    {transfer.transferNumber || transfer.id.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-700">{transfer.fromStore?.name || '—'}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-700">{transfer.toStore?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {transfer.items?.length || 0} item(s)
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(transfer.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedTransfer(transfer)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {transfer.status === 'pending' && (
                        <button
                          onClick={() => approveMutation.mutate(transfer.id)}
                          disabled={approveMutation.isPending}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Approve"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                      {(transfer.status === 'approved' || transfer.status === 'in_transit') && (
                        <button
                          onClick={() => receiveMutation.mutate(transfer.id)}
                          disabled={receiveMutation.isPending}
                          className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Mark Received"
                        >
                          <Package className="w-4 h-4" />
                        </button>
                      )}
                      {transfer.status === 'pending' && (
                        <button
                          onClick={() => cancelMutation.mutate(transfer.id)}
                          disabled={cancelMutation.isPending}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Cancel"
                        >
                          <XCircle className="w-4 h-4" />
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

      {/* New Transfer Modal */}
      {showNewTransfer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">New Stock Transfer</h2>
              <button onClick={resetForm} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* From Store */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Store</label>
                <select
                  value={fromStoreId}
                  onChange={e => setFromStoreId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select source store...</option>
                  {pharmacyStores.map(s => (
                    <option key={s.id} value={s.id} disabled={s.id === toStoreId}>{s.name}</option>
                  ))}
                </select>
              </div>
              {/* To Store */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Store</label>
                <select
                  value={toStoreId}
                  onChange={e => setToStoreId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Select destination store...</option>
                  {pharmacyStores.map(s => (
                    <option key={s.id} value={s.id} disabled={s.id === fromStoreId}>{s.name}</option>
                  ))}
                </select>
              </div>
              {/* Item Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search drugs..."
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  {searchResults.length > 0 && itemSearch.length > 2 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-auto">
                      {searchResults.map(drug => (
                        <button
                          key={drug.id}
                          onClick={() => addItem(drug)}
                          className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex justify-between"
                        >
                          <span>{drug.name}</span>
                          <span className="text-gray-400">Stock: {drug.currentStock ?? '—'}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {/* Selected Items */}
              {transferItems.length > 0 && (
                <div className="border border-gray-200 rounded-lg divide-y">
                  {transferItems.map(item => (
                    <div key={item.itemId} className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm text-gray-800">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={e => updateQuantity(item.itemId, parseInt(e.target.value) || 1)}
                          className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                        />
                        <button onClick={() => removeItem(item.itemId)} className="text-red-400 hover:text-red-600">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Transfer reason or notes..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-4 border-t">
              <button onClick={resetForm} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm">
                Cancel
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!fromStoreId || !toStoreId || transferItems.length === 0 || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
                Create Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Detail Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">Transfer Details</h2>
              <button onClick={() => setSelectedTransfer(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              {/* Transfer Info */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Transfer #</p>
                  <p className="text-sm font-medium">{selectedTransfer.transferNumber || selectedTransfer.id.slice(0, 8)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedTransfer.status]?.color}`}>
                    {STATUS_CONFIG[selectedTransfer.status]?.label}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">From</p>
                  <p className="text-sm font-medium">{selectedTransfer.fromStore?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">To</p>
                  <p className="text-sm font-medium">{selectedTransfer.toStore?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-sm">{new Date(selectedTransfer.createdAt).toLocaleString()}</p>
                </div>
                {selectedTransfer.requestedBy && (
                  <div>
                    <p className="text-xs text-gray-500">Requested By</p>
                    <p className="text-sm">{selectedTransfer.requestedBy.firstName} {selectedTransfer.requestedBy.lastName}</p>
                  </div>
                )}
              </div>
              {selectedTransfer.notes && (
                <div>
                  <p className="text-xs text-gray-500">Notes</p>
                  <p className="text-sm text-gray-700">{selectedTransfer.notes}</p>
                </div>
              )}
              {/* Items */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Items</p>
                <div className="border border-gray-200 rounded-lg divide-y">
                  {selectedTransfer.items?.map((item, idx) => (
                    <div key={idx} className="px-3 py-2 flex justify-between">
                      <span className="text-sm text-gray-800">{item.itemName || (item.item as any)?.name || item.itemId.slice(0, 8)}</span>
                      <div className="text-sm text-gray-600">
                        <span>Req: {item.quantityRequested}</span>
                        {item.quantityApproved != null && <span className="ml-3">Appr: {item.quantityApproved}</span>}
                        {item.quantityReceived != null && <span className="ml-3">Rcvd: {item.quantityReceived}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* Actions */}
            <div className="flex justify-end gap-3 p-4 border-t">
              {selectedTransfer.status === 'pending' && (
                <>
                  <button
                    onClick={() => cancelMutation.mutate(selectedTransfer.id)}
                    disabled={cancelMutation.isPending}
                    className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 text-sm"
                  >
                    Cancel Transfer
                  </button>
                  <button
                    onClick={() => approveMutation.mutate(selectedTransfer.id)}
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                  >
                    {approveMutation.isPending ? 'Approving...' : 'Approve & Dispatch'}
                  </button>
                </>
              )}
              {(selectedTransfer.status === 'approved' || selectedTransfer.status === 'in_transit') && (
                <button
                  onClick={() => receiveMutation.mutate(selectedTransfer.id)}
                  disabled={receiveMutation.isPending}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
                >
                  {receiveMutation.isPending ? 'Receiving...' : 'Mark as Received'}
                </button>
              )}
              <button onClick={() => setSelectedTransfer(null)} className="px-4 py-2 text-gray-700 border rounded-lg hover:bg-gray-50 text-sm">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
