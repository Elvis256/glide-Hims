import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useFacilityId } from '../lib/facility';
import {
  Calendar,
  Clock,
  User,
  Users,
  Scissors,
  AlertCircle,
  CheckCircle,
  XCircle,
  Play,
  Pause,
  Activity,
  Plus,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';

interface Theatre {
  id: string;
  name: string;
  code: string;
  type: string;
  status: 'available' | 'in_use' | 'cleaning' | 'maintenance' | 'out_of_service';
}

interface SurgeryCase {
  id: string;
  caseNumber: string;
  procedureName: string;
  procedureCode?: string;
  surgeryType: 'major' | 'minor' | 'day_case';
  priority: 'elective' | 'urgent' | 'emergency';
  status: string;
  scheduledDate: string;
  scheduledTime: string;
  estimatedDurationMinutes: number;
  patient: { id: string; firstName: string; lastName: string; mrn: string };
  theatre: { id: string; name: string; code: string };
  leadSurgeon: { id: string; firstName: string; lastName: string };
  actualStartTime?: string;
  actualEndTime?: string;
}

interface Dashboard {
  todayScheduledCount: number;
  inProgressCount: number;
  inProgressCases: SurgeryCase[];
  postOpCount: number;
  postOpCases: SurgeryCase[];
  theatres: Theatre[];
  theatreAvailable: number;
  theatreInUse: number;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-100 text-blue-800',
  pre_op: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-red-100 text-red-800',
  post_op: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-gray-100 text-gray-800',
  postponed: 'bg-orange-100 text-orange-800',
};

const priorityColors: Record<string, string> = {
  elective: 'bg-green-50 text-green-700 border-green-200',
  urgent: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  emergency: 'bg-red-50 text-red-700 border-red-200',
};

const theatreStatusColors: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  in_use: 'bg-red-100 text-red-800',
  cleaning: 'bg-yellow-100 text-yellow-800',
  maintenance: 'bg-orange-100 text-orange-800',
  out_of_service: 'bg-gray-100 text-gray-800',
};

export default function TheatrePage() {
  const facilityId = useFacilityId();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [schedule, setSchedule] = useState<SurgeryCase[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [selectedCase, setSelectedCase] = useState<SurgeryCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'theatres'>('dashboard');

  useEffect(() => {
    loadDashboard();
    loadSchedule();
  }, [selectedDate]);

  const loadDashboard = async () => {
    try {
      const response = await api.get(`/surgery/dashboard?facilityId=${facilityId}`);
      setDashboard(response.data);
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  };

  const loadSchedule = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/surgery/schedule/date?facilityId=${facilityId}&date=${selectedDate}`
      );
      setSchedule(response.data);
    } catch (err) {
      console.error('Error loading schedule:', err);
    } finally {
      setLoading(false);
    }
  };

  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const formatTime = (time: string) => {
    const [h, m] = time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Theatre / Surgery</h1>
          <p className="text-gray-500 text-sm">Operating theatre management and surgery scheduling</p>
        </div>
        <button
          onClick={() => setShowScheduleModal(true)}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4" />
          Schedule Surgery
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Activity },
            { id: 'schedule', label: 'Schedule', icon: Calendar },
            { id: 'theatres', label: 'Theatres', icon: Scissors },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && !dashboard && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-2 text-gray-500">Loading dashboard...</p>
        </div>
      )}
      {activeTab === 'dashboard' && dashboard && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
              <div className="text-sm text-gray-500">Today's Schedule</div>
              <div className="text-3xl font-bold text-blue-600">{dashboard.todayScheduledCount}</div>
              <div className="text-xs text-gray-400">Surgeries scheduled</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
              <div className="text-sm text-gray-500">In Progress</div>
              <div className="text-3xl font-bold text-red-600">{dashboard.inProgressCount}</div>
              <div className="text-xs text-gray-400">Active surgeries</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
              <div className="text-sm text-gray-500">Post-Op Recovery</div>
              <div className="text-3xl font-bold text-purple-600">{dashboard.postOpCount}</div>
              <div className="text-xs text-gray-400">In recovery</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
              <div className="text-sm text-gray-500">Theatre Status</div>
              <div className="text-3xl font-bold text-green-600">
                {dashboard.theatreAvailable}/{dashboard.theatres.length}
              </div>
              <div className="text-xs text-gray-400">Available</div>
            </div>
          </div>

          {/* In Progress Cases */}
          {dashboard.inProgressCases.length > 0 && (
            <div className="bg-white rounded-lg shadow">
              <div className="px-4 py-3 border-b bg-red-50">
                <h3 className="font-semibold text-red-800 flex items-center gap-2">
                  <Activity className="w-5 h-5 animate-pulse" />
                  Currently In Progress
                </h3>
              </div>
              <div className="divide-y">
                {dashboard.inProgressCases.map((c) => (
                  <div key={c.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="font-medium">{c.procedureName}</div>
                      <div className="text-sm text-gray-500">
                        {c.patient?.firstName} {c.patient?.lastName} • {c.theatre?.name}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Started</div>
                      <div className="font-medium">
                        {c.actualStartTime
                          ? new Date(c.actualStartTime).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--:--'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Theatre Status */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b">
              <h3 className="font-semibold">Theatre Status</h3>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              {dashboard.theatres.map((t) => (
                <div
                  key={t.id}
                  className={`p-4 rounded-lg border ${
                    t.status === 'available'
                      ? 'border-green-200 bg-green-50'
                      : t.status === 'in_use'
                      ? 'border-red-200 bg-red-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-sm text-gray-500">{t.code} • {t.type}</div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${theatreStatusColors[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Date Navigation */}
          <div className="bg-white rounded-lg shadow p-4 flex items-center justify-between">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="text-center">
              <div className="text-lg font-semibold">
                {new Date(selectedDate).toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="text-sm text-indigo-600 bg-transparent border-none cursor-pointer"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Schedule List */}
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : schedule.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No surgeries scheduled for this date</p>
              <button
                onClick={() => setShowScheduleModal(true)}
                className="mt-4 text-indigo-600 hover:text-indigo-700"
              >
                Schedule a surgery
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow divide-y">
              {schedule.map((s) => (
                <div
                  key={s.id}
                  onClick={() => setSelectedCase(s)}
                  className="p-4 hover:bg-gray-50 cursor-pointer flex items-start gap-4"
                >
                  <div className="text-center min-w-[80px]">
                    <div className="text-lg font-bold text-indigo-600">
                      {formatTime(s.scheduledTime)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDuration(s.estimatedDurationMinutes)}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.procedureName}</span>
                      <span className={`px-2 py-0.5 rounded text-xs border ${priorityColors[s.priority]}`}>
                        {s.priority}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${statusColors[s.status]}`}>
                        {s.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {s.patient?.firstName} {s.patient?.lastName} ({s.patient?.mrn})
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1 mr-4">
                        <Scissors className="w-3 h-3" />
                        {s.theatre?.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Dr. {s.leadSurgeon?.lastName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Theatres Tab */}
      {activeTab === 'theatres' && dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboard.theatres.map((t) => (
            <div key={t.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg">{t.name}</h3>
                  <p className="text-sm text-gray-500">{t.code}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${theatreStatusColors[t.status]}`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Type</span>
                  <span className="font-medium capitalize">{t.type}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t flex gap-2">
                {t.status === 'available' && (
                  <button className="flex-1 text-center py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 text-sm">
                    Schedule
                  </button>
                )}
                {t.status === 'cleaning' && (
                  <button className="flex-1 text-center py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm">
                    Mark Ready
                  </button>
                )}
                <button className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded text-sm">
                  Details
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Case Detail Side Panel */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setSelectedCase(null)} />
          <div className="relative w-full max-w-lg bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Surgery Details</h2>
              <button
                onClick={() => setSelectedCase(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div>
                <div className="text-sm text-gray-500">Case Number</div>
                <div className="font-mono text-lg">{selectedCase.caseNumber}</div>
              </div>
              
              <div>
                <div className="text-sm text-gray-500">Procedure</div>
                <div className="font-medium text-lg">{selectedCase.procedureName}</div>
                {selectedCase.procedureCode && (
                  <div className="text-sm text-gray-500">Code: {selectedCase.procedureCode}</div>
                )}
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="text-sm text-gray-500">Priority</div>
                  <span className={`inline-block mt-1 px-3 py-1 rounded border ${priorityColors[selectedCase.priority]}`}>
                    {selectedCase.priority}
                  </span>
                </div>
                <div className="flex-1">
                  <div className="text-sm text-gray-500">Status</div>
                  <span className={`inline-block mt-1 px-3 py-1 rounded ${statusColors[selectedCase.status]}`}>
                    {selectedCase.status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="font-medium">
                    {new Date(selectedCase.scheduledDate).toLocaleDateString()}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Time</div>
                  <div className="font-medium">{formatTime(selectedCase.scheduledTime)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Duration</div>
                  <div className="font-medium">{formatDuration(selectedCase.estimatedDurationMinutes)}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Theatre</div>
                  <div className="font-medium">{selectedCase.theatre?.name}</div>
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Patient</div>
                <div className="font-medium">
                  {selectedCase.patient?.firstName} {selectedCase.patient?.lastName}
                </div>
                <div className="text-sm text-gray-400">MRN: {selectedCase.patient?.mrn}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Lead Surgeon</div>
                <div className="font-medium">
                  Dr. {selectedCase.leadSurgeon?.firstName} {selectedCase.leadSurgeon?.lastName}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-2">
                {selectedCase.status === 'scheduled' && (
                  <>
                    <button className="w-full py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Complete Pre-Op Checklist
                    </button>
                  </>
                )}
                {selectedCase.status === 'pre_op' && (
                  <button className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" />
                    Start Surgery
                  </button>
                )}
                {selectedCase.status === 'in_progress' && (
                  <button className="w-full py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center gap-2">
                    <Pause className="w-4 h-4" />
                    Complete Surgery
                  </button>
                )}
                {selectedCase.status === 'post_op' && (
                  <button className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Discharge from Recovery
                  </button>
                )}
                {['scheduled', 'pre_op'].includes(selectedCase.status) && (
                  <button className="w-full py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 flex items-center justify-center gap-2">
                    <XCircle className="w-4 h-4" />
                    Cancel / Postpone
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Surgery Modal (placeholder) */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowScheduleModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Schedule Surgery</h2>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <p className="text-gray-500 text-center py-12">
                Surgery scheduling form coming soon...
                <br />
                <span className="text-sm">
                  Will include: patient search, procedure selection, theatre/date/time, surgeon assignment
                </span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
