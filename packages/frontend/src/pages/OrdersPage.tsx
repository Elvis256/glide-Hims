import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import {
  Search,
  Loader2,
  FlaskConical,
  Image,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  Eye,
} from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  encounterId: string;
  patientId: string;
  orderType: 'lab' | 'radiology' | 'pharmacy';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'routine' | 'urgent' | 'stat';
  orderedById: string;
  notes?: string;
  createdAt: string;
  patient?: { firstName: string; lastName: string; mrn: string };
  items?: OrderItem[];
}

interface OrderItem {
  id: string;
  name: string;
  code: string;
  status: string;
  result?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const priorityColors: Record<string, string> = {
  routine: 'bg-gray-100 text-gray-800',
  urgent: 'bg-orange-100 text-orange-800',
  stat: 'bg-red-100 text-red-800',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'pending': return <Clock className="h-4 w-4" />;
    case 'in_progress': return <AlertCircle className="h-4 w-4" />;
    case 'completed': return <CheckCircle className="h-4 w-4" />;
    case 'cancelled': return <XCircle className="h-4 w-4" />;
    default: return null;
  }
};

export default function OrdersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'lab' | 'radiology' | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch orders
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', activeTab, statusFilter],
    queryFn: async () => {
      let url = '/orders?';
      if (activeTab !== 'all') url += `type=${activeTab}&`;
      if (statusFilter) url += `status=${statusFilter}&`;
      const response = await api.get(url);
      return response.data as Order[];
    },
  });

  // Update order status mutation
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.put(`/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const filteredOrders = orders?.filter((o) =>
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    o.patient?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
    o.patient?.lastName?.toLowerCase().includes(search.toLowerCase()) ||
    o.patient?.mrn?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    pending: orders?.filter(o => o.status === 'pending').length || 0,
    inProgress: orders?.filter(o => o.status === 'in_progress').length || 0,
    completed: orders?.filter(o => o.status === 'completed').length || 0,
    lab: orders?.filter(o => o.orderType === 'lab').length || 0,
    radiology: orders?.filter(o => o.orderType === 'radiology').length || 0,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders Management</h1>
          <p className="mt-1 text-sm text-gray-500">Track and manage lab and radiology orders</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{stats.inProgress}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-gray-900">{stats.completed}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <FlaskConical className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Lab Orders</p>
              <p className="text-2xl font-bold text-gray-900">{stats.lab}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Image className="h-8 w-8 text-cyan-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Radiology</p>
              <p className="text-2xl font-bold text-gray-900">{stats.radiology}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            All Orders
          </button>
          <button
            onClick={() => setActiveTab('lab')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'lab'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FlaskConical className="h-4 w-4 inline mr-2" />
            Lab Queue
          </button>
          <button
            onClick={() => setActiveTab('radiology')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'radiology'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Image className="h-4 w-4 inline mr-2" />
            Radiology Queue
          </button>
        </nav>
      </div>

      {/* Search/Filter */}
      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order #, patient name, or MRN..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md py-2 px-3 text-sm focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Orders Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filteredOrders?.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>No orders found</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders?.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {order.orderType === 'lab' ? (
                        <FlaskConical className="h-5 w-5 text-purple-500 mr-2" />
                      ) : (
                        <Image className="h-5 w-5 text-cyan-500 mr-2" />
                      )}
                      <span className="text-sm font-medium text-gray-900">{order.orderNumber}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.patient?.firstName} {order.patient?.lastName}
                    </div>
                    <div className="text-sm text-gray-500">{order.patient?.mrn}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                    {order.orderType}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[order.priority]}`}>
                      {order.priority.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusColors[order.status]}`}>
                      <StatusIcon status={order.status} />
                      <span className="ml-1">{order.status.replace('_', ' ').toUpperCase()}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="text-blue-600 hover:text-blue-900"
                      title="View Details"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    {order.status === 'pending' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'in_progress' })}
                        className="text-orange-600 hover:text-orange-900"
                        title="Start Processing"
                      >
                        <AlertCircle className="h-5 w-5" />
                      </button>
                    )}
                    {order.status === 'in_progress' && (
                      <button
                        onClick={() => updateStatusMutation.mutate({ id: order.id, status: 'completed' })}
                        className="text-green-600 hover:text-green-900"
                        title="Mark Complete"
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

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={() => setSelectedOrder(null)} />
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium text-gray-900">Order Details</h3>
                <button onClick={() => setSelectedOrder(null)} className="text-gray-400 hover:text-gray-500">
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Order Number</p>
                    <p className="font-medium">{selectedOrder.orderNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Type</p>
                    <p className="font-medium capitalize">{selectedOrder.orderType}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Priority</p>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[selectedOrder.priority]}`}>
                      {selectedOrder.priority.toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${statusColors[selectedOrder.status]}`}>
                      <StatusIcon status={selectedOrder.status} />
                      <span className="ml-1">{selectedOrder.status.replace('_', ' ')}</span>
                    </span>
                  </div>
                </div>
                {selectedOrder.notes && (
                  <div>
                    <p className="text-sm text-gray-500">Notes</p>
                    <p className="text-sm mt-1 p-2 bg-gray-50 rounded">{selectedOrder.notes}</p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 mb-2">Order Items</p>
                  <div className="bg-gray-50 rounded p-4">
                    {selectedOrder.items?.length ? (
                      <ul className="space-y-2">
                        {selectedOrder.items.map((item, idx) => (
                          <li key={idx} className="flex items-center justify-between text-sm">
                            <span>{item.name}</span>
                            <span className="text-gray-500">{item.status}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500">No items data available</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setSelectedOrder(null)}
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
