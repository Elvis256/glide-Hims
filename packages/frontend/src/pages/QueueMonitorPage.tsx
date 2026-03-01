import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Monitor,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
  Maximize,
  Minimize,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Building2,
  Calendar,
  Activity,
  Timer,
  Megaphone,
  ChevronRight,
  Stethoscope,
  TrendingUp,
  Baby,
  Accessibility,
  Heart,
  AlertTriangle,
  Zap,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../services/queue';
import { facilitiesService } from '../services/facilities';

// Service point display names
const SERVICE_POINT_LABELS: Record<string, string> = {
  registration: 'Registration',
  triage: 'Triage',
  consultation: 'Consultation',
  general_opd: 'General OPD',
  laboratory: 'Laboratory',
  pharmacy: 'Pharmacy',
  radiology: 'Radiology',
  billing: 'Billing',
  cashier: 'Cashier',
  injection: 'Injection Room',
  dressing: 'Dressing Room',
  vitals: 'Vitals',
  records: 'Records',
  ipd: 'IPD Admission',
  emergency: 'Emergency',
  theatre: 'Theatre',
  physiotherapy: 'Physiotherapy',
  dental: 'Dental',
  optical: 'Optical',
  nutrition: 'Nutrition',
  counselling: 'Counselling',
};

// Department filter tabs
const DEPARTMENTS = [
  { value: '', label: 'All', color: 'blue' },
  { value: 'triage', label: 'Triage', color: 'red' },
  { value: 'consultation', label: 'Consult', color: 'purple' },
  { value: 'laboratory', label: 'Lab', color: 'cyan' },
  { value: 'pharmacy', label: 'Pharmacy', color: 'green' },
  { value: 'radiology', label: 'Radiology', color: 'indigo' },
  { value: 'billing', label: 'Billing', color: 'orange' },
  { value: 'emergency', label: 'Emergency', color: 'rose' },
];

// Priority config
const PRIORITY_CONFIG: Record<number, { label: string; color: string; darkColor: string }> = {
  1:  { label: 'EMERGENCY', color: 'bg-red-600 text-white',     darkColor: 'bg-red-700 text-white' },
  2:  { label: 'CRITICAL',  color: 'bg-orange-500 text-white',  darkColor: 'bg-orange-600 text-white' },
  3:  { label: 'URGENT',    color: 'bg-yellow-500 text-white',  darkColor: 'bg-yellow-600 text-white' },
  4:  { label: 'HIGH',      color: 'bg-amber-400 text-gray-900',darkColor: 'bg-amber-500 text-white' },
  5:  { label: 'NORMAL',    color: '',                          darkColor: '' },
  10: { label: 'NORMAL',    color: '',                          darkColor: '' },
};

// Condition flag icons
const FLAG_ICONS: Record<string, React.ReactNode> = {
  emergency:    <Zap className="w-3 h-3" />,
  appears_unwell: <AlertTriangle className="w-3 h-3" />,
  elderly:      <Users className="w-3 h-3" />,
  pregnant:     <Heart className="w-3 h-3" />,
  child:        <Baby className="w-3 h-3" />,
  wheelchair:   <Accessibility className="w-3 h-3" />,
};

const REFRESH_INTERVAL = 10000;

export default function QueueMonitorPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [darkMode, setDarkMode] = useState(true); // default dark for TV display
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [calledTokenIds, setCalledTokenIds] = useState<Set<string>>(new Set());
  const [flashingId, setFlashingId] = useState<string | null>(null);
  const [recentlyCompleted, setRecentlyCompleted] = useState<QueueEntry[]>([]);
  const [userInteracted, setUserInteracted] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-scroll waiting list
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let dir = 1;
    const id = setInterval(() => {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop += dir;
        if (el.scrollTop >= el.scrollHeight - el.clientHeight) dir = -1;
        else if (el.scrollTop <= 0) dir = 1;
      }
    }, 40);
    return () => clearInterval(id);
  }, []);

  // Marquee scroll
  useEffect(() => {
    const el = marqueeRef.current;
    if (!el) return;
    let pos = 0;
    const id = setInterval(() => {
      pos -= 1;
      if (Math.abs(pos) > el.scrollWidth / 2) pos = 0;
      el.style.transform = `translateX(${pos}px)`;
    }, 30);
    return () => clearInterval(id);
  }, [recentlyCompleted]);

  // Fetch all queue entries (active + recent)
  const { data: queue = [], isLoading: isLoadingQueue, error: queueError, dataUpdatedAt } = useQuery({
    queryKey: ['queue', 'monitor', selectedDepartment],
    queryFn: () => queueService.getQueue(selectedDepartment ? { servicePoint: selectedDepartment } : undefined),
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: stats, isLoading: isLoadingStats, error: statsError } = useQuery({
    queryKey: ['queue', 'stats', 'monitor'],
    queryFn: () => queueService.getStats(),
    refetchInterval: REFRESH_INTERVAL,
  });

  const { data: facilityInfo } = useQuery({
    queryKey: ['facility', 'public-info'],
    queryFn: () => facilitiesService.getPublicInfo(),
    staleTime: 5 * 60 * 1000, // rarely changes
  });

  const facilityName = facilityInfo?.name || 'Hospital';

  // Track recently completed patients
  useEffect(() => {
    const completed = queue.filter(q => q.status === 'completed');
    if (completed.length > 0) {
      setRecentlyCompleted(prev => {
        const existingIds = new Set(prev.map(p => p.id));
        const newOnes = completed.filter(c => !existingIds.has(c.id));
        return [...newOnes, ...prev].slice(0, 15);
      });
    }
  }, [queue]);

  // Seconds since update
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      setSecondsSinceUpdate(dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : 0);
    }, 1000);
    return () => clearInterval(t);
  }, [dataUpdatedAt]);

  // Privacy name
  const formatName = (fullName?: string): string => {
    if (!fullName) return 'Patient';
    const parts = fullName.trim().split(' ');
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
  };

  // Notification sound — AudioContext must be created after a user gesture
  const playSound = useCallback(() => {
    if (!audioEnabled || !userInteracted) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.12);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.24);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch { /* ignore */ }
  }, [audioEnabled, userInteracted]);

  // TTS
  const speak = useCallback((token: string, location: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(`Token ${token}. Please proceed to ${location}`);
    u.rate = 0.85; u.pitch = 1; u.volume = 1;
    speechSynthesis.speak(u);
  }, [ttsEnabled]);

  // Active (called/in_service) patients — all of them
  const activePatients = queue.filter(q => q.status === 'called' || q.status === 'in_service');

  // Detect new calls
  useEffect(() => {
    activePatients.forEach(p => {
      const id = p.id;
      if (!calledTokenIds.has(id)) {
        setCalledTokenIds(prev => new Set([...prev, id]));
        setFlashingId(id);
        playSound();
        const loc = p.roomNumber || p.counterNumber ||
          SERVICE_POINT_LABELS[p.servicePoint] || p.servicePoint.replace(/_/g, ' ');
        speak(p.ticketNumber || p.tokenNumber || '', loc);
        setTimeout(() => setFlashingId(null), 3000);
      }
    });
  }, [activePatients.map(p => p.id).join(',')]);

  // Full screen
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) { containerRef.current?.requestFullscreen(); setIsFullScreen(true); }
    else { document.exitFullscreen(); setIsFullScreen(false); }
  };
  useEffect(() => {
    const h = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  const isLoading = isLoadingQueue || isLoadingStats;
  const error = queueError || statsError;

  // Derived queue data
  const filteredQueue = selectedDepartment ? queue.filter(q => q.servicePoint === selectedDepartment) : queue;
  // Only pure-waiting for the waiting list display
  const waitingQueue = filteredQueue.filter(q => q.status === 'waiting').slice(0, 12);
  // Overdue: any patient actively waiting or called but not yet served for >30 min
  const overdueCount = queue.filter(q =>
    (q.status === 'waiting' || q.status === 'called') &&
    Math.floor((Date.now() - new Date(q.createdAt).getTime()) / 60000) > 30
  ).length;

  // Accurate front-end stat counts derived from loaded queue data
  const waitingCount = queue.filter(q => q.status === 'waiting').length;
  const servingCount = queue.filter(q => q.status === 'called' || q.status === 'in_service').length;
  const doneCount = stats?.completed ?? queue.filter(q => q.status === 'completed').length;

  // Department counts — include all active (waiting + called + in_service)
  const ACTIVE_STATUSES = new Set(['waiting', 'called', 'in_service']);
  const deptCounts = DEPARTMENTS.reduce((acc, d) => {
    acc[d.value] = d.value === ''
      ? queue.filter(q => ACTIVE_STATUSES.has(q.status)).length
      : queue.filter(q => q.servicePoint === d.value && ACTIVE_STATUSES.has(q.status)).length;
    return acc;
  }, {} as Record<string, number>);

  // Queue health
  const getQueueHealth = () => {
    const waiting = stats?.waiting ?? 0;
    const overduePct = waiting > 0 ? overdueCount / waiting : 0;
    if (waiting >= 20 || overduePct > 0.5) return { label: 'HIGH LOAD', color: 'text-red-400', dot: 'bg-red-500' };
    if (waiting >= 10 || overduePct > 0.25) return { label: 'BUSY',      color: 'text-yellow-400', dot: 'bg-yellow-500' };
    return { label: 'NORMAL', color: 'text-green-400', dot: 'bg-green-500' };
  };
  const health = getQueueHealth();

  // Wait time helpers
  const getWaitMins = (createdAt: string) =>
    Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);

  const formatWait = (mins: number) => {
    if (mins < 1) return '< 1 min';
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins} min`;
  };

  const waitRowClass = (mins: number) => {
    if (mins > 60) return darkMode ? 'border-l-4 border-red-500 bg-red-900/20' : 'border-l-4 border-red-400 bg-red-50';
    if (mins > 30) return darkMode ? 'border-l-4 border-yellow-500 bg-yellow-900/20' : 'border-l-4 border-yellow-400 bg-yellow-50';
    return '';
  };

  // Theme
  const bg    = darkMode ? 'bg-gray-950'       : 'bg-gradient-to-br from-slate-100 to-blue-50';
  const card  = darkMode ? 'bg-gray-900 border-gray-800'  : 'bg-white border-gray-200';
  const card2 = darkMode ? 'bg-gray-800 border-gray-700'  : 'bg-gray-50 border-gray-200';
  const tx    = darkMode ? 'text-white'         : 'text-gray-900';
  const muted = darkMode ? 'text-gray-400'      : 'text-gray-500';

  return (
    <div ref={containerRef} className={`min-h-screen ${bg} ${tx} transition-colors duration-300 font-sans`}
      onClick={() => { if (!userInteracted) setUserInteracted(true); }}>
      <div className="p-3 h-screen flex flex-col gap-3 max-w-full mx-auto">

        {/* ── HEADER ── */}
        <header className={`${card} rounded-2xl border px-5 py-3 flex items-center justify-between shadow-lg`}>
          {/* Left */}
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${darkMode ? 'bg-blue-900/60' : 'bg-blue-100'}`}>
              <Building2 className={`w-8 h-8 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">{facilityName}</h1>
              <p className={`text-sm ${muted} flex items-center gap-1`}>
                <Calendar className="w-3.5 h-3.5" />
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Center */}
          <div className="text-center">
            <div className="flex items-center gap-2 justify-center">
              <Monitor className={`w-6 h-6 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
              <span className={`text-3xl font-bold tracking-widest ${darkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
                OPD QUEUE
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 mt-1">
              <span className={`text-xs ${muted}`}>Updated {secondsSinceUpdate}s ago</span>
              <span className="flex items-center gap-1 text-xs font-semibold">
                <span className={`w-2 h-2 rounded-full ${health.dot} animate-pulse`} />
                <span className={health.color}>{health.label}</span>
              </span>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-4">
            <div className={`text-4xl font-mono font-bold ${darkMode ? 'text-blue-300' : 'text-blue-700'} tabular-nums`}>
              {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="flex flex-col gap-1.5">
              {/* Sound */}
              <button onClick={() => setAudioEnabled(!audioEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  audioEnabled ? (darkMode ? 'bg-green-900/60 text-green-300' : 'bg-green-100 text-green-700')
                              : (darkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400')}`}>
                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                Sound {audioEnabled ? 'ON' : 'OFF'}
              </button>
              {/* Voice */}
              <button onClick={() => setTtsEnabled(!ttsEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  ttsEnabled ? (darkMode ? 'bg-purple-900/60 text-purple-300' : 'bg-purple-100 text-purple-700')
                             : (darkMode ? 'bg-gray-800 text-gray-500' : 'bg-gray-100 text-gray-400')}`}>
                <Megaphone className="w-4 h-4" />
                Voice {ttsEnabled ? 'ON' : 'OFF'}
              </button>
              {/* Display controls */}
              <div className="flex gap-1.5">
                <button onClick={() => setDarkMode(!darkMode)}
                  className={`p-1.5 rounded-lg ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button onClick={toggleFullScreen}
                  className={`p-1.5 rounded-lg ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  {isFullScreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                </button>
                <div className={`p-1.5 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} flex items-center`}>
                  <RefreshCw className={`w-4 h-4 ${muted} ${secondsSinceUpdate < 3 ? 'animate-spin' : ''}`} />
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── ERROR ── */}
        {error && (
          <div className="rounded-xl p-3 bg-red-900/40 border border-red-600 flex items-center gap-2 text-red-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Failed to load queue data. Retrying automatically...</span>
          </div>
        )}

        {/* ── LOADING ── */}
        {isLoading && !queue.length && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-12 h-12 animate-spin text-blue-400" />
            <span className="ml-4 text-2xl">Loading...</span>
          </div>
        )}

        {(!isLoading || queue.length > 0) && !error && (
          <div className="flex-1 flex flex-col gap-3 min-h-0">

            {/* ── NOW SERVING (all active counters) ── */}
            <div className={`${card} rounded-2xl border shadow-lg`}>
              <div className={`flex items-center gap-2 px-5 py-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
                <Activity className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                <h2 className={`text-lg font-bold tracking-widest ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                  NOW SERVING
                </h2>
                <span className={`ml-2 text-sm ${muted}`}>
                  {activePatients.length === 0 ? 'No active patients' : `${activePatients.length} counter${activePatients.length !== 1 ? 's' : ''} active`}
                </span>
              </div>

              {activePatients.length === 0 ? (
                <div className={`flex items-center justify-center py-8 ${muted}`}>
                  <Users className="w-12 h-12 mr-4 opacity-20" />
                  <span className="text-xl">Queue is idle — no patients currently being served</span>
                </div>
              ) : (
                <div className="flex gap-4 p-4 flex-wrap">
                  {activePatients.map(p => {
                    const isFlashing = flashingId === p.id;
                    const location = p.roomNumber || p.counterNumber ||
                      SERVICE_POINT_LABELS[p.servicePoint] || p.servicePoint.replace(/_/g, ' ').toUpperCase();
                    const isNew = p.status === 'called';
                    return (
                      <div key={p.id}
                        className={`flex-1 min-w-[220px] max-w-xs rounded-2xl border-2 p-4 transition-all duration-300 ${
                          isFlashing
                            ? 'border-yellow-400 bg-yellow-400/20 scale-105 shadow-yellow-400/30 shadow-xl'
                            : isNew
                              ? (darkMode ? 'border-green-500 bg-green-900/30' : 'border-green-400 bg-green-50')
                              : (darkMode ? 'border-blue-700 bg-blue-900/20' : 'border-blue-200 bg-blue-50')
                        }`}>
                        {/* Token */}
                        <div className="flex items-start justify-between mb-2">
                          <div className={`relative px-4 py-2 rounded-xl ${isNew
                              ? (darkMode ? 'bg-green-600' : 'bg-green-500')
                              : (darkMode ? 'bg-blue-700' : 'bg-blue-500')}`}>
                            {isFlashing && <div className="absolute inset-0 rounded-xl bg-white animate-ping opacity-25" />}
                            <span className="relative text-4xl font-mono font-extrabold text-white tracking-tight">
                              {p.ticketNumber || p.tokenNumber}
                            </span>
                          </div>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${isNew
                              ? (darkMode ? 'bg-green-800 text-green-300' : 'bg-green-100 text-green-700')
                              : (darkMode ? 'bg-blue-800 text-blue-300' : 'bg-blue-100 text-blue-700')}`}>
                            {isNew ? '📢 CALLED' : '⚕️ IN SERVICE'}
                          </span>
                        </div>
                        {/* Patient */}
                        <p className={`text-xl font-semibold ${tx} truncate`}>{formatName(p.patient?.fullName)}</p>
                        {/* Condition flags */}
                        {p.patientConditionFlags && p.patientConditionFlags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.patientConditionFlags.map(f => (
                              <span key={f} className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium
                                ${darkMode ? 'bg-orange-900/60 text-orange-300' : 'bg-orange-100 text-orange-700'}`}>
                                {FLAG_ICONS[f]} {f.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Go to */}
                        <div className={`mt-3 pt-2 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                          <p className={`text-xs ${muted}`}>Please proceed to</p>
                          <p className={`text-lg font-bold uppercase tracking-wide ${darkMode ? 'text-blue-300' : 'text-blue-700'}`}>
                            {location}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── STATS + DEPARTMENT FILTER ── */}
            <div className="flex gap-3">
              {/* Stats */}
              <div className="flex gap-3">
                {[
                  { icon: <Clock className="w-6 h-6" />, value: waitingCount, label: 'Waiting', color: darkMode ? 'text-yellow-400' : 'text-yellow-600', bg: darkMode ? 'bg-yellow-900/40' : 'bg-yellow-50', border: darkMode ? 'border-yellow-800' : 'border-yellow-200' },
                  { icon: <Activity className="w-6 h-6" />, value: servingCount, label: 'Serving', color: darkMode ? 'text-green-400' : 'text-green-600', bg: darkMode ? 'bg-green-900/40' : 'bg-green-50', border: darkMode ? 'border-green-800' : 'border-green-200' },
                  { icon: <CheckCircle className="w-6 h-6" />, value: doneCount, label: 'Done Today', color: darkMode ? 'text-blue-400' : 'text-blue-600', bg: darkMode ? 'bg-blue-900/40' : 'bg-blue-50', border: darkMode ? 'border-blue-800' : 'border-blue-200' },
                  { icon: <Timer className="w-6 h-6" />, value: stats?.averageWaitMinutes ?? 0, label: 'Avg Wait (min)', color: darkMode ? 'text-purple-400' : 'text-purple-600', bg: darkMode ? 'bg-purple-900/40' : 'bg-purple-50', border: darkMode ? 'border-purple-800' : 'border-purple-200' },
                  { icon: <AlertTriangle className="w-6 h-6" />, value: overdueCount, label: 'Overdue >30m', color: overdueCount > 0 ? 'text-red-400' : (darkMode ? 'text-gray-500' : 'text-gray-400'), bg: overdueCount > 0 ? (darkMode ? 'bg-red-900/40' : 'bg-red-50') : (darkMode ? 'bg-gray-800' : 'bg-gray-50'), border: overdueCount > 0 ? (darkMode ? 'border-red-800' : 'border-red-200') : (darkMode ? 'border-gray-700' : 'border-gray-200') },
                ].map((s, i) => (
                  <div key={i} className={`${s.bg} border ${s.border} rounded-xl px-4 py-2.5 flex items-center gap-3 min-w-[110px]`}>
                    <span className={s.color}>{s.icon}</span>
                    <div>
                      <p className={`text-3xl font-extrabold ${s.color} leading-none`}>{s.value}</p>
                      <p className={`text-xs ${muted} mt-0.5 whitespace-nowrap`}>{s.label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Department filter */}
              <div className={`${card2} border rounded-xl p-1.5 flex gap-1.5 flex-wrap flex-1`}>
                {DEPARTMENTS.map(d => {
                  const active = selectedDepartment === d.value;
                  return (
                    <button key={d.value} onClick={() => setSelectedDepartment(d.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                        active
                          ? (darkMode ? 'bg-blue-600 text-white shadow-md' : 'bg-blue-500 text-white shadow-md')
                          : (darkMode ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200')
                      }`}>
                      {d.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                        active ? 'bg-white/20' : (darkMode ? 'bg-gray-700' : 'bg-gray-200')}`}>
                        {deptCounts[d.value] ?? 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── WAITING QUEUE TABLE ── */}
            <div className={`${card} rounded-2xl border flex-1 min-h-0 flex flex-col shadow-lg overflow-hidden`}>
              {/* Header */}
              <div className={`grid grid-cols-12 gap-2 px-5 py-2.5 text-xs font-bold uppercase tracking-widest ${muted} ${darkMode ? 'bg-gray-800/80 border-gray-800' : 'bg-gray-100 border-gray-200'} border-b`}>
                <div className="col-span-1">#</div>
                <div className="col-span-2">Token</div>
                <div className="col-span-3">Patient</div>
                <div className="col-span-2">Service Point</div>
                <div className="col-span-2">Waiting</div>
                <div className="col-span-2">Priority / Flags</div>
              </div>

              {/* Rows */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto divide-y divide-gray-800/50">
                {waitingQueue.length === 0 ? (
                  <div className={`flex flex-col items-center justify-center h-full ${muted} py-12`}>
                    <Stethoscope className="w-14 h-14 mb-3 opacity-20" />
                    <p className="text-xl font-medium">No patients waiting</p>
                    <p className="text-sm mt-1 opacity-60">Queue is clear</p>
                  </div>
                ) : waitingQueue.map((item, idx) => {
                  const mins = getWaitMins(item.createdAt);
                  const rowExtra = waitRowClass(mins);
                  const isNext = idx === 0;
                  const prio = PRIORITY_CONFIG[item.priority] ?? PRIORITY_CONFIG[5];
                  const flags = item.patientConditionFlags ?? [];

                  return (
                    <div key={item.id}
                      className={`grid grid-cols-12 gap-2 px-5 py-3 items-center transition-all ${rowExtra} ${
                        isNext ? (darkMode ? 'bg-blue-900/25' : 'bg-blue-50') : ''
                      }`}>
                      {/* Position */}
                      <div className="col-span-1">
                        <span className={`text-lg font-extrabold ${isNext ? (darkMode ? 'text-blue-400' : 'text-blue-600') : muted}`}>
                          {isNext
                            ? <ChevronRight className="w-5 h-5 animate-pulse inline" />
                            : `${idx + 1}`}
                        </span>
                      </div>
                      {/* Token */}
                      <div className="col-span-2">
                        <span className={`text-2xl font-mono font-extrabold ${
                          isNext ? (darkMode ? 'text-blue-300' : 'text-blue-600') : (darkMode ? 'text-gray-200' : 'text-gray-700')
                        }`}>
                          {item.ticketNumber || item.tokenNumber}
                        </span>
                      </div>
                      {/* Patient name + chief complaint */}
                      <div className="col-span-3">
                        <p className={`font-semibold ${tx}`}>{formatName(item.patient?.fullName)}</p>
                        {item.chiefComplaintAtToken && (
                          <p className={`text-xs mt-0.5 truncate ${muted}`} title={item.chiefComplaintAtToken}>
                            {item.chiefComplaintAtToken}
                          </p>
                        )}
                      </div>
                      {/* Service point */}
                      <div className="col-span-2">
                        <span className={`text-sm font-medium capitalize ${muted}`}>
                          {SERVICE_POINT_LABELS[item.servicePoint] || item.servicePoint.replace(/_/g, ' ')}
                        </span>
                        {item.previousServicePoint && (
                          <p className={`text-xs mt-0.5 ${darkMode ? 'text-cyan-400' : 'text-cyan-600'}`}>
                            ← from {SERVICE_POINT_LABELS[item.previousServicePoint] || item.previousServicePoint.replace(/_/g, ' ')}
                          </p>
                        )}
                      </div>
                      {/* Wait time */}
                      <div className="col-span-2">
                        <span className={`text-base font-bold ${
                          mins > 60 ? 'text-red-400' : mins > 30 ? 'text-yellow-400' : (darkMode ? 'text-gray-300' : 'text-gray-600')
                        }`}>
                          {formatWait(mins)}
                        </span>
                        {mins > 30 && (
                          <AlertCircle className={`inline ml-1.5 w-4 h-4 ${mins > 60 ? 'text-red-400' : 'text-yellow-400'}`} />
                        )}
                      </div>
                      {/* Priority + flags */}
                      <div className="col-span-2 flex flex-wrap gap-1 items-center">
                        {prio.label !== 'NORMAL' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${prio.color}`}>
                            {prio.label}
                          </span>
                        )}
                        {flags.slice(0, 2).map(f => (
                          <span key={f} className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full
                            ${darkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-100 text-gray-600'}`}>
                            {FLAG_ICONS[f]}
                          </span>
                        ))}
                        {item.onHold && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-500'}`}>
                            ON HOLD
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer legend */}
              <div className={`px-5 py-2 border-t ${darkMode ? 'border-gray-800' : 'border-gray-200'} flex items-center gap-6 text-xs ${muted}`}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${darkMode ? 'bg-yellow-900/60 border border-yellow-600' : 'bg-yellow-100 border border-yellow-400'}`} />
                  <span>Waiting &gt; 30 mins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className={`w-3 h-3 rounded ${darkMode ? 'bg-red-900/60 border border-red-600' : 'bg-red-100 border border-red-400'}`} />
                  <span>Waiting &gt; 60 mins</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TrendingUp className="w-3 h-3" />
                  <span>Showing {Math.min(waitingQueue.length, 12)} of {stats?.waiting ?? waitingQueue.length} waiting</span>
                </div>
              </div>
            </div>

            {/* ── RECENTLY COMPLETED MARQUEE ── */}
            <div className={`${darkMode ? 'bg-gray-900 border-gray-800' : 'bg-slate-800 border-slate-700'} border rounded-xl px-4 py-2 overflow-hidden flex items-center gap-3`}>
              <span className="text-green-400 font-bold text-xs tracking-widest whitespace-nowrap flex-shrink-0 flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5" /> COMPLETED
              </span>
              <div className="overflow-hidden flex-1 relative">
                <div ref={marqueeRef} className="flex gap-8 whitespace-nowrap will-change-transform">
                  {recentlyCompleted.length === 0
                    ? <span className="text-gray-500 text-sm">No completions yet today</span>
                    : [...recentlyCompleted, ...recentlyCompleted].map((p, i) => (
                        <span key={`${p.id}-${i}`} className="text-sm text-green-300 font-medium">
                          ✓ {p.ticketNumber || p.tokenNumber} &nbsp;·&nbsp; {formatName(p.patient?.fullName)} &nbsp;·&nbsp; {SERVICE_POINT_LABELS[p.servicePoint] || p.servicePoint}
                        </span>
                      ))
                  }
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
