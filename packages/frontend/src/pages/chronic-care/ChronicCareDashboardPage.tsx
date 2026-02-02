import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  Users,
  AlertTriangle,
  Calendar,
  Search,
  Filter,
  Send,
  Phone,
  Mail,
  Clock,
  RefreshCw,
  ChevronRight,
  Heart,
  Loader2,
  CheckCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { chronicCareService, type ChronicPatient, type ChronicStatus } from '../../services/chronic-care';
import { useFacilityId } from '../../lib/facility';

const statusColors: Record<ChronicStatus, { bg: string; text: string; label: string }> = {
  active: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Active' },
  controlled: { bg: 'bg-green-100', text: 'text-green-700', label: 'Controlled' },
  uncontrolled: { bg: 'bg-red-100', text: 'text-red-700', label: 'Uncontrolled' },
  in_remission: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'In Remission' },
  resolved: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Resolved' },
};

export default function ChronicCareDashboardPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<ChronicStatus | 'all'>('all');
  const [conditionFilter, setConditionFilter] = useState<string>('all');
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState({ subject: '', message: '' });

  // Fetch dashboard stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['chronic-dashboard', facilityId],
    queryFn: () => chronicCareService.getDashboard(facilityId),
    enabled: !!facilityId,
  });

  // Fetch conditions list
  const { data: conditions = [] } = useQuery({
    queryKey: ['chronic-conditions'],
    queryFn: () => chronicCareService.getConditionsList(),
  });

  // Fetch patients
  const { data: patientsData, isLoading: patientsLoading } = useQuery({
    queryKey: ['chronic-patients', facilityId, searchTerm, statusFilter, conditionFilter, showOverdueOnly],
    queryFn: () => chronicCareService.getPatients(facilityId, {
      search: searchTerm || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      diagnosisId: conditionFilter !== 'all' ? conditionFilter : undefined,
      overdueFollowUp: showOverdueOnly || undefined,
      limit: 100,
    }),
    enabled: !!facilityId,
  });

  const patients = patientsData?.data || [];

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: (conditionId: string) => chronicCareService.sendReminder(facilityId, conditionId),
    onSuccess: () => {
      toast.success('Reminder sent successfully');
      queryClient.invalidateQueries({ queryKey: ['chronic-patients'] });
    },
    onError: () => toast.error('Failed to send reminder'),
  });

  // Bulk reminder mutation
  const bulkReminderMutation = useMutation({
    mutationFn: () => chronicCareService.sendBulkReminders(facilityId, {
      patientIds: selectedPatients,
      subject: bulkMessage.subject,
      message: bulkMessage.message,
      channel: 'both',
    }),
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} reminders, ${result.failed} failed`);
      setShowBulkModal(false);
      setSelectedPatients([]);
      setBulkMessage({ subject: '', message: '' });
    },
    onError: () => toast.error('Failed to send bulk reminders'),
  });

  const togglePatientSelection = (patientId: string) => {
    setSelectedPatients(prev => 
      prev.includes(patientId) 
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  const selectAllPatients = () => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map(p => p.patientId));
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <Heart className="w-6 h-6 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Chronic Care Dashboard</h1>
            <p className="text-sm text-gray-500">Monitor and manage chronic disease patients</p>
          </div>
        </div>
        {selectedPatients.length > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700"
          >
            <Send className="w-4 h-4" />
            Send Reminders ({selectedPatients.length})
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Chronic Patients</p>
              <p className="text-2xl font-bold">{statsLoading ? '...' : stats?.totalPatients || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Activity className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Patients</p>
              <p className="text-2xl font-bold">{statsLoading ? '...' : stats?.activePatients || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Overdue Follow-ups</p>
              <p className="text-2xl font-bold text-red-600">{statsLoading ? '...' : stats?.overdueFollowUps || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Upcoming (7 days)</p>
              <p className="text-2xl font-bold">{statsLoading ? '...' : stats?.upcomingFollowUps || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Condition Breakdown */}
      {stats?.conditionBreakdown && stats.conditionBreakdown.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <h3 className="font-semibold mb-3">Condition Breakdown</h3>
          <div className="flex flex-wrap gap-2">
            {stats.conditionBreakdown.map((item, idx) => (
              <div key={idx} className="px-3 py-1.5 bg-gray-100 rounded-full text-sm">
                <span className="font-medium">{item.condition}</span>
                <span className="ml-2 text-gray-500">({item.count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border p-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, MRN, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ChronicStatus | 'all')}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="controlled">Controlled</option>
            <option value="uncontrolled">Uncontrolled</option>
            <option value="in_remission">In Remission</option>
          </select>
          <select
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
          >
            <option value="all">All Conditions</option>
            {conditions.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showOverdueOnly}
              onChange={(e) => setShowOverdueOnly(e.target.checked)}
              className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            Overdue Only
          </label>
        </div>
      </div>

      {/* Patient List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">Chronic Patients Registry</h3>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedPatients.length === patients.length && patients.length > 0}
              onChange={selectAllPatients}
              className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            Select All
          </label>
        </div>

        {patientsLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
          </div>
        ) : patients.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No chronic patients found</p>
          </div>
        ) : (
          <div className="divide-y">
            {patients.map((patient) => {
              const isOverdue = patient.nextFollowUp && new Date(patient.nextFollowUp) < new Date();
              const status = statusColors[patient.status];

              return (
                <div
                  key={patient.id}
                  className={`p-4 hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <input
                      type="checkbox"
                      checked={selectedPatients.includes(patient.patientId)}
                      onChange={() => togglePatientSelection(patient.patientId)}
                      className="rounded border-gray-300 text-rose-600 focus:ring-rose-500"
                    />
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-gray-900">{patient.patient.fullName}</span>
                        <span className="text-sm text-gray-500">MRN: {patient.patient.mrn}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>
                          {status.label}
                        </span>
                        {isOverdue && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Overdue
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="font-medium text-rose-600">{patient.diagnosis.name}</span>
                        <span>Diagnosed: {new Date(patient.diagnosedDate).toLocaleDateString()}</span>
                        {patient.nextFollowUp && (
                          <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                            <Clock className="w-3 h-3 inline mr-1" />
                            Next: {new Date(patient.nextFollowUp).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {patient.patient.phone && (
                        <a
                          href={`tel:${patient.patient.phone}`}
                          className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                          title={patient.patient.phone}
                        >
                          <Phone className="w-4 h-4" />
                        </a>
                      )}
                      {patient.patient.email && (
                        <a
                          href={`mailto:${patient.patient.email}`}
                          className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200"
                          title={patient.patient.email}
                        >
                          <Mail className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => sendReminderMutation.mutate(patient.id)}
                        disabled={sendReminderMutation.isPending}
                        className="flex items-center gap-1 px-3 py-1.5 bg-rose-100 text-rose-600 rounded-lg hover:bg-rose-200 disabled:opacity-50"
                        title="Send Reminder"
                      >
                        <Send className="w-4 h-4" />
                        <span className="text-sm">Remind</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bulk Reminder Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold mb-4">Send Bulk Reminders</h3>
            <p className="text-sm text-gray-500 mb-4">
              Sending to {selectedPatients.length} patients via Email & SMS
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={bulkMessage.subject}
                  onChange={(e) => setBulkMessage(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Follow-up Reminder"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={bulkMessage.message}
                  onChange={(e) => setBulkMessage(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Dear patient, this is a reminder for your upcoming follow-up appointment..."
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkReminderMutation.mutate()}
                disabled={!bulkMessage.subject || !bulkMessage.message || bulkReminderMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50"
              >
                {bulkReminderMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Send Reminders
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
