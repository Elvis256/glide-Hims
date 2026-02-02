import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Volume2,
  UserCircle,
  Clock,
  CheckCircle,
  SkipForward,
  XCircle,
  RefreshCw,
  Stethoscope,
  Loader2,
  Pause,
  Play,
  ArrowRightLeft,
  RotateCcw,
  GripVertical,
  AlertTriangle,
  Timer,
  Users,
  Activity,
  X,
  Keyboard,
  CreditCard,
  FileText,
  Building2,
  User,
  Send,
  ChevronRight,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../services/queue';
import { useAuthStore } from '../store/auth';
import { usePermissions } from '../components/PermissionGate';

const SERVICE_POINTS = [
  { value: 'consultation', label: 'Consultation' },
  { value: 'triage', label: 'Triage' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'billing', label: 'Billing' },
  { value: 'cashier', label: 'Cashier' },
  { value: 'injection', label: 'Injection' },
  { value: 'dressing', label: 'Dressing' },
  { value: 'vitals', label: 'Vitals' },
  { value: 'records', label: 'Records' },
  { value: 'registration', label: 'Registration' },
];

const TRANSFER_TARGETS = [
  { value: 'consultation', label: 'Another Doctor', icon: Stethoscope },
  { value: 'laboratory', label: 'Laboratory', icon: Activity },
  { value: 'pharmacy', label: 'Pharmacy', icon: FileText },
  { value: 'radiology', label: 'Radiology', icon: Activity },
  { value: 'billing', label: 'Billing', icon: CreditCard },
];

const SKIP_REASONS = [
  'Patient not ready',
  'Patient requested delay',
  'Missing documents',
  'Payment pending',
  'Other',
];

const PRIORITY_LEVELS: Record<number, { label: string; color: string; bgColor: string }> = {
  1: { label: 'Emergency', color: 'text-red-700', bgColor: 'bg-red-100' },
  2: { label: 'Urgent', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  3: { label: 'VIP', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  4: { label: 'Elderly', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  5: { label: 'Disabled', color: 'text-blue-600', bgColor: 'bg-blue-50' },
  6: { label: 'Pregnant', color: 'text-pink-700', bgColor: 'bg-pink-100' },
  7: { label: 'Pediatric', color: 'text-green-700', bgColor: 'bg-green-100' },
  10: { label: 'Routine', color: 'text-gray-600', bgColor: 'bg-gray-100' },
};

interface TodaySummary {
  patientsSeen: number;
  avgConsultationTime: number;
  noShows: number;
  stillWaiting: number;
}

export default function CallNextPatientPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  
  // State
  const [counterNumber, setCounterNumber] = useState(() => localStorage.getItem('callNext_counter') || '1');
  const [servicePoint, setServicePoint] = useState(() => localStorage.getItem('callNext_servicePoint') || 'consultation');
  const [currentPatient, setCurrentPatient] = useState<QueueEntry | null>(null);
  const [lastPatient, setLastPatient] = useState<QueueEntry | null>(null);
  const [recentlyCalled, setRecentlyCalled] = useState<{ patient: QueueEntry; time: Date }[]>([]);
  const [consultationStartTime, setConsultationStartTime] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isQueueHeld, setIsQueueHeld] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [skipTarget, setSkipTarget] = useState<QueueEntry | null>(null);
  const [transferTarget, setTransferTarget] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [skipReason, setSkipReason] = useState('');
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [myQueue, setMyQueue] = useState<QueueEntry[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Permission checks
  const canUpdateQueue = hasPermission('queue.update');
  const canDeleteQueue = hasPermission('queue.delete');

  // Persist settings
  useEffect(() => {
    localStorage.setItem('callNext_counter', counterNumber);
  }, [counterNumber]);

  useEffect(() => {
    localStorage.setItem('callNext_servicePoint', servicePoint);
  }, [servicePoint]);

  // Consultation timer
  useEffect(() => {
    if (consultationStartTime) {
      timerRef.current = setInterval(() => {
        const now = new Date();
        setElapsedTime(Math.floor((now.getTime() - consultationStartTime.getTime()) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setElapsedTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consultationStartTime]);

  // Fetch waiting queue from API
  const { data: waitingList = [], isLoading, refetch } = useQuery({
    queryKey: ['queue', 'waiting', servicePoint],
    queryFn: () => queueService.getWaiting(servicePoint),
    refetchInterval: 5000,
  });

  // Fetch queue stats for today's summary
  const { data: queueStats } = useQuery({
    queryKey: ['queue', 'stats', servicePoint],
    queryFn: () => queueService.getStats(),
    refetchInterval: 30000,
  });

  // Calculate today's summary
  const todaySummary: TodaySummary = {
    patientsSeen: queueStats?.completed || 0,
    avgConsultationTime: queueStats?.avgWaitTime || 0,
    noShows: 0, // Would need backend support
    stillWaiting: queueStats?.waiting || waitingList.length,
  };

  // Update myQueue when waitingList changes
  useEffect(() => {
    setMyQueue(waitingList);
  }, [waitingList]);

  // Call next patient mutation
  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext(servicePoint),
    onSuccess: (data) => {
      if (data) {
        setCurrentPatient(data);
        setConsultationStartTime(new Date());
        setRecentlyCalled([{ patient: data, time: new Date() }, ...recentlyCalled.slice(0, 4)]);
        speakAnnouncement(data.ticketNumber || '', counterNumber);
        toast.success(`Calling ${data.patient?.fullName || 'patient'} - Token ${data.ticketNumber}`);
      } else {
        toast.info('No patients waiting in queue');
      }
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: () => {
      toast.error('Failed to call next patient');
    },
  });

  // Start service mutation
  const startServiceMutation = useMutation({
    mutationFn: (id: string) => queueService.startService(id),
    onSuccess: () => {
      setConsultationStartTime(new Date());
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Service started');
    },
    onError: () => {
      toast.error('Failed to start service');
    },
  });

  // Complete service mutation
  const completeMutation = useMutation({
    mutationFn: (id: string) => queueService.complete(id),
    onSuccess: () => {
      setLastPatient(currentPatient);
      setCurrentPatient(null);
      setConsultationStartTime(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Patient consultation completed');
    },
    onError: () => {
      toast.error('Failed to complete service');
    },
  });

  // No-show mutation
  const noShowMutation = useMutation({
    mutationFn: (id: string) => queueService.noShow(id),
    onSuccess: () => {
      setLastPatient(currentPatient);
      setCurrentPatient(null);
      setConsultationStartTime(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.warning('Patient marked as no-show');
    },
    onError: () => {
      toast.error('Failed to mark no-show');
    },
  });

  // Skip mutation
  const skipMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => queueService.skip(id, reason),
    onSuccess: () => {
      setShowSkipModal(false);
      setSkipTarget(null);
      setSkipReason('');
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.info('Patient skipped');
    },
    onError: () => {
      toast.error('Failed to skip patient');
    },
  });

  // Transfer mutation
  const transferMutation = useMutation({
    mutationFn: ({ id, target }: { id: string; target: string }) => queueService.transfer(id, target),
    onSuccess: () => {
      setShowTransferModal(false);
      setTransferTarget('');
      setTransferNote('');
      setLastPatient(currentPatient);
      setCurrentPatient(null);
      setConsultationStartTime(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Patient transferred successfully');
    },
    onError: () => {
      toast.error('Failed to transfer patient');
    },
  });

  // Requeue mutation (return to queue)
  const requeueMutation = useMutation({
    mutationFn: (id: string) => queueService.requeue(id),
    onSuccess: () => {
      setLastPatient(currentPatient);
      setCurrentPatient(null);
      setConsultationStartTime(null);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.info('Patient returned to queue');
    },
    onError: () => {
      toast.error('Failed to return patient to queue');
    },
  });

  // Recall last patient mutation
  const recallMutation = useMutation({
    mutationFn: (id: string) => queueService.recall(id),
    onSuccess: (data) => {
      setCurrentPatient(data);
      setLastPatient(null);
      setConsultationStartTime(new Date());
      speakAnnouncement(data.ticketNumber || '', counterNumber);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
      toast.success('Patient recalled');
    },
    onError: () => {
      toast.error('Failed to recall patient');
    },
  });

  // Call specific patient
  const callPatientMutation = useMutation({
    mutationFn: (id: string) => queueService.call(id),
    onSuccess: (data) => {
      setCurrentPatient(data);
      setConsultationStartTime(new Date());
      setRecentlyCalled([{ patient: data, time: new Date() }, ...recentlyCalled.slice(0, 4)]);
      speakAnnouncement(data.ticketNumber || '', counterNumber);
      toast.success(`Calling ${data.patient?.fullName || 'patient'} - Token ${data.ticketNumber}`);
      queryClient.invalidateQueries({ queryKey: ['queue'] });
    },
    onError: () => {
      toast.error('Failed to call patient');
    },
  });

  const callNextPatient = useCallback(() => {
    if (waitingList.length === 0 || currentPatient || isQueueHeld) return;
    if (!canUpdateQueue) {
      toast.error('You do not have permission to call patients');
      return;
    }
    callNextMutation.mutate();
  }, [waitingList.length, currentPatient, isQueueHeld, canUpdateQueue, callNextMutation]);

  const speakAnnouncement = (token: string, counter: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `Token number ${token.replace('-', ' ')}, please proceed to counter ${counter}`
      );
      speechSynthesis.speak(utterance);
    }
  };

  const recallCurrentPatient = () => {
    if (currentPatient) {
      speakAnnouncement(currentPatient.ticketNumber || '', counterNumber);
      toast.info('Patient recalled via announcement');
    }
  };

  const completeService = useCallback(() => {
    if (!currentPatient) return;
    if (!canUpdateQueue) {
      toast.error('You do not have permission to complete consultations');
      return;
    }
    completeMutation.mutate(currentPatient.id);
  }, [currentPatient, canUpdateQueue, completeMutation]);

  const markNoShow = useCallback(() => {
    if (!currentPatient) return;
    if (!canDeleteQueue) {
      toast.error('You do not have permission to mark no-shows');
      return;
    }
    noShowMutation.mutate(currentPatient.id);
  }, [currentPatient, canDeleteQueue, noShowMutation]);

  const handleSkipPatient = (patient: QueueEntry) => {
    setSkipTarget(patient);
    setShowSkipModal(true);
  };

  const confirmSkip = () => {
    if (skipTarget) {
      skipMutation.mutate({ id: skipTarget.id, reason: skipReason });
    }
  };

  const handleTransfer = () => {
    if (currentPatient && transferTarget) {
      transferMutation.mutate({ id: currentPatient.id, target: transferTarget });
    }
  };

  const returnToQueue = () => {
    if (currentPatient) {
      requeueMutation.mutate(currentPatient.id);
    }
  };

  const recallLastPatient = () => {
    if (lastPatient) {
      recallMutation.mutate(lastPatient.id);
    }
  };

  const toggleQueueHold = () => {
    setIsQueueHeld(!isQueueHeld);
    toast.info(isQueueHeld ? 'Queue resumed' : 'Queue held - taking a break');
  };

  const markPriority = (patientId: string, urgent: boolean) => {
    // Would need backend support for priority update
    toast.info(urgent ? 'Marked as urgent' : 'Priority reset');
  };

  // Drag and drop handlers for queue reordering
  const handleDragStart = (id: string) => {
    setDraggedItem(id);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === targetId) return;
    
    const draggedIndex = myQueue.findIndex(p => p.id === draggedItem);
    const targetIndex = myQueue.findIndex(p => p.id === targetId);
    
    if (draggedIndex !== -1 && targetIndex !== -1) {
      const newQueue = [...myQueue];
      const [removed] = newQueue.splice(draggedIndex, 1);
      newQueue.splice(targetIndex, 0, removed);
      setMyQueue(newQueue);
    }
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    // Would need backend support to persist reorder
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          callNextPatient();
          break;
        case 'Enter':
          e.preventDefault();
          completeService();
          break;
        case 'KeyN':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            markNoShow();
          }
          break;
        case 'Slash':
          if (e.shiftKey) {
            e.preventDefault();
            setShowShortcutsModal(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [callNextPatient, completeService, markNoShow]);

  const getPriorityBadge = (priority?: number) => {
    const p = priority || 10;
    const info = PRIORITY_LEVELS[p] || PRIORITY_LEVELS[10];
    return (
      <span className={`px-2 py-0.5 ${info.bgColor} ${info.color} rounded text-xs font-medium`}>
        {info.label}
      </span>
    );
  };

  const getWaitTime = (entry: QueueEntry) => {
    if (!entry.createdAt) return 0;
    const now = new Date();
    const created = new Date(entry.createdAt);
    return Math.floor((now.getTime() - created.getTime()) / 60000);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const calculateAge = (dob?: string) => {
    if (!dob) return null;
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const nextPatient = waitingList[0];

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header with Current Context */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <Volume2 className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Call Next Patient</h1>
              <p className="text-gray-500 text-sm">Manage patient queue and service</p>
            </div>
          </div>
          {/* Current Context Panel */}
          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
            <User className="w-4 h-4 text-blue-600" />
            <div className="text-sm">
              <span className="font-medium text-blue-900">{user?.fullName || 'Unknown User'}</span>
              <span className="text-blue-600 mx-2">•</span>
              <span className="text-blue-700">{SERVICE_POINTS.find(s => s.value === servicePoint)?.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Service Point Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-500" />
            <select
              value={servicePoint}
              onChange={(e) => setServicePoint(e.target.value)}
              className="px-3 py-1.5 border rounded font-medium text-sm"
            >
              {SERVICE_POINTS.map(sp => (
                <option key={sp.value} value={sp.value}>{sp.label}</option>
              ))}
            </select>
          </div>
          {/* Counter/Room Number */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Room/Counter:</label>
            <input
              type="text"
              value={counterNumber}
              onChange={(e) => setCounterNumber(e.target.value)}
              className="w-20 px-3 py-1.5 border rounded text-center font-medium text-sm"
            />
          </div>
          {/* Shortcuts Help */}
          <button
            onClick={() => setShowShortcutsModal(true)}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Column 1: Currently Serving & Call Next */}
        <div className="flex flex-col gap-4">
          {/* Currently Serving Card */}
          <div className={`card p-4 ${currentPatient ? 'border-2 border-green-500 bg-green-50' : ''}`}>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4" />
              Currently Serving
              {isQueueHeld && (
                <span className="ml-auto px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs flex items-center gap-1">
                  <Pause className="w-3 h-3" /> Queue Held
                </span>
              )}
            </h2>
            {currentPatient ? (
              <div className="py-2">
                {/* Large Token */}
                <p className="text-4xl font-mono font-bold text-green-600 text-center mb-2">
                  {currentPatient.ticketNumber}
                </p>
                {/* Patient Info */}
                <div className="text-center mb-3">
                  <p className="text-lg font-medium text-gray-900">{currentPatient.patient?.fullName || 'Unknown'}</p>
                  <p className="text-sm text-gray-500">{currentPatient.patient?.mrn}</p>
                  <div className="flex items-center justify-center gap-2 mt-1 text-sm text-gray-600">
                    {/* Age and Gender would need patient extended info */}
                    <span>MRN: {currentPatient.patient?.mrn}</span>
                  </div>
                </div>
                {/* Priority/Payment Badge */}
                <div className="flex justify-center gap-2 mb-3">
                  {getPriorityBadge(currentPatient.priority)}
                </div>
                {/* Chief Complaint */}
                {currentPatient.notes && (
                  <div className="p-2 bg-white/50 rounded border border-green-200 mb-3">
                    <p className="text-xs text-gray-500">Chief Complaint</p>
                    <p className="text-sm">{currentPatient.notes}</p>
                  </div>
                )}
                {/* Consultation Timer */}
                <div className="flex items-center justify-center gap-2 mb-4 p-2 bg-white/50 rounded">
                  <Timer className="w-4 h-4 text-gray-500" />
                  <span className="text-lg font-mono font-medium">{formatDuration(elapsedTime)}</span>
                </div>
                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={completeService}
                    disabled={completeMutation.isPending || !canUpdateQueue}
                    className="btn-primary text-sm flex items-center justify-center gap-1 py-2"
                  >
                    {completeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Complete
                  </button>
                  <button
                    onClick={markNoShow}
                    disabled={noShowMutation.isPending || !canDeleteQueue}
                    className="bg-red-600 text-white hover:bg-red-700 rounded text-sm flex items-center justify-center gap-1 py-2"
                  >
                    {noShowMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    No Show
                  </button>
                  <button
                    onClick={() => setShowTransferModal(true)}
                    className="btn-secondary text-sm flex items-center justify-center gap-1 py-2"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer
                  </button>
                  <button
                    onClick={returnToQueue}
                    disabled={requeueMutation.isPending}
                    className="btn-secondary text-sm flex items-center justify-center gap-1 py-2"
                  >
                    {requeueMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Return to Queue
                  </button>
                </div>
                {/* Recall button */}
                <button
                  onClick={recallCurrentPatient}
                  className="w-full mt-2 text-sm text-blue-600 hover:underline flex items-center justify-center gap-1"
                >
                  <Volume2 className="w-4 h-4" />
                  Recall Patient (Announce Again)
                </button>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-400">
                <UserCircle className="w-16 h-16 mx-auto mb-2 opacity-50" />
                <p>No patient currently being served</p>
                {lastPatient && (
                  <button
                    onClick={recallLastPatient}
                    disabled={recallMutation.isPending}
                    className="mt-3 text-sm text-blue-600 hover:underline flex items-center justify-center gap-1 mx-auto"
                  >
                    {recallMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                    Recall last patient ({lastPatient.ticketNumber})
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Call Next Section */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3">Call Next</h2>
            {/* Next Patient Preview */}
            {nextPatient && !currentPatient && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-3">
                <p className="text-xs text-blue-600 mb-1">Next in queue:</p>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-blue-700">{nextPatient.ticketNumber}</span>
                    <p className="text-sm text-gray-700">{nextPatient.patient?.fullName || 'Unknown'}</p>
                  </div>
                  <button
                    onClick={() => handleSkipPatient(nextPatient)}
                    className="text-xs text-gray-500 hover:text-orange-600"
                    title="Skip with reason"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            {/* Call Next Button */}
            <button
              onClick={callNextPatient}
              disabled={waitingList.length === 0 || currentPatient !== null || callNextMutation.isPending || isQueueHeld || !canUpdateQueue}
              className="w-full btn-primary py-4 text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {callNextMutation.isPending ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <Volume2 className="w-6 h-6" />
              )}
              Call Next Patient
              {waitingList.length > 0 && (
                <span className="bg-white/20 px-2 py-0.5 rounded text-sm">
                  {waitingList.length} waiting
                </span>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">Press SPACE to call next</p>
          </div>

          {/* Quick Actions */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <button
                onClick={recallLastPatient}
                disabled={!lastPatient || recallMutation.isPending}
                className="w-full btn-secondary text-sm flex items-center gap-2 py-2 disabled:opacity-50"
              >
                <RotateCcw className="w-4 h-4" />
                Recall Last Patient
                {lastPatient && <span className="text-gray-400 ml-auto">{lastPatient.ticketNumber}</span>}
              </button>
              <button
                onClick={toggleQueueHold}
                className={`w-full text-sm flex items-center gap-2 py-2 rounded ${
                  isQueueHeld 
                    ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                    : 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                }`}
              >
                {isQueueHeld ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isQueueHeld ? 'Resume Queue' : 'Hold Queue (Break)'}
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: My Queue Panel */}
        <div className="card p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              My Queue ({myQueue.length})
            </h2>
            <button
              onClick={() => refetch()}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">Drag to reorder • Click ⚠️ to mark urgent</p>
          
          <div className="flex-1 overflow-y-auto space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : myQueue.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Queue is empty!</p>
                </div>
              </div>
            ) : (
              myQueue.map((entry, idx) => (
                <div
                  key={entry.id}
                  draggable
                  onDragStart={() => handleDragStart(entry.id)}
                  onDragOver={(e) => handleDragOver(e, entry.id)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-2 p-2 border rounded-lg cursor-move hover:border-blue-300 ${
                    idx === 0 && !currentPatient ? 'border-blue-300 bg-blue-50' : ''
                  } ${draggedItem === entry.id ? 'opacity-50' : ''}`}
                >
                  <GripVertical className="w-4 h-4 text-gray-300" />
                  <span className="w-5 h-5 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-sm font-bold text-blue-600 truncate">{entry.ticketNumber}</span>
                      {entry.priority && entry.priority < 10 && getPriorityBadge(entry.priority)}
                    </div>
                    <p className="text-xs text-gray-600 truncate">{entry.patient?.fullName || 'Unknown'}</p>
                    <p className="text-xs text-gray-400">{getWaitTime(entry)} min waiting</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => markPriority(entry.id, !entry.priority || entry.priority >= 10)}
                      className={`p-1 rounded hover:bg-red-50 ${entry.priority && entry.priority < 3 ? 'text-red-500' : 'text-gray-300'}`}
                      title="Mark as urgent"
                    >
                      <AlertTriangle className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => !currentPatient && callPatientMutation.mutate(entry.id)}
                      disabled={!!currentPatient || !canUpdateQueue}
                      className="p-1 text-blue-500 hover:bg-blue-50 rounded disabled:opacity-50"
                      title="Call this patient"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Waiting Queue */}
        <div className="card p-4 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3 flex-shrink-0">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Waiting Queue ({waitingList.length})
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : waitingList.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Queue is empty!</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {waitingList.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-3 border rounded-lg ${
                      idx === 0 ? 'border-blue-300 bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium">
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-blue-600">{entry.ticketNumber}</span>
                          {getPriorityBadge(entry.priority)}
                        </div>
                        <p className="text-sm text-gray-900">{entry.patient?.fullName || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{entry.patient?.mrn || ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">{getWaitTime(entry)} min</p>
                        <p className="text-xs text-gray-500">waiting</p>
                      </div>
                      <button
                        onClick={() => handleSkipPatient(entry)}
                        className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded"
                        title="Skip with reason"
                        disabled={skipMutation.isPending}
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Today's Summary & Recent */}
        <div className="flex flex-col gap-4">
          {/* Today's Summary */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Today's Summary
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{todaySummary.patientsSeen}</p>
                <p className="text-xs text-gray-600">Patients Seen</p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{todaySummary.avgConsultationTime}</p>
                <p className="text-xs text-gray-600">Avg. Time (min)</p>
              </div>
              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{todaySummary.noShows}</p>
                <p className="text-xs text-gray-600">No Shows</p>
              </div>
              <div className="p-3 bg-amber-50 rounded-lg">
                <p className="text-2xl font-bold text-amber-600">{todaySummary.stillWaiting}</p>
                <p className="text-xs text-gray-600">Still Waiting</p>
              </div>
            </div>
          </div>

          {/* Recently Called */}
          <div className="card p-4 flex-1 min-h-0 flex flex-col">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Recently Called</h2>
            <div className="flex-1 overflow-y-auto space-y-2">
              {recentlyCalled.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">No recent calls</p>
              ) : (
                recentlyCalled.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-mono text-sm font-medium">{item.patient.ticketNumber}</p>
                      <p className="text-xs text-gray-500">{item.patient.patient?.fullName || ''}</p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {item.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Patient Modal */}
      {showTransferModal && currentPatient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Transfer Patient</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Transferring:</p>
              <p className="font-medium">{currentPatient.patient?.fullName} ({currentPatient.ticketNumber})</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Transfer to:</label>
              <div className="space-y-2">
                {TRANSFER_TARGETS.map(target => (
                  <button
                    key={target.value}
                    onClick={() => setTransferTarget(target.value)}
                    className={`w-full p-3 border rounded-lg flex items-center gap-3 text-left transition-colors ${
                      transferTarget === target.value 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'hover:border-gray-300'
                    }`}
                  >
                    <target.icon className="w-5 h-5 text-gray-500" />
                    <span>{target.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Note (optional):</label>
              <textarea
                value={transferNote}
                onChange={(e) => setTransferNote(e.target.value)}
                className="w-full p-2 border rounded-lg"
                rows={2}
                placeholder="Add any notes for the receiving department..."
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTransferModal(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                disabled={!transferTarget || transferMutation.isPending}
                className="flex-1 btn-primary flex items-center justify-center gap-2"
              >
                {transferMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Confirm Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Skip Patient Modal */}
      {showSkipModal && skipTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Skip Patient</h3>
              <button onClick={() => { setShowSkipModal(false); setSkipTarget(null); }} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Skipping:</p>
              <p className="font-medium">{skipTarget.patient?.fullName} ({skipTarget.ticketNumber})</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Reason for skipping:</label>
              <div className="space-y-2">
                {SKIP_REASONS.map(reason => (
                  <button
                    key={reason}
                    onClick={() => setSkipReason(reason)}
                    className={`w-full p-2 border rounded-lg text-left text-sm transition-colors ${
                      skipReason === reason 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'hover:border-gray-300'
                    }`}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSkipModal(false); setSkipTarget(null); }}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmSkip}
                disabled={!skipReason || skipMutation.isPending}
                className="flex-1 bg-orange-600 text-white hover:bg-orange-700 rounded py-2 flex items-center justify-center gap-2"
              >
                {skipMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <SkipForward className="w-4 h-4" />
                )}
                Skip Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Keyboard className="w-5 h-5" />
                Keyboard Shortcuts
              </h3>
              <button onClick={() => setShowShortcutsModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Call Next Patient</span>
                <kbd className="px-2 py-1 bg-white border rounded text-sm font-mono">Space</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Mark Complete</span>
                <kbd className="px-2 py-1 bg-white border rounded text-sm font-mono">Enter</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Mark No-Show</span>
                <kbd className="px-2 py-1 bg-white border rounded text-sm font-mono">N</kbd>
              </div>
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>Show Shortcuts</span>
                <kbd className="px-2 py-1 bg-white border rounded text-sm font-mono">?</kbd>
              </div>
            </div>
            <button
              onClick={() => setShowShortcutsModal(false)}
              className="w-full mt-4 btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
