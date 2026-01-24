import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FlaskConical,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  User,
  RefreshCw,
  Play,
  FileText,
  X,
} from 'lucide-react';
import api from '../services/api';
import type { Order, OrderStatus, OrderPriority } from '../types';

// Hardcoded facility ID - should come from user context
const DEFAULT_FACILITY_ID = '00000000-0000-0000-0000-000000000001';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const priorityColors: Record<OrderPriority, string> = {
  routine: 'bg-gray-100 text-gray-800',
  urgent: 'bg-orange-100 text-orange-800',
  stat: 'bg-red-100 text-red-800',
};

export default function LabPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);

  // Fetch lab orders
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['lab-orders', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams({
        orderType: 'lab',
        facilityId: DEFAULT_FACILITY_ID,
      });
      if (statusFilter) params.append('status', statusFilter);
      const response = await api.get(`/orders?${params}`);
      return response.data;
    },
  });

  // Fetch stats
  const { data: statsData } = useQuery({
    queryKey: ['lab-stats'],
    queryFn: async () => {
      const response = await api.get(`/orders/stats/${DEFAULT_FACILITY_ID}?orderType=lab`);
      return response.data;
    },
  });

  // Start processing mutation
  const startMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const response = await api.post(`/orders/${orderId}/start`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-stats'] });
    },
  });

  const orders: Order[] = ordersData?.data || [];
  const stats = statsData || { pending: 0, inProgress: 0, completedToday: 0, urgent: 0, stat: 0 };

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(search) ||
      order.encounter.patient.mrn.toLowerCase().includes(search) ||
      order.encounter.patient.fullName.toLowerCase().includes(search)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratory</h1>
          <p className="text-gray-600">Process lab orders and results</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-white border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
              <p className="text-sm text-yellow-700">Pending</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Play className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">{stats.inProgress}</p>
              <p className="text-sm text-blue-700">In Progress</p>
            </div>
          </div>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold text-green-900">{stats.completedToday}</p>
              <p className="text-sm text-green-700">Completed Today</p>
            </div>
          </div>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-2xl font-bold text-orange-900">{stats.urgent}</p>
              <p className="text-sm text-orange-700">Urgent</p>
            </div>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-2xl font-bold text-red-900">{stats.stat}</p>
              <p className="text-sm text-red-700">STAT</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by order #, MRN, or patient name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Orders List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Lab Orders</h2>
          </div>
          <div className="divide-y max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <FlaskConical className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>No lab orders found</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 ${
                    selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{order.orderNumber}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[order.status]}`}>
                          {order.status.replace('_', ' ')}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColors[order.priority]}`}>
                          {order.priority.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>{order.encounter.patient.fullName}</span>
                        <span className="text-gray-400">•</span>
                        <span>{order.encounter.patient.mrn}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {order.testCodes?.length || 0} test(s) • {order.orderedBy?.fullName || 'Unknown'}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Order Details Panel */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b">
            <h2 className="font-semibold text-gray-900">Order Details</h2>
          </div>
          {selectedOrder ? (
            <div className="p-4">
              {/* Patient Info */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">{selectedOrder.encounter.patient.fullName}</p>
                    <p className="text-sm text-gray-500">
                      {selectedOrder.encounter.patient.mrn} • {selectedOrder.orderNumber}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Info */}
              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[selectedOrder.status]}`}>
                    {selectedOrder.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Priority</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${priorityColors[selectedOrder.priority]}`}>
                    {selectedOrder.priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ordered By</span>
                  <span className="text-gray-900">{selectedOrder.orderedBy?.fullName || 'Unknown'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Ordered At</span>
                  <span className="text-gray-900">{new Date(selectedOrder.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Tests */}
              <div className="mb-4">
                <h3 className="font-medium text-gray-900 mb-2">Tests Ordered</h3>
                <div className="border rounded-lg divide-y">
                  {selectedOrder.testCodes?.map((test, idx) => (
                    <div key={idx} className="p-2 flex justify-between">
                      <span className="text-gray-700">{test.name}</span>
                      <span className="text-gray-500 text-sm">{test.code}</span>
                    </div>
                  )) || (
                    <div className="p-2 text-gray-500">No tests specified</div>
                  )}
                </div>
              </div>

              {/* Instructions */}
              {selectedOrder.instructions && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Instructions</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">{selectedOrder.instructions}</p>
                </div>
              )}

              {/* Clinical Notes */}
              {selectedOrder.clinicalNotes && (
                <div className="mb-4">
                  <h3 className="font-medium text-gray-900 mb-2">Clinical Notes</h3>
                  <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded whitespace-pre-wrap">
                    {selectedOrder.clinicalNotes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3">
                {selectedOrder.status === 'pending' && (
                  <button
                    onClick={() => startMutation.mutate(selectedOrder.id)}
                    disabled={startMutation.isPending}
                    className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Processing
                  </button>
                )}
                {selectedOrder.status === 'in_progress' && (
                  <button
                    onClick={() => setShowResultsModal(true)}
                    className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Enter Results
                  </button>
                )}
                {selectedOrder.status === 'completed' && (
                  <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                    <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                    <p className="text-green-800 font-medium">Completed</p>
                    <p className="text-sm text-green-600">
                      {selectedOrder.completedAt && new Date(selectedOrder.completedAt).toLocaleString()}
                    </p>
                  </div>
                )}
                <button
                  onClick={() => navigate(`/encounters/${selectedOrder.encounterId}`)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  View Visit
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <FlaskConical className="w-12 h-12 mx-auto mb-2 text-gray-300" />
              <p>Select an order to view details</p>
            </div>
          )}
        </div>
      </div>

      {/* Results Modal */}
      {showResultsModal && selectedOrder && (
        <LabResultsModal
          order={selectedOrder}
          onClose={() => setShowResultsModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
            queryClient.invalidateQueries({ queryKey: ['lab-stats'] });
            setShowResultsModal(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </div>
  );
}

// Lab Results Modal
function LabResultsModal({
  order,
  onClose,
  onSuccess,
}: {
  order: Order;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [results, setResults] = useState<Record<string, { value: string; unit: string; refRange: string; abnormal: string }>>({});
  const [interpretation, setInterpretation] = useState('');

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post(`/orders/${order.id}/lab-results`, data);
      return response.data;
    },
    onSuccess,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const resultsList = Object.entries(results).map(([code, data]) => ({
      testCode: code,
      testName: order.testCodes?.find(t => t.code === code)?.name || code,
      resultValue: data.value,
      unit: data.unit,
      referenceRange: data.refRange,
      abnormalFlag: data.abnormal || undefined,
    }));

    submitMutation.mutate({
      results: resultsList,
      interpretation,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Enter Lab Results - {order.orderNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Test Results */}
          {order.testCodes?.map((test) => (
            <div key={test.code} className="border rounded-lg p-3">
              <h3 className="font-medium text-gray-900 mb-3">{test.name} ({test.code})</h3>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Result Value *</label>
                  <input
                    type="text"
                    value={results[test.code]?.value || ''}
                    onChange={(e) => setResults({
                      ...results,
                      [test.code]: { ...results[test.code], value: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unit</label>
                  <input
                    type="text"
                    value={results[test.code]?.unit || ''}
                    onChange={(e) => setResults({
                      ...results,
                      [test.code]: { ...results[test.code], unit: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., mg/dL"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Flag</label>
                  <select
                    value={results[test.code]?.abnormal || ''}
                    onChange={(e) => setResults({
                      ...results,
                      [test.code]: { ...results[test.code], abnormal: e.target.value }
                    })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Normal</option>
                    <option value="high">High</option>
                    <option value="low">Low</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="mt-2">
                <label className="block text-xs text-gray-500 mb-1">Reference Range</label>
                <input
                  type="text"
                  value={results[test.code]?.refRange || ''}
                  onChange={(e) => setResults({
                    ...results,
                    [test.code]: { ...results[test.code], refRange: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., 70-100"
                />
              </div>
            </div>
          ))}

          {/* Interpretation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Interpretation / Comments</label>
            <textarea
              value={interpretation}
              onChange={(e) => setInterpretation(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Overall interpretation of results..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Results'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
