import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useFacilityId } from '../../lib/facility';
import { radiologyService } from '../../services/radiology';
import type { ImagingOrder, CreateImagingOrderDto } from '../../services/radiology';
import { patientsService } from '../../services/patients';
import type { Patient } from '../../services/patients';
import {
  Search,
  Filter,
  Calendar,
  User,
  FileText,
  Plus,
  ChevronRight,
  X,
  Play,
  Check,
  Ban,
  Loader2,
} from 'lucide-react';

type DisplayStatus = 'Pending' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

function mapApiStatus(status: string): DisplayStatus {
  switch (status) {
    case 'ordered':
    case 'pending': return 'Pending';
    case 'scheduled': return 'Scheduled';
    case 'in_progress': return 'In Progress';
    case 'completed':
    case 'reported': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return 'Pending';
  }
}

function getPatientDisplayName(order: ImagingOrder): string {
  if (order.patient?.fullName) return order.patient.fullName;
  if (order.patient?.firstName) return `${order.patient.firstName} ${order.patient.lastName || ''}`.trim();
  return 'Unknown Patient';
}

function getPatientMrn(order: ImagingOrder): string {
  return order.patient?.mrn || order.patientId;
}

function getModalityName(order: ImagingOrder): string {
  if (typeof order.modality === 'string') return order.modality;
  if (order.modality && typeof order.modality === 'object') return (order.modality as { name: string }).name;
  return '';
}

function getOrderingPhysician(order: ImagingOrder): string {
  if (order.orderedBy?.fullName) return order.orderedBy.fullName;
  if (order.orderedBy?.firstName) return `${order.orderedBy.firstName} ${order.orderedBy.lastName || ''}`.trim();
  if (order.doctor?.fullName) return order.doctor.fullName;
  return '';
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'Pending': return 'bg-yellow-100 text-yellow-800';
    case 'Scheduled': return 'bg-blue-100 text-blue-800';
    case 'In Progress': return 'bg-orange-100 text-orange-800';
    case 'Completed': return 'bg-green-100 text-green-800';
    case 'Cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

interface NewOrderFormData {
  patientSearch: string;
  selectedPatient: Patient | null;
  modalityId: string;
  studyType: string;
  clinicalIndication: string;
  priority: 'routine' | 'urgent' | 'stat';
}

interface ScheduleFormData {
  scheduledDate: string;
  scheduledTime: string;
}

export default function ImagingOrdersPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<DisplayStatus | 'All'>('All');
  const [selectedOrder, setSelectedOrder] = useState<ImagingOrder | null>(null);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState<NewOrderFormData>({
    patientSearch: '',
    selectedPatient: null,
    modalityId: '',
    studyType: '',
    clinicalIndication: '',
    priority: 'routine',
  });
  const [scheduleForm, setScheduleForm] = useState<ScheduleFormData>({
    scheduledDate: '',
    scheduledTime: '',
  });

  if (!hasPermission('radiology.orders')) {
    return <AccessDenied />;
  }

  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['radiology-orders', facilityId],
    queryFn: () => radiologyService.orders.list(facilityId),
    enabled: !!facilityId,
  });

  const { data: modalities = [] } = useQuery({
    queryKey: ['radiology-modalities', facilityId],
    queryFn: () => radiologyService.modalities.list(facilityId, { active: true }),
    enabled: !!facilityId && showNewOrderModal,
  });

  const { data: patientResults } = useQuery({
    queryKey: ['patients-search', newOrderForm.patientSearch],
    queryFn: () => patientsService.search({ search: newOrderForm.patientSearch, limit: 5 }),
    enabled: newOrderForm.patientSearch.length >= 2,
  });

  const createOrderMutation = useMutation({
    mutationFn: (data: CreateImagingOrderDto) => radiologyService.orders.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] });
      setShowNewOrderModal(false);
      setNewOrderForm({ patientSearch: '', selectedPatient: null, modalityId: '', studyType: '', clinicalIndication: '', priority: 'routine' });
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ orderId, scheduledAt }: { orderId: string; scheduledAt: string }) =>
      radiologyService.orders.schedule(orderId, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] });
      setShowScheduleModal(false);
    },
  });

  const startMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.start(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] }),
  });

  const completeMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.complete(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] }),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.cancel(orderId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] }),
  });

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const patientName = getPatientDisplayName(order);
      const mrn = getPatientMrn(order);
      const displayStatus = mapApiStatus(order.status);
      const matchesSearch =
        patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mrn.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.studyType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || displayStatus === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [orders, searchTerm, selectedStatus]);

  const handleCreateOrder = () => {
    if (!newOrderForm.selectedPatient || !newOrderForm.modalityId || !newOrderForm.studyType) return;
    createOrderMutation.mutate({
      facilityId,
      patientId: newOrderForm.selectedPatient.id,
      modalityId: newOrderForm.modalityId,
      studyType: newOrderForm.studyType,
      clinicalIndication: newOrderForm.clinicalIndication,
      priority: newOrderForm.priority,
    });
  };

  const handleSchedule = () => {
    if (!selectedOrder || !scheduleForm.scheduledDate) return;
    const scheduledAt = scheduleForm.scheduledTime
      ? `${scheduleForm.scheduledDate}T${scheduleForm.scheduledTime}:00`
      : `${scheduleForm.scheduledDate}T00:00:00`;
    scheduleMutation.mutate({ orderId: selectedOrder.id, scheduledAt });
  };

  const isActionLoading = startMutation.isPending || completeMutation.isPending || cancelMutation.isPending;
  const hasActionError = startMutation.isError || completeMutation.isError || cancelMutation.isError || scheduleMutation.isError;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Imaging Orders</h1>
          <p className="text-gray-600">View and manage radiology orders</p>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, ID, or study type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as DisplayStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Scheduled">Scheduled</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Orders List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-auto h-full">
            {loadingOrders ? (
              <div className="p-12 text-center text-gray-500">
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
                <p>Loading orders...</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredOrders.length === 0 && (
                  <div className="p-12 text-center text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No imaging orders</p>
                  </div>
                )}
                {filteredOrders.map((order) => {
                  const displayStatus = mapApiStatus(order.status);
                  return (
                    <div
                      key={order.id}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedOrder?.id === order.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <User className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">{getPatientDisplayName(order)}</h3>
                              <span className="text-sm text-gray-500">{getPatientMrn(order)}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-700 mt-1">{order.studyType}</p>
                            <p className="text-sm text-gray-500 mt-1">{order.clinicalIndication || order.clinicalHistory}</p>
                            <div className="flex items-center gap-3 mt-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}>
                                {displayStatus}
                              </span>
                              {order.priority && order.priority !== 'routine' && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${order.priority === 'stat' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                  {order.priority.toUpperCase()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">{new Date(order.orderedAt).toLocaleDateString()}</p>
                          {order.scheduledAt && (
                            <p className="text-sm font-medium text-blue-600 mt-1">
                              {new Date(order.scheduledAt).toLocaleDateString()}{' '}
                              {new Date(order.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                          <ChevronRight className="w-5 h-5 text-gray-400 mt-2 ml-auto" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Order Details Panel */}
        {selectedOrder ? (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="font-semibold text-gray-900">Order Details</h2>
              <p className="text-sm text-gray-500">{selectedOrder.orderNumber || selectedOrder.id}</p>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Patient Information</h3>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{getPatientDisplayName(selectedOrder)}</p>
                    <p className="text-sm text-gray-500">{getPatientMrn(selectedOrder)}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Study Information</h3>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-gray-500">Study Type</p>
                    <p className="font-medium text-gray-900">{selectedOrder.studyType}</p>
                  </div>
                  {getModalityName(selectedOrder) && (
                    <div>
                      <p className="text-xs text-gray-500">Modality</p>
                      <p className="text-gray-900">{getModalityName(selectedOrder)}</p>
                    </div>
                  )}
                  {(selectedOrder.clinicalIndication || selectedOrder.clinicalHistory) && (
                    <div>
                      <p className="text-xs text-gray-500">Clinical Indication</p>
                      <p className="text-gray-900">{selectedOrder.clinicalIndication || selectedOrder.clinicalHistory}</p>
                    </div>
                  )}
                  {getOrderingPhysician(selectedOrder) && (
                    <div>
                      <p className="text-xs text-gray-500">Ordering Physician</p>
                      <p className="text-gray-900">{getOrderingPhysician(selectedOrder)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Priority</p>
                    <p className="text-gray-900 capitalize">{selectedOrder.priority}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(mapApiStatus(selectedOrder.status))}`}>
                      {mapApiStatus(selectedOrder.status)}
                    </span>
                  </div>
                </div>
              </div>

              {selectedOrder.scheduledAt && (
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">Schedule</h3>
                  <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-900">{new Date(selectedOrder.scheduledAt).toLocaleDateString()}</p>
                      <p className="text-sm text-blue-700">
                        {new Date(selectedOrder.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-wrap gap-2">
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'ordered') && (
                  <button
                    onClick={() => { setScheduleForm({ scheduledDate: '', scheduledTime: '' }); setShowScheduleModal(true); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>
                )}
                {selectedOrder.status === 'scheduled' && (
                  <button
                    onClick={() => startMutation.mutate(selectedOrder.id)}
                    disabled={isActionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Start
                  </button>
                )}
                {selectedOrder.status === 'in_progress' && (
                  <button
                    onClick={() => completeMutation.mutate(selectedOrder.id)}
                    disabled={isActionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm disabled:opacity-50"
                  >
                    {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Complete
                  </button>
                )}
                {!['completed', 'reported', 'cancelled'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => cancelMutation.mutate(selectedOrder.id)}
                    disabled={isActionLoading}
                    className="flex items-center justify-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                    Cancel
                  </button>
                )}
                <button className="flex items-center justify-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm">
                  <FileText className="w-4 h-4" />
                  View Order
                </button>
              </div>
              {hasActionError && (
                <p className="mt-2 text-xs text-red-600">Action failed. Please try again.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Select an order to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrderModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">New Imaging Order</h2>
              <button onClick={() => setShowNewOrderModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Patient *</label>
                {newOrderForm.selectedPatient ? (
                  <div className="flex items-center justify-between p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{newOrderForm.selectedPatient.firstName} {newOrderForm.selectedPatient.lastName}</p>
                      <p className="text-sm text-gray-500">{newOrderForm.selectedPatient.mrn}</p>
                    </div>
                    <button
                      onClick={() => setNewOrderForm(f => ({ ...f, selectedPatient: null, patientSearch: '' }))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search patient by name or MRN..."
                      value={newOrderForm.patientSearch}
                      onChange={(e) => setNewOrderForm(f => ({ ...f, patientSearch: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {patientResults?.data && patientResults.data.length > 0 && (
                      <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                        {patientResults.data.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => setNewOrderForm(f => ({ ...f, selectedPatient: p, patientSearch: '' }))}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          >
                            <span className="font-medium">{p.firstName} {p.lastName}</span>
                            <span className="text-gray-500 ml-2">{p.mrn}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Modality *</label>
                <select
                  value={newOrderForm.modalityId}
                  onChange={(e) => setNewOrderForm(f => ({ ...f, modalityId: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select modality...</option>
                  {modalities.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Study Type *</label>
                <input
                  type="text"
                  placeholder="e.g. Chest X-Ray PA/Lateral"
                  value={newOrderForm.studyType}
                  onChange={(e) => setNewOrderForm(f => ({ ...f, studyType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Indication</label>
                <textarea
                  placeholder="Reason for exam..."
                  value={newOrderForm.clinicalIndication}
                  onChange={(e) => setNewOrderForm(f => ({ ...f, clinicalIndication: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                <select
                  value={newOrderForm.priority}
                  onChange={(e) => setNewOrderForm(f => ({ ...f, priority: e.target.value as 'routine' | 'urgent' | 'stat' }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="stat">STAT</option>
                </select>
              </div>

              {createOrderMutation.isError && (
                <p className="text-sm text-red-600">Failed to create order. Please try again.</p>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowNewOrderModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateOrder}
                disabled={!newOrderForm.selectedPatient || !newOrderForm.modalityId || !newOrderForm.studyType || createOrderMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {createOrderMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Imaging</h2>
              <button onClick={() => setShowScheduleModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600">
                Scheduling <span className="font-medium">{selectedOrder.studyType}</span> for{' '}
                <span className="font-medium">{getPatientDisplayName(selectedOrder)}</span>
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  value={scheduleForm.scheduledDate}
                  onChange={(e) => setScheduleForm(f => ({ ...f, scheduledDate: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                <input
                  type="time"
                  value={scheduleForm.scheduledTime}
                  onChange={(e) => setScheduleForm(f => ({ ...f, scheduledTime: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {scheduleMutation.isError && (
                <p className="text-sm text-red-600">Failed to schedule. Please try again.</p>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t">
              <button
                onClick={() => setShowScheduleModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleSchedule}
                disabled={!scheduleForm.scheduledDate || scheduleMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {scheduleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
