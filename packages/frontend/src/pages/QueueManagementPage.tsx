import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Settings, Users, Activity, RefreshCw, Plus, Edit2, Trash2, X, Play, Pause, ArrowRightLeft, Phone, SkipForward, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api';
import { usePermissions } from '../components/PermissionGate';

interface QueueItem {
  id: string;
  ticketNumber: string;
  status: string;
  priority: number;
  servicePoint: string;
  estimatedWaitMinutes: number;
  patient: {
    fullName: string;
    mrn: string;
  };
  counterNumber?: string;
  roomNumber?: string;
  createdAt: string;
  department?: string;
}

interface QueueStats {
  waiting: number;
  inService: number;
  completed: number;
  noShow: number;
  total: number;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
}

interface ServicePoint {
  id: string;
  name: string;
  code: string;
  department: string;
  capacity: number;
  isActive: boolean;
  currentLoad: number;
  assignedStaff: string[];
}

interface QueueConfig {
  tokenPrefix: string;
  tokenDigits: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  priorityLevels: PriorityLevel[];
}

interface PriorityLevel {
  value: number;
  label: string;
  color: string;
  isActive: boolean;
}

interface StaffMember {
  id: string;
  name: string;
  department: string;
}

const defaultServicePoints: ServicePoint[] = [
  { id: '1', name: 'Registration', code: 'registration', department: 'Front Desk', capacity: 50, isActive: true, currentLoad: 12, assignedStaff: [] },
  { id: '2', name: 'Triage', code: 'triage', department: 'Emergency', capacity: 30, isActive: true, currentLoad: 8, assignedStaff: [] },
  { id: '3', name: 'Consultation', code: 'consultation', department: 'OPD', capacity: 40, isActive: true, currentLoad: 15, assignedStaff: [] },
  { id: '4', name: 'Laboratory', code: 'laboratory', department: 'Diagnostics', capacity: 25, isActive: true, currentLoad: 6, assignedStaff: [] },
  { id: '5', name: 'Radiology', code: 'radiology', department: 'Diagnostics', capacity: 20, isActive: true, currentLoad: 4, assignedStaff: [] },
  { id: '6', name: 'Pharmacy', code: 'pharmacy', department: 'Pharmacy', capacity: 60, isActive: true, currentLoad: 22, assignedStaff: [] },
  { id: '7', name: 'Billing', code: 'billing', department: 'Finance', capacity: 40, isActive: false, currentLoad: 0, assignedStaff: [] },
  { id: '8', name: 'Cashier', code: 'cashier', department: 'Finance', capacity: 35, isActive: true, currentLoad: 10, assignedStaff: [] },
];

const defaultPriorityLevels: PriorityLevel[] = [
  { value: 1, label: 'Emergency', color: 'bg-red-500', isActive: true },
  { value: 2, label: 'Urgent', color: 'bg-orange-500', isActive: true },
  { value: 3, label: 'VIP', color: 'bg-purple-500', isActive: true },
  { value: 4, label: 'Elderly', color: 'bg-blue-500', isActive: true },
  { value: 5, label: 'Disabled', color: 'bg-blue-400', isActive: true },
  { value: 6, label: 'Pregnant', color: 'bg-pink-500', isActive: true },
  { value: 7, label: 'Pediatric', color: 'bg-green-500', isActive: true },
  { value: 10, label: 'Normal', color: 'bg-gray-500', isActive: true },
];

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Emergency', color: 'bg-red-500' },
  2: { label: 'Urgent', color: 'bg-orange-500' },
  3: { label: 'VIP', color: 'bg-purple-500' },
  4: { label: 'Elderly', color: 'bg-blue-500' },
  5: { label: 'Disabled', color: 'bg-blue-400' },
  6: { label: 'Pregnant', color: 'bg-pink-500' },
  7: { label: 'Pediatric', color: 'bg-green-500' },
  10: { label: 'Normal', color: 'bg-gray-500' },
};

const mockStaff: StaffMember[] = [
  { id: 's1', name: 'Dr. John Smith', department: 'OPD' },
  { id: 's2', name: 'Nurse Mary Johnson', department: 'Emergency' },
  { id: 's3', name: 'Tech. Robert Brown', department: 'Diagnostics' },
  { id: 's4', name: 'Sarah Wilson', department: 'Front Desk' },
  { id: 's5', name: 'Pharmacist Davis', department: 'Pharmacy' },
];

type TabType = 'overview' | 'service-points' | 'configuration' | 'operations' | 'queue';

export default function QueueManagementPage() {
  const { hasPermission, isSuperAdmin } = usePermissions();
  const canUpdate = hasPermission('queue.update');
  const canDelete = hasPermission('queue.delete');
  const canAdmin = isSuperAdmin || hasPermission('admin');

  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [selectedServicePoint, setSelectedServicePoint] = useState('all');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Service Points State
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>(defaultServicePoints);
  const [showServicePointModal, setShowServicePointModal] = useState(false);
  const [editingServicePoint, setEditingServicePoint] = useState<ServicePoint | null>(null);
  const [servicePointForm, setServicePointForm] = useState({
    name: '',
    code: '',
    department: '',
    capacity: 30,
  });
  const [showAssignStaffModal, setShowAssignStaffModal] = useState(false);
  const [assigningServicePoint, setAssigningServicePoint] = useState<ServicePoint | null>(null);

  // Configuration State
  const [queueConfig, setQueueConfig] = useState<QueueConfig>({
    tokenPrefix: 'T',
    tokenDigits: 4,
    workingHoursStart: '08:00',
    workingHoursEnd: '17:00',
    priorityLevels: defaultPriorityLevels,
  });

  // Operations State
  const [queuesOnHold, setQueuesOnHold] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferringPatient, setTransferringPatient] = useState<QueueItem | null>(null);
  const [transferTarget, setTransferTarget] = useState('');

  // Queue Actions State
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [removingPatient, setRemovingPatient] = useState<QueueItem | null>(null);

  const loadQueue = useCallback(async () => {
    try {
      const endpoint = selectedServicePoint === 'all' 
        ? '/queue/waiting' 
        : `/queue/waiting/${selectedServicePoint}`;
      const response = await api.get(endpoint);
      setQueue(response.data);
    } catch (error) {
      console.error('Failed to load queue:', error);
      // Mock data for demo
      setQueue([
        { id: '1', ticketNumber: 'T0001', status: 'waiting', priority: 10, servicePoint: 'registration', estimatedWaitMinutes: 5, patient: { fullName: 'John Doe', mrn: 'MRN001' }, createdAt: new Date(Date.now() - 300000).toISOString(), department: 'Front Desk' },
        { id: '2', ticketNumber: 'T0002', status: 'called', priority: 4, servicePoint: 'consultation', estimatedWaitMinutes: 10, patient: { fullName: 'Jane Smith', mrn: 'MRN002' }, counterNumber: '3', createdAt: new Date(Date.now() - 600000).toISOString(), department: 'OPD' },
        { id: '3', ticketNumber: 'T0003', status: 'in_service', priority: 2, servicePoint: 'laboratory', estimatedWaitMinutes: 0, patient: { fullName: 'Bob Wilson', mrn: 'MRN003' }, roomNumber: 'Lab 1', createdAt: new Date(Date.now() - 900000).toISOString(), department: 'Diagnostics' },
        { id: '4', ticketNumber: 'T0004', status: 'waiting', priority: 3, servicePoint: 'pharmacy', estimatedWaitMinutes: 15, patient: { fullName: 'Alice Brown', mrn: 'MRN004' }, createdAt: new Date(Date.now() - 1200000).toISOString(), department: 'Pharmacy' },
      ]);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [selectedServicePoint]);

  const loadStats = useCallback(async () => {
    try {
      const endpoint = selectedServicePoint === 'all'
        ? '/queue/stats'
        : `/queue/stats?servicePoint=${selectedServicePoint}`;
      const response = await api.get(endpoint);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
      // Mock stats
      setStats({
        waiting: 24,
        inService: 8,
        completed: 156,
        noShow: 5,
        total: 193,
        averageWaitMinutes: 12,
        averageServiceMinutes: 8,
      });
    }
  }, [selectedServicePoint]);

  useEffect(() => {
    loadQueue();
    loadStats();
  }, [loadQueue, loadStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadQueue();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadQueue, loadStats]);

  const handleRefresh = () => {
    loadQueue();
    loadStats();
    toast.success('Queue data refreshed');
  };

  // Service Point Actions
  const handleAddServicePoint = () => {
    setEditingServicePoint(null);
    setServicePointForm({ name: '', code: '', department: '', capacity: 30 });
    setShowServicePointModal(true);
  };

  const handleEditServicePoint = (sp: ServicePoint) => {
    if (!canUpdate) {
      toast.error('You do not have permission to edit service points');
      return;
    }
    setEditingServicePoint(sp);
    setServicePointForm({ name: sp.name, code: sp.code, department: sp.department, capacity: sp.capacity });
    setShowServicePointModal(true);
  };

  const handleSaveServicePoint = async () => {
    if (!servicePointForm.name || !servicePointForm.code || !servicePointForm.department) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingServicePoint) {
        setServicePoints(prev => prev.map(sp => 
          sp.id === editingServicePoint.id 
            ? { ...sp, ...servicePointForm }
            : sp
        ));
        toast.success('Service point updated successfully');
      } else {
        const newSP: ServicePoint = {
          id: `sp-${Date.now()}`,
          ...servicePointForm,
          isActive: true,
          currentLoad: 0,
          assignedStaff: [],
        };
        setServicePoints(prev => [...prev, newSP]);
        toast.success('Service point created successfully');
      }
      setShowServicePointModal(false);
    } catch {
      toast.error('Failed to save service point');
    }
  };

  const handleToggleServicePoint = (sp: ServicePoint) => {
    if (!canUpdate) {
      toast.error('You do not have permission to modify service points');
      return;
    }
    setServicePoints(prev => prev.map(s => 
      s.id === sp.id ? { ...s, isActive: !s.isActive } : s
    ));
    toast.success(`${sp.name} ${sp.isActive ? 'deactivated' : 'activated'}`);
  };

  const handleAssignStaff = (sp: ServicePoint) => {
    if (!canUpdate) {
      toast.error('You do not have permission to assign staff');
      return;
    }
    setAssigningServicePoint(sp);
    setShowAssignStaffModal(true);
  };

  const handleToggleStaffAssignment = (staffId: string) => {
    if (!assigningServicePoint) return;
    setServicePoints(prev => prev.map(sp => {
      if (sp.id !== assigningServicePoint.id) return sp;
      const hasStaff = sp.assignedStaff.includes(staffId);
      return {
        ...sp,
        assignedStaff: hasStaff
          ? sp.assignedStaff.filter(id => id !== staffId)
          : [...sp.assignedStaff, staffId],
      };
    }));
    setAssigningServicePoint(prev => {
      if (!prev) return null;
      const hasStaff = prev.assignedStaff.includes(staffId);
      return {
        ...prev,
        assignedStaff: hasStaff
          ? prev.assignedStaff.filter(id => id !== staffId)
          : [...prev.assignedStaff, staffId],
      };
    });
  };

  // Queue Configuration Actions
  const handleSaveConfig = () => {
    if (!canAdmin) {
      toast.error('You do not have admin permission to modify configuration');
      return;
    }
    toast.success('Queue configuration saved');
  };

  // Queue Operations
  const handleResetQueue = async () => {
    if (!canDelete) {
      toast.error('You do not have permission to reset queues');
      return;
    }
    try {
      await api.post('/queue/reset');
      loadQueue();
      loadStats();
      toast.success('All waiting queues have been cleared');
    } catch {
      // Demo mode
      setQueue([]);
      toast.success('All waiting queues have been cleared');
    }
    setShowResetConfirm(false);
  };

  const handleHoldQueues = () => {
    if (!canUpdate) {
      toast.error('You do not have permission to hold queues');
      return;
    }
    setQueuesOnHold(true);
    toast.warning('All queues are now on hold');
  };

  const handleResumeQueues = () => {
    if (!canUpdate) {
      toast.error('You do not have permission to resume queues');
      return;
    }
    setQueuesOnHold(false);
    toast.success('Queues resumed');
  };

  const handleTransfer = (item: QueueItem) => {
    if (!canUpdate) {
      toast.error('You do not have permission to transfer patients');
      return;
    }
    setTransferringPatient(item);
    setTransferTarget('');
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = async () => {
    if (!transferringPatient || !transferTarget) {
      toast.error('Please select a target service point');
      return;
    }
    try {
      await api.post(`/queue/${transferringPatient.id}/transfer`, { targetServicePoint: transferTarget });
      toast.success(`Patient transferred to ${servicePoints.find(sp => sp.code === transferTarget)?.name}`);
    } catch {
      // Demo mode
      setQueue(prev => prev.map(item =>
        item.id === transferringPatient.id
          ? { ...item, servicePoint: transferTarget }
          : item
      ));
      toast.success(`Patient transferred to ${servicePoints.find(sp => sp.code === transferTarget)?.name}`);
    }
    setShowTransferModal(false);
    setTransferringPatient(null);
  };

  // Queue Item Actions
  const handleCallPatient = async (item: QueueItem) => {
    if (!canUpdate) {
      toast.error('You do not have permission to call patients');
      return;
    }
    try {
      await api.post(`/queue/${item.id}/call`, { counterNumber: '1' });
      loadQueue();
      toast.success(`Calling ${item.patient.fullName}`);
    } catch {
      setQueue(prev => prev.map(q =>
        q.id === item.id ? { ...q, status: 'called', counterNumber: '1' } : q
      ));
      toast.success(`Calling ${item.patient.fullName}`);
    }
  };

  const handleSkipPatient = async (item: QueueItem) => {
    if (!canUpdate) {
      toast.error('You do not have permission to skip patients');
      return;
    }
    try {
      await api.post(`/queue/${item.id}/skip`, { skipReason: 'Skipped by admin' });
      loadQueue();
      toast.success(`${item.patient.fullName} skipped`);
    } catch {
      setQueue(prev => prev.filter(q => q.id !== item.id));
      toast.success(`${item.patient.fullName} skipped`);
    }
  };

  const handleRemovePatient = (item: QueueItem) => {
    if (!canDelete) {
      toast.error('You do not have permission to remove patients');
      return;
    }
    setRemovingPatient(item);
    setShowRemoveConfirm(true);
  };

  const handleConfirmRemove = async () => {
    if (!removingPatient) return;
    try {
      await api.delete(`/queue/${removingPatient.id}`);
      loadQueue();
      toast.success(`${removingPatient.patient.fullName} removed from queue`);
    } catch {
      setQueue(prev => prev.filter(q => q.id !== removingPatient.id));
      toast.success(`${removingPatient.patient.fullName} removed from queue`);
    }
    setShowRemoveConfirm(false);
    setRemovingPatient(null);
  };

  const getWaitTime = (createdAt: string) => {
    const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const activeServicePoints = servicePoints.filter(sp => sp.isActive);

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Activity },
    { id: 'service-points' as const, label: 'Service Points', icon: Settings },
    { id: 'configuration' as const, label: 'Configuration', icon: Settings, requireAdmin: true },
    { id: 'operations' as const, label: 'Operations', icon: Activity },
    { id: 'queue' as const, label: 'Queue Management', icon: Users },
  ];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Queue Administration</h1>
          <p className="text-gray-600">Configure and manage patient queues</p>
        </div>
        <div className="flex items-center gap-3">
          {queuesOnHold && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">Queues On Hold</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="w-4 h-4" />
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg ${autoRefresh ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'}`}
            title={autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          >
            <RefreshCw className={`w-5 h-5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
          </button>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map(tab => {
          if (tab.requireAdmin && !canAdmin) return null;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-yellow-600">{stats.waiting}</div>
                <div className="text-sm text-yellow-700">Waiting</div>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-blue-600">{stats.inService}</div>
                <div className="text-sm text-blue-700">In Service</div>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-green-600">{stats.completed}</div>
                <div className="text-sm text-green-700">Completed</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-red-600">{stats.noShow}</div>
                <div className="text-sm text-red-700">No Show</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-gray-600">{stats.total}</div>
                <div className="text-sm text-gray-700">Total Today</div>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-purple-600">{stats.averageWaitMinutes}m</div>
                <div className="text-sm text-purple-700">Avg Wait</div>
              </div>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-center">
                <div className="text-3xl font-bold text-indigo-600">{stats.averageServiceMinutes}m</div>
                <div className="text-sm text-indigo-700">Avg Service</div>
              </div>
            </div>
          )}

          {/* Active Service Points Grid */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Activity className="w-5 h-5 text-blue-600" />
                Active Service Points
              </h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {activeServicePoints.map(sp => (
                  <div
                    key={sp.id}
                    className="bg-gray-50 border rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{sp.name}</h3>
                      <span className={`w-2 h-2 rounded-full ${sp.currentLoad > sp.capacity * 0.8 ? 'bg-red-500' : sp.currentLoad > sp.capacity * 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    </div>
                    <div className="text-sm text-gray-600">{sp.department}</div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="text-gray-500">Load:</span>
                      <span className={`font-medium ${sp.currentLoad > sp.capacity * 0.8 ? 'text-red-600' : 'text-gray-900'}`}>
                        {sp.currentLoad}/{sp.capacity}
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${sp.currentLoad > sp.capacity * 0.8 ? 'bg-red-500' : sp.currentLoad > sp.capacity * 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(100, (sp.currentLoad / sp.capacity) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Service Points Tab */}
      {activeTab === 'service-points' && (
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-600" />
              Service Points Management
            </h2>
            {canUpdate && (
              <button
                onClick={handleAddServicePoint}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Add Service Point
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Current Load</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assigned Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {servicePoints.map(sp => (
                  <tr key={sp.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{sp.name}</td>
                    <td className="px-4 py-3 text-gray-600"><code className="bg-gray-100 px-2 py-0.5 rounded text-sm">{sp.code}</code></td>
                    <td className="px-4 py-3 text-gray-600">{sp.department}</td>
                    <td className="px-4 py-3 text-gray-600">{sp.capacity}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${sp.currentLoad > sp.capacity * 0.8 ? 'text-red-600' : 'text-gray-900'}`}>
                        {sp.currentLoad}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{sp.assignedStaff.length} assigned</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                        sp.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {sp.isActive ? <CheckCircle className="w-3 h-3" /> : null}
                        {sp.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canUpdate && (
                          <>
                            <button
                              onClick={() => handleEditServicePoint(sp)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleToggleServicePoint(sp)}
                              className={`p-1.5 rounded ${sp.isActive ? 'text-orange-500 hover:bg-orange-50' : 'text-green-500 hover:bg-green-50'}`}
                              title={sp.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {sp.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => handleAssignStaff(sp)}
                              className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                              title="Assign Staff"
                            >
                              <Users className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === 'configuration' && canAdmin && (
        <div className="space-y-6">
          {/* Token Format Settings */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Token Format Settings</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Token Prefix</label>
                <input
                  type="text"
                  value={queueConfig.tokenPrefix}
                  onChange={e => setQueueConfig(prev => ({ ...prev, tokenPrefix: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="T"
                />
                <p className="text-xs text-gray-500 mt-1">Example: T0001, OPD001</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number of Digits</label>
                <select
                  value={queueConfig.tokenDigits}
                  onChange={e => setQueueConfig(prev => ({ ...prev, tokenDigits: parseInt(e.target.value) }))}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value={3}>3 digits (001-999)</option>
                  <option value={4}>4 digits (0001-9999)</option>
                  <option value={5}>5 digits (00001-99999)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Working Hours */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Working Hours</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  type="time"
                  value={queueConfig.workingHoursStart}
                  onChange={e => setQueueConfig(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  type="time"
                  value={queueConfig.workingHoursEnd}
                  onChange={e => setQueueConfig(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
          </div>

          {/* Priority Levels */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Priority Levels</h2>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {queueConfig.priorityLevels.map(priority => (
                  <div
                    key={priority.value}
                    className={`flex items-center justify-between p-3 border rounded-lg ${priority.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${priority.color}`} />
                      <span className="font-medium text-sm">{priority.label}</span>
                    </div>
                    <button
                      onClick={() => {
                        setQueueConfig(prev => ({
                          ...prev,
                          priorityLevels: prev.priorityLevels.map(p =>
                            p.value === priority.value ? { ...p, isActive: !p.isActive } : p
                          ),
                        }));
                      }}
                      className={`text-xs px-2 py-1 rounded ${priority.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}
                    >
                      {priority.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveConfig}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Configuration
            </button>
          </div>
        </div>
      )}

      {/* Operations Tab */}
      {activeTab === 'operations' && (
        <div className="space-y-6">
          {/* Emergency Controls */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Queue Operations
              </h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {canDelete && (
                <div className="border border-red-200 rounded-lg p-4 bg-red-50">
                  <h3 className="font-medium text-red-800 mb-2">Reset Queue</h3>
                  <p className="text-sm text-red-600 mb-3">Clear all waiting patients. This action cannot be undone.</p>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Reset All Queues
                  </button>
                </div>
              )}

              {canUpdate && (
                <>
                  <div className={`border rounded-lg p-4 ${queuesOnHold ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
                    <h3 className={`font-medium mb-2 ${queuesOnHold ? 'text-green-800' : 'text-orange-800'}`}>
                      {queuesOnHold ? 'Resume Queues' : 'Hold All Queues'}
                    </h3>
                    <p className={`text-sm mb-3 ${queuesOnHold ? 'text-green-600' : 'text-orange-600'}`}>
                      {queuesOnHold ? 'Resume normal queue operations.' : 'Pause all queue operations for emergency.'}
                    </p>
                    <button
                      onClick={queuesOnHold ? handleResumeQueues : handleHoldQueues}
                      className={`w-full px-4 py-2 text-white rounded-lg ${queuesOnHold ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                    >
                      {queuesOnHold ? 'Resume Queues' : 'Hold Queues'}
                    </button>
                  </div>

                  <div className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                    <h3 className="font-medium text-blue-800 mb-2">Transfer Patients</h3>
                    <p className="text-sm text-blue-600 mb-3">Move patients between different service points.</p>
                    <button
                      onClick={() => setActiveTab('queue')}
                      className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Go to Queue Management
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Queue Management Tab */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Point</label>
                <select
                  value={selectedServicePoint}
                  onChange={e => setSelectedServicePoint(e.target.value)}
                  className="border rounded-lg px-3 py-2"
                >
                  <option value="all">All Service Points</option>
                  {servicePoints.filter(sp => sp.isActive).map(sp => (
                    <option key={sp.id} value={sp.code}>{sp.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Queue Table */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b">
              <h2 className="text-lg font-semibold">Current Queue ({queue.length} patients)</h2>
            </div>
            {loading ? (
              <div className="p-8 text-center text-gray-500">Loading...</div>
            ) : queue.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No patients in queue</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Token</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Patient</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Department</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Service Point</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Wait Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Priority</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {queue.map(item => (
                      <tr key={item.id} className={`hover:bg-gray-50 ${
                        item.status === 'called' ? 'bg-yellow-50' : item.status === 'in_service' ? 'bg-blue-50' : ''
                      }`}>
                        <td className="px-4 py-3">
                          <span className="text-lg font-bold text-blue-600">{item.ticketNumber}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{item.patient.fullName}</div>
                          <div className="text-xs text-gray-500">MRN: {item.patient.mrn}</div>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{item.department || '-'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {servicePoints.find(sp => sp.code === item.servicePoint)?.name || item.servicePoint}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            item.status === 'waiting' ? 'bg-yellow-100 text-yellow-800' :
                            item.status === 'called' ? 'bg-orange-100 text-orange-800' :
                            item.status === 'in_service' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {item.status === 'waiting' ? 'Waiting' :
                             item.status === 'called' ? `Called (${item.counterNumber || item.roomNumber})` :
                             item.status === 'in_service' ? 'In Service' : item.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{getWaitTime(item.createdAt)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs text-white ${priorityLabels[item.priority]?.color || 'bg-gray-500'}`}>
                            {priorityLabels[item.priority]?.label || 'Normal'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {canUpdate && item.status === 'waiting' && (
                              <button
                                onClick={() => handleCallPatient(item)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                title="Call Patient"
                              >
                                <Phone className="w-4 h-4" />
                              </button>
                            )}
                            {canUpdate && (
                              <>
                                <button
                                  onClick={() => handleSkipPatient(item)}
                                  className="p-1.5 text-gray-500 hover:bg-gray-100 rounded"
                                  title="Skip"
                                >
                                  <SkipForward className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleTransfer(item)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                  title="Transfer"
                                >
                                  <ArrowRightLeft className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleRemovePatient(item)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title="Remove"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Service Point Modal */}
      {showServicePointModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingServicePoint ? 'Edit Service Point' : 'Add New Service Point'}
              </h2>
              <button onClick={() => setShowServicePointModal(false)} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={servicePointForm.name}
                  onChange={e => setServicePointForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Registration Counter 1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={servicePointForm.code}
                  onChange={e => setServicePointForm(prev => ({ ...prev, code: e.target.value.toLowerCase().replace(/\s/g, '-') }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., registration-1"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department *</label>
                <input
                  type="text"
                  value={servicePointForm.department}
                  onChange={e => setServicePointForm(prev => ({ ...prev, department: e.target.value }))}
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="e.g., Front Desk"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacity</label>
                <input
                  type="number"
                  value={servicePointForm.capacity}
                  onChange={e => setServicePointForm(prev => ({ ...prev, capacity: parseInt(e.target.value) || 30 }))}
                  className="w-full border rounded-lg px-3 py-2"
                  min={1}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowServicePointModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveServicePoint}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                {editingServicePoint ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Staff Modal */}
      {showAssignStaffModal && assigningServicePoint && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                Assign Staff to {assigningServicePoint.name}
              </h2>
              <button onClick={() => setShowAssignStaffModal(false)} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-2 max-h-80 overflow-y-auto">
              {mockStaff.map(staff => (
                <div
                  key={staff.id}
                  onClick={() => handleToggleStaffAssignment(staff.id)}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer ${
                    assigningServicePoint.assignedStaff.includes(staff.id) ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div>
                    <div className="font-medium">{staff.name}</div>
                    <div className="text-sm text-gray-500">{staff.department}</div>
                  </div>
                  {assigningServicePoint.assignedStaff.includes(staff.id) && (
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => {
                  setShowAssignStaffModal(false);
                  toast.success('Staff assignments updated');
                }}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reset All Queues?</h3>
              <p className="text-gray-600 mb-6">
                This will remove all waiting patients from all queues. This action cannot be undone.
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetQueue}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Yes, Reset All Queues
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {showTransferModal && transferringPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Transfer Patient</h2>
              <button onClick={() => setShowTransferModal(false)} className="p-1 text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-500">Patient</div>
                <div className="font-medium">{transferringPatient.patient.fullName}</div>
                <div className="text-sm text-gray-500">Token: {transferringPatient.ticketNumber}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transfer to Service Point</label>
                <select
                  value={transferTarget}
                  onChange={e => setTransferTarget(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">Select service point...</option>
                  {servicePoints
                    .filter(sp => sp.isActive && sp.code !== transferringPatient.servicePoint)
                    .map(sp => (
                      <option key={sp.id} value={sp.code}>{sp.name} ({sp.department})</option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmTransfer}
                disabled={!transferTarget}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && removingPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Remove from Queue?</h3>
              <p className="text-gray-600 mb-6">
                Remove <strong>{removingPatient.patient.fullName}</strong> (Token: {removingPatient.ticketNumber}) from the queue?
              </p>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmRemove}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
