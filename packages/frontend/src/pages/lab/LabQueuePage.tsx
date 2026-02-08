import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  FlaskConical,
  Clock,
  AlertTriangle,
  CheckCircle,
  Filter,
  User,
  Calendar,
  Timer,
  Play,
  UserCheck,
  RefreshCw,
  Loader2,
  Droplets,
  FileText,
  Eye,
  X,
  Printer,
  TestTube,
  Stethoscope,
  Phone,
  MapPin,
  ClipboardList,
} from 'lucide-react';
import { labService, type LabOrder } from '../../services';
import { useFacilityId } from '../../lib/facility';
import { getApiErrorMessage } from '../../services/api';

type Priority = 'stat' | 'urgent' | 'routine';
type Status = 'pending' | 'in_progress' | 'completed' | 'cancelled';



const technicians = ['Tech. Sarah', 'Tech. Mike', 'Tech. John', 'Tech. Anna'];

const priorityColors: Record<Priority, string> = {
  stat: 'bg-red-100 text-red-700 border-red-300',
  urgent: 'bg-orange-100 text-orange-700 border-orange-300',
  routine: 'bg-blue-100 text-blue-700 border-blue-300',
};

const statusColors: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="w-3.5 h-3.5" />,
  in_progress: <Play className="w-3.5 h-3.5" />,
  completed: <CheckCircle className="w-3.5 h-3.5" />,
  cancelled: <AlertTriangle className="w-3.5 h-3.5" />,
};

export default function LabQueuePage() {
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const facilityId = useFacilityId();
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterTest, setFilterTest] = useState('');
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectingOrder, setCollectingOrder] = useState<LabOrder | null>(null);
  const [collectionNotes, setCollectionNotes] = useState('');

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

  // Fetch lab orders
  const { data: ordersData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['lab-orders', facilityId],
    queryFn: () => labService.orders.list({ facilityId }),
    staleTime: 15000,
    refetchInterval: 20000,
    retry: 1,
  });

  // Assign technician mutation
  const assignMutation = useMutation({
    mutationFn: (data: { orderId: string; technician: string }) =>
      labService.orders.assign(data.orderId, data.technician),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      toast.success(`Order assigned to ${variables.technician}`);
    },
    onError: () => {
      toast.error('Failed to assign technician');
    },
  });

  // Update status mutation
  const updateStatusMutation = useMutation({
    mutationFn: (data: { orderId: string; status: string }) =>
      labService.orders.updateStatus(data.orderId, data.status),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      const statusMessages: Record<string, string> = {
        in_progress: 'Order started - sample collection in progress',
        completed: 'Order marked as completed',
        cancelled: 'Order cancelled',
      };
      toast.success(statusMessages[variables.status] || 'Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    },
  });

  // Collect sample mutation - chains to start processing on success
  const collectSampleMutation = useMutation({
    mutationFn: async (data: { orderId: string; patientId: string; labTestCode: string; sampleType: string; notes?: string }) => {
      // First collect the sample
      await labService.samples.collect({
        orderId: data.orderId,
        patientId: data.patientId,
        facilityId,
        labTestCode: data.labTestCode,
        sampleType: data.sampleType as any,
        collectionNotes: data.notes,
      });
      // Then update order status to in_progress
      await labService.orders.startProcessing(data.orderId);
      return data.orderId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-samples'] });
      toast.success('Sample collected and processing started');
      setShowCollectModal(false);
      setCollectingOrder(null);
      setCollectionNotes('');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to collect sample'));
    },
  });

  // Start processing mutation (for standalone use)
  const startProcessingMutation = useMutation({
    mutationFn: (orderId: string) => labService.orders.startProcessing(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      toast.success('Processing started');
    },
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to start processing'));
    },
  });

  // Handle API response
  const orders: LabOrder[] = ordersData || [];

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => filterStatus === 'all' || order.status === filterStatus)
      .filter((order) => filterPriority === 'all' || order.priority === filterPriority)
      .filter((order) => !filterTest || order.tests?.some((t: { testName?: string }) => t.testName?.toLowerCase().includes(filterTest.toLowerCase())))
      .sort((a, b) => {
        const priorityOrder: Record<string, number> = { stat: 0, urgent: 1, routine: 2 };
        return (priorityOrder[a.priority || 'routine'] || 2) - (priorityOrder[b.priority || 'routine'] || 2);
      });
  }, [orders, filterStatus, filterPriority, filterTest]);

  const handleAssign = (orderId: string, technician: string) => {
    if (technician) {
      assignMutation.mutate({ orderId, technician });
    }
    setAssigningOrder(null);
  };

  const handleViewOrder = (order: LabOrder) => {
    setSelectedOrder(order);
    setShowViewModal(true);
  };

  const handleCollectSample = (order: LabOrder) => {
    setCollectingOrder(order);
    setShowCollectModal(true);
  };

  const handleStartProcessing = (orderId: string) => {
    startProcessingMutation.mutate(orderId);
  };

  const handlePrintLabels = (order: LabOrder) => {
    // Generate and print sample labels
    const printContent = `
      <html>
        <head>
          <title>Lab Sample Labels</title>
          <style>
            body { font-family: Arial, sans-serif; }
            .label { border: 1px solid #000; padding: 10px; margin: 10px; width: 200px; }
            .barcode { font-family: monospace; font-size: 14px; letter-spacing: 2px; }
            .patient-name { font-weight: bold; font-size: 12px; }
            .mrn { font-size: 10px; color: #666; }
            .test { font-size: 11px; margin-top: 5px; }
            .date { font-size: 9px; color: #888; margin-top: 5px; }
          </style>
        </head>
        <body>
          ${order.tests?.map((test, i) => `
            <div class="label">
              <div class="barcode">${order.orderNumber}-${i + 1}</div>
              <div class="patient-name">${order.patient?.fullName || 'Unknown'}</div>
              <div class="mrn">MRN: ${order.patient?.mrn || 'N/A'}</div>
              <div class="test">${test.testName}</div>
              <div class="date">${new Date().toLocaleString()}</div>
            </div>
          `).join('') || ''}
        </body>
      </html>
    `;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
    toast.success('Labels sent to printer');
  };

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const stats = useMemo(() => ({
    stat: orders.filter((o) => o.priority === 'stat' && o.status !== 'completed').length,
    urgent: orders.filter((o) => o.priority === 'urgent' && o.status !== 'completed').length,
    pending: orders.filter((o) => o.status === 'pending').length,
    completed: orders.filter((o) => o.status === 'completed').length,
  }), [orders]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <FlaskConical className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Queue</h1>
            <p className="text-sm text-gray-500">Manage laboratory orders by priority</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-center">
            <p className="text-xl font-bold text-red-600">{stats.stat}</p>
            <p className="text-xs text-red-500">STAT</p>
          </div>
          <div className="px-4 py-2 bg-orange-50 border border-orange-200 rounded-lg text-center">
            <p className="text-xl font-bold text-orange-600">{stats.urgent}</p>
            <p className="text-xs text-orange-500">Urgent</p>
          </div>
          <div className="px-4 py-2 bg-gray-100 border border-gray-200 rounded-lg text-center">
            <p className="text-xl font-bold text-gray-600">{stats.pending}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-xl font-bold text-green-600">{stats.completed}</p>
            <p className="text-xs text-green-500">Completed</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-4 p-3 bg-white rounded-lg border border-gray-200">
        <Filter className="w-5 h-5 text-gray-400" />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as Status | 'all')}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | 'all')}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Priorities</option>
          <option value="stat">STAT</option>
          <option value="urgent">Urgent</option>
          <option value="routine">Routine</option>
        </select>
        <input
          type="text"
          placeholder="Search by test type..."
          value={filterTest}
          onChange={(e) => setFilterTest(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 w-48"
        />
        <div className="flex items-center gap-2 ml-auto text-sm text-gray-500">
          <Calendar className="w-4 h-4" />
          <span>Today: {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          )}
          {!isLoading && (
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr className="text-left text-sm text-gray-600">
                  <th className="px-4 py-3 font-medium">Order ID</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Tests</th>
                  <th className="px-4 py-3 font-medium">Priority</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Wait Time</th>
                  <th className="px-4 py-3 font-medium">Assigned To</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    <FlaskConical className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No orders in queue</p>
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => {
                  const status = (order.status || 'pending') as Status;
                  const priority = (order.priority || 'routine') as Priority;
                  return (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{order.orderNumber || order.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="font-medium text-gray-900">{order.patient?.fullName || 'Unknown'}</p>
                            <p className="text-xs text-gray-500">{order.patient?.mrn || ''}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {order.tests?.map((test: { id: string; testName?: string }) => (
                            <span key={test.id} className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                              {test.testName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded border text-xs font-medium ${priorityColors[priority]}`}>
                          {priority === 'stat' && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                          {priority.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit ${statusColors[status]}`}>
                          {statusIcons[status]}
                          {statusLabels[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Timer className="w-4 h-4 text-gray-400" />
                          {getWaitTime(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {assigningOrder === order.id ? (
                          <select
                            autoFocus
                            onChange={(e) => handleAssign(order.id, e.target.value)}
                            onBlur={() => setAssigningOrder(null)}
                            className="px-2 py-1 border border-gray-300 rounded text-sm"
                          >
                            <option value="">Select...</option>
                            {technicians.map((tech) => (
                              <option key={tech} value={tech}>{tech}</option>
                            ))}
                          </select>
                        ) : order.assignedTo ? (
                          <span className="flex items-center gap-1 text-sm text-gray-700">
                            <UserCheck className="w-4 h-4 text-green-500" />
                            {order.assignedTo}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleCollectSample(order)}
                                className="px-3 py-1 bg-rose-600 text-white text-sm rounded hover:bg-rose-700 transition-colors flex items-center gap-1"
                                title="Collect Sample"
                              >
                                <Droplets className="w-3.5 h-3.5" />
                                Collect
                              </button>
                              <button
                                onClick={() => handlePrintLabels(order)}
                                className="px-2 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors"
                                title="Print Labels"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>
                              {!order.assignedTo && (
                                <button
                                  onClick={() => setAssigningOrder(order.id)}
                                  className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                                >
                                  Assign
                                </button>
                              )}
                            </>
                          )}
                          {status === 'in_progress' && (
                            <>
                              <button
                                onClick={() => navigate(`/lab/results?orderId=${order.id}`)}
                                className="px-3 py-1 bg-emerald-600 text-white text-sm rounded hover:bg-emerald-700 transition-colors flex items-center gap-1"
                                title="Enter Results"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                Results
                              </button>
                              <button
                                onClick={() => updateStatusMutation.mutate({ orderId: order.id, status: 'completed' })}
                                disabled={updateStatusMutation.isPending}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50"
                              >
                                {updateStatusMutation.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                )}
                                Complete
                              </button>
                            </>
                          )}
                          {status === 'completed' && (
                            <button
                              onClick={() => handleViewOrder(order)}
                              className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded hover:bg-gray-200 transition-colors flex items-center gap-1"
                              title="View Results"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* View Order Modal */}
      {showViewModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-500">{selectedOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => { setShowViewModal(false); setSelectedOrder(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Patient Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-gray-900">Patient Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Name</p>
                    <p className="font-medium">{selectedOrder.patient?.fullName || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">MRN</p>
                    <p className="font-medium">{selectedOrder.patient?.mrn || 'N/A'}</p>
                  </div>
                  {selectedOrder.patient?.phone && (
                    <div className="flex items-center gap-1">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{selectedOrder.patient.phone}</span>
                    </div>
                  )}
                  {selectedOrder.patient?.room && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>Room: {selectedOrder.patient.room}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Info */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <ClipboardList className="w-5 h-5 text-indigo-600" />
                  <h3 className="font-semibold text-gray-900">Order Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Priority</p>
                    <span className={`px-2 py-1 rounded border text-xs font-medium ${priorityColors[(selectedOrder.priority || 'routine') as Priority]}`}>
                      {(selectedOrder.priority || 'routine').toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500">Status</p>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColors[selectedOrder.status || 'pending']}`}>
                      {statusLabels[selectedOrder.status || 'pending']}
                    </span>
                  </div>
                  <div>
                    <p className="text-gray-500">Ordered By</p>
                    <p className="font-medium">{selectedOrder.doctor?.fullName || selectedOrder.orderedBy || 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Order Date</p>
                    <p className="font-medium">{new Date(selectedOrder.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedOrder.assignedTo && (
                    <div>
                      <p className="text-gray-500">Assigned To</p>
                      <p className="font-medium flex items-center gap-1">
                        <UserCheck className="w-4 h-4 text-green-500" />
                        {selectedOrder.assignedTo}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Tests */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <TestTube className="w-5 h-5 text-rose-600" />
                  <h3 className="font-semibold text-gray-900">Tests Ordered</h3>
                </div>
                <div className="space-y-2">
                  {selectedOrder.tests?.map((test: { id: string; testName?: string; name?: string; testCode?: string }) => (
                    <div key={test.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">{test.testName || test.name}</p>
                        {test.testCode && <p className="text-xs text-gray-500">Code: {test.testCode}</p>}
                      </div>
                      <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
                        {selectedOrder.sampleType || 'Blood'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clinical Notes */}
              {selectedOrder.clinicalNotes && (
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <Stethoscope className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-gray-900">Clinical Notes</h3>
                  </div>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedOrder.clinicalNotes}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => handlePrintLabels(selectedOrder)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Labels
              </button>
              {selectedOrder.status === 'pending' && (
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    handleCollectSample(selectedOrder);
                  }}
                  className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-2"
                >
                  <Droplets className="w-4 h-4" />
                  Collect Sample
                </button>
              )}
              {selectedOrder.encounterId && (
                <button
                  onClick={() => navigate(`/encounters/${selectedOrder.encounterId}`)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  View Encounter
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sample Collection Modal */}
      {showCollectModal && collectingOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Collect Sample</h2>
                <p className="text-sm text-gray-500">{collectingOrder.orderNumber}</p>
              </div>
              <button
                onClick={() => { setShowCollectModal(false); setCollectingOrder(null); setCollectionNotes(''); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {/* Patient Info Summary */}
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <User className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{collectingOrder.patient?.fullName || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">MRN: {collectingOrder.patient?.mrn || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Tests to Collect */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Tests to Collect</label>
                <div className="space-y-2">
                  {collectingOrder.tests?.map((test: { id: string; testName?: string }) => (
                    <div key={test.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <TestTube className="w-4 h-4 text-rose-500" />
                      <span className="text-sm">{test.testName}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sample Type</label>
                <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <Droplets className="w-5 h-5 text-rose-600" />
                  <span className="font-medium text-rose-700 capitalize">{collectingOrder.sampleType || 'Blood'}</span>
                </div>
              </div>

              {/* Collection Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Notes (Optional)</label>
                <textarea
                  value={collectionNotes}
                  onChange={(e) => setCollectionNotes(e.target.value)}
                  placeholder="Any special notes about sample collection..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => { setShowCollectModal(false); setCollectingOrder(null); setCollectionNotes(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePrintLabels(collectingOrder)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print Labels
              </button>
              <button
                onClick={() => {
                  if (collectingOrder.tests && collectingOrder.tests[0]) {
                    collectSampleMutation.mutate({
                      orderId: collectingOrder.id,
                      patientId: collectingOrder.patientId,
                      labTestCode: collectingOrder.tests[0].testCode || collectingOrder.tests[0].id,
                      sampleType: collectingOrder.sampleType || 'blood',
                      notes: collectionNotes,
                    });
                  } else {
                    toast.error('No tests found for this order');
                  }
                }}
                disabled={collectSampleMutation.isPending}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 flex items-center gap-2 disabled:opacity-50"
              >
                {collectSampleMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Droplets className="w-4 h-4" />
                )}
                Confirm Collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
