import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Search,
  Filter,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Send,
  Loader2,
  Calendar,
} from 'lucide-react';
import { prescriptionsService, type RxNotificationLog } from '../../services/prescriptions';
import { toast } from 'sonner';

type StatusFilter = 'all' | 'sent' | 'delivered' | 'failed' | 'pending';
type TypeFilter = 'all' | 'ready' | 'refill_reminder' | 'collection_reminder';

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; className: string; bg: string }> = {
  sent: { icon: CheckCircle, className: 'text-green-600', bg: 'bg-green-50 text-green-700' },
  delivered: { icon: CheckCircle, className: 'text-green-700', bg: 'bg-green-100 text-green-800' },
  failed: { icon: XCircle, className: 'text-red-600', bg: 'bg-red-50 text-red-700' },
  pending: { icon: Clock, className: 'text-yellow-600', bg: 'bg-yellow-50 text-yellow-700' },
};

const TYPE_LABELS: Record<string, string> = {
  ready: 'Ready for Collection',
  refill_reminder: 'Refill Reminder',
  collection_reminder: 'Collection Reminder',
};

function getDefaultDateRange() {
  const dateTo = new Date().toISOString().split('T')[0];
  const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return { dateFrom, dateTo };
}

export default function NotificationLogPage() {
  const queryClient = useQueryClient();
  const defaults = getDefaultDateRange();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ['rx-notifications-all', statusFilter, typeFilter, dateFrom, dateTo],
    queryFn: () =>
      prescriptionsService.getAllNotifications({
        status: statusFilter === 'all' ? undefined : statusFilter,
        notificationType: typeFilter === 'all' ? undefined : typeFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const resendMutation = useMutation({
    mutationFn: (id: string) => prescriptionsService.resendNotification(id),
    onSuccess: (result: RxNotificationLog) => {
      if (result.status === 'sent') {
        toast.success('Notification resent successfully');
      } else {
        toast.error(`Resend failed: ${result.errorMessage || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['rx-notifications-all'] });
    },
    onError: () => toast.error('Failed to resend notification'),
  });

  const sentCount = notifications.filter((n) => n.status === 'sent' || n.status === 'delivered').length;
  const failedCount = notifications.filter((n) => n.status === 'failed').length;
  const pendingCount = notifications.filter((n) => n.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notification Log</h1>
          <p className="text-gray-500 mt-1">Track SMS notifications sent to patients</p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <CheckCircle className="w-5 h-5" />
            <span className="text-2xl font-bold">{sentCount}</span>
          </div>
          <p className="text-sm text-green-600 mt-1">Sent / Delivered</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <div className="flex items-center gap-2 text-red-700">
            <XCircle className="w-5 h-5" />
            <span className="text-2xl font-bold">{failedCount}</span>
          </div>
          <p className="text-sm text-red-600 mt-1">Failed</p>
        </div>
        <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
          <div className="flex items-center gap-2 text-yellow-700">
            <Clock className="w-5 h-5" />
            <span className="text-2xl font-bold">{pendingCount}</span>
          </div>
          <p className="text-sm text-yellow-600 mt-1">Pending</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center bg-gray-50 rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="all">All Types</option>
            <option value="ready">Ready for Collection</option>
            <option value="refill_reminder">Refill Reminder</option>
            <option value="collection_reminder">Collection Reminder</option>
          </select>
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="all">All Status</option>
          <option value="sent">Sent</option>
          <option value="delivered">Delivered</option>
          <option value="failed">Failed</option>
          <option value="pending">Pending</option>
        </select>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded-lg px-3 py-2 text-sm bg-white"
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No notifications found</p>
          <p className="text-sm mt-1">Notifications will appear here when sent</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {notifications.map((n) => {
                  const statusCfg = STATUS_CONFIG[n.status] || STATUS_CONFIG.pending;
                  const StatusIcon = statusCfg.icon;
                  return (
                    <tr key={n.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {formatDate(n.createdAt)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs font-medium">
                          {TYPE_LABELS[n.notificationType] || n.notificationType}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="uppercase text-xs font-medium text-gray-500">{n.channel}</span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-600">
                        {n.phoneNumber}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusCfg.bg}`}>
                          <StatusIcon className="w-3 h-3" />
                          {n.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-gray-500" title={n.message}>
                        {n.message}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {n.status === 'failed' && (
                          <button
                            onClick={() => resendMutation.mutate(n.id)}
                            disabled={resendMutation.isPending}
                            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
                          >
                            {resendMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Send className="w-3 h-3" />
                            )}
                            Resend
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
