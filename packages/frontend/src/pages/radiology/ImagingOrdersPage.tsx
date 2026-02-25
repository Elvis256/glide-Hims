import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useFacilityId } from '../../lib/facility';
import { radiologyService } from '../../services/radiology';
import type { ImagingOrder, CreateImagingOrderDto } from '../../services/radiology';
import { patientsService } from '../../services/patients';
import type { Patient } from '../../services/patients';
import { toast } from 'sonner';
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
  Activity,
  Clock,
  AlertTriangle,
  Zap,
  Image,
  ClipboardList,
  Stethoscope,
  Timer,
  MapPin,
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
    case 'Pending': return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'Scheduled': return 'bg-blue-100 text-blue-800 border border-blue-200';
    case 'In Progress': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
    case 'Completed': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
    case 'Cancelled': return 'bg-red-100 text-red-800 border border-red-200';
    default: return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
}

function getPriorityConfig(priority: string) {
  switch (priority) {
    case 'stat': return { label: 'STAT', className: 'bg-red-600 text-white animate-pulse', icon: Zap };
    case 'urgent': return { label: 'URGENT', className: 'bg-orange-500 text-white', icon: AlertTriangle };
    default: return { label: 'Routine', className: 'bg-gray-100 text-gray-600', icon: null };
  }
}

function getModalityIcon(order: ImagingOrder): string {
  const type = typeof order.modality === 'object' && order.modality ? (order.modality as any).modalityType : '';
  switch (type) {
    case 'xray': return '🦴';
    case 'ct': return '🧠';
    case 'mri': return '🧲';
    case 'ultrasound': return '📡';
    case 'mammography': return '🎀';
    case 'fluoroscopy': return '📺';
    default: return '🔬';
  }
}

function getTimeSince(date: string): string {
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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
      toast.success('Imaging order created successfully');
    },
    onError: () => toast.error('Failed to create order'),
  });

  const scheduleMutation = useMutation({
    mutationFn: ({ orderId, scheduledAt }: { orderId: string; scheduledAt: string }) =>
      radiologyService.orders.schedule(orderId, scheduledAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] });
      setShowScheduleModal(false);
      toast.success('Study scheduled successfully');
    },
    onError: () => toast.error('Failed to schedule study'),
  });

  const startMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.start(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] });
      toast.success('Imaging started');
    },
    onError: () => toast.error('Failed to start imaging'),
  });

  const completeMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.complete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] });
      toast.success('Imaging completed');
    },
    onError: () => toast.error('Failed to complete imaging'),
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => radiologyService.orders.cancel(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radiology-orders', facilityId] });
      toast.success('Order cancelled');
    },
    onError: () => toast.error('Failed to cancel order'),
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

  // Summary stats
  const stats = useMemo(() => {
    const pending = orders.filter(o => ['ordered', 'pending'].includes(o.status)).length;
    const scheduled = orders.filter(o => o.status === 'scheduled').length;
    const inProgress = orders.filter(o => o.status === 'in_progress').length;
    const completed = orders.filter(o => ['completed', 'reported'].includes(o.status)).length;
    const statPriority = orders.filter(o => o.priority === 'stat' && !['completed', 'reported', 'cancelled'].includes(o.status)).length;
    return { total: orders.length, pending, scheduled, inProgress, completed, statPriority };
  }, [orders]);

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
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-sm">
            <Image className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Imaging Orders</h1>
            <p className="text-sm text-gray-500">View and manage radiology orders</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewOrderModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Order
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-5 gap-3 mb-5">
        {[
          { label: 'Total Orders', value: stats.total, icon: ClipboardList, color: 'text-gray-700', bg: 'bg-white' },
          { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Scheduled', value: stats.scheduled, icon: Calendar, color: 'text-blue-700', bg: 'bg-blue-50' },
          { label: 'In Progress', value: stats.inProgress, icon: Activity, color: 'text-indigo-700', bg: 'bg-indigo-50' },
          { label: 'Completed', value: stats.completed, icon: Check, color: 'text-emerald-700', bg: 'bg-emerald-50' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-xl border border-gray-200 p-3.5 flex items-center gap-3`}>
            <div className={`p-2 rounded-lg ${stat.bg === 'bg-white' ? 'bg-gray-100' : stat.bg}`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-200 mb-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by patient name, MRN, or study type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value as DisplayStatus | 'All')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Scheduled">Scheduled</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          {stats.statPriority > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
              <Zap className="w-4 h-4" />
              {stats.statPriority} STAT
            </span>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex gap-5 overflow-hidden">
        {/* Orders List */}
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
              {selectedStatus !== 'All' ? ` · ${selectedStatus}` : ''}
            </p>
          </div>
          <div className="overflow-auto flex-1">
            {loadingOrders ? (
              <div className="p-12 text-center text-gray-500">
                <Loader2 className="w-8 h-8 mx-auto mb-2 text-blue-500 animate-spin" />
                <p className="text-sm">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="p-12 text-center">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Image className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-gray-500 font-medium">No imaging orders</p>
                <p className="text-sm text-gray-400 mt-1">
                  Orders appear here when doctors request imaging studies
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredOrders.map((order) => {
                  const displayStatus = mapApiStatus(order.status);
                  const priorityConfig = getPriorityConfig(order.priority);
                  const isSelected = selectedOrder?.id === order.id;
                  return (
                    <div
                      key={order.id}
                      className={`p-4 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50 border-l-4 border-l-blue-600'
                          : order.priority === 'stat'
                            ? 'hover:bg-red-50/30 border-l-4 border-l-red-400'
                            : 'hover:bg-gray-50 border-l-4 border-l-transparent'
                      }`}
                      onClick={() => setSelectedOrder(order)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0 text-lg">
                            {getModalityIcon(order)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-gray-900 truncate">{getPatientDisplayName(order)}</h3>
                              <span className="text-xs text-gray-400 font-mono">{getPatientMrn(order)}</span>
                            </div>
                            <p className="text-sm font-medium text-indigo-700 mt-0.5">{order.studyType}</p>
                            {order.bodyPart && (
                              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {order.bodyPart}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(displayStatus)}`}>
                                {displayStatus}
                              </span>
                              {order.priority !== 'routine' && (
                                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${priorityConfig.className}`}>
                                  {priorityConfig.label}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-gray-400">{getTimeSince(order.orderedAt)}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{new Date(order.orderedAt).toLocaleDateString()}</p>
                          {order.scheduledAt && (
                            <p className="text-xs font-medium text-blue-600 mt-1 flex items-center gap-1 justify-end">
                              <Calendar className="w-3 h-3" />
                              {new Date(order.scheduledAt).toLocaleDateString()}
                            </p>
                          )}
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
          <div className="w-[420px] bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-gray-900">Order Details</h2>
                  <p className="text-sm text-blue-600 font-mono">{selectedOrder.orderNumber || selectedOrder.id.slice(0, 8)}</p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 hover:bg-white/60 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-5">
              {/* Patient */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Patient</h3>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-11 h-11 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {getPatientDisplayName(selectedOrder).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{getPatientDisplayName(selectedOrder)}</p>
                    <p className="text-sm text-gray-500 font-mono">{getPatientMrn(selectedOrder)}</p>
                  </div>
                </div>
              </div>

              {/* Study */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Study Information</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                    <span className="text-2xl">{getModalityIcon(selectedOrder)}</span>
                    <div>
                      <p className="font-semibold text-indigo-900">{selectedOrder.studyType}</p>
                      {getModalityName(selectedOrder) && (
                        <p className="text-sm text-indigo-600">{getModalityName(selectedOrder)}</p>
                      )}
                    </div>
                  </div>

                  {selectedOrder.bodyPart && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Body Part</p>
                        <p className="text-sm text-gray-900">{selectedOrder.bodyPart}</p>
                      </div>
                    </div>
                  )}

                  {(selectedOrder.clinicalIndication || selectedOrder.clinicalHistory) && (
                    <div className="flex items-start gap-2">
                      <Stethoscope className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Clinical Indication</p>
                        <p className="text-sm text-gray-900">{selectedOrder.clinicalIndication || selectedOrder.clinicalHistory}</p>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-400">Priority</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${getPriorityConfig(selectedOrder.priority).className}`}>
                        {getPriorityConfig(selectedOrder.priority).label}
                      </span>
                    </div>
                    <div className="p-2.5 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-400">Status</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(mapApiStatus(selectedOrder.status))}`}>
                        {mapApiStatus(selectedOrder.status)}
                      </span>
                    </div>
                  </div>

                  {getOrderingPhysician(selectedOrder) && (
                    <div className="flex items-start gap-2">
                      <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-400">Ordering Physician</p>
                        <p className="text-sm text-gray-900">Dr. {getOrderingPhysician(selectedOrder)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline</h3>
                <div className="relative pl-5 space-y-3">
                  <div className="absolute left-1.5 top-1 bottom-1 w-0.5 bg-gray-200" />
                  {/* Ordered */}
                  <div className="relative flex items-start gap-3">
                    <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm" />
                    <div>
                      <p className="text-xs font-medium text-gray-700">Ordered</p>
                      <p className="text-xs text-gray-400">{new Date(selectedOrder.orderedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {/* Scheduled */}
                  {selectedOrder.scheduledAt && (
                    <div className="relative flex items-start gap-3">
                      <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white shadow-sm" />
                      <div>
                        <p className="text-xs font-medium text-gray-700">Scheduled</p>
                        <p className="text-xs text-gray-400">{new Date(selectedOrder.scheduledAt).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {/* Performed */}
                  {selectedOrder.performedAt && (
                    <div className="relative flex items-start gap-3">
                      <div className="absolute -left-5 top-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow-sm" />
                      <div>
                        <p className="text-xs font-medium text-gray-700">Completed</p>
                        <p className="text-xs text-gray-400">{new Date(selectedOrder.performedAt).toLocaleString()}</p>
                        {selectedOrder.imageCount ? (
                          <p className="text-xs text-emerald-600 mt-0.5">{selectedOrder.imageCount} images captured</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Technologist Notes */}
              {selectedOrder.technologistNotes && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Technologist Notes</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedOrder.technologistNotes}</p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200 bg-gray-50/80">
              <div className="flex flex-wrap gap-2">
                {(selectedOrder.status === 'pending' || selectedOrder.status === 'ordered') && (
                  <button
                    onClick={() => { setScheduleForm({ scheduledDate: '', scheduledTime: '' }); setShowScheduleModal(true); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                  >
                    <Calendar className="w-4 h-4" />
                    Schedule
                  </button>
                )}
                {selectedOrder.status === 'scheduled' && (
                  <button
                    onClick={() => startMutation.mutate(selectedOrder.id)}
                    disabled={isActionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                  >
                    {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    Start Exam
                  </button>
                )}
                {selectedOrder.status === 'in_progress' && (
                  <button
                    onClick={() => completeMutation.mutate(selectedOrder.id)}
                    disabled={isActionLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                  >
                    {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Complete
                  </button>
                )}
                {!['completed', 'reported', 'cancelled'].includes(selectedOrder.status) && (
                  <button
                    onClick={() => cancelMutation.mutate(selectedOrder.id)}
                    disabled={isActionLoading}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="w-[420px] bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center">
            <div className="text-center p-8">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <FileText className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-medium text-gray-500">Select an order</p>
              <p className="text-sm text-gray-400 mt-1">Click on an order to view its details</p>
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
