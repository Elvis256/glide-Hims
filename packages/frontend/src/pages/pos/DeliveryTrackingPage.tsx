import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  Plus,
  Search,
  MapPin,
  Clock,
  CheckCircle,
  XCircle,
  Package,
  X,
  Loader2,
  Calendar,
  User,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../services/api';
import { useFacilityId } from '../../lib/facility';
import { asList } from '../../utils/unwrapResponse';

type DeliveryStatus = 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'failed';

interface Delivery {
  id: string;
  saleNumber: string;
  customerName: string;
  address: string;
  driverName: string;
  driverPhone?: string;
  status: DeliveryStatus;
  scheduledDate?: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
}

interface DeliveryFormData {
  saleId: string;
  customerName: string;
  address: string;
  driverName: string;
  driverPhone: string;
  scheduledDate: string;
  notes: string;
}

const emptyForm: DeliveryFormData = {
  saleId: '',
  customerName: '',
  address: '',
  driverName: '',
  driverPhone: '',
  scheduledDate: '',
  notes: '',
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

  const deliveries = asList<Delivery>(deliveriesData);

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
          d.driverName.toLowerCase().includes(term)
      );
    }
    return result;
  }, [deliveries, activeTab, searchTerm]);

  // Create delivery
  const createMutation = useMutation({
    mutationFn: async (data: DeliveryFormData) => {
      const res = await api.post('/pos/deliveries', {
        ...data,
        scheduledDate: data.scheduledDate || undefined,
        notes: data.notes || undefined,
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

  // Update status
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
    if (!form.customerName || !form.address || !form.driverName) {
      toast.error('Customer, address, and driver are required');
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
          <p className="text-sm text-gray-500">Track and manage delivery orders</p>
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
                  const config = statusConfig[delivery.status];
                  return (
                    <tr key={delivery.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-3 font-medium text-gray-900">
                        {delivery.saleNumber}
                      </td>
                      <td className="px-6 py-3 text-gray-900">{delivery.customerName}</td>
                      <td className="max-w-[200px] truncate px-6 py-3 text-gray-600">
                        {delivery.address}
                      </td>
                      <td className="px-6 py-3 text-gray-600">{delivery.driverName}</td>
                      <td className="px-6 py-3 text-center">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bg} ${config.color}`}
                        >
                          {config.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-3 text-gray-600">
                        {delivery.scheduledDate
                          ? new Date(delivery.scheduledDate).toLocaleDateString()
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
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Sale ID / Reference
                  </label>
                  <input
                    type="text"
                    value={form.saleId}
                    onChange={(e) => setForm({ ...form, saleId: e.target.value })}
                    placeholder="Enter sale reference"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                    required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Delivery Address *
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    required
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Driver Name *
                    </label>
                    <input
                      type="text"
                      value={form.driverName}
                      onChange={(e) => setForm({ ...form, driverName: e.target.value })}
                      required
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Scheduled Date
                  </label>
                  <input
                    type="date"
                    value={form.scheduledDate}
                    onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
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
