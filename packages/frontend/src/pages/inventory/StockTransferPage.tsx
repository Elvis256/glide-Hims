import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowRightLeft,
  LayoutDashboard,
  Plus,
  Inbox,
  Send,
  Package,
  Truck,
  CheckCircle,
  Clock,
  XCircle,
  Search,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';
import { getApiErrorMessage } from '../../services/api';
import { stockTransferService } from '../../services/stock-transfer';
import type { StockTransfer, StockTransferItem, TransferDashboard } from '../../services/stock-transfer';
import { facilitiesService } from '../../services/facilities';
import api from '../../services/api';

type TabId = 'dashboard' | 'new' | 'incoming' | 'outgoing';

const STATUS_COLORS: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-purple-100 text-purple-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-800',
};

const REASON_LABELS: Record<string, string> = {
  near_expiry: 'Near Expiry',
  surplus: 'Surplus',
  stockout_relief: 'Stockout Relief',
  redistribution: 'Redistribution',
  other: 'Other',
};

const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'new', label: 'New Transfer', icon: Plus },
  { id: 'incoming', label: 'Incoming', icon: Inbox },
  { id: 'outgoing', label: 'Outgoing', icon: Send },
];

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────

function DashboardTab({ facilityId }: { facilityId: string }) {
  const { data, isLoading } = useQuery<TransferDashboard>({
    queryKey: ['stock-transfer-dashboard', facilityId],
    queryFn: () => stockTransferService.getDashboard(facilityId),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 h-28" />
        ))}
        <div className="col-span-full bg-white rounded-lg shadow p-6 h-64" />
      </div>
    );
  }

  const stats = [
    { label: 'Pending Requests', value: data?.pendingRequests ?? 0, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
    { label: 'In Transit', value: data?.inTransit ?? 0, icon: Truck, color: 'text-purple-600 bg-purple-50' },
    { label: 'Received This Month', value: data?.receivedThisMonth ?? 0, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
    { label: 'Total Transferred Value', value: formatCurrency(data?.totalTransferredValue ?? 0, { compact: true }), icon: Package, color: 'text-blue-600 bg-blue-50' },
  ];

  const recent = asList<StockTransfer>(data?.recentTransfers).slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-lg shadow p-5">
            <div className="flex items-center gap-3">
              <div className={`p-2.5 rounded-lg ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className="text-xl font-semibold text-gray-900">{s.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-5 py-4 border-b">
          <h3 className="font-semibold text-gray-900">Recent Activity</h3>
        </div>
        {recent.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No recent transfers</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Transfer #</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">From → To</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.transferNumber || t.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {t.sourceFacility?.name ?? '—'} → {t.destinationFacility?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{REASON_LABELS[t.reason] || t.reason}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-3 text-sm text-gray-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── New Transfer Tab ───────────────────────────────────────────────────────

interface NewItemRow {
  key: number;
  itemId: string;
  itemName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  availableQty: number;
  unitCost: number;
  batches: Array<{ batchNumber: string; expiryDate: string; quantity: number }>;
}

function NewTransferTab({ facilityId, onCreated }: { facilityId: string; onCreated: () => void }) {
  const queryClient = useQueryClient();
  const [destinationFacilityId, setDestinationFacilityId] = useState('');
  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<NewItemRow[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [nextKey, setNextKey] = useState(1);

  const { data: facilitiesData } = useQuery({
    queryKey: ['facilities-list'],
    queryFn: () => facilitiesService.list(),
    staleTime: 60000,
  });
  const facilities = asList(facilitiesData).filter((f: any) => f.id !== facilityId);

  const { data: inventoryData } = useQuery({
    queryKey: ['inventory-stock', facilityId, itemSearch],
    queryFn: async () => {
      const params: Record<string, string> = { facilityId };
      if (itemSearch) params.search = itemSearch;
      const res = await api.get('/inventory/stock', { params });
      return res.data;
    },
    enabled: !!facilityId,
  });
  const inventoryItems = asList(inventoryData);

  const createMutation = useMutation({
    mutationFn: () =>
      stockTransferService.create({
        sourceFacilityId: facilityId,
        destinationFacilityId,
        reason: reason as any,
        notes: notes || undefined,
        items: items.map((i) => ({
          itemId: i.itemId,
          batchNumber: i.batchNumber || undefined,
          expiryDate: i.expiryDate || undefined,
          quantity: i.quantity,
          unitCost: i.unitCost || undefined,
        })),
      }),
    onSuccess: () => {
      toast.success('Transfer request created successfully');
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transfer-dashboard'] });
      resetForm();
      onCreated();
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to create transfer'));
    },
  });

  const resetForm = () => {
    setDestinationFacilityId('');
    setReason('');
    setNotes('');
    setItems([]);
    setItemSearch('');
  };

  const addItem = (stock: any) => {
    if (items.some((i) => i.itemId === (stock.itemId || stock.item?.id))) {
      toast.error('Item already added');
      return;
    }
    const batches = asList(stock.batches || stock.item?.batches).map((b: any) => ({
      batchNumber: b.batchNumber || b.batch_number || '',
      expiryDate: b.expiryDate || b.expiry_date || '',
      quantity: b.quantity ?? b.availableQuantity ?? 0,
    }));
    const firstBatch = batches[0];
    setItems((prev) => [
      ...prev,
      {
        key: nextKey,
        itemId: stock.itemId || stock.item?.id || stock.id,
        itemName: stock.item?.name || stock.name || '',
        batchNumber: firstBatch?.batchNumber || '',
        expiryDate: firstBatch?.expiryDate || '',
        quantity: 1,
        availableQty: stock.availableQuantity ?? stock.totalQuantity ?? 0,
        unitCost: stock.item?.unitCost ?? stock.unitCost ?? 0,
        batches,
      },
    ]);
    setNextKey((k) => k + 1);
    setItemSearch('');
  };

  const updateItem = (key: number, field: keyof NewItemRow, value: any) => {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        const updated = { ...i, [field]: value };
        if (field === 'batchNumber') {
          const batch = i.batches.find((b) => b.batchNumber === value);
          if (batch) {
            updated.expiryDate = batch.expiryDate;
            updated.availableQty = batch.quantity;
          }
        }
        return updated;
      }),
    );
  };

  const removeItem = (key: number) => setItems((prev) => prev.filter((i) => i.key !== key));

  const totalValue = items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0);
  const canSubmit = destinationFacilityId && reason && items.length > 0 && items.every((i) => i.quantity > 0 && i.quantity <= i.availableQty);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-5 py-4 border-b">
        <h3 className="font-semibold text-gray-900">Create Transfer Request</h3>
      </div>
      <div className="p-5 space-y-5">
        {/* Destination + Reason row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Destination Facility *</label>
            <select
              value={destinationFacilityId}
              onChange={(e) => setDestinationFacilityId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select facility…</option>
              {facilities.map((f: any) => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select reason…</option>
              {Object.entries(REASON_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Optional notes…"
          />
        </div>

        {/* Item search */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Search inventory items…"
            />
          </div>
          {itemSearch.length >= 2 && inventoryItems.length > 0 && (
            <div className="mt-1 border rounded-lg shadow-lg max-h-48 overflow-y-auto bg-white z-10 relative">
              {inventoryItems.slice(0, 10).map((stock: any) => {
                const name = stock.item?.name || stock.name || '';
                const code = stock.item?.code || stock.code || '';
                const avail = stock.availableQuantity ?? stock.totalQuantity ?? 0;
                const alreadyAdded = items.some((i) => i.itemId === (stock.itemId || stock.item?.id || stock.id));
                return (
                  <button
                    key={stock.id || stock.itemId}
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => addItem(stock)}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 flex justify-between ${alreadyAdded ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span>{name} {code && <span className="text-gray-400">({code})</span>}</span>
                    <span className="text-gray-500">Avail: {avail}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Batch</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expiry</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Unit Cost</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item) => (
                  <tr key={item.key}>
                    <td className="px-4 py-2 text-sm font-medium text-gray-900">{item.itemName}</td>
                    <td className="px-4 py-2">
                      {item.batches.length > 0 ? (
                        <select
                          value={item.batchNumber}
                          onChange={(e) => updateItem(item.key, 'batchNumber', e.target.value)}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                        >
                          <option value="">No batch</option>
                          {item.batches.map((b) => (
                            <option key={b.batchNumber} value={b.batchNumber}>
                              {b.batchNumber} (Qty: {b.quantity})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">
                      {item.expiryDate ? formatDate(item.expiryDate) : '—'}
                    </td>
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        min={1}
                        max={item.availableQty}
                        value={item.quantity}
                        onChange={(e) => updateItem(item.key, 'quantity', Math.max(1, parseInt(e.target.value) || 0))}
                        className={`w-20 px-2 py-1 border rounded text-sm text-right ${item.quantity > item.availableQty ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      {item.quantity > item.availableQty && (
                        <p className="text-xs text-red-500 mt-0.5">Max: {item.availableQty}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-right text-gray-600">{formatCurrency(item.unitCost)}</td>
                    <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(item.quantity * item.unitCost)}</td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => removeItem(item.key)} className="text-red-500 hover:text-red-700 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end px-4 py-3 bg-gray-50 border-t">
              <span className="text-sm font-semibold text-gray-700">
                Total Value: {formatCurrency(totalValue)}
              </span>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Reset
          </button>
          <button
            type="button"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Submit Transfer Request
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Transfer List (Incoming / Outgoing) ────────────────────────────────────

function TransferListTab({
  facilityId,
  direction,
}: {
  facilityId: string;
  direction: 'incoming' | 'outgoing';
}) {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionDialog, setActionDialog] = useState<{ type: string; transferId: string } | null>(null);

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['stock-transfers', direction, facilityId, statusFilter],
    queryFn: () =>
      stockTransferService.list({
        direction,
        facilityId,
        status: statusFilter || undefined,
      }),
  });
  const transfers = asList<StockTransfer>(transfersData);

  // Detail query for expanded row
  const { data: expandedDetail } = useQuery({
    queryKey: ['stock-transfer-detail', expandedId],
    queryFn: () => stockTransferService.getOne(expandedId!),
    enabled: !!expandedId,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    queryClient.invalidateQueries({ queryKey: ['stock-transfer-dashboard'] });
    queryClient.invalidateQueries({ queryKey: ['stock-transfer-detail'] });
  };

  const approveMutation = useMutation({
    mutationFn: (transfer: StockTransfer) => {
      const detailItems = asList<StockTransferItem>(expandedDetail?.items || transfer.items);
      return stockTransferService.approve(transfer.id, {
        items: detailItems.map((i) => ({
          itemId: i.itemId,
          approvedQuantity: i.requestedQuantity,
        })),
      });
    },
    onSuccess: () => { toast.success('Transfer approved'); invalidateAll(); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to approve')),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      stockTransferService.reject(id, reason),
    onSuccess: () => { toast.success('Transfer rejected'); invalidateAll(); setActionDialog(null); setActionReason(''); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to reject')),
  });

  const shipMutation = useMutation({
    mutationFn: (id: string) => stockTransferService.ship(id),
    onSuccess: () => { toast.success('Transfer marked as shipped'); invalidateAll(); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to ship')),
  });

  const receiveMutation = useMutation({
    mutationFn: (transfer: StockTransfer) => {
      const detailItems = asList<StockTransferItem>(expandedDetail?.items || transfer.items);
      return stockTransferService.receive(transfer.id, {
        items: detailItems.map((i) => ({
          itemId: i.itemId,
          receivedQuantity: i.approvedQuantity ?? i.requestedQuantity,
        })),
      });
    },
    onSuccess: () => { toast.success('Transfer received'); invalidateAll(); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to receive')),
  });

  const cancelMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      stockTransferService.cancel(id, reason),
    onSuccess: () => { toast.success('Transfer cancelled'); invalidateAll(); setActionDialog(null); setActionReason(''); },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Failed to cancel')),
  });

  const isIncoming = direction === 'incoming';

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow animate-pulse">
        <div className="p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {['requested', 'approved', 'in_transit', 'received', 'cancelled', 'rejected'].map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {transfers.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No {direction} transfers found
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-3 py-3" />
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Transfer #</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">
                    {isIncoming ? 'From Facility' : 'To Facility'}
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Items</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Reason</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {transfers.map((t) => {
                  const isExpanded = expandedId === t.id;
                  const detailItems = isExpanded ? asList<StockTransferItem>(expandedDetail?.items) : [];
                  const counterFacility = isIncoming ? t.sourceFacility : t.destinationFacility;

                  return (
                    <TransferRow
                      key={t.id}
                      transfer={t}
                      isExpanded={isExpanded}
                      detailItems={detailItems}
                      counterFacilityName={counterFacility?.name ?? '—'}
                      isIncoming={isIncoming}
                      onToggle={() => setExpandedId(isExpanded ? null : t.id)}
                      onApprove={() => approveMutation.mutate(t)}
                      onReject={() => setActionDialog({ type: 'reject', transferId: t.id })}
                      onShip={() => shipMutation.mutate(t.id)}
                      onReceive={() => receiveMutation.mutate(t)}
                      onCancel={() => setActionDialog({ type: 'cancel', transferId: t.id })}
                      isActing={
                        approveMutation.isPending ||
                        rejectMutation.isPending ||
                        shipMutation.isPending ||
                        receiveMutation.isPending ||
                        cancelMutation.isPending
                      }
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reason Dialog (reject / cancel) */}
      {actionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">
              {actionDialog.type === 'reject' ? 'Reject Transfer' : 'Cancel Transfer'}
            </h3>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Provide a reason…"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => { setActionDialog(null); setActionReason(''); }}
                className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                disabled={!actionReason.trim()}
                onClick={() => {
                  if (actionDialog.type === 'reject') {
                    rejectMutation.mutate({ id: actionDialog.transferId, reason: actionReason });
                  } else {
                    cancelMutation.mutate({ id: actionDialog.transferId, reason: actionReason });
                  }
                }}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${actionDialog.type === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'}`}
              >
                {actionDialog.type === 'reject' ? 'Reject' : 'Cancel Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TransferRow({
  transfer: t,
  isExpanded,
  detailItems,
  counterFacilityName,
  isIncoming,
  onToggle,
  onApprove,
  onReject,
  onShip,
  onReceive,
  onCancel,
  isActing,
}: {
  transfer: StockTransfer;
  isExpanded: boolean;
  detailItems: StockTransferItem[];
  counterFacilityName: string;
  isIncoming: boolean;
  onToggle: () => void;
  onApprove: () => void;
  onReject: () => void;
  onShip: () => void;
  onReceive: () => void;
  onCancel: () => void;
  isActing: boolean;
}) {
  const itemCount = t.items?.length ?? detailItems.length ?? 0;

  return (
    <>
      <tr className="hover:bg-gray-50 cursor-pointer" onClick={onToggle}>
        <td className="px-3 py-3 text-gray-400">
          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </td>
        <td className="px-4 py-3 text-sm font-medium text-gray-900">{t.transferNumber || t.id.slice(0, 8)}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{counterFacilityName}</td>
        <td className="px-4 py-3 text-sm text-center text-gray-600">{itemCount}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{REASON_LABELS[t.reason] || t.reason}</td>
        <td className="px-4 py-3 text-center"><StatusBadge status={t.status} /></td>
        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(t.createdAt)}</td>
        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end gap-2">
            {isIncoming && t.status === 'requested' && (
              <>
                <button
                  onClick={onApprove}
                  disabled={isActing}
                  className="px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  onClick={onReject}
                  disabled={isActing}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </>
            )}
            {isIncoming && t.status === 'in_transit' && (
              <button
                onClick={onReceive}
                disabled={isActing}
                className="px-3 py-1 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                Receive
              </button>
            )}
            {!isIncoming && t.status === 'requested' && (
              <button
                onClick={onCancel}
                disabled={isActing}
                className="px-3 py-1 text-xs bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            {!isIncoming && t.status === 'approved' && (
              <button
                onClick={onShip}
                disabled={isActing}
                className="px-3 py-1 text-xs bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                Ship
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-8 py-4">
            {detailItems.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading items…
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 border-b">
                    <th className="text-left py-2">Item</th>
                    <th className="text-left py-2">Batch</th>
                    <th className="text-left py-2">Expiry</th>
                    <th className="text-right py-2">Requested</th>
                    <th className="text-right py-2">Approved</th>
                    <th className="text-right py-2">Received</th>
                    <th className="text-right py-2">Unit Cost</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detailItems.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 font-medium text-gray-900">{item.item?.name ?? item.itemId}</td>
                      <td className="py-2 text-gray-600">{item.batchNumber || '—'}</td>
                      <td className="py-2 text-gray-600">{item.expiryDate ? formatDate(item.expiryDate) : '—'}</td>
                      <td className="py-2 text-right">{item.requestedQuantity}</td>
                      <td className="py-2 text-right">{item.approvedQuantity ?? '—'}</td>
                      <td className="py-2 text-right">{item.receivedQuantity ?? '—'}</td>
                      <td className="py-2 text-right text-gray-600">{formatCurrency(item.unitCost)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.requestedQuantity * item.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {t.notes && (
              <div className="mt-3 p-3 bg-white rounded border text-sm text-gray-600">
                <span className="font-medium text-gray-700">Notes:</span> {t.notes}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function StockTransferPage() {
  const facilityId = useFacilityId();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <ArrowRightLeft className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Inter-Facility Stock Transfers</h1>
            <p className="text-sm text-gray-500">Manage stock transfers between facilities</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-1 -mb-px overflow-x-auto">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <DashboardTab facilityId={facilityId} />}
      {activeTab === 'new' && (
        <NewTransferTab facilityId={facilityId} onCreated={() => setActiveTab('outgoing')} />
      )}
      {activeTab === 'incoming' && <TransferListTab facilityId={facilityId} direction="incoming" />}
      {activeTab === 'outgoing' && <TransferListTab facilityId={facilityId} direction="outgoing" />}
    </div>
  );
}
