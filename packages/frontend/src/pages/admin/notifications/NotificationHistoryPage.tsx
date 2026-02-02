import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Clock,
  Search,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  User,
  Send,
} from 'lucide-react';
import { format } from 'date-fns';
import api from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';

interface Reminder {
  id: string;
  patientId: string;
  patient?: {
    fullName: string;
    mrn: string;
    phone?: string;
    email?: string;
  };
  type: string;
  channel: string;
  status: string;
  subject: string;
  message: string;
  scheduledFor: string;
  sentAt?: string;
  errorMessage?: string;
  retryCount: number;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-green-100 text-green-800',
  delivered: 'bg-blue-100 text-blue-800',
  read: 'bg-purple-100 text-purple-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const channelIcons: Record<string, React.ReactNode> = {
  email: <Mail className="w-4 h-4" />,
  sms: <Phone className="w-4 h-4" />,
  whatsapp: <MessageSquare className="w-4 h-4 text-green-600" />,
  both: <><Phone className="w-4 h-4" /><Mail className="w-4 h-4" /></>,
  all: <><Phone className="w-4 h-4" /><Mail className="w-4 h-4" /><MessageSquare className="w-4 h-4" /></>,
};

const typeLabels: Record<string, string> = {
  appointment: 'Appointment Reminder',
  follow_up: 'Follow-up Reminder',
  medication: 'Medication Reminder',
  lab_test: 'Lab Test Reminder',
  lab_result: 'Lab Results Ready',
  prescription_ready: 'Prescription Ready',
  chronic_checkup: 'Chronic Care Checkup',
  thank_you: 'Thank You Message',
  payment_reminder: 'Payment Reminder',
  discharge: 'Discharge Instructions',
  birthday: 'Birthday Wishes',
  custom: 'Custom Message',
};

export default function NotificationHistoryPage() {
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [channelFilter, setChannelFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: reminders = [], isLoading, refetch } = useQuery<Reminder[]>({
    queryKey: ['notification-history', facilityId],
    queryFn: async () => {
      const { data } = await api.get('/notifications/history', {
        params: { facilityId, limit: 500 },
      });
      return data;
    },
    enabled: !!facilityId,
  });

  // Filter reminders
  const filteredReminders = reminders.filter((r) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      if (!r.patient?.fullName.toLowerCase().includes(search) &&
          !r.patient?.mrn.toLowerCase().includes(search) &&
          !r.message.toLowerCase().includes(search)) {
        return false;
      }
    }
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (channelFilter !== 'all' && r.channel !== channelFilter) return false;
    if (dateFrom && new Date(r.createdAt) < new Date(dateFrom)) return false;
    if (dateTo && new Date(r.createdAt) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  // Statistics
  const stats = {
    total: reminders.length,
    sent: reminders.filter(r => r.status === 'sent' || r.status === 'delivered').length,
    pending: reminders.filter(r => r.status === 'pending').length,
    failed: reminders.filter(r => r.status === 'failed').length,
  };

  const exportCSV = () => {
    const headers = ['Date', 'Patient', 'MRN', 'Type', 'Channel', 'Status', 'Message'];
    const rows = filteredReminders.map(r => [
      format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
      r.patient?.fullName || 'Unknown',
      r.patient?.mrn || '',
      typeLabels[r.type] || r.type,
      r.channel,
      r.status,
      r.message.replace(/,/g, ';'),
    ]);
    
    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `notification-history-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <MessageSquare className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Notification History</h1>
            <p className="text-sm text-gray-500">View all sent SMS, WhatsApp, and Email notifications</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Send className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.sent}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Failed</p>
              <p className="text-2xl font-bold text-red-600">{stats.failed}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search patient, MRN, or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="sent">Sent</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            {Object.entries(typeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Channels</option>
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Email</option>
          </select>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <span>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date/Time</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Patient</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Channel</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Message</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Loading notifications...
                </td>
              </tr>
            ) : filteredReminders.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  No notifications found
                </td>
              </tr>
            ) : (
              filteredReminders.slice(0, 100).map((reminder) => (
                <tr key={reminder.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(reminder.createdAt), 'dd/MM/yyyy')}
                    </div>
                    <div className="text-xs text-gray-500">
                      {format(new Date(reminder.createdAt), 'HH:mm')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {reminder.patient?.fullName || 'Unknown'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {reminder.patient?.mrn}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-gray-900">
                      {typeLabels[reminder.type] || reminder.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {channelIcons[reminder.channel]}
                      <span className="text-sm text-gray-600 capitalize">{reminder.channel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600 max-w-xs truncate" title={reminder.message}>
                      {reminder.message}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusColors[reminder.status]}`}>
                      {reminder.status === 'sent' || reminder.status === 'delivered' ? (
                        <CheckCircle className="w-3 h-3" />
                      ) : reminder.status === 'failed' ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      {reminder.status}
                    </span>
                    {reminder.errorMessage && (
                      <div className="text-xs text-red-600 mt-1" title={reminder.errorMessage}>
                        {reminder.errorMessage.substring(0, 30)}...
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filteredReminders.length > 100 && (
          <div className="px-4 py-3 bg-gray-50 text-center text-sm text-gray-500">
            Showing 100 of {filteredReminders.length} notifications
          </div>
        )}
      </div>
    </div>
  );
}
