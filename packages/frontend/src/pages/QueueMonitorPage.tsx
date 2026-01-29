import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Monitor,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../services/queue';

const SERVICE_POINTS = [
  { value: '', label: 'All' },
  { value: 'registration', label: 'Registration' },
  { value: 'triage', label: 'Triage' },
  { value: 'consultation', label: 'Consultation' },
  { value: 'laboratory', label: 'Laboratory' },
  { value: 'radiology', label: 'Radiology' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'billing', label: 'Billing' },
  { value: 'cashier', label: 'Cashier' },
];

export default function QueueMonitorPage() {
  const [selectedServicePoint, setSelectedServicePoint] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch queue entries from API
  const { 
    data: queue = [], 
    isLoading: isLoadingQueue, 
    error: queueError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['queue', 'list', selectedServicePoint],
    queryFn: () => queueService.getQueue(selectedServicePoint ? { servicePoint: selectedServicePoint } : undefined),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  // Fetch queue stats from API
  const { 
    data: stats, 
    isLoading: isLoadingStats,
    error: statsError,
  } = useQuery({
    queryKey: ['queue', 'stats'],
    queryFn: () => queueService.getStats(),
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const isLoading = isLoadingQueue || isLoadingStats;
  const error = queueError || statsError;

  // Map API status to display status
  const mapStatus = (status: QueueEntry['status']): 'waiting' | 'called' | 'serving' | 'completed' => {
    switch (status) {
      case 'waiting': return 'waiting';
      case 'called': return 'called';
      case 'in_service': return 'serving';
      case 'completed': return 'completed';
      case 'skipped':
      case 'no_show':
      case 'cancelled':
      default: return 'completed';
    }
  };

  const filteredQueue = selectedServicePoint
    ? queue.filter(q => q.servicePoint === selectedServicePoint)
    : queue;

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
            Updated: {dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : '-'}
          </span>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="card p-4 mb-4 bg-red-50 border-red-200 flex-shrink-0">
          <div className="flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load queue data. Please try again later.</span>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-3 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading queue data...</span>
          </div>
        </div>
      )}

      {!isLoading && !error && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
            <div className="card p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-yellow-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-2xl font-bold">{stats?.waiting ?? 0}</span>
              </div>
              <p className="text-xs text-gray-500">Waiting</p>
            </div>
            <div className="card p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-1">
                <Users className="w-4 h-4" />
                <span className="text-2xl font-bold">{stats?.inService ?? 0}</span>
              </div>
              <p className="text-xs text-gray-500">In Service</p>
            </div>
            <div className="card p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-blue-600 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-2xl font-bold">{stats?.completed ?? 0}</span>
              </div>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="card p-3 text-center">
              <div className="flex items-center justify-center gap-2 text-purple-600 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-2xl font-bold">{stats?.avgWaitTime ?? 0}m</span>
              </div>
              <p className="text-xs text-gray-500">Avg Wait</p>
            </div>
          </div>

          {/* Service Point Filter */}
          <div className="flex gap-2 mb-4 flex-shrink-0 overflow-x-auto">
            {SERVICE_POINTS.map((sp) => (
              <button
                key={sp.value}
                onClick={() => setSelectedServicePoint(sp.value)}
                className={`px-4 py-1.5 rounded text-sm font-medium whitespace-nowrap ${
                  selectedServicePoint === sp.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {sp.label}
              </button>
            ))}
          </div>

          {/* Queue Grid */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <div className="card h-full flex flex-col">
              {/* Column Headers */}
              <div className="grid grid-cols-5 gap-4 p-3 border-b bg-gray-50 text-xs font-medium text-gray-500 flex-shrink-0">
                <div>Token</div>
                <div>Patient</div>
                <div>Service Point</div>
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
                    {filteredQueue.map((item) => {
                      const displayStatus = mapStatus(item.status);
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-5 gap-4 p-3 items-center ${
                            displayStatus === 'serving' ? 'bg-green-50' : 
                            displayStatus === 'called' ? 'bg-yellow-50' : ''
                          }`}
                        >
                          <div className="font-mono font-bold text-blue-600">{item.ticketNumber || item.tokenNumber}</div>
                          <div className="font-medium text-gray-900">{item.patient?.fullName ?? 'Unknown'}</div>
                          <div className="text-gray-600 text-sm capitalize">{item.servicePoint?.replace(/_/g, ' ')}</div>
                          <div className="text-gray-600 text-sm">
                            {displayStatus === 'serving' ? 'Now' : `${item.estimatedWaitMinutes ?? 0} min`}
                          </div>
                          <div>
                            <span className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(displayStatus)}`}>
                              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
