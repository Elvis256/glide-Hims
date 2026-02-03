import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ListOrdered,
  Clock,
  UserCircle,
  AlertTriangle,
  Search,
  Filter,
  Loader2,
  RefreshCw,
  Play,
  CheckCircle,
  X,
  GripVertical,
  Heart,
  Activity,
  Thermometer,
  Droplets,
  Ambulance,
  User,
  MapPin,
  Stethoscope,
  Timer,
  TrendingUp,
  Pill,
  AlertCircle,
  Building2,
  ArrowRight,
  Save,
  ClipboardList,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../services/queue';
import { usePermissions } from '../../components/PermissionGate';

interface TriagePatient {
  id: string;
  queueNumber: number;
  name: string;
  mrn: string;
  age: number;
  gender: string;
  chiefComplaint: string;
  arrivalTime: string;
  priority: 'critical' | 'urgent' | 'semi-urgent' | 'routine';
  status: 'waiting' | 'in-triage' | 'completed';
  waitTime: number;
  arrivalMode: 'walk-in' | 'ambulance' | 'referral';
  vitals?: {
    temperature?: number;
    pulse?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    painScale?: number;
  };
  allergies?: string[];
  medications?: string[];
  patientId?: string;
}

// ESI Levels for triage
const ESI_LEVELS = [
  { level: 1, label: 'ESI-1 (Resuscitation)', color: 'bg-red-600', description: 'Immediate life-saving intervention required', acuity: 'critical' },
  { level: 2, label: 'ESI-2 (Emergent)', color: 'bg-orange-500', description: 'High risk, confused/lethargic, severe pain/distress', acuity: 'urgent' },
  { level: 3, label: 'ESI-3 (Urgent)', color: 'bg-yellow-500', description: 'Two or more resources needed', acuity: 'semi-urgent' },
  { level: 4, label: 'ESI-4 (Less Urgent)', color: 'bg-green-500', description: 'One resource needed', acuity: 'semi-urgent' },
  { level: 5, label: 'ESI-5 (Non-Urgent)', color: 'bg-blue-500', description: 'No resources needed', acuity: 'routine' },
];

const DISPOSITION_OPTIONS = [
  { value: 'opd', label: 'OPD Consultation', icon: Stethoscope },
  { value: 'emergency', label: 'Emergency Department', icon: AlertTriangle },
  { value: 'direct-admit', label: 'Direct Admission', icon: Building2 },
  { value: 'observation', label: 'Observation Unit', icon: Clock },
];

// Map API priority (1-10) to UI priority
const mapPriority = (priority: number): TriagePatient['priority'] => {
  if (priority <= 1) return 'critical';
  if (priority <= 3) return 'urgent';
  if (priority <= 5) return 'semi-urgent';
  return 'routine';
};

// Map acuity to ESI level
const acuityToESI = (acuity: TriagePatient['priority']): number => {
  switch (acuity) {
    case 'critical': return 1;
    case 'urgent': return 2;
    case 'semi-urgent': return 3;
    case 'routine': return 5;
    default: return 4;
  }
};

// Map API status to UI status
const mapStatus = (status: string): TriagePatient['status'] => {
  if (status === 'in_service') return 'in-triage';
  if (status === 'completed') return 'completed';
  return 'waiting';
};

// Calculate age from date of birth
const calculateAge = (dob?: string): number => {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

// Calculate wait time in minutes
const calculateWaitTime = (createdAt: string): number => {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.round((now.getTime() - created.getTime()) / 60000);
};

// Transform API queue entry to UI format
const transformQueueEntry = (entry: QueueEntry & { patient?: { fullName: string; mrn: string; dateOfBirth?: string; gender?: string; id?: string }; encounter?: { chiefComplaint?: string }; arrivalMode?: string }): TriagePatient => ({
  id: entry.id,
  queueNumber: parseInt(entry.ticketNumber?.replace(/\D/g, '') || '0') || 0,
  name: entry.patient?.fullName || 'Unknown Patient',
  mrn: entry.patient?.mrn || 'N/A',
  age: calculateAge(entry.patient?.dateOfBirth),
  gender: entry.patient?.gender || 'Unknown',
  chiefComplaint: entry.encounter?.chiefComplaint || entry.notes || 'No complaint recorded',
  arrivalTime: entry.createdAt,
  priority: mapPriority(entry.priority),
  status: mapStatus(entry.status),
  waitTime: calculateWaitTime(entry.createdAt),
  arrivalMode: (entry.arrivalMode as 'walk-in' | 'ambulance' | 'referral') || 'walk-in',
  patientId: entry.patient?.id || entry.patientId,
});

const priorityColors: Record<string, { bg: string; border: string; text: string; label: string; pulse: string }> = {
  critical: { bg: 'bg-red-50', border: 'border-red-500', text: 'text-red-700', label: 'Critical', pulse: 'animate-pulse' },
  urgent: { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-700', label: 'Urgent', pulse: '' },
  'semi-urgent': { bg: 'bg-yellow-50', border: 'border-yellow-500', text: 'text-yellow-700', label: 'Semi-Urgent', pulse: '' },
  routine: { bg: 'bg-green-50', border: 'border-green-500', text: 'text-green-700', label: 'Routine', pulse: '' },
};

const arrivalModeIcons: Record<string, { icon: typeof User; color: string }> = {
  'walk-in': { icon: User, color: 'text-gray-500' },
  ambulance: { icon: Ambulance, color: 'text-red-500' },
  referral: { icon: ClipboardList, color: 'text-blue-500' },
};

export default function TriageQueuePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  
  // Permission checks
  const canReadTriage = hasPermission('triage.read');
  const canUpdateTriage = hasPermission('triage.update');

  // State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedPatient, setSelectedPatient] = useState<TriagePatient | null>(null);
  const [showTriageModal, setShowTriageModal] = useState(false);
  const [showQuickTriageModal, setShowQuickTriageModal] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [myQueue, setMyQueue] = useState<TriagePatient[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const previousQueueLengthRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Triage form state
  const [triageForm, setTriageForm] = useState({
    chiefComplaint: '',
    onset: '',
    duration: '',
    esiLevel: 3,
    acuityColor: 'semi-urgent' as TriagePatient['priority'],
    disposition: 'opd',
    nursingNotes: '',
  });

  // Fetch queue from API - triage service point
  const { data: queueData, isLoading, refetch } = useQuery({
    queryKey: ['triage-queue'],
    queryFn: () => queueService.getQueue({ servicePoint: 'triage' }),
    refetchInterval: 30000,
    enabled: canReadTriage,
  });

  // Also get consultation queue as fallback
  const { data: consultQueue } = useQuery({
    queryKey: ['consultation-queue-triage'],
    queryFn: () => queueService.getQueue({ servicePoint: 'consultation' }),
    refetchInterval: 30000,
    enabled: canReadTriage,
  });

  // Start triage mutation
  const startTriageMutation = useMutation({
    mutationFn: (id: string) => queueService.startService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triage-queue'] });
      toast.success('Triage started');
    },
    onError: () => {
      toast.error('Failed to start triage');
    },
  });

  // Complete triage mutation
  const completeTriageMutation = useMutation({
    mutationFn: ({ id, nextServicePoint }: { id: string; nextServicePoint: string }) =>
      queueService.transfer(id, nextServicePoint),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['triage-queue'] });
      setShowTriageModal(false);
      setShowQuickTriageModal(false);
      setSelectedPatient(null);
      toast.success('Triage completed, patient transferred');
    },
    onError: () => {
      toast.error('Failed to complete triage');
    },
  });

  // Transform API data to UI format
  const allQueue: TriagePatient[] = useMemo(() => [
    ...(queueData || []).map(transformQueueEntry),
    ...(consultQueue || []).filter((q: QueueEntry) => q.status === 'waiting').map(transformQueueEntry),
  ], [queueData, consultQueue]);

  // Reordered queue for display (combines server data with local reorder)
  const displayQueue = useMemo(() => {
    if (myQueue.length === 0 || draggedItem === null) {
      return allQueue;
    }
    // If we have a local reorder during drag, use that
    if (myQueue.length > 0 && myQueue.every(q => allQueue.some(a => a.id === q.id))) {
      return myQueue;
    }
    return allQueue;
  }, [allQueue, myQueue, draggedItem]);

  // Sound alert for new arrivals
  const playNotificationSound = useCallback((isAmbulance: boolean = false) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      if (isAmbulance) {
        oscillator.frequency.setValueAtTime(880, ctx.currentTime);
        oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.2);
        oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.4);
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.6);
      } else {
        oscillator.frequency.setValueAtTime(523.25, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
        oscillator.start(ctx.currentTime);
        oscillator.stop(ctx.currentTime + 0.3);
      }
    } catch {
      // Audio not supported
    }
  }, []);

  // Check for new arrivals
  useEffect(() => {
    if (allQueue.length > previousQueueLengthRef.current && previousQueueLengthRef.current > 0) {
      const newPatients = allQueue.slice(0, allQueue.length - previousQueueLengthRef.current);
      const hasAmbulance = newPatients.some(p => p.arrivalMode === 'ambulance');
      playNotificationSound(hasAmbulance);
      toast.info(`New patient arrived${hasAmbulance ? ' by ambulance!' : ''}`, {
        icon: hasAmbulance ? '🚑' : '👤',
      });
    }
    previousQueueLengthRef.current = allQueue.length;
  }, [allQueue, playNotificationSound]);

  // Filter queue based on status
  const filteredQueue = displayQueue.filter((patient) => {
    if (statusFilter === 'waiting' && patient.status !== 'waiting') return false;
    if (statusFilter === 'in-progress' && patient.status !== 'in-triage') return false;
    if (statusFilter === 'completed' && patient.status !== 'completed') return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        patient.name.toLowerCase().includes(term) ||
        patient.mrn.toLowerCase().includes(term) ||
        patient.chiefComplaint.toLowerCase().includes(term)
      );
    }
    return true;
  });

  // Stats calculations
  const waitingCount = allQueue.filter((p) => p.status === 'waiting').length;
  const inTriageCount = allQueue.filter((p) => p.status === 'in-triage').length;
  const completedToday = allQueue.filter((p) => p.status === 'completed').length;
  const avgWaitTime = allQueue.length > 0 
    ? Math.round(allQueue.reduce((a, b) => a + b.waitTime, 0) / allQueue.length) 
    : 0;
  const criticalCount = allQueue.filter((p) => p.priority === 'critical').length;
  const urgentCount = allQueue.filter((p) => p.priority === 'urgent').length;
  const routineCount = allQueue.filter((p) => p.priority === 'routine' || p.priority === 'semi-urgent').length;

  // Drag and drop handlers
  const handleDragStart = (id: string) => {
    if (!canUpdateTriage) return;
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId || !canUpdateTriage) return;
    
    const currentQueue = myQueue.length > 0 ? myQueue : allQueue;
    const draggedIndex = currentQueue.findIndex(p => p.id === draggedItem);
    const targetIndex = currentQueue.findIndex(p => p.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newQueue = [...currentQueue];
      const [removed] = newQueue.splice(draggedIndex, 1);
      newQueue.splice(targetIndex, 0, removed);
      setMyQueue(newQueue);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    // Reset to server order after a delay
    setTimeout(() => setMyQueue([]), 5000);
  };

  const handleRefresh = () => {
    refetch();
    setLastRefresh(new Date());
    toast.info('Queue refreshed');
  };

  const handleStartTriage = (patient: TriagePatient) => {
    if (!canUpdateTriage) {
      toast.error('You do not have permission to perform triage');
      return;
    }
    setSelectedPatient(patient);
    setTriageForm({
      ...triageForm,
      chiefComplaint: patient.chiefComplaint,
      acuityColor: patient.priority,
      esiLevel: acuityToESI(patient.priority),
    });
    startTriageMutation.mutate(patient.id);
    setShowTriageModal(true);
  };

  const handleQuickTriage = (patient: TriagePatient) => {
    if (!canUpdateTriage) {
      toast.error('You do not have permission to perform triage');
      return;
    }
    setSelectedPatient(patient);
    setTriageForm({
      ...triageForm,
      chiefComplaint: patient.chiefComplaint,
      acuityColor: patient.priority,
      esiLevel: acuityToESI(patient.priority),
    });
    setShowQuickTriageModal(true);
  };

  const handleCompleteTriage = () => {
    if (!selectedPatient) return;
    completeTriageMutation.mutate({
      id: selectedPatient.id,
      nextServicePoint: triageForm.disposition === 'opd' ? 'consultation' : 
                        triageForm.disposition === 'emergency' ? 'emergency' : 
                        triageForm.disposition === 'direct-admit' ? 'admission' : 'observation',
    });
  };

  const handleRecordVitals = () => {
    if (selectedPatient) {
      navigate('/nursing/vitals/record', { state: { patient: selectedPatient } });
    }
  };

  // Permission gate
  if (!canReadTriage) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">You do not have permission to view the triage queue.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <ListOrdered className="w-6 h-6 text-teal-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Triage Queue</h1>
              <p className="text-sm text-gray-500">Patients waiting for triage assessment</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </span>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Clock className="w-4 h-4" />
            Waiting
          </div>
          <p className="text-2xl font-bold text-gray-900">{waitingCount}</p>
        </div>
        <div className="bg-teal-50 rounded-xl border border-teal-200 p-4">
          <div className="flex items-center gap-2 text-teal-600 text-sm mb-1">
            <Activity className="w-4 h-4" />
            In Triage
          </div>
          <p className="text-2xl font-bold text-teal-700">{inTriageCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <CheckCircle className="w-4 h-4" />
            Triaged Today
          </div>
          <p className="text-2xl font-bold text-gray-900">{completedToday}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
            <Timer className="w-4 h-4" />
            Avg Wait
          </div>
          <p className="text-2xl font-bold text-gray-900">{avgWaitTime}m</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4">
          <div className="flex items-center gap-2 text-red-600 text-sm mb-1">
            <AlertTriangle className="w-4 h-4" />
            Critical/Urgent
          </div>
          <p className="text-2xl font-bold text-red-700">{criticalCount + urgentCount}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4">
          <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
            <TrendingUp className="w-4 h-4" />
            Routine
          </div>
          <p className="text-2xl font-bold text-green-700">{routineCount}</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, MRN, or complaint..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="waiting">Not Started</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Queue Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Queue Cards */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-500">Drag to reorder by priority</p>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-500 rounded-full" title="Critical" />
              <span className="w-3 h-3 bg-orange-500 rounded-full" title="Urgent" />
              <span className="w-3 h-3 bg-yellow-500 rounded-full" title="Semi-Urgent" />
              <span className="w-3 h-3 bg-green-500 rounded-full" title="Routine" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
              </div>
            ) : filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <div className="text-center">
                  <ListOrdered className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>No patients in queue</p>
                </div>
              </div>
            ) : (
              filteredQueue.map((patient) => {
                const priority = priorityColors[patient.priority] || priorityColors.routine;
                const arrivalInfo = arrivalModeIcons[patient.arrivalMode] || arrivalModeIcons['walk-in'];
                const ArrivalIcon = arrivalInfo.icon;
                const isLongWait = patient.waitTime > 15;

                return (
                  <div
                    key={patient.id}
                    draggable={canUpdateTriage}
                    onDragStart={() => handleDragStart(patient.id)}
                    onDragOver={(e) => handleDragOver(e, patient.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedPatient(patient)}
                    className={`
                      bg-white rounded-xl border-2 p-4 cursor-pointer transition-all hover:shadow-md
                      ${priority.border} ${priority.bg}
                      ${selectedPatient?.id === patient.id ? 'ring-2 ring-teal-500' : ''}
                      ${draggedItem === patient.id ? 'opacity-50' : ''}
                      ${isLongWait && patient.status === 'waiting' ? 'animate-pulse' : ''}
                    `}
                  >
                    <div className="flex items-start gap-4">
                      {canUpdateTriage && (
                        <GripVertical className="w-5 h-5 text-gray-400 mt-1 cursor-grab" />
                      )}
                      <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-gray-600 border-2 border-gray-200 shadow-sm">
                        {patient.queueNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-gray-900">{patient.name}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${priority.bg} ${priority.text} border ${priority.border}`}>
                            {priority.label}
                          </span>
                          {patient.status === 'in-triage' && (
                            <span className="px-2 py-0.5 text-xs font-medium rounded bg-teal-100 text-teal-700 border border-teal-300">
                              In Progress
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">{patient.mrn} • {patient.age}y • {patient.gender}</p>
                        <p className="text-sm text-gray-700 mt-2 line-clamp-2">{patient.chiefComplaint}</p>
                        <div className="flex items-center gap-4 mt-3 text-sm">
                          <div className="flex items-center gap-1 text-gray-500">
                            <Clock className={`w-4 h-4 ${isLongWait ? 'text-red-500' : ''}`} />
                            <span className={isLongWait ? 'text-red-600 font-medium' : ''}>
                              {patient.waitTime}m wait
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 ${arrivalInfo.color}`}>
                            <ArrivalIcon className="w-4 h-4" />
                            <span className="capitalize">{patient.arrivalMode}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartTriage(patient);
                          }}
                          disabled={!canUpdateTriage || patient.status === 'completed'}
                          className="flex items-center gap-1 px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50"
                        >
                          <Play className="w-4 h-4" />
                          {patient.status === 'in-triage' ? 'Continue' : 'Start'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickTriage(patient);
                          }}
                          disabled={!canUpdateTriage}
                          className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          <Stethoscope className="w-4 h-4" />
                          Quick
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Patient Details Sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col min-h-0">
          {selectedPatient ? (
            <>
              <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <UserCircle className="w-5 h-5 text-teal-600" />
                Patient Details
              </h2>
              <div className="flex-1 space-y-4 overflow-y-auto">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <UserCircle className="w-10 h-10 text-gray-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{selectedPatient.name}</p>
                    <p className="text-sm text-gray-500">{selectedPatient.mrn}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Age</p>
                    <p className="font-medium text-gray-900">{selectedPatient.age} years</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-500">Gender</p>
                    <p className="font-medium text-gray-900">{selectedPatient.gender}</p>
                  </div>
                </div>

                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                  <p className="text-xs text-teal-600">Token Number</p>
                  <p className="font-bold text-2xl text-teal-700">#{selectedPatient.queueNumber}</p>
                </div>

                <div className={`p-3 rounded-lg border ${priorityColors[selectedPatient.priority]?.bg} ${priorityColors[selectedPatient.priority]?.border}`}>
                  <p className="text-xs text-gray-600">Priority Level</p>
                  <div className="flex items-center gap-2 mt-1">
                    <AlertTriangle className={`w-5 h-5 ${priorityColors[selectedPatient.priority]?.text}`} />
                    <p className={`font-medium ${priorityColors[selectedPatient.priority]?.text}`}>
                      {priorityColors[selectedPatient.priority]?.label}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Chief Complaint</p>
                  <p className="text-gray-900 mt-1">{selectedPatient.chiefComplaint}</p>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Arrival Mode</p>
                  <div className="flex items-center gap-2 mt-1">
                    {(() => {
                      const info = arrivalModeIcons[selectedPatient.arrivalMode];
                      const Icon = info?.icon || User;
                      return (
                        <>
                          <Icon className={`w-4 h-4 ${info?.color || 'text-gray-500'}`} />
                          <span className="capitalize">{selectedPatient.arrivalMode}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Wait Time</p>
                  <p className={`font-medium ${selectedPatient.waitTime > 15 ? 'text-red-600' : 'text-gray-900'}`}>
                    {selectedPatient.waitTime} minutes
                    {selectedPatient.waitTime > 15 && <span className="text-xs ml-2">(Extended wait)</span>}
                  </p>
                </div>

                {/* Vitals Summary */}
                {selectedPatient.vitals && (
                  <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-xs text-blue-600 mb-2">Vitals Recorded</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {selectedPatient.vitals.temperature && (
                        <div className="flex items-center gap-1">
                          <Thermometer className="w-3 h-3 text-red-500" />
                          <span>{selectedPatient.vitals.temperature}°C</span>
                        </div>
                      )}
                      {selectedPatient.vitals.pulse && (
                        <div className="flex items-center gap-1">
                          <Heart className="w-3 h-3 text-pink-500" />
                          <span>{selectedPatient.vitals.pulse} bpm</span>
                        </div>
                      )}
                      {selectedPatient.vitals.bpSystolic && (
                        <div className="flex items-center gap-1">
                          <Activity className="w-3 h-3 text-purple-500" />
                          <span>{selectedPatient.vitals.bpSystolic}/{selectedPatient.vitals.bpDiastolic}</span>
                        </div>
                      )}
                      {selectedPatient.vitals.oxygenSaturation && (
                        <div className="flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-blue-500" />
                          <span>{selectedPatient.vitals.oxygenSaturation}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Allergies */}
                {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
                  <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-xs text-red-600 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Allergies
                    </p>
                    <p className="text-sm text-red-700">{selectedPatient.allergies.join(', ')}</p>
                  </div>
                )}

                {/* Medications */}
                {selectedPatient.medications && selectedPatient.medications.length > 0 && (
                  <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-xs text-purple-600 mb-1 flex items-center gap-1">
                      <Pill className="w-3 h-3" />
                      Current Medications
                    </p>
                    <p className="text-sm text-purple-700">{selectedPatient.medications.join(', ')}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleStartTriage(selectedPatient)}
                  disabled={!canUpdateTriage}
                  className="flex-1 px-4 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Play className="w-5 h-5" />
                  {selectedPatient.status === 'in-triage' ? 'Continue Triage' : 'Start Triage'}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500">
              <div className="text-center">
                <ListOrdered className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p>Select a patient to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Triage Modal */}
      {showQuickTriageModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">Quick Triage</h3>
              <button onClick={() => setShowQuickTriageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {/* Patient Info */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center font-bold text-teal-600">
                    {selectedPatient.queueNumber}
                  </div>
                  <div>
                    <p className="font-medium">{selectedPatient.name}</p>
                    <p className="text-sm text-gray-500">{selectedPatient.mrn} • {selectedPatient.age}y</p>
                  </div>
                </div>
              </div>

              {/* Vitals Summary */}
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm font-medium text-blue-700 mb-2">Vital Signs</p>
                {selectedPatient.vitals ? (
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div><span className="text-gray-500">Temp:</span> {selectedPatient.vitals.temperature || 'N/A'}°C</div>
                    <div><span className="text-gray-500">Pulse:</span> {selectedPatient.vitals.pulse || 'N/A'}</div>
                    <div><span className="text-gray-500">BP:</span> {selectedPatient.vitals.bpSystolic || '-'}/{selectedPatient.vitals.bpDiastolic || '-'}</div>
                    <div><span className="text-gray-500">RR:</span> {selectedPatient.vitals.respiratoryRate || 'N/A'}</div>
                    <div><span className="text-gray-500">SpO2:</span> {selectedPatient.vitals.oxygenSaturation || 'N/A'}%</div>
                    <div><span className="text-gray-500">Pain:</span> {selectedPatient.vitals.painScale || 'N/A'}/10</div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No vitals recorded</p>
                )}
              </div>

              {/* Chief Complaint */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chief Complaint</label>
                <p className="p-2 bg-gray-50 rounded border text-sm">{selectedPatient.chiefComplaint}</p>
              </div>

              {/* ESI Level / Triage Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Triage Category (ESI Level)</label>
                <div className="space-y-2">
                  {ESI_LEVELS.map((esi) => (
                    <button
                      key={esi.level}
                      onClick={() => setTriageForm({ 
                        ...triageForm, 
                        esiLevel: esi.level, 
                        acuityColor: esi.acuity as TriagePatient['priority'] 
                      })}
                      className={`w-full p-2 border rounded-lg flex items-center gap-3 text-left transition-colors ${
                        triageForm.esiLevel === esi.level
                          ? 'border-gray-900 bg-gray-50'
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full ${esi.color}`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{esi.label}</p>
                        <p className="text-xs text-gray-500">{esi.description}</p>
                      </div>
                      {triageForm.esiLevel === esi.level && (
                        <CheckCircle className="w-5 h-5 text-teal-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Disposition */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Recommended Destination</label>
                <div className="grid grid-cols-2 gap-2">
                  {DISPOSITION_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTriageForm({ ...triageForm, disposition: option.value })}
                      className={`p-3 border rounded-lg flex items-center gap-2 text-left transition-colors ${
                        triageForm.disposition === option.value
                          ? 'border-teal-500 bg-teal-50'
                          : 'hover:border-gray-300'
                      }`}
                    >
                      <option.icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowQuickTriageModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCompleteTriage}
                disabled={completeTriageMutation.isPending}
                className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {completeTriageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Complete Triage
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Triage Form Modal */}
      {showTriageModal && selectedPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center font-bold text-teal-600">
                  {selectedPatient.queueNumber}
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Triage Assessment</h3>
                  <p className="text-sm text-gray-500">{selectedPatient.name} • {selectedPatient.mrn}</p>
                </div>
              </div>
              <button onClick={() => setShowTriageModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Left Column - Vitals */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <Heart className="w-4 h-4 text-red-500" />
                      Vital Signs
                    </h4>
                    {selectedPatient.vitals ? (
                      <div className="space-y-2">
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-600">Temperature</span>
                          <span className="font-medium">{selectedPatient.vitals.temperature || 'N/A'}°C</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-600">Pulse</span>
                          <span className="font-medium">{selectedPatient.vitals.pulse || 'N/A'} bpm</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-600">Blood Pressure</span>
                          <span className="font-medium">{selectedPatient.vitals.bpSystolic || '-'}/{selectedPatient.vitals.bpDiastolic || '-'} mmHg</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-600">Respiratory Rate</span>
                          <span className="font-medium">{selectedPatient.vitals.respiratoryRate || 'N/A'} /min</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-600">SpO2</span>
                          <span className="font-medium">{selectedPatient.vitals.oxygenSaturation || 'N/A'}%</span>
                        </div>
                        <div className="flex justify-between p-2 bg-gray-50 rounded">
                          <span className="text-gray-600">Pain Scale</span>
                          <span className="font-medium">{selectedPatient.vitals.painScale || 'N/A'}/10</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-gray-500 mb-3">No vitals recorded</p>
                        <button
                          onClick={handleRecordVitals}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                        >
                          Record Vitals
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Allergies */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-700 mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Allergies
                    </h4>
                    {selectedPatient.allergies && selectedPatient.allergies.length > 0 ? (
                      <ul className="space-y-1">
                        {selectedPatient.allergies.map((allergy, idx) => (
                          <li key={idx} className="text-sm text-red-700">• {allergy}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-red-600">No known allergies</p>
                    )}
                  </div>

                  {/* Medications */}
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <h4 className="font-medium text-purple-700 mb-2 flex items-center gap-2">
                      <Pill className="w-4 h-4" />
                      Current Medications
                    </h4>
                    {selectedPatient.medications && selectedPatient.medications.length > 0 ? (
                      <ul className="space-y-1">
                        {selectedPatient.medications.map((med, idx) => (
                          <li key={idx} className="text-sm text-purple-700">• {med}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-purple-600">No current medications</p>
                    )}
                  </div>
                </div>

                {/* Middle Column - Assessment */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Presenting Complaint</h4>
                    <textarea
                      value={triageForm.chiefComplaint}
                      onChange={(e) => setTriageForm({ ...triageForm, chiefComplaint: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                      rows={3}
                      placeholder="Describe the chief complaint..."
                    />
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Onset & Duration</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500">Onset</label>
                        <input
                          type="text"
                          value={triageForm.onset}
                          onChange={(e) => setTriageForm({ ...triageForm, onset: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="e.g., Sudden, Gradual"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Duration</label>
                        <input
                          type="text"
                          value={triageForm.duration}
                          onChange={(e) => setTriageForm({ ...triageForm, duration: e.target.value })}
                          className="w-full p-2 border border-gray-300 rounded-lg text-sm"
                          placeholder="e.g., 2 hours, 3 days"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3">Nursing Notes</h4>
                    <textarea
                      value={triageForm.nursingNotes}
                      onChange={(e) => setTriageForm({ ...triageForm, nursingNotes: e.target.value })}
                      className="w-full p-3 border border-gray-300 rounded-lg text-sm resize-none"
                      rows={4}
                      placeholder="Additional observations..."
                    />
                  </div>
                </div>

                {/* Right Column - ESI & Disposition */}
                <div className="space-y-4">
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                      ESI Level
                    </h4>
                    <div className="space-y-2">
                      {ESI_LEVELS.map((esi) => (
                        <button
                          key={esi.level}
                          onClick={() => setTriageForm({ 
                            ...triageForm, 
                            esiLevel: esi.level,
                            acuityColor: esi.acuity as TriagePatient['priority']
                          })}
                          className={`w-full p-2 border rounded-lg flex items-center gap-2 text-left transition-colors ${
                            triageForm.esiLevel === esi.level
                              ? 'border-gray-900 bg-gray-50'
                              : 'hover:border-gray-300'
                          }`}
                        >
                          <div className={`w-3 h-3 rounded-full ${esi.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{esi.label}</p>
                          </div>
                          {triageForm.esiLevel === esi.level && (
                            <CheckCircle className="w-4 h-4 text-teal-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      Disposition
                    </h4>
                    <div className="space-y-2">
                      {DISPOSITION_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTriageForm({ ...triageForm, disposition: option.value })}
                          className={`w-full p-3 border rounded-lg flex items-center gap-3 text-left transition-colors ${
                            triageForm.disposition === option.value
                              ? 'border-teal-500 bg-teal-50'
                              : 'hover:border-gray-300'
                          }`}
                        >
                          <option.icon className="w-5 h-5 text-gray-500" />
                          <span className="font-medium">{option.label}</span>
                          {triageForm.disposition === option.value && (
                            <CheckCircle className="w-4 h-4 text-teal-600 ml-auto" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 flex gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setShowTriageModal(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('Triage saved as draft');
                }}
                className="px-6 py-2 border border-teal-600 text-teal-600 rounded-lg hover:bg-teal-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Save Draft
              </button>
              <button
                onClick={handleCompleteTriage}
                disabled={completeTriageMutation.isPending}
                className="flex-1 px-6 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {completeTriageMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Complete Triage & Assign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
