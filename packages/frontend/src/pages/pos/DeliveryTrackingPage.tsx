import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Truck, Plus, Search, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

type DeliveryStatus = 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'failed';

// Backend delivery row: sale + customer come as RELATIONS, dates as scheduledAt/deliveredAt
interface DeliveryRow {
  id: string;
  saleNumber: string;
  customerName: string;
  deliveryAddress: string;
  driverName?: string;
  driverPhone?: string;
  vehicleNumber?: string;
  status: DeliveryStatus;
  scheduledAt?: string;
  deliveredAt?: string;
}

function mapDelivery(d: any): DeliveryRow {
  return {
    id: d.id,
    saleNumber: d.sale?.saleNumber || '—',
    customerName: d.customer?.name || '—',
    deliveryAddress: d.deliveryAddress || '',
    driverName: d.driverName || undefined,
    driverPhone: d.driverPhone || undefined,
    vehicleNumber: d.vehicleNumber || undefined,
    status: (d.status as DeliveryStatus) || 'pending',
    scheduledAt: d.scheduledAt || undefined,
    deliveredAt: d.deliveredAt || undefined,
  };
}

interface DeliveryFormData {
  saleId: string;
  customerId: string;
  deliveryAddress: string;
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  scheduledAt: string;
}

const emptyForm: DeliveryFormData = {
  saleId: '',
  customerId: '',
  deliveryAddress: '',
  driverName: '',
  driverPhone: '',
  vehicleNumber: '',
  scheduledAt: '',
};

const statusConfig: Record<DeliveryStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-800', bg: 'bg-amber-100' },
  dispatched: { label: 'Dispatched', color: 'text-blue-800', bg: 'bg-blue-100' },
  in_transit: { label: 'In Transit', color: 'text-indigo-800', bg: 'bg-indigo-100' },
  delivered: { label: 'Delivered', color: 'text-green-800', bg: 'bg-green-100' },
  failed: { label: 'Failed', color: 'text-red-800', bg: 'bg-red-100' },
};

const statusTabs: { key: DeliveryStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

export default function DeliveryTrackingPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<DeliveryStatus | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState<DeliveryFormData>(emptyForm);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data: deliveriesData, isLoading } = useQuery({
    queryKey: ['pos-deliveries', facilityId],
    queryFn: async () => {
      const res = await api.get('/pos/deliveries');
      return res.data;
    },
  });

  const deliveries = useMemo(
    () => asList<any>(deliveriesData).map(mapDelivery),
    [deliveriesData]
  );

  // Pickers for the create form (delivery needs a sale UUID + wholesale customer UUID)
  const { data: salesData } = useQuery({
    queryKey: ['pos-delivery-sales'],
    queryFn: async () => {
      const res = await api.get('/pharmacy/sales', { params: { limit: 50 } });
      return asList<any>(res.data);
    },
    enabled: showCreateModal,
  });
  const { data: customersData } = useQuery({
    queryKey: ['pos-delivery-customers'],
    queryFn: async () => {
      const res = await api.get('/pos/wholesale/customers');
      return asList<any>(res.data);
    },
    enabled: showCreateModal,
  });
  const saleOptions = salesData || [];
  const customerOptions = customersData || [];

  const filteredDeliveries = useMemo(() => {
    let result = deliveries;
    if (activeTab !== 'all') {
      result = result.filter((d) => d.status === activeTab);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.saleNumber.toLowerCase().includes(term) ||
          d.customerName.toLowerCase().includes(term) ||
          (d.driverName || '').toLowerCase().includes(term)
      );
    }
    return result;
  }, [deliveries, activeTab, searchTerm]);

  const createMutation = useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      const res = await api.post('/pos/deliveries', {
        saleId: data.saleId,
        customerId: data.customerId,
        deliveryAddress: data.deliveryAddress,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : undefined,
        driverName: data.driverName || undefined,
        driverPhone: data.driverPhone || undefined,
        vehicleNumber: data.vehicleNumber || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-deliveries'] });
      setShowCreateModal(false);
      setForm(emptyForm);
      toast.success('Delivery created');
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create delivery')),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: DeliveryStatus }) => {
      const res = await api.patch(`/pos/deliveries/${id}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-deliveries'] });
      setUpdatingId(null);
      toast.success('Status updated');
    },
    onError: (err) => {
      setUpdatingId(null);
      toast.error(getApiErrorMessage(err, 'Failed to update status'));
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.saleId || !form.customerId || !form.deliveryAddress.trim()) {
      toast.error('Sale, customer, and delivery address are required');
      return;
    }
    createMutation.mutate(form);
  };

  const handleStatusChange = (deliveryId: string, newStatus: DeliveryStatus) => {
    setUpdatingId(deliveryId);
    updateStatusMutation.mutate({ id: deliveryId, status: newStatus });
  };

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: deliveries.length };
    statusTabs.forEach((tab) => {
      if (tab.key !== 'all') {
        counts[tab.key] = deliveries.filter((d) => d.status === tab.key).length;
      }
    });
    return counts;
  }, [deliveries]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Delivery Tracking</h1>
          <p className="text-sm text-gray-500">Track and manage wholesale delivery orders</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Create Delivery
        </button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab.label}
            <span
              className={`rounded-full px-1.5 py-0.5 text-xs ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {tabCounts[tab.key] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by sale #, customer, or driver..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Deliveries Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Truck className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="font-medium">No deliveries found</p>
            <p className="text-sm">Create a delivery to start tracking</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <th className="px-6 py-3">Sale #</th>
                  <th className="px-6 py-3">Customer</th>
                  <th className="px-6 py-3">Address</th>
                  <th className="px-6 py-3">Driver</th>
                  <th className="px-6 py-3 text-center">Status</th>
                  <th className="px-6 py-3">Scheduled</th>
                  <th className="px-6 py-3">Delivered</th>
                  <th className="px-6 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredDeliveries.map((delivery) => {
                  const config = statusConfig[delivery.status] || statusConfig.pending;
                  return (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">
                        {delivery.saleNumber}
                      </td>
                      <td className="px-6 py-3 text-gray-900">{delivery.customerName}</td>
                      <td className="max-w-[200px] truncate px-6 py-3 text-gray-600">
                        {delivery.deliveryAddress}
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {delivery.driverName || '—'}
                        {delivery.driverPhone && (
                          <span className="block text-xs text-gray-400">{delivery.driverPhone}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-gray-600">
                        {delivery.scheduledAt
                          ? new Date(delivery.scheduledAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-gray-600">
                        {delivery.deliveredAt
                          ? new Date(delivery.deliveredAt).toLocaleDateString()
                          : '—'}
                      </td>
                      <td className="px-6 py-3 text-right">
                        {delivery.status !== 'delivered' && delivery.status !== 'failed' && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                handleStatusChange(
                                  delivery.id,
                                  e.target.value as DeliveryStatus
                                );
                              }
                            }}
                            disabled={updatingId === delivery.id}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
                          >
                            <option value="">Update...</option>
                            {delivery.status === 'pending' && (
                              <option value="dispatched">Dispatched</option>
                            )}
                            {(delivery.status === 'pending' ||
                              delivery.status === 'dispatched') && (
                              <option value="in_transit">In Transit</option>
                            )}
                            <option value="delivered">Delivered</option>
                            <option value="failed">Failed</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Delivery Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Create Delivery</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setForm(emptyForm);
                }}
                className="rounded p-1 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Sale *</label>
                  <select
                    value={form.saleId}
                    onChange={(e) => setForm({ ...form, saleId: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select the sale being delivered…</option>
                    {saleOptions.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.saleNumber} — {formatCurrency(Number(s.totalAmount) || 0)}
                        {s.customerName ? ` (${s.customerName})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Wholesale Customer *
                  </label>
                  <select
                    value={form.customerId}
                    onChange={(e) => setForm({ ...form, customerId: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="">Select customer…</option>
                    {customerOptions.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  {customerOptions.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400">
                      No wholesale customers yet — add them under Wholesale Customers first
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Delivery Address *
                  </label>
                  <textarea
                    value={form.deliveryAddress}
                    onChange={(e) => setForm({ ...form, deliveryAddress: e.target.value })}
                    required
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Driver Name
                    </label>
                    <input
                      type="text"
                      value={form.driverName}
                      onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Driver Phone
                    </label>
                    <input
                      type="tel"
                      value={form.driverPhone}
                      onChange={(e) => setForm({ ...form, driverPhone: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Vehicle Number
                    </label>
                    <input
                      type="text"
                      value={form.vehicleNumber}
                      onChange={(e) => setForm({ ...form, vehicleNumber: e.target.value })}
                      placeholder="e.g. UBA 123X"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Scheduled Date
                    </label>
                    <input
                      type="date"
                      value={form.scheduledAt}
                      onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setForm(emptyForm);
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Delivery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
