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
  Droplets,
} from 'lucide-react';
import { labService } from '../services/lab';
import { useFacilityId } from '../lib/facility';
import type { Order, OrderStatus, OrderPriority } from '../types';

const statusColors: Record<OrderStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const priorityColors: Record<OrderPriority, string> = {
  routine: 'bg-gray-100 text-gray-700',
  urgent: 'bg-orange-100 text-orange-800',
  stat: 'bg-red-600 text-white',
};

function getTAT(createdAt: string): { label: string; colorClass: string } {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const label =
    diffHours < 1
      ? `${Math.round(diffHours * 60)}m`
      : `${diffHours.toFixed(1)}h`;
  const colorClass =
    diffHours < 2
      ? 'text-green-600 font-medium'
      : diffHours < 4
      ? 'text-orange-600 font-medium'
      : 'text-red-600 font-bold';
  return { label, colorClass };
}

export default function LabPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectTargetOrder, setCollectTargetOrder] = useState<Order | null>(null);

  // Fetch lab orders via labService
  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['lab-orders', statusFilter, facilityId],
    queryFn: () =>
      labService.orders.list({ facilityId, status: statusFilter || undefined }),
  });

  // Fetch real stats from lab queue
  const { data: statsData } = useQuery({
    queryKey: ['lab-stats', facilityId],
    queryFn: () => labService.dashboard.getQueue(facilityId),
  });

  // Start processing mutation
  const startMutation = useMutation({
    mutationFn: (orderId: string) => labService.orders.startProcessing(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-stats'] });
    },
  });

  const orders: Order[] = (ordersData as any) || [];
  const stats = statsData || {
    pendingCollection: 0,
    pendingProcessing: 0,
    inProgress: 0,
    completedToday: 0,
  };

  const filteredOrders = orders.filter((order) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      order.orderNumber.toLowerCase().includes(search) ||
      order.encounter.patient.mrn.toLowerCase().includes(search) ||
      order.encounter.patient.fullName.toLowerCase().includes(search)
    );
  });

  const openCollect = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollectTargetOrder(order);
    setShowCollectModal(true);
  };

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Droplets className="w-8 h-8 text-yellow-600" />
            <div>
              <p className="text-2xl font-bold text-yellow-900">{stats.pendingCollection}</p>
              <p className="text-sm text-yellow-700">Pending Collection</p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-2xl font-bold text-blue-900">{stats.pendingProcessing}</p>
              <p className="text-sm text-blue-700">Pending Processing</p>
            </div>
          </div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Play className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-2xl font-bold text-purple-900">{stats.inProgress}</p>
              <p className="text-sm text-purple-700">In Progress</p>
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
              filteredOrders.map((order) => {
                const tat = getTAT(order.createdAt);
                return (
                  <div
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`p-4 cursor-pointer hover:bg-gray-50 ${
                      selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900">{order.orderNumber}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[order.status]}`}>
                            {order.status.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${priorityColors[order.priority]}`}>
                            {order.priority.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                          <User className="w-4 h-4 flex-shrink-0" />
                          <span>{order.encounter.patient.fullName}</span>
                          <span className="text-gray-400">•</span>
                          <span>{order.encounter.patient.mrn}</span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-500">
                            {order.testCodes?.length || 0} test(s) • {order.orderedBy?.fullName || 'Unknown'}
                          </p>
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3 h-3 text-gray-400" />
                            <span className={`text-xs ${tat.colorClass}`}>TAT: {tat.label}</span>
                          </div>
                        </div>
                      </div>
                      {order.status === 'pending' && (
                        <button
                          onClick={(e) => openCollect(order, e)}
                          className="ml-2 flex-shrink-0 flex items-center gap-1 px-2 py-1 text-xs bg-teal-50 text-teal-700 border border-teal-200 rounded hover:bg-teal-100"
                          title="Collect Sample"
                        >
                          <Droplets className="w-3 h-3" />
                          Collect
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
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
                  <span className={`px-2 py-0.5 text-xs rounded-full font-semibold ${priorityColors[selectedOrder.priority]}`}>
                    {selectedOrder.priority.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">TAT</span>
                  {(() => {
                    const tat = getTAT(selectedOrder.createdAt);
                    return <span className={`text-sm ${tat.colorClass}`}>{tat.label} elapsed</span>;
                  })()}
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
                  <>
                    <button
                      onClick={(e) => openCollect(selectedOrder, e)}
                      className="flex-1 bg-teal-600 text-white py-2 px-4 rounded-lg hover:bg-teal-700 flex items-center justify-center gap-2"
                    >
                      <Droplets className="w-4 h-4" />
                      Collect Sample
                    </button>
                    <button
                      onClick={() => startMutation.mutate(selectedOrder.id)}
                      disabled={startMutation.isPending}
                      className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <Play className="w-4 h-4" />
                      Start Processing
                    </button>
                  </>
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

      {/* Collect Sample Modal */}
      {showCollectModal && collectTargetOrder && (
        <CollectSampleModal
          order={collectTargetOrder}
          facilityId={facilityId}
          onClose={() => { setShowCollectModal(false); setCollectTargetOrder(null); }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
            queryClient.invalidateQueries({ queryKey: ['lab-stats'] });
            setShowCollectModal(false);
            setCollectTargetOrder(null);
          }}
        />
      )}

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

// Collect Sample Modal
function CollectSampleModal({
  order,
  facilityId,
  onClose,
  onSuccess,
}: {
  order: Order;
  facilityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [sampleType, setSampleType] = useState<'blood' | 'serum' | 'plasma' | 'urine' | 'stool' | 'sputum' | 'csf' | 'swab' | 'tissue' | 'other'>('blood');
  const [priority, setPriority] = useState<'routine' | 'urgent' | 'stat'>(order.priority as 'routine' | 'urgent' | 'stat' || 'routine');
  const [notes, setNotes] = useState('');

  const collectMutation = useMutation({
    mutationFn: () =>
      labService.samples.collect({
        orderId: order.id,
        patientId: order.encounter.patient.id,
        facilityId,
        sampleType,
        priority,
        collectionNotes: notes || undefined,
      }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Collect Sample — {order.orderNumber}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => { e.preventDefault(); collectMutation.mutate(); }}
          className="p-4 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
            <p className="text-sm text-gray-600">{order.encounter.patient.fullName} ({order.encounter.patient.mrn})</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sample Type *</label>
            <select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value as typeof sampleType)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="blood">Blood (EDTA)</option>
              <option value="serum">Serum</option>
              <option value="plasma">Plasma</option>
              <option value="urine">Urine</option>
              <option value="stool">Stool</option>
              <option value="sputum">Sputum</option>
              <option value="csf">CSF</option>
              <option value="swab">Swab</option>
              <option value="tissue">Tissue</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as typeof priority)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="routine">Routine</option>
              <option value="urgent">Urgent</option>
              <option value="stat">STAT</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Collection Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Optional notes..."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={collectMutation.isPending}
              className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Droplets className="w-4 h-4" />
              {collectMutation.isPending ? 'Collecting...' : 'Collect Sample'}
            </button>
          </div>
        </form>
      </div>
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
  const queryClient = useQueryClient();
  const [results, setResults] = useState<Record<string, { value: string; unit: string; refRange: string; abnormal: string }>>({});
  const [interpretation, setInterpretation] = useState('');
  const [error, setError] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      const sampleId = order.sampleId;
      const testCodes = order.testCodes || [];

      if (sampleId) {
        // Use labService.results.enter per test
        const promises = testCodes.map((test) => {
          const data = results[test.code];
          if (!data?.value) return Promise.resolve();
          return labService.results.enter(sampleId, {
            parameter: test.name || test.code,
            value: data.value,
            unit: data.unit || undefined,
            referenceRange: data.refRange || undefined,
            abnormalFlag: data.abnormal || undefined,
            interpretation: interpretation || undefined,
          });
        });
        await Promise.all(promises);
      } else {
        // Fall back to legacy endpoint
        const { default: api } = await import('../services/api');
        const resultsList = testCodes.map((test) => {
          const data = results[test.code] || { value: '', unit: '', refRange: '', abnormal: '' };
          return {
            testCode: test.code,
            testName: test.name,
            resultValue: data.value,
            unit: data.unit,
            referenceRange: data.refRange,
            abnormalFlag: data.abnormal || undefined,
          };
        });
        await api.post(`/orders/${order.id}/lab-results`, { results: resultsList, interpretation });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      onSuccess();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to submit results');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    submitMutation.mutate();
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
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}

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
                    onChange={(e) =>
                      setResults({ ...results, [test.code]: { ...results[test.code], value: e.target.value } })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Unit</label>
                  <input
                    type="text"
                    value={results[test.code]?.unit || ''}
                    onChange={(e) =>
                      setResults({ ...results, [test.code]: { ...results[test.code], unit: e.target.value } })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., mg/dL"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Flag</label>
                  <select
                    value={results[test.code]?.abnormal || ''}
                    onChange={(e) =>
                      setResults({ ...results, [test.code]: { ...results[test.code], abnormal: e.target.value } })
                    }
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
                  onChange={(e) =>
                    setResults({ ...results, [test.code]: { ...results[test.code], refRange: e.target.value } })
                  }
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
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50">
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

