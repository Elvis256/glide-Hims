import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addDays, isPast, isToday, isTomorrow, differenceInDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Bell,
  Send,
  Clock,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Search,
  Filter,
  Phone,
  Mail,
  MessageSquare,
  Loader2,
  X,
  Users,
  RefreshCw,
  History,
} from 'lucide-react';
import { chronicCareService, notificationsService } from '../../services/chronic-care';
import type { ChronicPatient, ChronicStatus } from '../../services/chronic-care';
import { useFacilityId } from '../../lib/facility';

const statusColors: Record<ChronicStatus, { bg: string; text: string }> = {
  active: { bg: 'bg-blue-100', text: 'text-blue-700' },
  controlled: { bg: 'bg-green-100', text: 'text-green-700' },
  uncontrolled: { bg: 'bg-red-100', text: 'text-red-700' },
  in_remission: { bg: 'bg-purple-100', text: 'text-purple-700' },
  resolved: { bg: 'bg-gray-100', text: 'text-gray-700' },
};

type Tab = 'overdue' | 'today' | 'upcoming' | 'history';

export default function ChronicRemindersPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('overdue');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [reminderMessage, setReminderMessage] = useState({
    subject: 'Follow-up Reminder',
    message: 'Dear {patientName}, this is a reminder for your chronic care follow-up appointment. Please contact us to schedule your visit.',
    channel: 'both' as 'email' | 'sms' | 'whatsapp' | 'both',
  });

  // Fetch all chronic patients
  const { data: patientsData, isLoading } = useQuery({
    queryKey: ['chronic-patients', facilityId],
    queryFn: () => chronicCareService.getPatients(facilityId, { limit: 500 }),
    enabled: !!facilityId,
  });

  // Fetch reminder history
  const { data: reminderHistory = [] } = useQuery({
    queryKey: ['reminder-history', facilityId],
    queryFn: () => notificationsService.getHistory(facilityId, undefined, 50),
    enabled: !!facilityId && activeTab === 'history',
  });

  const patients = patientsData?.data || [];

  // Categorize patients
  const overdue = patients.filter(p => p.nextFollowUp && isPast(new Date(p.nextFollowUp)) && !isToday(new Date(p.nextFollowUp)));
  const today = patients.filter(p => p.nextFollowUp && isToday(new Date(p.nextFollowUp)));
  const upcoming = patients.filter(p => {
    if (!p.nextFollowUp) return false;
    const date = new Date(p.nextFollowUp);
    return !isPast(date) && !isToday(date) && differenceInDays(date, new Date()) <= 7;
  });

  const getPatientsByTab = () => {
    switch (activeTab) {
      case 'overdue': return overdue;
      case 'today': return today;
      case 'upcoming': return upcoming;
      default: return [];
    }
  };

  const filteredPatients = getPatientsByTab().filter(p =>
    p.patient.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.patient.mrn.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Send single reminder
  const sendReminderMutation = useMutation({
    mutationFn: (conditionId: string) => chronicCareService.sendReminder(facilityId, conditionId),
    onSuccess: () => {
      toast.success('Reminder sent successfully');
      queryClient.invalidateQueries({ queryKey: ['chronic-patients'] });
    },
    onError: () => toast.error('Failed to send reminder'),
  });

  // Send bulk reminders
  const bulkReminderMutation = useMutation({
    mutationFn: () => chronicCareService.sendBulkReminders(facilityId, {
      patientIds: selectedPatients,
      subject: reminderMessage.subject,
      message: reminderMessage.message,
      channel: reminderMessage.channel,
    }),
    onSuccess: (result) => {
      toast.success(`Sent ${result.sent} reminders successfully`);
      setShowBulkModal(false);
      setSelectedPatients([]);
      queryClient.invalidateQueries({ queryKey: ['chronic-patients'] });
      queryClient.invalidateQueries({ queryKey: ['reminder-history'] });
    },
    onError: () => toast.error('Failed to send reminders'),
  });

  // Record visit (mark as seen)
  const recordVisitMutation = useMutation({
    mutationFn: ({ id, nextDate }: { id: string; nextDate?: string }) => 
      chronicCareService.recordVisit(id, nextDate),
    onSuccess: () => {
      toast.success('Visit recorded');
      queryClient.invalidateQueries({ queryKey: ['chronic-patients'] });
    },
    onError: () => toast.error('Failed to record visit'),
  });

  const togglePatient = (patientId: string) => {
    setSelectedPatients(prev =>
      prev.includes(patientId)
        ? prev.filter(id => id !== patientId)
        : [...prev, patientId]
    );
  };

  const selectAll = () => {
    const currentPatients = getPatientsByTab();
    if (selectedPatients.length === currentPatients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(currentPatients.map(p => p.patientId));
    }
  };

  const getDaysOverdue = (date: string) => {
    const days = differenceInDays(new Date(), new Date(date));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const getDaysUntil = (date: string) => {
    const days = differenceInDays(new Date(date), new Date());
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-100 rounded-lg">
            <Bell className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Follow-up Reminders</h1>
            <p className="text-sm text-gray-500">Send reminders to chronic care patients</p>
          </div>
        </div>
        {selectedPatients.length > 0 && (
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
          >
            <Send className="w-4 h-4" />
            Send to {selectedPatients.length} Patients
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <button
          onClick={() => setActiveTab('overdue')}
          className={`bg-white rounded-lg border p-4 text-left transition-all ${
            activeTab === 'overdue' ? 'ring-2 ring-red-500 border-red-200' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Overdue</p>
              <p className="text-2xl font-bold text-red-600">{overdue.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
        </button>
        <button
          onClick={() => setActiveTab('today')}
          className={`bg-white rounded-lg border p-4 text-left transition-all ${
            activeTab === 'today' ? 'ring-2 ring-amber-500 border-amber-200' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Due Today</p>
              <p className="text-2xl font-bold text-amber-600">{today.length}</p>
            </div>
            <Clock className="w-8 h-8 text-amber-400" />
          </div>
        </button>
        <button
          onClick={() => setActiveTab('upcoming')}
          className={`bg-white rounded-lg border p-4 text-left transition-all ${
            activeTab === 'upcoming' ? 'ring-2 ring-blue-500 border-blue-200' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Next 7 Days</p>
              <p className="text-2xl font-bold text-blue-600">{upcoming.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-400" />
          </div>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`bg-white rounded-lg border p-4 text-left transition-all ${
            activeTab === 'history' ? 'ring-2 ring-gray-500 border-gray-200' : ''
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Sent History</p>
              <p className="text-2xl font-bold text-gray-600">{reminderHistory.length}</p>
            </div>
            <History className="w-8 h-8 text-gray-400" />
          </div>
        </button>
      </div>

      {/* Filters */}
      {activeTab !== 'history' && (
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or MRN..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selectedPatients.length === getPatientsByTab().length && getPatientsByTab().length > 0}
              onChange={selectAll}
              className="rounded border-gray-300 text-amber-600"
            />
            Select All
          </label>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
        </div>
      ) : activeTab === 'history' ? (
        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Recent Reminders Sent</h3>
          </div>
          {reminderHistory.length === 0 ? (
            <div className="p-12 text-center">
              <History className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No reminders sent yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {reminderHistory.map((item: any, idx: number) => (
                <div key={idx} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{item.patientName || 'Unknown Patient'}</p>
                      <p className="text-sm text-gray-500">{item.message?.slice(0, 60)}...</p>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.status === 'sent' ? 'bg-green-100 text-green-700' :
                        item.status === 'failed' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {item.status || 'Sent'}
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.createdAt ? format(new Date(item.createdAt), 'dd/MM/yyyy HH:mm') : ''}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {activeTab === 'overdue' ? 'No overdue follow-ups!' :
             activeTab === 'today' ? 'No follow-ups due today' :
             'No upcoming follow-ups in the next 7 days'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">
                  <input
                    type="checkbox"
                    checked={selectedPatients.length === filteredPatients.length && filteredPatients.length > 0}
                    onChange={selectAll}
                    className="rounded border-gray-300 text-amber-600"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Follow-up</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPatients.map((patient) => {
                const isOverdue = patient.nextFollowUp && isPast(new Date(patient.nextFollowUp));
                return (
                  <tr key={patient.id} className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedPatients.includes(patient.patientId)}
                        onChange={() => togglePatient(patient.patientId)}
                        className="rounded border-gray-300 text-amber-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{patient.patient.fullName}</div>
                      <div className="text-xs text-gray-500">MRN: {patient.patient.mrn}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-rose-600">{patient.diagnosis.name}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[patient.status].bg} ${statusColors[patient.status].text}`}>
                        {patient.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {patient.nextFollowUp && (
                        <div>
                          <div className={`font-medium ${isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
                            {format(new Date(patient.nextFollowUp), 'dd/MM/yyyy')}
                          </div>
                          <div className={`text-xs ${isOverdue ? 'text-red-500' : 'text-gray-500'}`}>
                            {isOverdue ? getDaysOverdue(patient.nextFollowUp) : getDaysUntil(patient.nextFollowUp)}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {patient.patient.phone && (
                          <a href={`tel:${patient.patient.phone}`} className="p-1 hover:bg-green-100 rounded text-green-600" title={patient.patient.phone}>
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                        {patient.patient.email && (
                          <a href={`mailto:${patient.patient.email}`} className="p-1 hover:bg-blue-100 rounded text-blue-600" title={patient.patient.email}>
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => sendReminderMutation.mutate(patient.id)}
                          disabled={sendReminderMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1 bg-amber-100 text-amber-700 rounded hover:bg-amber-200 text-sm"
                          title="Send Reminder"
                        >
                          <Send className="w-3 h-3" />
                          Remind
                        </button>
                        <button
                          onClick={() => {
                            const nextDate = format(addDays(new Date(), patient.followUpIntervalDays), 'yyyy-MM-dd');
                            recordVisitMutation.mutate({ id: patient.id, nextDate });
                          }}
                          disabled={recordVisitMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 text-sm"
                          title="Mark as Seen"
                        >
                          <CheckCircle className="w-3 h-3" />
                          Seen
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Reminder Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Send Bulk Reminders</h2>
              <button onClick={() => setShowBulkModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  Sending reminders to <strong>{selectedPatients.length}</strong> patients
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
                <div className="flex items-center gap-4">
                  {[
                    { value: 'sms', label: 'SMS', icon: Phone },
                    { value: 'email', label: 'Email', icon: Mail },
                    { value: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
                    { value: 'both', label: 'All', icon: Send },
                  ].map(ch => (
                    <label key={ch.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="channel"
                        value={ch.value}
                        checked={reminderMessage.channel === ch.value}
                        onChange={(e) => setReminderMessage(prev => ({ ...prev, channel: e.target.value as any }))}
                        className="text-amber-600"
                      />
                      <ch.icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm">{ch.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                <input
                  type="text"
                  value={reminderMessage.subject}
                  onChange={(e) => setReminderMessage(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={reminderMessage.message}
                  onChange={(e) => setReminderMessage(prev => ({ ...prev, message: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 border rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Variables: {'{patientName}'}, {'{hospitalName}'}, {'{appointmentDate}'}
                </p>
              </div>
            </div>
            <div className="border-t px-6 py-4 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => bulkReminderMutation.mutate()}
                disabled={bulkReminderMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
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
