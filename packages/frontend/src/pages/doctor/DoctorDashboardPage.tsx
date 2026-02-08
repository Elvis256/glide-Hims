import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Users,
  Phone,
  Clock,
  AlertTriangle,
  Loader2,
  PlayCircle,
  RefreshCw,
  ChevronRight,
  Activity,
  Stethoscope,
  Calendar,
  FlaskConical,
  Image,
  FileText,
  Pen,
  Eye,
  CheckCircle,
  Bell,
  UserCheck,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { queueService, type QueueEntry } from '../../services/queue';
import { labService, type LabOrder } from '../../services/lab';
import { encountersService, type Encounter } from '../../services/encounters';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useAuthStore } from '../../store/auth';
import api from '../../services/api';

// ===================== TYPES =====================
interface QueuePatient {
  id: string;
  ticketNumber: string;
  name: string;
  mrn: string;
  patientId: string;
  encounterId?: string;
  status: 'waiting' | 'called' | 'in_service';
  priority: 'emergency' | 'urgent' | 'high' | 'normal' | 'low';
  chiefComplaint: string;
  waitTime: number;
  age?: string;
  gender?: string;
  visitType?: string;
}

interface PendingReview {
  id: string;
  patientName: string;
  mrn: string;
  category: 'lab' | 'imaging' | 'referral' | 'notes';
  type: string;
  dateSubmitted: string;
  priority: 'urgent' | 'routine';
  description: string;
  encounterId?: string;
  patientId?: string;
}

interface ScheduleAppointment {
  id: string;
  patientName: string;
  time: string;
  status: 'scheduled' | 'in-progress' | 'completed' | 'no-show';
  reason: string;
  encounterId?: string;
}

// ===================== HELPERS =====================
function calculateAge(dob: string | Date | undefined): string {
  if (!dob) return '';
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return '';
  const today = new Date();
  if (birthDate > today) return '';
  let years = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    years--;
  }
  if (years < 1) {
    const months = (today.getFullYear() - birthDate.getFullYear()) * 12 + (today.getMonth() - birthDate.getMonth());
    return months <= 0 ? '< 1m' : `${months}m`;
  }
  return `${years}y`;
}

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hrs}h ${mins}m`;
}

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffMins > 0) return `${diffMins} min ago`;
  return 'Just now';
}

const priorityConfig = {
  emergency: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', label: 'EMERGENCY' },
  urgent: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', label: 'Urgent' },
  high: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', label: 'High' },
  normal: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-300', label: 'Normal' },
  low: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300', label: 'Low' },
};

// ===================== COMPONENT =====================
export default function DoctorDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const user = useAuthStore((s) => s.user);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  // Permission check
  if (!hasPermission('encounters.read')) {
    return <AccessDenied />;
  }

  // ===================== QUERIES =====================
  
  // Queue data - filter by assigned doctor (current user)
  const { data: queueData = [], isLoading: queueLoading, refetch: refetchQueue } = useQuery({
    queryKey: ['doctor-queue', user?.id],
    queryFn: () => queueService.getByServicePoint('consultation', user?.id),
    refetchInterval: 30000,
    enabled: !!user?.id,
  });

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['doctor-queue-stats'],
    queryFn: async () => {
      const response = await api.get('/encounters/stats/today');
      return response.data;
    },
    refetchInterval: 60000,
  });

  // Pending lab reviews
  const { data: pendingLabs = [], isLoading: labsLoading } = useQuery({
    queryKey: ['pending-lab-reviews'],
    queryFn: () => labService.orders.list({ status: 'completed' }),
  });

  // Today's encounters (schedule)
  const { data: todayEncounters = [], isLoading: scheduleLoading } = useQuery({
    queryKey: ['today-schedule'],
    queryFn: () => encountersService.getQueue(),
  });

  // ===================== MUTATIONS =====================
  
  const callNextMutation = useMutation({
    mutationFn: () => queueService.callNext('consultation'),
    onSuccess: (patient) => {
      if (patient) {
        toast.success(`Called: ${patient.patient?.fullName || patient.ticketNumber}`);
        queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
      } else {
        toast.info('No patients waiting');
      }
    },
    onError: () => toast.error('Failed to call next patient'),
  });

  const startServiceMutation = useMutation({
    mutationFn: (id: string) => queueService.startService(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['doctor-queue'] });
    },
  });

  // ===================== DATA TRANSFORMATION =====================
  
  const queuePatients = useMemo((): QueuePatient[] => {
    return queueData.map((entry: QueueEntry) => ({
      id: entry.id,
      ticketNumber: entry.ticketNumber || '',
      name: entry.patient?.fullName || 'Unknown',
      mrn: entry.patient?.mrn || '',
      patientId: entry.patientId,
      encounterId: entry.encounterId,
      status: entry.status as 'waiting' | 'called' | 'in_service',
      priority: (entry.priority || 'normal') as QueuePatient['priority'],
      chiefComplaint: entry.notes || 'General consultation',
      waitTime: entry.createdAt ? Math.floor((Date.now() - new Date(entry.createdAt).getTime()) / 60000) : 0,
      age: calculateAge(entry.patient?.dateOfBirth),
      gender: entry.patient?.gender?.charAt(0).toUpperCase(),
      visitType: 'OPD Visit',
    }));
  }, [queueData]);

  const waitingPatients = queuePatients.filter(p => p.status === 'waiting' || p.status === 'called');
  const inConsultationPatients = queuePatients.filter(p => p.status === 'in_service');

  const pendingReviews = useMemo((): PendingReview[] => {
    return pendingLabs.map((order: LabOrder) => ({
      id: order.id,
      patientName: order.patient?.fullName || 'Unknown',
      mrn: order.patient?.mrn || order.patientId,
      category: 'lab' as const,
      type: order.tests?.map(t => t.testName || t.name).join(', ') || 'Lab Tests',
      dateSubmitted: order.completedAt || order.createdAt,
      priority: order.priority === 'stat' ? 'urgent' : 'routine',
      description: order.clinicalNotes || 'Lab results ready for review',
      encounterId: order.encounterId,
      patientId: order.patientId,
    }));
  }, [pendingLabs]);

  const scheduleAppointments = useMemo((): ScheduleAppointment[] => {
    return todayEncounters.slice(0, 5).map((enc: Encounter) => ({
      id: enc.id,
      patientName: enc.patient?.fullName || 'Unknown',
      time: new Date(enc.visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: enc.status === 'completed' ? 'completed' : enc.status === 'in_consultation' ? 'in-progress' : 'scheduled',
      reason: enc.chiefComplaint || 'Consultation',
      encounterId: enc.id,
    }));
  }, [todayEncounters]);

  // ===================== HANDLERS =====================
  
  const handleRefresh = useCallback(() => {
    refetchQueue();
    queryClient.invalidateQueries({ queryKey: ['pending-lab-reviews'] });
    queryClient.invalidateQueries({ queryKey: ['today-schedule'] });
    setLastRefresh(new Date());
    toast.success('Dashboard refreshed');
  }, [refetchQueue, queryClient]);

  const handleCallNext = () => {
    callNextMutation.mutate();
  };

  const handleStartConsultation = async (patient: QueuePatient) => {
    try {
      if (patient.status === 'waiting') {
        await queueService.call(patient.id);
      }
      if (patient.status !== 'in_service') {
        await startServiceMutation.mutateAsync(patient.id);
      }
      navigate(`/doctor/consult?encounterId=${patient.encounterId}&patientId=${patient.patientId}`);
    } catch (err) {
      console.error('Failed to start consultation:', err);
      toast.error('Failed to start consultation');
    }
  };

  const handleContinueConsultation = (patient: QueuePatient) => {
    navigate(`/doctor/consult?encounterId=${patient.encounterId}&patientId=${patient.patientId}`);
  };

  const handleReviewResult = (review: PendingReview) => {
    if (review.encounterId) {
      navigate(`/doctor/consult?encounterId=${review.encounterId}&patientId=${review.patientId}&tab=results`);
    } else {
      navigate(`/doctor/results/lab?orderId=${review.id}`);
    }
  };

  // ===================== RENDER =====================
  const isLoading = queueLoading || labsLoading || scheduleLoading;

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
          <p className="text-sm text-gray-500">
            Welcome, Dr. {user?.fullName || 'Doctor'} • Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{waitingPatients.length}</p>
              <p className="text-sm text-gray-500">Waiting</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Stethoscope className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{inConsultationPatients.length}</p>
              <p className="text-sm text-gray-500">In Consultation</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <UserCheck className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.completed || 0}</p>
              <p className="text-sm text-gray-500">Seen Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Timer className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats?.avgWaitTime || 0} min</p>
              <p className="text-sm text-gray-500">Avg Wait</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Bell className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{pendingReviews.length}</p>
              <p className="text-sm text-gray-500">Pending Reviews</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Queue Panel */}
        <div className="col-span-2 space-y-4">
          {/* Call Next Button */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Patient Queue</h2>
                <p className="text-blue-100 text-sm">
                  {waitingPatients.length} patient{waitingPatients.length !== 1 ? 's' : ''} waiting
                </p>
              </div>
              <button
                onClick={handleCallNext}
                disabled={callNextMutation.isPending || waitingPatients.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {callNextMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Phone className="w-5 h-5" />
                )}
                Call Next
              </button>
            </div>
          </div>

          {/* Waiting Patients */}
          {waitingPatients.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200">
              <div className="p-4 border-b border-gray-100">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-500" />
                  Waiting ({waitingPatients.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {waitingPatients.map((patient) => (
                  <div key={patient.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${priorityConfig[patient.priority].bg} ${priorityConfig[patient.priority].text}`}>
                          {patient.ticketNumber}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{patient.name}</p>
                          <p className="text-sm text-gray-500">
                            {patient.mrn} • {patient.age}/{patient.gender} • {patient.chiefComplaint}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500">{formatWaitTime(patient.waitTime)}</span>
                        <button
                          onClick={() => handleStartConsultation(patient)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" />
                          Start
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* In Consultation */}
          {inConsultationPatients.length > 0 && (
            <div className="bg-white rounded-xl border border-green-200">
              <div className="p-4 border-b border-green-100 bg-green-50 rounded-t-xl">
                <h3 className="font-semibold text-green-800 flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  In Consultation ({inConsultationPatients.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-100">
                {inConsultationPatients.map((patient) => (
                  <div key={patient.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 text-xs font-bold rounded bg-green-100 text-green-700">
                          {patient.ticketNumber}
                        </span>
                        <div>
                          <p className="font-medium text-gray-900">{patient.name}</p>
                          <p className="text-sm text-gray-500">
                            {patient.mrn} • {patient.age}/{patient.gender} • {patient.visitType}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleContinueConsultation(patient)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                        Continue
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {waitingPatients.length === 0 && inConsultationPatients.length === 0 && !queueLoading && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 mb-1">No Patients in Queue</h3>
              <p className="text-gray-500 text-sm">All patients have been attended to</p>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Pending Reviews */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-purple-500" />
                Pending Reviews
                {pendingReviews.length > 0 && (
                  <span className="ml-auto px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                    {pendingReviews.length}
                  </span>
                )}
              </h3>
            </div>
            {pendingReviews.length > 0 ? (
              <div className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {pendingReviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate">{review.patientName}</p>
                        <p className="text-xs text-gray-500 truncate">{review.type}</p>
                        <p className="text-xs text-gray-400 mt-1">{getTimeAgo(review.dateSubmitted)}</p>
                      </div>
                      <button
                        onClick={() => handleReviewResult(review)}
                        className="flex-shrink-0 p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                No pending reviews
              </div>
            )}
            {pendingReviews.length > 5 && (
              <div className="p-3 border-t border-gray-100">
                <button
                  onClick={() => navigate('/doctor/pending')}
                  className="w-full text-sm text-purple-600 hover:text-purple-700 font-medium"
                >
                  View all {pendingReviews.length} reviews →
                </button>
              </div>
            )}
          </div>

          {/* Today's Schedule */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="p-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                Today's Schedule
              </h3>
            </div>
            {scheduleAppointments.length > 0 ? (
              <div className="divide-y divide-gray-100 max-h-60 overflow-y-auto">
                {scheduleAppointments.map((apt) => (
                  <div key={apt.id} className="p-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 w-12">{apt.time}</span>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{apt.patientName}</p>
                          <p className="text-xs text-gray-500">{apt.reason}</p>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                        apt.status === 'in-progress' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {apt.status === 'in-progress' ? 'Active' : apt.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm">
                No appointments today
              </div>
            )}
            <div className="p-3 border-t border-gray-100">
              <button
                onClick={() => navigate('/doctor/schedule')}
                className="w-full text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View full schedule →
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/patients')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <Users className="w-4 h-4 text-gray-400" />
                Search Patients
              </button>
              <button
                onClick={() => navigate('/doctor/prescriptions')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <FileText className="w-4 h-4 text-gray-400" />
                Prescription History
              </button>
              <button
                onClick={() => navigate('/doctor/results/lab')}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <FlaskConical className="w-4 h-4 text-gray-400" />
                Lab Results Lookup
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
