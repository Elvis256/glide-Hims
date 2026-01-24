import { useState, useEffect } from 'react';
import api from '../services/api';

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

const servicePoints = [
  { value: 'registration', label: 'Registration', icon: '📋' },
  { value: 'triage', label: 'Triage', icon: '🩺' },
  { value: 'consultation', label: 'Consultation', icon: '👨‍⚕️' },
  { value: 'laboratory', label: 'Laboratory', icon: '🔬' },
  { value: 'radiology', label: 'Radiology', icon: '📷' },
  { value: 'pharmacy', label: 'Pharmacy', icon: '💊' },
  { value: 'billing', label: 'Billing', icon: '💰' },
  { value: 'cashier', label: 'Cashier', icon: '💵' },
];

const priorityLabels: Record<number, { label: string; color: string }> = {
  1: { label: 'Emergency', color: 'bg-red-500' },
  2: { label: 'Urgent', color: 'bg-orange-500' },
  3: { label: 'VIP', color: 'bg-purple-500' },
  4: { label: 'Elderly', color: 'bg-blue-500' },
  5: { label: 'Disabled', color: 'bg-blue-400' },
  6: { label: 'Pregnant', color: 'bg-pink-500' },
  7: { label: 'Pediatric', color: 'bg-green-500' },
  10: { label: 'Routine', color: 'bg-gray-500' },
};

export default function QueueManagementPage() {
  const [selectedServicePoint, setSelectedServicePoint] = useState('consultation');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [counterNumber, setCounterNumber] = useState('1');

  useEffect(() => {
    loadQueue();
    loadStats();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadQueue();
      loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedServicePoint]);

  const loadQueue = async () => {
    try {
      const response = await api.get(`/queue/waiting/${selectedServicePoint}`);
      setQueue(response.data);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.get(`/queue/stats?servicePoint=${selectedServicePoint}`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const callNext = async () => {
    try {
      const response = await api.post('/queue/call-next', {
        servicePoint: selectedServicePoint,
        counterNumber,
      });
      if (response.data) {
        loadQueue();
        loadStats();
      } else {
        alert('No patients in queue');
      }
    } catch (error) {
      console.error('Failed to call next:', error);
    }
  };

  const startService = async (id: string) => {
    try {
      await api.post(`/queue/${id}/start-service`);
      loadQueue();
      loadStats();
    } catch (error) {
      console.error('Failed to start service:', error);
    }
  };

  const completeService = async (id: string) => {
    try {
      await api.post(`/queue/${id}/complete`);
      loadQueue();
      loadStats();
    } catch (error) {
      console.error('Failed to complete service:', error);
    }
  };

  const skipPatient = async (id: string) => {
    const reason = prompt('Enter skip reason:');
    if (reason) {
      try {
        await api.post(`/queue/${id}/skip`, { skipReason: reason });
        loadQueue();
        loadStats();
      } catch (error) {
        console.error('Failed to skip patient:', error);
      }
    }
  };

  const markNoShow = async (id: string) => {
    try {
      await api.post(`/queue/${id}/no-show`);
      loadQueue();
      loadStats();
    } catch (error) {
      console.error('Failed to mark no-show:', error);
    }
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Queue Management</h1>
        <p className="text-gray-600">Manage patient queues and service flow</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
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

      {/* Service Point Selection */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap gap-2">
          {servicePoints.map((sp) => (
            <button
              key={sp.value}
              onClick={() => setSelectedServicePoint(sp.value)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedServicePoint === sp.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {sp.icon} {sp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Call Next Section */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Counter/Room</label>
            <input
              type="text"
              value={counterNumber}
              onChange={(e) => setCounterNumber(e.target.value)}
              className="border rounded-lg px-3 py-2 w-24"
              placeholder="1"
            />
          </div>
          <button
            onClick={callNext}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-green-700 flex items-center gap-2"
          >
            📢 Call Next Patient
          </button>
        </div>
      </div>

      {/* Queue List */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold">
            Waiting Queue - {servicePoints.find((sp) => sp.value === selectedServicePoint)?.label}
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : queue.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No patients in queue</div>
        ) : (
          <div className="divide-y">
            {queue.map((item, _index) => (
              <div
                key={item.id}
                className={`p-4 flex items-center justify-between ${
                  item.status === 'called' ? 'bg-yellow-50' : item.status === 'in_service' ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-3xl font-bold text-blue-600 w-16">{item.ticketNumber}</div>
                  <div>
                    <div className="font-medium">{item.patient?.fullName}</div>
                    <div className="text-sm text-gray-500">MRN: {item.patient?.mrn}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className={`px-2 py-0.5 rounded text-xs text-white ${
                          priorityLabels[item.priority]?.color || 'bg-gray-500'
                        }`}
                      >
                        {priorityLabels[item.priority]?.label || 'Unknown'}
                      </span>
                      {item.estimatedWaitMinutes > 0 && (
                        <span className="text-xs text-gray-500">~{item.estimatedWaitMinutes} min wait</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {item.status === 'waiting' && (
                    <>
                      <button
                        onClick={() => skipPatient(item.id)}
                        className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                      >
                        Skip
                      </button>
                    </>
                  )}
                  {item.status === 'called' && (
                    <>
                      <span className="px-3 py-1 bg-yellow-200 text-yellow-800 rounded">Called to {item.counterNumber || item.roomNumber}</span>
                      <button
                        onClick={() => startService(item.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        Start Service
                      </button>
                      <button
                        onClick={() => markNoShow(item.id)}
                        className="px-3 py-1 bg-red-200 text-red-700 rounded hover:bg-red-300"
                      >
                        No Show
                      </button>
                    </>
                  )}
                  {item.status === 'in_service' && (
                    <>
                      <span className="px-3 py-1 bg-blue-200 text-blue-800 rounded">In Service</span>
                      <button
                        onClick={() => completeService(item.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        Complete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
