import { useState, useEffect } from 'react';
import {
  Monitor,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  Volume2,
  RefreshCw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';

interface QueueItem {
  id: string;
  ticketNumber: string;
  patientName: string;
  department: string;
  doctor: string;
  status: 'waiting' | 'called' | 'serving' | 'completed';
  waitTime: number;
  position: number;
}

// Mock queue data
const mockQueueItems: QueueItem[] = [
  { id: '1', ticketNumber: 'OPD-001', patientName: 'Sarah N.', department: 'General', doctor: 'Dr. Nambi', status: 'serving', waitTime: 0, position: 0 },
  { id: '2', ticketNumber: 'OPD-002', patientName: 'James O.', department: 'General', doctor: 'Dr. Okello', status: 'called', waitTime: 5, position: 1 },
  { id: '3', ticketNumber: 'OPD-003', patientName: 'Grace A.', department: 'Cardiology', doctor: 'Dr. Olweny', status: 'waiting', waitTime: 12, position: 2 },
  { id: '4', ticketNumber: 'OPD-004', patientName: 'Peter O.', department: 'General', doctor: 'Dr. Nambi', status: 'waiting', waitTime: 18, position: 3 },
  { id: '5', ticketNumber: 'OPD-005', patientName: 'Mary A.', department: 'Pediatrics', doctor: 'Dr. Apio', status: 'waiting', waitTime: 22, position: 4 },
  { id: '6', ticketNumber: 'OPD-006', patientName: 'David O.', department: 'General', doctor: 'Dr. Okello', status: 'waiting', waitTime: 25, position: 5 },
];

const departments = ['All', 'General', 'Pediatrics', 'Cardiology', 'Gynecology', 'Orthopedics'];

export default function QueueMonitorPage() {
  const [queue, setQueue] = useState<QueueItem[]>(mockQueueItems);
  const [selectedDept, setSelectedDept] = useState('All');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setLastRefresh(new Date());
      // In production, fetch from API
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const filteredQueue = selectedDept === 'All' 
    ? queue 
    : queue.filter(q => q.department === selectedDept);

  const stats = {
    waiting: queue.filter(q => q.status === 'waiting').length,
    called: queue.filter(q => q.status === 'called').length,
    serving: queue.filter(q => q.status === 'serving').length,
    completed: queue.filter(q => q.status === 'completed').length,
    avgWait: Math.round(queue.filter(q => q.status === 'waiting').reduce((a, b) => a + b.waitTime, 0) / (queue.filter(q => q.status === 'waiting').length || 1)),
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'serving': return 'bg-green-100 text-green-700 border-green-200';
      case 'called': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'waiting': return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Monitor className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Queue Monitor</h1>
            <p className="text-gray-500 text-sm">Real-time patient queue display</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm ${
              autoRefresh ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
            Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
          </button>
          <span className="text-xs text-gray-400">
            Updated: {lastRefresh.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-yellow-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-2xl font-bold">{stats.waiting}</span>
          </div>
          <p className="text-xs text-gray-500">Waiting</p>
        </div>
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-orange-600 mb-1">
            <Volume2 className="w-4 h-4" />
            <span className="text-2xl font-bold">{stats.called}</span>
          </div>
          <p className="text-xs text-gray-500">Called</p>
        </div>
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-2xl font-bold">{stats.serving}</span>
          </div>
          <p className="text-xs text-gray-500">Serving</p>
        </div>
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-blue-600 mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-2xl font-bold">{stats.completed}</span>
          </div>
          <p className="text-xs text-gray-500">Completed</p>
        </div>
        <div className="card p-3 text-center">
          <div className="flex items-center justify-center gap-2 text-purple-600 mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-2xl font-bold">{stats.avgWait}m</span>
          </div>
          <p className="text-xs text-gray-500">Avg Wait</p>
        </div>
      </div>

      {/* Department Filter */}
      <div className="flex gap-2 mb-4 flex-shrink-0 overflow-x-auto">
        {departments.map((dept) => (
          <button
            key={dept}
            onClick={() => setSelectedDept(dept)}
            className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
              selectedDept === dept
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {dept}
          </button>
        ))}
      </div>

      {/* Queue Grid */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="card h-full flex flex-col">
          {/* Column Headers */}
          <div className="grid grid-cols-6 gap-4 p-3 border-b bg-gray-50 text-xs font-medium text-gray-500 flex-shrink-0">
            <div>Token</div>
            <div>Patient</div>
            <div>Department</div>
            <div>Doctor</div>
            <div>Wait Time</div>
            <div>Status</div>
          </div>
          
          {/* Queue Items */}
          <div className="flex-1 overflow-y-auto">
            {filteredQueue.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No patients in queue</p>
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {filteredQueue.map((item) => (
                  <div
                    key={item.id}
                    className={`grid grid-cols-6 gap-4 p-3 items-center ${
                      item.status === 'serving' ? 'bg-green-50' : 
                      item.status === 'called' ? 'bg-yellow-50' : ''
                    }`}
                  >
                    <div className="font-mono font-bold text-blue-600">{item.ticketNumber}</div>
                    <div className="font-medium text-gray-900">{item.patientName}</div>
                    <div className="text-gray-600 text-sm">{item.department}</div>
                    <div className="text-gray-600 text-sm">{item.doctor}</div>
                    <div className="text-gray-600 text-sm">
                      {item.status === 'serving' ? 'Now' : `${item.waitTime} min`}
                    </div>
                    <div>
                      <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(item.status)}`}>
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
