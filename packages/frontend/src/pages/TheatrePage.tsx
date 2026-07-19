import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../services/api';
import { useFacilityId } from '../lib/facility';
import WhoChecklistPanel from '../components/surgery/WhoChecklistPanel';
import ScheduleSurgeryModal from '../components/surgery/ScheduleSurgeryModal';
import PreOpModal from '../components/surgery/PreOpModal';
import CompleteSurgeryModal from '../components/surgery/CompleteSurgeryModal';
import ConsumablesSection from '../components/surgery/ConsumablesSection';
import { surgeryService } from '../services/surgery';
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
  patient: { id: string; fullName: string; mrn: string };
  theatre: { id: string; name: string; code: string };
  // User relation — User has only fullName.
  leadSurgeon: { id: string; fullName: string };
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
  const [whoChecklistCase, setWhoChecklistCase] = useState<SurgeryCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'schedule' | 'theatres'>('dashboard');
  const [preOpCase, setPreOpCase] = useState<SurgeryCase | null>(null);
  const [completeCase, setCompleteCase] = useState<SurgeryCase | null>(null);
  const [cancelCase, setCancelCase] = useState<SurgeryCase | null>(null);
  const [cancelForm, setCancelForm] = useState({ reason: '', newDate: '', newTime: '' });
  const [showTheatreModal, setShowTheatreModal] = useState(false);
  const [theatreForm, setTheatreForm] = useState({ name: '', code: '', type: 'general' });
  const [actionPending, setActionPending] = useState(false);

  const refresh = () => {
    loadDashboard();
    loadSchedule();
  };

  const startSurgery = async (c: SurgeryCase) => {
    try {
      setActionPending(true);
      await surgeryService.cases.start(c.id);
      toast.success('Surgery started — theatre marked in use');
      setSelectedCase(null);
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Cannot start surgery'));
    } finally {
      setActionPending(false);
    }
  };

  const dischargeRecovery = async (c: SurgeryCase) => {
    try {
      setActionPending(true);
      await surgeryService.cases.dischargeRecovery(c.id);
      toast.success('Patient discharged from recovery');
      setSelectedCase(null);
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to discharge from recovery'));
    } finally {
      setActionPending(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelCase || !cancelForm.reason) return;
    try {
      setActionPending(true);
      await surgeryService.cases.cancel(cancelCase.id, {
        reason: cancelForm.reason,
        newDate: cancelForm.newDate || undefined,
        newTime: cancelForm.newTime || undefined,
      } as any);
      toast.success(cancelForm.newDate ? 'Surgery postponed' : 'Surgery cancelled');
      setCancelCase(null);
      setCancelForm({ reason: '', newDate: '', newTime: '' });
      setSelectedCase(null);
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to cancel surgery'));
    } finally {
      setActionPending(false);
    }
  };

  const createTheatre = async () => {
    try {
      setActionPending(true);
      await surgeryService.theatres.create({
        facilityId,
        name: theatreForm.name,
        code: theatreForm.code,
        type: theatreForm.type as any,
      } as any);
      toast.success('Theatre added');
      setShowTheatreModal(false);
      setTheatreForm({ name: '', code: '', type: 'general' });
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to add theatre'));
    } finally {
      setActionPending(false);
    }
  };

  const markTheatreReady = async (theatreId: string) => {
    try {
      await surgeryService.theatres.updateStatus(theatreId, 'available' as any);
      toast.success('Theatre marked available');
      refresh();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update theatre'));
    }
  };

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
                        {c.patient?.fullName} • {c.theatre?.name}
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
                        {s.patient?.fullName} ({s.patient?.mrn})
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1 mr-4">
                        <Scissors className="w-3 h-3" />
                        {s.theatre?.name}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        Dr. {s.leadSurgeon?.fullName}
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
        <div className="space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowTheatreModal(true)}
            className="px-4 py-2 border border-indigo-300 text-indigo-600 rounded-lg hover:bg-indigo-50 flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Theatre
          </button>
        </div>
        {dashboard.theatres.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <Scissors className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p>No theatres configured yet — add one to start scheduling surgeries.</p>
          </div>
        )}
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
                  <button
                    onClick={() => setShowScheduleModal(true)}
                    className="flex-1 text-center py-2 bg-green-50 text-green-700 rounded hover:bg-green-100 text-sm"
                  >
                    Schedule
                  </button>
                )}
                {['cleaning', 'maintenance'].includes(t.status) && (
                  <button
                    onClick={() => markTheatreReady(t.id)}
                    className="flex-1 text-center py-2 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 text-sm"
                  >
                    Mark Ready
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
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
                  {selectedCase.patient?.fullName}
                </div>
                <div className="text-sm text-gray-400">MRN: {selectedCase.patient?.mrn}</div>
              </div>

              <div>
                <div className="text-sm text-gray-500">Lead Surgeon</div>
                <div className="font-medium">
                  Dr. {selectedCase.leadSurgeon?.fullName}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t space-y-2">
                {['scheduled', 'pre_op', 'in_progress', 'post_op', 'completed'].includes(
                  selectedCase.status,
                ) && (
                  <button
                    onClick={() => setWhoChecklistCase(selectedCase)}
                    className="w-full py-2 bg-teal-600 text-white rounded hover:bg-teal-700 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    WHO Safety Checklist
                  </button>
                )}
                {selectedCase.status === 'scheduled' && (
                  <button
                    onClick={() => setPreOpCase(selectedCase)}
                    className="w-full py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Complete Pre-Op Checklist
                  </button>
                )}
                {['scheduled', 'pre_op'].includes(selectedCase.status) && (
                  <button
                    onClick={() => startSurgery(selectedCase)}
                    disabled={actionPending}
                    className="w-full py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Play className="w-4 h-4" />
                    Start Surgery
                  </button>
                )}
                {selectedCase.status === 'in_progress' && (
                  <button
                    onClick={() => setCompleteCase(selectedCase)}
                    className="w-full py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center gap-2"
                  >
                    <Pause className="w-4 h-4" />
                    Complete Surgery
                  </button>
                )}
                {selectedCase.status === 'post_op' && (
                  <button
                    onClick={() => dischargeRecovery(selectedCase)}
                    disabled={actionPending}
                    className="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Discharge from Recovery
                  </button>
                )}
                {['scheduled', 'pre_op'].includes(selectedCase.status) && (
                  <button
                    onClick={() => setCancelCase(selectedCase)}
                    className="w-full py-2 border border-red-300 text-red-600 rounded hover:bg-red-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel / Postpone
                  </button>
                )}
              </div>

              {['pre_op', 'in_progress', 'post_op', 'completed'].includes(selectedCase.status) && (
                <ConsumablesSection caseId={selectedCase.id} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* WHO Surgical Safety Checklist */}
      {whoChecklistCase && (
        <WhoChecklistPanel
          caseId={whoChecklistCase.id}
          caseNumber={whoChecklistCase.caseNumber}
          onClose={() => setWhoChecklistCase(null)}
        />
      )}

      {/* Schedule Surgery */}
      {showScheduleModal && (
        <ScheduleSurgeryModal
          theatres={(dashboard?.theatres as any) ?? []}
          onClose={() => setShowScheduleModal(false)}
          onScheduled={refresh}
        />
      )}

      {/* Pre-Op checklist */}
      {preOpCase && (
        <PreOpModal
          caseId={preOpCase.id}
          caseNumber={preOpCase.caseNumber}
          onClose={() => setPreOpCase(null)}
          onSaved={() => {
            setSelectedCase(null);
            refresh();
          }}
        />
      )}

      {/* Complete surgery */}
      {completeCase && (
        <CompleteSurgeryModal
          caseId={completeCase.id}
          caseNumber={completeCase.caseNumber}
          onClose={() => setCompleteCase(null)}
          onCompleted={() => {
            setSelectedCase(null);
            refresh();
          }}
        />
      )}

      {/* Cancel / postpone */}
      {cancelCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setCancelCase(null)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Cancel / Postpone — {cancelCase.caseNumber}</h2>
              <button onClick={() => setCancelCase(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Reason *</span>
                <textarea
                  rows={2}
                  value={cancelForm.reason}
                  onChange={(e) => setCancelForm((f) => ({ ...f, reason: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">Postpone to date</span>
                  <input
                    type="date"
                    value={cancelForm.newDate}
                    onChange={(e) => setCancelForm((f) => ({ ...f, newDate: e.target.value }))}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">New time</span>
                  <input
                    type="time"
                    value={cancelForm.newTime}
                    onChange={(e) => setCancelForm((f) => ({ ...f, newTime: e.target.value }))}
                    className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <p className="text-xs text-gray-500">Leave the date empty to cancel outright.</p>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setCancelCase(null)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Back</button>
              <button
                onClick={submitCancel}
                disabled={!cancelForm.reason || actionPending}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {cancelForm.newDate ? 'Postpone' : 'Cancel Surgery'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add theatre */}
      {showTheatreModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowTheatreModal(false)} />
          <div className="relative bg-white rounded-lg shadow-xl w-full max-w-sm">
            <div className="border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold">Add Theatre</h2>
              <button onClick={() => setShowTheatreModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-3">
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Name *</span>
                <input
                  value={theatreForm.name}
                  onChange={(e) => setTheatreForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Main Theatre 1"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Code *</span>
                <input
                  value={theatreForm.code}
                  onChange={(e) => setTheatreForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="e.g. OT1"
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-gray-700">Type *</span>
                <select
                  value={theatreForm.type}
                  onChange={(e) => setTheatreForm((f) => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {['general', 'orthopedic', 'cardiac', 'neuro', 'obstetric', 'ophthalmic', 'ent', 'minor'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button onClick={() => setShowTheatreModal(false)} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={createTheatre}
                disabled={!theatreForm.name || !theatreForm.code || actionPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                Add Theatre
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
