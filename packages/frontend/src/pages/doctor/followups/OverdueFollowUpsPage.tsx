import { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Phone,
  Mail,
  Calendar,
  CheckCircle,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Users,
  Building,
  Stethoscope,
  Send,
  Loader2,
} from 'lucide-react';
import { followUpsService, type FollowUp, type FollowUpStatus } from '../../../services/follow-ups';

type OverdueStatus = 'pending' | 'rescheduled' | 'unable-to-contact' | 'declined';
type SortOption = 'most-overdue' | 'recent';

interface OverdueFollowUp {
  id: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  originalDate: string;
  daysOverdue: number;
  reason: string;
  doctor: string;
  department: string;
  status: OverdueStatus;
}

// Map backend status to local UI status
const mapBackendStatus = (status: FollowUpStatus): OverdueStatus => {
  switch (status) {
    case 'rescheduled':
      return 'rescheduled';
    case 'cancelled':
      return 'declined';
    default:
      return 'pending';
  }
};

// Calculate days overdue from scheduled date
const calculateDaysOverdue = (scheduledDate: string): number => {
  const scheduled = new Date(scheduledDate);
  const today = new Date();
  const diffTime = today.getTime() - scheduled.getTime();
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
};

// Transform API follow-up to local interface
const transformFollowUp = (followUp: FollowUp): OverdueFollowUp => ({
  id: followUp.id,
  patientName: followUp.patient?.fullName || 'Unknown Patient',
  patientPhone: followUp.patient?.phone || 'N/A',
  patientEmail: followUp.patient?.email || 'N/A',
  originalDate: followUp.scheduledDate,
  daysOverdue: calculateDaysOverdue(followUp.scheduledDate),
  reason: followUp.reason || followUp.type.replace(/_/g, ' '),
  doctor: followUp.provider?.fullName || 'Unassigned',
  department: followUp.department?.name || 'General',
  status: mapBackendStatus(followUp.status),
});

const statusConfig: Record<OverdueStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Pending' },
  rescheduled: { bg: 'bg-green-100', text: 'text-green-700', label: 'Rescheduled' },
  'unable-to-contact': { bg: 'bg-red-100', text: 'text-red-700', label: 'Unable to Contact' },
  declined: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Declined' },
};

export default function OverdueFollowUpsPage() {
  const [followUps, setFollowUps] = useState<OverdueFollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('most-overdue');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OverdueStatus | 'all'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Fetch overdue follow-ups (missed status)
  useEffect(() => {
    const fetchOverdueFollowUps = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await followUpsService.findAll({ status: 'missed' });
        const transformed = data.map(transformFollowUp);
        setFollowUps(transformed);
      } catch (err) {
        setError('Failed to load overdue follow-ups');
        console.error('Error fetching overdue follow-ups:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOverdueFollowUps();
  }, []);

  const stats = useMemo(() => {
    const total = followUps.filter((f) => f.status === 'pending').length;
    const byDoctor = followUps.reduce((acc, f) => {
      if (f.status === 'pending') {
        acc[f.doctor] = (acc[f.doctor] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    const byDepartment = followUps.reduce((acc, f) => {
      if (f.status === 'pending') {
        acc[f.department] = (acc[f.department] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);
    return { total, byDoctor, byDepartment };
  }, [followUps]);

  const sortedFollowUps = useMemo(() => {
    let filtered = statusFilter === 'all' ? followUps : followUps.filter((f) => f.status === statusFilter);
    return [...filtered].sort((a, b) => {
      if (sortBy === 'most-overdue') {
        return b.daysOverdue - a.daysOverdue;
      }
      return a.daysOverdue - b.daysOverdue;
    });
  }, [followUps, sortBy, statusFilter]);

  const updateStatus = async (id: string, status: OverdueStatus) => {
    try {
      setActionLoading(id);
      if (status === 'rescheduled') {
        // For now, reschedule to tomorrow as a default
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        await followUpsService.reschedule(id, { 
          newDate: tomorrow.toISOString().split('T')[0],
          reason: 'Rescheduled from overdue follow-ups' 
        });
      } else if (status === 'declined') {
        await followUpsService.cancel(id, { cancellationReason: 'Patient declined' });
      }
      // Update local state
      setFollowUps((prev) =>
        prev.map((f) => (f.id === id ? { ...f, status } : f))
      );
    } catch (err) {
      console.error('Error updating status:', err);
      alert('Failed to update status');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (id: string) => {
    await updateStatus(id, 'rescheduled');
  };

  const handleCallPatient = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleSendReminder = async (id: string) => {
    try {
      setActionLoading(id);
      await followUpsService.sendReminders();
      alert('Reminder sent successfully!');
    } catch (err) {
      console.error('Error sending reminder:', err);
      alert('Failed to send reminder');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-500">Loading overdue follow-ups...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-8 h-8 text-orange-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Overdue Follow-Ups</h1>
            <p className="text-gray-500">Patients who missed their scheduled follow-up appointments</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="flex gap-4">
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border flex items-center gap-3">
            <Users className="w-5 h-5 text-orange-500" />
            <div>
              <p className="text-xs text-gray-500">Total Overdue</p>
              <p className="text-lg font-bold text-orange-600">{stats.total}</p>
            </div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border">
            <p className="text-xs text-gray-500 mb-1">By Doctor</p>
            <div className="flex gap-2">
              {Object.entries(stats.byDoctor).slice(0, 2).map(([doctor, count]) => (
                <span key={doctor} className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  {doctor.split(' ')[1]}: {count}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-lg px-4 py-3 shadow-sm border">
            <p className="text-xs text-gray-500 mb-1">By Department</p>
            <div className="flex gap-2">
              {Object.entries(stats.byDepartment).slice(0, 2).map(([dept, count]) => (
                <span key={dept} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                  {dept}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['all', 'pending', 'rescheduled', 'unable-to-contact', 'declined'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'All' : statusConfig[status].label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="most-overdue">Most Overdue</option>
            <option value="recent">Recent</option>
          </select>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-auto">
        <div className="space-y-3">
          {sortedFollowUps.map((followUp) => {
            const isExpanded = expandedId === followUp.id;

            return (
              <div
                key={followUp.id}
                className="bg-white rounded-xl shadow-sm border overflow-hidden"
              >
                {/* Main Row */}
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Overdue Badge */}
                      <div className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center ${
                        followUp.daysOverdue > 10 ? 'bg-red-100' : followUp.daysOverdue > 5 ? 'bg-orange-100' : 'bg-yellow-100'
                      }`}>
                        <span className={`text-xl font-bold ${
                          followUp.daysOverdue > 10 ? 'text-red-600' : followUp.daysOverdue > 5 ? 'text-orange-600' : 'text-yellow-600'
                        }`}>
                          {followUp.daysOverdue}
                        </span>
                        <span className="text-xs text-gray-500">days</span>
                      </div>

                      {/* Patient Info */}
                      <div>
                        <h3 className="font-semibold text-gray-900">{followUp.patientName}</h3>
                        <p className="text-sm text-gray-500">{followUp.reason}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Original: {new Date(followUp.originalDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <Stethoscope className="w-3 h-3" />
                            {followUp.doctor}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            {followUp.department}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Status Badge */}
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig[followUp.status].bg} ${statusConfig[followUp.status].text}`}>
                        {statusConfig[followUp.status].label}
                      </span>

                      {/* Quick Actions */}
                      {followUp.status === 'pending' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReschedule(followUp.id)}
                            disabled={actionLoading === followUp.id}
                            className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                            title="Reschedule"
                          >
                            {actionLoading === followUp.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RefreshCw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleCallPatient(followUp.patientPhone)}
                            className="p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                            title="Call Patient"
                          >
                            <Phone className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendReminder(followUp.id)}
                            disabled={actionLoading === followUp.id}
                            className="p-2 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
                            title="Send Reminder"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {/* Expand Button */}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : followUp.id)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Section */}
                {isExpanded && (
                  <div className="border-t bg-gray-50 p-4">
                    <div className="grid grid-cols-2 gap-6">
                      {/* Contact Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Contact Information</h4>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span>{followUp.patientPhone}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span>{followUp.patientEmail}</span>
                          </div>
                        </div>
                      </div>

                      {/* Update Status */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Update Status</h4>
                        <div className="flex gap-2 flex-wrap">
                          <button
                            onClick={() => updateStatus(followUp.id, 'rescheduled')}
                            disabled={actionLoading === followUp.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === followUp.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Rescheduled
                          </button>
                          <button
                            onClick={() => updateStatus(followUp.id, 'unable-to-contact')}
                            disabled={actionLoading === followUp.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Unable to Contact
                          </button>
                          <button
                            onClick={() => updateStatus(followUp.id, 'declined')}
                            disabled={actionLoading === followUp.id}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
                          >
                            <XCircle className="w-4 h-4" />
                            Declined
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
