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
} from 'lucide-react';
import { queueService, type QueueEntry } from '../services/queue';

// Department configuration
const DEPARTMENTS = [
  { value: '', label: 'All Departments', color: 'blue' },
  { value: 'general_opd', label: 'General OPD', color: 'emerald' },
  { value: 'consultation', label: 'Specialist', color: 'purple' },
  { value: 'triage', label: 'Emergency', color: 'red' },
  { value: 'registration', label: 'Registration', color: 'amber' },
  { value: 'laboratory', label: 'Laboratory', color: 'cyan' },
  { value: 'pharmacy', label: 'Pharmacy', color: 'green' },
  { value: 'radiology', label: 'Radiology', color: 'indigo' },
  { value: 'billing', label: 'Billing', color: 'orange' },
];

// Facility name - could come from config/context in production
const FACILITY_NAME = 'City General Hospital';
const REFRESH_INTERVAL = 10000; // 10 seconds

export default function QueueMonitorPage() {
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastCalledToken, setLastCalledToken] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-update clock every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-scroll effect for waiting queue
  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    let scrollDirection = 1;
    const scrollSpeed = 1;
    const scrollInterval = setInterval(() => {
      if (scrollContainer.scrollHeight > scrollContainer.clientHeight) {
        scrollContainer.scrollTop += scrollDirection * scrollSpeed;
        
        if (scrollContainer.scrollTop >= scrollContainer.scrollHeight - scrollContainer.clientHeight) {
          scrollDirection = -1;
        } else if (scrollContainer.scrollTop <= 0) {
          scrollDirection = 1;
        }
      }
    }, 50);

    return () => clearInterval(scrollInterval);
  }, []);

  // Fetch queue entries
  const { 
    data: queue = [], 
    isLoading: isLoadingQueue, 
    error: queueError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['queue', 'monitor', selectedDepartment],
    queryFn: () => queueService.getQueue(selectedDepartment ? { servicePoint: selectedDepartment } : undefined),
    refetchInterval: REFRESH_INTERVAL,
  });

  // Fetch queue stats
  const { 
    data: stats, 
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery({
    queryKey: ['queue', 'stats', 'monitor'],
    queryFn: () => queueService.getStats(),
    refetchInterval: REFRESH_INTERVAL,
  });

  // Get seconds since last update
  const getSecondsSinceUpdate = () => {
    if (!dataUpdatedAt) return 0;
    return Math.floor((Date.now() - dataUpdatedAt) / 1000);
  };

  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceUpdate(getSecondsSinceUpdate());
    }, 1000);
    return () => clearInterval(timer);
  }, [dataUpdatedAt]);

  // Format name for privacy (e.g., "John Doe" -> "John D.")
  const formatPrivateName = (fullName: string | undefined): string => {
    if (!fullName) return 'Patient';
    const parts = fullName.trim().split(' ');
    if (parts.length === 1) return parts[0];
    const firstName = parts[0];
    const lastInitial = parts[parts.length - 1][0];
    return `${firstName} ${lastInitial}.`;
  };

  // Play notification sound
  const playNotificationSound = useCallback(() => {
    if (!audioEnabled) return;
    
    // Create audio context for notification bell sound
    try {
      const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.2);
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch {
      console.warn('Audio notification not supported');
    }
  }, [audioEnabled]);

  // Text-to-speech announcement
  const speakAnnouncement = useCallback((token: string, room: string) => {
    if (!ttsEnabled || !('speechSynthesis' in window)) return;
    
    const utterance = new SpeechSynthesisUtterance(
      `Token number ${token}, please proceed to ${room}`
    );
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  // Detect new called patient and trigger announcements
  const nowServing = queue.find(q => q.status === 'in_service' || q.status === 'called');
  
  useEffect(() => {
    if (nowServing) {
      const token = nowServing.ticketNumber || nowServing.tokenNumber || '';
      if (token && token !== lastCalledToken) {
        setLastCalledToken(token);
        playNotificationSound();
        // Use room number if available, otherwise fall back to service point or Room 1
        const room = nowServing.roomNumber || nowServing.counterNumber || nowServing.servicePoint?.replace(/_/g, ' ') || 'Room 1';
        speakAnnouncement(token, room);
      }
    }
  }, [nowServing, lastCalledToken, playNotificationSound, speakAnnouncement]);

  // Full screen toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullScreen(true);
    } else {
      document.exitFullscreen();
      setIsFullScreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullScreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullScreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullScreenChange);
  }, []);

  const isLoading = isLoadingQueue || isLoadingStats;
  const error = queueError || statsError;

  // Filter and categorize queue
  const filteredQueue = selectedDepartment
    ? queue.filter(q => q.servicePoint === selectedDepartment)
    : queue;

  const waitingQueue = filteredQueue
    .filter(q => q.status === 'waiting')
    .slice(0, 10); // Show next 10

  // Calculate department counts
  const departmentCounts = DEPARTMENTS.reduce((acc, dept) => {
    if (dept.value === '') {
      acc[dept.value] = queue.filter(q => q.status === 'waiting').length;
    } else {
      acc[dept.value] = queue.filter(q => q.servicePoint === dept.value && q.status === 'waiting').length;
    }
    return acc;
  }, {} as Record<string, number>);

  // Calculate wait time and get highlight class
  const getWaitTimeHighlight = (createdAt: string): string => {
    const waitMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (waitMinutes > 60) return darkMode ? 'bg-red-900/50 border-red-500' : 'bg-red-100 border-red-300';
    if (waitMinutes > 30) return darkMode ? 'bg-yellow-900/50 border-yellow-500' : 'bg-yellow-100 border-yellow-300';
    return '';
  };

  const getWaitTimeDisplay = (createdAt: string): { time: string; minutes: number } => {
    const waitMinutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    if (waitMinutes < 1) return { time: '< 1 min', minutes: 0 };
    if (waitMinutes >= 60) {
      const hours = Math.floor(waitMinutes / 60);
      const mins = waitMinutes % 60;
      return { time: `${hours}h ${mins}m`, minutes: waitMinutes };
    }
    return { time: `${waitMinutes} min`, minutes: waitMinutes };
  };

  // Theme classes
  const bgClass = darkMode ? 'bg-gray-900' : 'bg-gradient-to-br from-blue-50 to-indigo-100';
  const cardBgClass = darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textClass = darkMode ? 'text-white' : 'text-gray-900';
  const mutedTextClass = darkMode ? 'text-gray-400' : 'text-gray-600';

  return (
    <div 
      ref={containerRef}
      className={`min-h-screen ${bgClass} ${textClass} transition-colors duration-300 ${isFullScreen ? 'p-6' : ''}`}
    >
      <div className={`${isFullScreen ? '' : 'p-4'} max-w-full mx-auto h-screen flex flex-col`}>
        
        {/* Large Display Header */}
        <header className={`${cardBgClass} rounded-2xl shadow-lg p-6 mb-4 border`}>
          <div className="flex items-center justify-between">
            {/* Left: Facility Info */}
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                <Building2 className={`w-10 h-10 ${darkMode ? 'text-blue-300' : 'text-blue-600'}`} />
              </div>
              <div>
                <h1 className={`text-3xl font-bold ${textClass}`}>{FACILITY_NAME}</h1>
                <div className="flex items-center gap-4 mt-1">
                  <span className={`flex items-center gap-2 ${mutedTextClass}`}>
                    <Calendar className="w-4 h-4" />
                    {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Center: Title */}
            <div className="text-center">
              <div className="flex items-center gap-3 justify-center">
                <Monitor className={`w-8 h-8 ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`} />
                <h2 className={`text-4xl font-bold tracking-wide ${darkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  OPD Queue
                </h2>
              </div>
              <p className={`text-sm mt-1 ${mutedTextClass}`}>
                Last updated: {secondsSinceUpdate} seconds ago
              </p>
            </div>

            {/* Right: Time & Controls */}
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className={`text-5xl font-mono font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                  {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                  title={darkMode ? 'Light Mode' : 'Dark Mode'}
                >
                  {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
                <button
                  onClick={toggleFullScreen}
                  className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}
                  title={isFullScreen ? 'Exit Full Screen' : 'Full Screen'}
                >
                  {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
          
          {/* Audio Controls */}
          <div className="flex items-center justify-end gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setAudioEnabled(!audioEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                audioEnabled 
                  ? darkMode ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-700'
                  : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              Sound {audioEnabled ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                ttsEnabled 
                  ? darkMode ? 'bg-purple-900 text-purple-300' : 'bg-purple-100 text-purple-700'
                  : darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
              }`}
            >
              <Megaphone className="w-5 h-5" />
              Voice {ttsEnabled ? 'ON' : 'OFF'}
            </button>
            <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className={mutedTextClass}>Auto-refresh: 10s</span>
            </div>
          </div>
        </header>

        {/* Error State */}
        {error && (
          <div className={`${cardBgClass} rounded-xl p-4 mb-4 border-red-300 bg-red-50 dark:bg-red-900/30`}>
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="w-6 h-6" />
              <span className="text-lg">Failed to load queue data. Retrying...</span>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !queue.length && (
          <div className="flex-1 flex items-center justify-center">
            <div className="flex items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-blue-500" />
              <span className="text-2xl">Loading queue data...</span>
            </div>
          </div>
        )}

        {(!isLoading || queue.length > 0) && !error && (
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            
            {/* Now Serving Section - Prominent */}
            <div className={`${cardBgClass} rounded-2xl shadow-lg border-2 ${
              nowServing 
                ? darkMode ? 'border-green-500 bg-gradient-to-r from-green-900/50 to-emerald-900/50' : 'border-green-400 bg-gradient-to-r from-green-50 to-emerald-50'
                : ''
            }`}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Activity className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                  <h3 className={`text-2xl font-bold ${darkMode ? 'text-green-400' : 'text-green-700'}`}>
                    NOW SERVING
                  </h3>
                </div>
                
                {nowServing ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                      {/* Token Number - Large with pulse animation */}
                      <div className={`relative px-8 py-4 rounded-2xl ${darkMode ? 'bg-green-600' : 'bg-green-500'}`}>
                        <div className="absolute inset-0 rounded-2xl bg-green-400 animate-ping opacity-20"></div>
                        <span className="relative text-7xl font-mono font-bold text-white">
                          {nowServing.ticketNumber || nowServing.tokenNumber}
                        </span>
                      </div>
                      
                      {/* Patient Info */}
                      <div>
                        <p className={`text-3xl font-semibold ${textClass}`}>
                          {formatPrivateName(nowServing.patient?.fullName)}
                        </p>
                        <p className={`text-xl mt-2 ${mutedTextClass}`}>
                          Please proceed to
                        </p>
                      </div>
                    </div>
                    
                    {/* Room/Counter */}
                    <div className="text-right">
                      <div className={`inline-block px-6 py-3 rounded-xl ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                        <p className={`text-lg font-medium ${darkMode ? 'text-blue-300' : 'text-blue-600'}`}>
                          Room / Counter
                        </p>
                        <p className={`text-4xl font-bold ${darkMode ? 'text-blue-200' : 'text-blue-700'}`}>
                          {nowServing.roomNumber || nowServing.counterNumber || nowServing.servicePoint?.replace(/_/g, ' ').toUpperCase() || 'ROOM 1'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={`text-center py-8 ${mutedTextClass}`}>
                    <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                    <p className="text-2xl">No patient currently being served</p>
                  </div>
                )}
              </div>
            </div>

            {/* Queue Statistics Bar */}
            <div className="grid grid-cols-4 gap-4">
              <div className={`${cardBgClass} rounded-xl p-4 border`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${darkMode ? 'bg-yellow-900' : 'bg-yellow-100'}`}>
                    <Clock className={`w-8 h-8 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                  </div>
                  <div>
                    <p className={`text-4xl font-bold ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`}>
                      {stats?.waiting ?? waitingQueue.length}
                    </p>
                    <p className={`text-sm font-medium ${mutedTextClass}`}>Waiting</p>
                  </div>
                </div>
              </div>
              
              <div className={`${cardBgClass} rounded-xl p-4 border`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${darkMode ? 'bg-green-900' : 'bg-green-100'}`}>
                    <Activity className={`w-8 h-8 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                  </div>
                  <div>
                    <p className={`text-4xl font-bold ${darkMode ? 'text-green-400' : 'text-green-600'}`}>
                      {stats?.inService ?? 0}
                    </p>
                    <p className={`text-sm font-medium ${mutedTextClass}`}>Being Served</p>
                  </div>
                </div>
              </div>
              
              <div className={`${cardBgClass} rounded-xl p-4 border`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
                    <CheckCircle className={`w-8 h-8 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
                  </div>
                  <div>
                    <p className={`text-4xl font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                      {stats?.completed ?? 0}
                    </p>
                    <p className={`text-sm font-medium ${mutedTextClass}`}>Completed Today</p>
                  </div>
                </div>
              </div>
              
              <div className={`${cardBgClass} rounded-xl p-4 border`}>
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${darkMode ? 'bg-purple-900' : 'bg-purple-100'}`}>
                    <Timer className={`w-8 h-8 ${darkMode ? 'text-purple-400' : 'text-purple-600'}`} />
                  </div>
                  <div>
                    <p className={`text-4xl font-bold ${darkMode ? 'text-purple-400' : 'text-purple-600'}`}>
                      {stats?.averageWaitMinutes ?? 0}
                    </p>
                    <p className={`text-sm font-medium ${mutedTextClass}`}>Avg Wait (mins)</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Tabs */}
            <div className={`${cardBgClass} rounded-xl p-2 border flex gap-2 overflow-x-auto`}>
              {DEPARTMENTS.map((dept) => (
                <button
                  key={dept.value}
                  onClick={() => setSelectedDepartment(dept.value)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-medium whitespace-nowrap transition-all ${
                    selectedDepartment === dept.value
                      ? darkMode 
                        ? `bg-${dept.color}-900 text-${dept.color}-300 ring-2 ring-${dept.color}-500`
                        : `bg-${dept.color}-500 text-white shadow-lg`
                      : darkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {dept.label}
                  <span className={`px-2 py-0.5 rounded-full text-sm ${
                    selectedDepartment === dept.value
                      ? 'bg-white/20'
                      : darkMode ? 'bg-gray-600' : 'bg-gray-300'
                  }`}>
                    {departmentCounts[dept.value] ?? 0}
                  </span>
                </button>
              ))}
            </div>

            {/* Waiting Queue List */}
            <div className={`${cardBgClass} rounded-2xl shadow-lg border flex-1 min-h-0 flex flex-col`}>
              <div className={`p-4 border-b ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'} rounded-t-2xl`}>
                <div className="flex items-center justify-between">
                  <h3 className={`text-xl font-bold ${textClass}`}>Waiting Queue</h3>
                  <span className={`text-sm ${mutedTextClass}`}>Next 10 patients</span>
                </div>
              </div>
              
              {/* Column Headers */}
              <div className={`grid grid-cols-5 gap-4 px-6 py-3 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'} font-semibold text-sm ${mutedTextClass}`}>
                <div>Token #</div>
                <div>Patient Name</div>
                <div>Department</div>
                <div>Wait Time</div>
                <div>Status</div>
              </div>
              
              {/* Queue Items with Auto-scroll */}
              <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto"
              >
                {waitingQueue.length === 0 ? (
                  <div className={`flex items-center justify-center h-full ${mutedTextClass}`}>
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <p className="text-xl">No patients waiting</p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {waitingQueue.map((item, index) => {
                      const waitInfo = getWaitTimeDisplay(item.createdAt);
                      const highlightClass = getWaitTimeHighlight(item.createdAt);
                      
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-5 gap-4 px-6 py-4 items-center transition-colors ${highlightClass} ${
                            index === 0 
                              ? darkMode ? 'bg-blue-900/30' : 'bg-blue-50' 
                              : ''
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {index === 0 && (
                              <ChevronRight className={`w-6 h-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'} animate-pulse`} />
                            )}
                            <span className={`text-2xl font-mono font-bold ${darkMode ? 'text-blue-400' : 'text-blue-600'}`}>
                              {item.ticketNumber || item.tokenNumber}
                            </span>
                          </div>
                          <div className={`text-lg font-medium ${textClass}`}>
                            {formatPrivateName(item.patient?.fullName)}
                          </div>
                          <div className={`text-lg ${mutedTextClass} capitalize`}>
                            {item.servicePoint?.replace(/_/g, ' ') || 'General'}
                          </div>
                          <div className={`text-lg font-medium ${
                            waitInfo.minutes > 60 
                              ? 'text-red-500' 
                              : waitInfo.minutes > 30 
                                ? 'text-yellow-500' 
                                : mutedTextClass
                          }`}>
                            {waitInfo.time}
                            {waitInfo.minutes > 30 && (
                              <AlertCircle className="inline-block w-5 h-5 ml-2" />
                            )}
                          </div>
                          <div>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              darkMode 
                                ? 'bg-gray-700 text-gray-300'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              <Clock className="w-4 h-4 mr-1" />
                              Waiting
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Footer Legend */}
              <div className={`px-6 py-3 border-t ${darkMode ? 'border-gray-700' : 'border-gray-200'} flex items-center gap-6 text-sm ${mutedTextClass}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${darkMode ? 'bg-yellow-900/50 border border-yellow-500' : 'bg-yellow-100 border border-yellow-300'}`}></div>
                  <span>Waiting &gt; 30 mins</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded ${darkMode ? 'bg-red-900/50 border border-red-500' : 'bg-red-100 border border-red-300'}`}></div>
                  <span>Waiting &gt; 60 mins</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Hidden audio element for notifications */}
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQ" type="audio/wav" />
      </audio>
    </div>
  );
}
