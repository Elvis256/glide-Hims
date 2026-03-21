import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import React, { useState, useMemo, useEffect } from 'react';
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
  PlayCircle,
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
  RotateCcw,
} from 'lucide-react';
import { labService, type LabOrder } from '../../services';
import { providersService } from '../../services/providers';
import { useAuthStore } from '../../store/auth';
import { queueService } from '../../services/queue';
import { useFacilityId } from '../../lib/facility';
import api, { getApiErrorMessage } from '../../services/api';
import { announcePatientCall } from '../../utils/announcements';
import { printService } from '../../lib/print';
import { asList } from '../../utils/unwrapResponse';

type Priority = 'stat' | 'urgent' | 'routine';
type Status = 'pending' | 'in_progress' | 'completed' | 'cancelled';

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
  const currentUser = useAuthStore((state) => state.user);
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all');
  const [filterTest, setFilterTest] = useState('');
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [collectingOrder, setCollectingOrder] = useState<LabOrder | null>(null);
  const [collectionNotes, setCollectionNotes] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [elapsedTimes, setElapsedTimes] = useState<Record<string, string>>({});
  const [showReturnDoctorModal, setShowReturnDoctorModal] = useState(false);
  const [returnDoctorReason, setReturnDoctorReason] = useState('');
  const [returnDoctorOrderId, setReturnDoctorOrderId] = useState<string | null>(null);
  // Fetch lab technologists from providers API
  const { data: allProviders } = useQuery({
    queryKey: ['providers', facilityId],
    queryFn: () => providersService.list({ facilityId }),
    staleTime: 60000,
  });
  const technicians = (allProviders || []).filter(
    (p) => p.providerType === 'lab_technologist' && p.status === 'active'
  );
  const currentUserTechName = currentUser
    ? [currentUser.firstName, currentUser.lastName].filter(Boolean).join(' ') || currentUser.email || ''
    : '';
  const isCurrentUserTech = technicians.some(
    (t) => t.fullName === currentUserTechName || t.userId === (currentUser as any)?.id
  );

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
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to assign technician'));
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
    onError: (error) => {
      toast.error(getApiErrorMessage(error, 'Failed to update order status'));
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

  // Call next patient mutation
  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext('laboratory'),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      if (patient) {
        toast.success(`Called ${patient.patient?.fullName || 'next patient'} - Ticket ${patient.ticketNumber}`);
        // Announce 3 times
        announcePatientCall({
          patientName: patient.patient?.fullName,
          ticketNumber: patient.ticketNumber,
          servicePoint: 'laboratory',
          repeatCount: 3,
          delayBetweenRepeats: 2000,
        });
      } else {
        toast.info('No patients waiting in laboratory queue');
      }
    },
    onError: () => {
      toast.error('Failed to call next patient');
    },
  });

  // Fetch laboratory queue entries to enable per-patient call
  const { data: labQueueData } = useQuery({
    queryKey: ['lab-queue-entries'],
    queryFn: () => queueService.getQueue({ servicePoint: 'laboratory' }),
    refetchInterval: 20000,
  });

  // Build a lookup: encounterId → queueEntry for quick matching
  const queueByEncounter = useMemo(() => {
    const map: Record<string, { id: string; ticketNumber: string; status: string }> = {};
    if (labQueueData) {
      for (const entry of labQueueData) {
        if (entry.encounterId && (entry.status === 'waiting' || entry.status === 'called')) {
          map[entry.encounterId] = { id: entry.id, ticketNumber: entry.ticketNumber, status: entry.status };
        }
      }
    }
    return map;
  }, [labQueueData]);

  // Call a specific patient by their queue entry
  const callPatientMutation = useMutation({
    mutationFn: (queueId: string) => queueService.call(queueId),
    onSuccess: (patient) => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      queryClient.invalidateQueries({ queryKey: ['lab-queue-entries'] });
      toast.success(`Called ${patient.patient?.fullName || 'patient'} - Ticket ${patient.ticketNumber}`);
      announcePatientCall({
        patientName: patient.patient?.fullName,
        ticketNumber: patient.ticketNumber,
        servicePoint: 'laboratory',
        repeatCount: 3,
        delayBetweenRepeats: 2000,
      });
    },
    onError: () => {
      toast.error('Failed to call patient');
    },
  });

  // Fetch patients returned to lab
  const { data: returnedToLabData } = useQuery({
    queryKey: ['lab-returned-patients'],
    queryFn: async () => {
      const response = await api.get('/encounters', {
        params: { status: 'return_to_lab', limit: 50 },
      });
      return asList(response.data);
    },
    refetchInterval: 15000,
  });

  // Accept returned patient mutation
  const acceptReturnedMutation = useMutation({
    mutationFn: async (encounterId: string) => {
      const response = await api.patch(`/encounters/${encounterId}/status`, {
        status: 'pending_lab',
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-returned-patients'] });
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      toast.success('Patient accepted back into lab queue');
    },
    onError: () => {
      toast.error('Failed to accept returned patient');
    },
  });

  // Return to doctor mutation
  const returnToDoctorMutation = useMutation({
    mutationFn: async ({ encounterId, reason }: { encounterId: string; reason: string }) => {
      const response = await api.patch(`/encounters/${encounterId}/return-to-doctor`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lab-orders'] });
      toast.success('Patient returned to doctor successfully');
      setShowReturnDoctorModal(false);
      setReturnDoctorReason('');
      setReturnDoctorOrderId(null);
    },
    onError: () => {
      toast.error('Failed to return patient to doctor');
    },
  });

  // Handle API response
  const orders: LabOrder[] = ordersData || [];

  // Check if a lab order has all results released (required before completing)
  const canCompleteLabOrder = (order: LabOrder): boolean => {
    const results = order.tests?.flatMap(t => t.result?.parameters || []) || [];
    if (results.length === 0) return false;
    return results.every((r: any) => r.status === 'released');
  };

  // Returned patients from billing/other departments
  const returnedPatients = useMemo(() => {
    return (returnedToLabData || []).map((enc: any) => ({
      id: enc.id,
      patientName: enc.patient?.fullName || 'Unknown',
      patientMrn: enc.patient?.mrn || 'N/A',
      patientId: enc.patient?.id || enc.patientId,
      returnReason: enc.metadata?.labReturnReason || 'Returned to lab',
      returnedAt: enc.metadata?.labReturnedAt || enc.updatedAt,
      encounterId: enc.id,
      visitNumber: enc.visitNumber,
    }));
  }, [returnedToLabData]);

  // Live elapsed timer for in-progress orders
  useEffect(() => {
    const inProgressOrders = orders.filter(o => o.status === 'in_progress');
    if (inProgressOrders.length === 0) { setElapsedTimes({}); return; }
    const calc = () => {
      const times: Record<string, string> = {};
      inProgressOrders.forEach(order => {
        const start = new Date((order as any).collectedAt || order.createdAt).getTime();
        const ms = Date.now() - start;
        const s = Math.floor(ms / 1000) % 60;
        const m = Math.floor(ms / 60000) % 60;
        const h = Math.floor(ms / 3600000);
        times[order.id] = h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
      });
      setElapsedTimes(times);
    };
    calc();
    const id = setInterval(calc, 1000);
    return () => clearInterval(id);
  }, [orders]);

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
    const bodyHtml = `
      ${order.tests?.map((test, i) => `
        <div class="label" style="border:1px solid #000; padding:10px; margin:10px; width:200px;">
          <div style="font-family:monospace; font-size:14px; letter-spacing:2px;">${order.orderNumber}-${i + 1}</div>
          <div style="font-weight:bold; font-size:12px;">${order.patient?.fullName || 'Unknown'}</div>
          <div style="font-size:10px; color:#666;">MRN: ${order.patient?.mrn || 'N/A'}</div>
          <div style="font-size:11px; margin-top:5px;">${test.testName}</div>
          <div style="font-size:9px; color:#888; margin-top:5px;">${new Date().toLocaleString()}</div>
        </div>
      `).join('') || ''}
    `;
    printService.printLabel(bodyHtml, { title: 'Lab Sample Labels' });
    toast.success('Labels sent to printer');
  };

  const getWaitTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (minutes < 60) return `${minutes} min`;
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  };

  const stats = useMemo(() => {
    const todayStr = new Date().toDateString();
    return {
      stat: orders.filter((o) => o.priority === 'stat' && o.status !== 'completed').length,
      urgent: orders.filter((o) => o.priority === 'urgent' && o.status !== 'completed').length,
      pending: orders.filter((o) => o.status === 'pending').length,
      inProgress: orders.filter((o) => o.status === 'in_progress').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      completedToday: orders.filter((o) => o.status === 'completed' && new Date((o as any).completedAt || o.updatedAt || o.createdAt).toDateString() === todayStr).length,
    };
  }, [orders]);

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

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
          <button
            onClick={() => callNextMutation.mutate()}
            disabled={callNextMutation.isPending || stats.pending === 0}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold rounded-lg shadow hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <PlayCircle className="w-5 h-5" />
            Call Next
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

      {/* Quick stats bar */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => { setFilterStatus('pending'); setFilterPriority('all'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterStatus === 'pending' && filterPriority === 'all' ? 'bg-gray-200 border-gray-400 text-gray-800' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}
        >
          <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          Pending <span className="ml-1 font-bold">{stats.pending}</span>
        </button>
        <button
          onClick={() => { setFilterStatus('in_progress'); setFilterPriority('all'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterStatus === 'in_progress' && filterPriority === 'all' ? 'bg-yellow-200 border-yellow-400 text-yellow-900' : 'bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100'}`}
        >
          <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
          In Progress <span className="ml-1 font-bold">{stats.inProgress}</span>
        </button>
        <button
          onClick={() => { setFilterStatus('all'); setFilterPriority('stat'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterPriority === 'stat' ? 'bg-red-200 border-red-400 text-red-900' : 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'}`}
        >
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse" />
          STAT <span className="ml-1 font-bold">{stats.stat}</span>
        </button>
        <button
          onClick={() => { setFilterStatus('all'); setFilterPriority('urgent'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterPriority === 'urgent' ? 'bg-orange-200 border-orange-400 text-orange-900' : 'bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100'}`}
        >
          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />
          Urgent <span className="ml-1 font-bold">{stats.urgent}</span>
        </button>
        <button
          onClick={() => { setFilterStatus('completed'); setFilterPriority('all'); }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${filterStatus === 'completed' && filterPriority === 'all' ? 'bg-green-200 border-green-400 text-green-900' : 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100'}`}
        >
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          Completed Today <span className="ml-1 font-bold">{stats.completedToday}</span>
        </button>
        {(filterStatus !== 'all' || filterPriority !== 'all') && (
          <button
            onClick={() => { setFilterStatus('all'); setFilterPriority('all'); }}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full border border-gray-200"
          >
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {/* Batch selection toolbar */}
      {selectedOrders.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-4 py-2 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm font-medium text-indigo-700">{selectedOrders.size} selected</span>
          <button
            onClick={() => {
              const eligibleOrders: string[] = [];
              const ineligibleCount = { noResults: 0, notReleased: 0 };
              selectedOrders.forEach(orderId => {
                const order = orders.find(o => o.id === orderId);
                if (order && canCompleteLabOrder(order)) {
                  eligibleOrders.push(orderId);
                } else {
                  const results = order?.tests?.flatMap(t => t.result?.parameters || []) || [];
                  if (results.length === 0) ineligibleCount.noResults++;
                  else ineligibleCount.notReleased++;
                }
              });
              if (eligibleOrders.length > 0) {
                eligibleOrders.forEach(orderId => {
                  updateStatusMutation.mutate({ orderId, status: 'completed' });
                });
              }
              const skipped = ineligibleCount.noResults + ineligibleCount.notReleased;
              if (skipped > 0) {
                toast.warning(`${skipped} order(s) skipped — results must be released before completing`);
              }
              setSelectedOrders(new Set());
            }}
            disabled={updateStatusMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            <CheckCircle className="w-4 h-4" />
            Complete Selected
          </button>
          <button
            onClick={() => setSelectedOrders(new Set())}
            className="flex items-center gap-1 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" /> Clear Selection
          </button>
        </div>
      )}

      {/* Returned to Lab Section */}
      {returnedPatients.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <RotateCcw className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-gray-900">
              Returned to Lab ({returnedPatients.length})
            </h2>
          </div>
          <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200">
            <div className="divide-y divide-amber-200">
              {returnedPatients.map((patient: any) => (
                <div
                  key={patient.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-amber-100 transition-colors"
                >
                  <div className="col-span-2">
                    <span className="font-mono font-bold text-amber-600">
                      {patient.visitNumber || '—'}
                    </span>
                  </div>
                  <div className="col-span-2 font-medium text-gray-900">
                    {patient.patientName}
                  </div>
                  <div className="col-span-2 text-gray-500 font-mono text-sm">
                    {patient.patientMrn}
                  </div>
                  <div className="col-span-3 text-amber-700 text-sm">
                    <div className="flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" />
                      <span className="font-medium">Reason:</span>
                    </div>
                    <p className="truncate">{patient.returnReason}</p>
                  </div>
                  <div className="col-span-1">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                      <RotateCcw className="w-3 h-3" />
                      Returned
                    </span>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button
                      onClick={() => acceptReturnedMutation.mutate(patient.encounterId)}
                      disabled={acceptReturnedMutation.isPending}
                      className="inline-flex items-center gap-1 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
                    >
                      {acceptReturnedMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <FlaskConical className="w-4 h-4" />
                      )}
                      Accept &amp; Process
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
                  <th className="px-3 py-3 w-8">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedOrders.has(o.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedOrders(new Set(filteredOrders.map(o => o.id)));
                        } else {
                          setSelectedOrders(new Set());
                        }
                      }}
                    />
                  </th>
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
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    <FlaskConical className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                    <p>No orders in queue</p>
                  </td>
                </tr>
              )}
              {filteredOrders.map((order) => {
                  const status = (order.status || 'pending') as Status;
                  const priority = (order.priority || 'routine') as Priority;
                  const isStat = priority === 'stat';
                  const isSelected = selectedOrders.has(order.id);
                  return (
                    <tr key={order.id} className={`transition-colors ${isStat ? 'animate-pulse ring-2 ring-inset ring-red-400 bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'} ${isSelected ? 'bg-indigo-50' : ''}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedOrders);
                            if (e.target.checked) next.add(order.id); else next.delete(order.id);
                            setSelectedOrders(next);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
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
                        <div className="flex flex-col gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 w-fit ${statusColors[status]}`}>
                            {statusIcons[status]}
                            {statusLabels[status]}
                          </span>
                          {status === 'in_progress' && elapsedTimes[order.id] && (
                            <span className="flex items-center gap-1 text-xs text-yellow-600 font-mono">
                              <Timer className="w-3 h-3" />
                              {elapsedTimes[order.id]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Timer className="w-4 h-4 text-gray-400" />
                          {getWaitTime(order.createdAt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {assigningOrder === order.id ? (
                          <div className="flex flex-col gap-1">
                            <select
                              autoFocus
                              onChange={(e) => handleAssign(order.id, e.target.value)}
                              onBlur={() => setAssigningOrder(null)}
                              className="px-2 py-1 border border-gray-300 rounded text-sm"
                            >
                              <option value="">Select...</option>
                              {technicians.length > 0 ? technicians.map((tech) => (
                                <option key={tech.id} value={tech.fullName}>
                                  {tech.fullName}{tech.specialty ? ` — ${tech.specialty}` : ''}
                                </option>
                              )) : (
                                <option disabled>No technicians found</option>
                              )}
                            </select>
                            {isCurrentUserTech && (
                              <button
                                onMouseDown={(e) => { e.preventDefault(); handleAssign(order.id, currentUserTechName); setAssigningOrder(null); }}
                                className="px-2 py-1 bg-indigo-50 text-indigo-700 text-xs rounded hover:bg-indigo-100"
                              >
                                Assign to me
                              </button>
                            )}
                          </div>
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
                              {order.encounterId && queueByEncounter[order.encounterId] && (
                                <button
                                  onClick={() => callPatientMutation.mutate(queueByEncounter[order.encounterId!].id)}
                                  disabled={callPatientMutation.isPending || queueByEncounter[order.encounterId]?.status === 'called'}
                                  className={`px-3 py-1 text-white text-sm rounded transition-colors flex items-center gap-1 ${
                                    queueByEncounter[order.encounterId]?.status === 'called'
                                      ? 'bg-amber-500 cursor-default'
                                      : 'bg-blue-600 hover:bg-blue-700'
                                  }`}
                                  title={queueByEncounter[order.encounterId]?.status === 'called' ? 'Patient already called' : 'Call patient to lab'}
                                >
                                  <Phone className="w-3.5 h-3.5" />
                                  {queueByEncounter[order.encounterId]?.status === 'called' ? 'Called' : 'Call'}
                                </button>
                              )}
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
                                disabled={updateStatusMutation.isPending || !canCompleteLabOrder(order)}
                                title={!canCompleteLabOrder(order) ? 'All results must be released before completing' : 'Mark order as completed'}
                                className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
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
                          {order.encounterId && status !== 'completed' && status !== 'cancelled' && (
                            <button
                              onClick={() => {
                                setReturnDoctorOrderId(order.id);
                                setReturnDoctorReason('');
                                setShowReturnDoctorModal(true);
                              }}
                              className="px-2 py-1 bg-orange-100 text-orange-700 text-sm rounded hover:bg-orange-200 transition-colors flex items-center gap-1 border border-orange-300"
                              title="Return to Doctor"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              Doctor
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

      {/* Return to Doctor Modal */}
      {showReturnDoctorModal && returnDoctorOrderId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <RotateCcw className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Return to Doctor</h2>
                  <p className="text-sm text-gray-500">Send this order back for physician review</p>
                </div>
              </div>
              <button
                onClick={() => { setShowReturnDoctorModal(false); setReturnDoctorReason(''); setReturnDoctorOrderId(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Quick Select Reason</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'Abnormal results require review',
                    'Test cannot be performed',
                    'Additional clinical information needed',
                    'Sample unsuitable - needs reorder',
                    'Critical value - immediate attention',
                  ].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReturnDoctorReason(reason)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                        returnDoctorReason === reason
                          ? 'bg-orange-100 border-orange-400 text-orange-800'
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-200'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason Details</label>
                <textarea
                  value={returnDoctorReason}
                  onChange={(e) => setReturnDoctorReason(e.target.value)}
                  placeholder="Describe why this order needs to be returned to the doctor..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  rows={3}
                />
              </div>
            </div>
            <div className="p-6 border-t flex justify-end gap-3">
              <button
                onClick={() => { setShowReturnDoctorModal(false); setReturnDoctorReason(''); setReturnDoctorOrderId(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const order = orders.find(o => o.id === returnDoctorOrderId);
                  if (order?.encounterId && returnDoctorReason.trim()) {
                    returnToDoctorMutation.mutate({ encounterId: order.encounterId, reason: returnDoctorReason.trim() });
                  } else if (!returnDoctorReason.trim()) {
                    toast.error('Please provide a reason');
                  }
                }}
                disabled={returnToDoctorMutation.isPending || !returnDoctorReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 flex items-center gap-2 disabled:opacity-50"
              >
                {returnToDoctorMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Return to Doctor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
