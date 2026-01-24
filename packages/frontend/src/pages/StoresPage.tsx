import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  Plus,
  Search,
  Edit,
  Loader2,
  Warehouse,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  X,
  Package,
} from 'lucide-react';

interface Store {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'pharmacy' | 'ward' | 'theatre' | 'lab' | 'radiology' | 'emergency';
  facilityId: string;
  departmentId?: string;
  canDispense: boolean;
  canIssue: boolean;
  canReceive: boolean;
  isActive: boolean;
}

interface StockTransfer {
  id: string;
  transferNumber: string;
  fromStoreId: string;
  toStoreId: string;
  status: 'requested' | 'approved' | 'in_transit' | 'received' | 'cancelled';
  requestedById: string;
  notes?: string;
  createdAt: string;
  fromStore?: Store;
  toStore?: Store;
  items?: StockTransferItem[];
}

interface StockTransferItem {
  id: string;
  itemId: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  receivedQuantity?: number;
  item?: { name: string; code: string };
}

const typeColors: Record<string, string> = {
  main: 'bg-blue-100 text-blue-800',
  pharmacy: 'bg-green-100 text-green-800',
  ward: 'bg-purple-100 text-purple-800',
  theatre: 'bg-red-100 text-red-800',
  lab: 'bg-amber-100 text-amber-800',
  radiology: 'bg-cyan-100 text-cyan-800',
  emergency: 'bg-orange-100 text-orange-800',
};

const statusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-purple-100 text-purple-800',
  received: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'requested': return <Clock className="h-4 w-4" />;
    case 'approved': return <CheckCircle className="h-4 w-4" />;
    case 'in_transit': return <Truck className="h-4 w-4" />;
    case 'received': return <CheckCircle className="h-4 w-4" />;
    case 'cancelled': return <XCircle className="h-4 w-4" />;
    default: return null;
  }
};

export default function StoresPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showStoreModal, setShowStoreModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<'stores' | 'transfers'>('stores');
  const [transferFilter, setTransferFilter] = useState<string>('');

  // Fetch stores
  const { data: stores, isLoading: loadingStores } = useQuery({
    queryKey: ['stores'],
    queryFn: async () => {
      const response = await api.get('/stores');
      return response.data as Store[];
    },
  });

  // Fetch transfers
  const { data: transfers, isLoading: loadingTransfers } = useQuery({
    queryKey: ['stock-transfers', transferFilter],
    queryFn: async () => {
      const params = transferFilter ? `?status=${transferFilter}` : '';
      const response = await api.get(`/stores/transfers/list${params}`);
      return response.data as StockTransfer[];
    },
    enabled: activeTab === 'transfers',
  });

  // Store mutation
  const storeMutation = useMutation({
    mutationFn: (data: Partial<Store>) => {
      if (editingStore) {
        return api.patch(`/stores/${editingStore.id}`, data);
      }
      return api.post('/stores', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores'] });
      setShowStoreModal(false);
      setEditingStore(null);
    },
  });

  // Approve transfer mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/stores/transfers/${id}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
  });

  // Receive transfer mutation
  const receiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/stores/transfers/${id}/receive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
  });

  // Cancel transfer mutation
  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/stores/transfers/${id}/cancel`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-transfers'] });
    },
  });

  const filteredStores = stores?.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleStoreSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    storeMutation.mutate({
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      type: formData.get('type') as Store['type'],
      facilityId: formData.get('facilityId') as string || 'b94b30c8-f98e-4a70-825e-253224a1cb91',
      canDispense: formData.get('canDispense') === 'true',
      canIssue: formData.get('canIssue') === 'true',
      canReceive: formData.get('canReceive') === 'true',
      isActive: formData.get('isActive') === 'true',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores & Transfers</h1>
          <p className="mt-1 text-sm text-gray-500">Manage inventory locations and stock transfers</p>
        </div>
        <button
          onClick={() => {
            if (activeTab === 'stores') {
              setEditingStore(null);
              setShowStoreModal(true);
            } else {
              setShowTransferModal(true);
            }
          }}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          {activeTab === 'stores' ? 'New Store' : 'New Transfer'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('stores')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'stores'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Warehouse className="h-4 w-4 inline mr-2" />
            Stores ({stores?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('transfers')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'transfers'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck className="h-4 w-4 inline mr-2" />
            Transfers ({transfers?.length || 0})
          </button>
        </nav>
      </div>

      {/* Search/Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        {activeTab === 'transfers' && (
          <select
            value={transferFilter}
            onChange={(e) => setTransferFilter(e.target.value)}
            className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="requested">Requested</option>
            <option value="approved">Approved</option>
            <option value="in_transit">In Transit</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
      </div>

      {/* Stores Tab */}
      {activeTab === 'stores' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingStores ? (
            <div className="col-span-full flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            filteredStores?.map((store) => (
              <div key={store.id} className="bg-white shadow rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Warehouse className="h-8 w-8 text-blue-500 mr-3" />
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">{store.name}</h3>
                      <p className="text-xs text-gray-500">{store.code}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingStore(store);
                      setShowStoreModal(true);
                    }}
                    className="text-gray-400 hover:text-blue-600"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${typeColors[store.type]}`}>
                    {store.type.toUpperCase()}
                  </span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    store.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {store.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="mt-3 flex gap-2 text-xs">
                  {store.canDispense && <span className="px-2 py-1 bg-gray-100 rounded">Dispense</span>}
                  {store.canIssue && <span className="px-2 py-1 bg-gray-100 rounded">Issue</span>}
                  {store.canReceive && <span className="px-2 py-1 bg-gray-100 rounded">Receive</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === 'transfers' && (
        <div className="bg-white shadow rounded-lg overflow-hidden">
          {loadingTransfers ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transfer #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From → To</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transfers?.map((transfer) => (
                  <tr key={transfer.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Package className="h-5 w-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{transfer.transferNumber}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-500">
                        {transfer.fromStore?.name || stores?.find(s => s.id === transfer.fromStoreId)?.name || 'Unknown'}
                        <ArrowRight className="h-4 w-4 mx-2 text-gray-400" />
                        {transfer.toStore?.name || stores?.find(s => s.id === transfer.toStoreId)?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusColors[transfer.status]}`}>
                        <StatusIcon status={transfer.status} />
                        <span className="ml-1">{transfer.status.replace('_', ' ').toUpperCase()}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(transfer.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {transfer.status === 'requested' && (
                        <>
                          <button
                            onClick={() => approveMutation.mutate(transfer.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Approve & Dispatch"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => cancelMutation.mutate(transfer.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Cancel"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                      {transfer.status === 'in_transit' && (
                        <button
                          onClick={() => receiveMutation.mutate(transfer.id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Mark Received"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Store Modal */}
      {showStoreModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowStoreModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">
                  {editingStore ? 'Edit Store' : 'New Store'}
                </h3>
                <button onClick={() => setShowStoreModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleStoreSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Name</label>
                  <input
                    type="text"
                    name="name"
                    defaultValue={editingStore?.name}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Code</label>
                  <input
                    type="text"
                    name="code"
                    defaultValue={editingStore?.code}
                    required
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Type</label>
                  <select
                    name="type"
                    defaultValue={editingStore?.type || 'pharmacy'}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="main">Main Store</option>
                    <option value="pharmacy">Pharmacy</option>
                    <option value="ward">Ward</option>
                    <option value="theatre">Theatre</option>
                    <option value="lab">Laboratory</option>
                    <option value="radiology">Radiology</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Capabilities</label>
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="canDispense"
                        value="true"
                        defaultChecked={editingStore?.canDispense ?? true}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Can Dispense</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="canIssue"
                        value="true"
                        defaultChecked={editingStore?.canIssue ?? true}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Can Issue</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        name="canReceive"
                        value="true"
                        defaultChecked={editingStore?.canReceive ?? true}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Can Receive</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    name="isActive"
                    value="true"
                    defaultChecked={editingStore?.isActive ?? true}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 block text-sm text-gray-700">Active</label>
                </div>
                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowStoreModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={storeMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {storeMutation.isPending ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal Placeholder */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setShowTransferModal(false)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">New Stock Transfer</h3>
                <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-gray-500 text-center py-8">
                <Truck className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                Stock transfers are created from the Inventory page when requesting items.
              </p>
              <div className="flex justify-end">
                <button
                  onClick={() => setShowTransferModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
