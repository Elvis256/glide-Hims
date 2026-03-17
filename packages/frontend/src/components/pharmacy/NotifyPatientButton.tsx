import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { prescriptionsService, type RxNotificationLog } from '../../services/prescriptions';
import { toast } from 'sonner';

interface NotifyPatientButtonProps {
  prescriptionId: string;
  compact?: boolean;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_ICONS: Record<string, { icon: typeof CheckCircle; className: string }> = {
  sent: { icon: CheckCircle, className: 'text-green-500' },
  delivered: { icon: CheckCircle, className: 'text-green-600' },
  failed: { icon: XCircle, className: 'text-red-500' },
  pending: { icon: Clock, className: 'text-yellow-500' },
};

export default function NotifyPatientButton({ prescriptionId, compact = false }: NotifyPatientButtonProps) {
  const queryClient = useQueryClient();
  const [showHistory, setShowHistory] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ['rx-notifications', prescriptionId],
    queryFn: () => prescriptionsService.getPrescriptionNotifications(prescriptionId),
    enabled: showHistory,
  });

  const readyMutation = useMutation({
    mutationFn: () => prescriptionsService.notifyPrescriptionReady(prescriptionId),
    onSuccess: (result: RxNotificationLog) => {
      if (result.status === 'sent') {
        toast.success('SMS notification sent successfully');
      } else {
        toast.error(`Notification failed: ${result.errorMessage || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['rx-notifications', prescriptionId] });
    },
    onError: () => toast.error('Failed to send notification'),
  });

  const refillMutation = useMutation({
    mutationFn: () => prescriptionsService.notifyRefillReminder(prescriptionId),
    onSuccess: (result: RxNotificationLog) => {
      if (result.status === 'sent') {
        toast.success('Refill reminder sent');
      } else {
        toast.error(`Reminder failed: ${result.errorMessage || 'Unknown error'}`);
      }
      queryClient.invalidateQueries({ queryKey: ['rx-notifications', prescriptionId] });
    },
    onError: () => toast.error('Failed to send refill reminder'),
  });

  const lastNotification = notifications.length > 0 ? notifications[0] : null;

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1">
        <button
          onClick={() => readyMutation.mutate()}
          disabled={readyMutation.isPending}
          className={`flex items-center gap-1.5 rounded-lg font-medium transition ${
            compact
              ? 'px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100'
              : 'px-3 py-2 text-sm bg-blue-600 text-white hover:bg-blue-700'
          } disabled:opacity-50`}
          title="Send 'prescription ready' SMS"
        >
          {readyMutation.isPending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <MessageSquare className="w-3.5 h-3.5" />
          )}
          {!compact && 'Notify Patient'}
        </button>

        <button
          onClick={() => setShowHistory(!showHistory)}
          className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          title="View notification history"
        >
          {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* History dropdown */}
      {showHistory && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-lg border z-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Notification History</h4>
            <button
              onClick={() => refillMutation.mutate()}
              disabled={refillMutation.isPending}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-orange-50 text-orange-700 rounded hover:bg-orange-100 disabled:opacity-50"
            >
              {refillMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
              Refill Reminder
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No notifications sent yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {notifications.map((n) => {
                const statusInfo = STATUS_ICONS[n.status] || STATUS_ICONS.pending;
                const StatusIcon = statusInfo.icon;
                return (
                  <div key={n.id} className="flex items-start gap-2 text-xs border rounded-lg p-2 bg-gray-50">
                    <StatusIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${statusInfo.className}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-medium capitalize">{n.notificationType.replace('_', ' ')}</span>
                        <span className="text-gray-400">{formatDate(n.createdAt)}</span>
                      </div>
                      <p className="text-gray-500 truncate mt-0.5">{n.message}</p>
                      {n.errorMessage && (
                        <p className="text-red-500 mt-0.5">Error: {n.errorMessage}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {lastNotification && (
            <div className="mt-2 pt-2 border-t text-xs text-gray-400">
              Last sent: {formatDate(lastNotification.createdAt)} — {lastNotification.status}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
