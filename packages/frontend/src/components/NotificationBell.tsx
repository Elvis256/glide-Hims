import { useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '../store/notifications';
import { inAppNotificationService } from '../services/inAppNotifications';

const TYPE_ICONS: Record<string, string> = {
  PATIENT_QUEUED: '🏥',
  PATIENT_TRANSFERRED: '🔄',
  PATIENT_CALLED: '📢',
  LAB_ORDER_CREATED: '🧪',
  LAB_SAMPLE_COLLECTED: '🧫',
  LAB_RESULT_READY: '📋',
  RADIOLOGY_ORDER_CREATED: '📡',
  RADIOLOGY_RESULT_READY: '🩻',
  PRESCRIPTION_CREATED: '💊',
  PRESCRIPTION_DISPENSED: '✅',
  INVOICE_CREATED: '💰',
  ENCOUNTER_STATUS_CHANGED: '🔔',
  GENERAL: '🔔',
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const { notifications, unreadCount, isOpen, toggleOpen, setOpen, markAsRead, markAllAsRead } =
    useNotificationStore();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: string) => {
    markAsRead(id);
    try {
      await inAppNotificationService.markAsRead(id);
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    markAllAsRead();
    try {
      await inAppNotificationService.markAllAsRead();
    } catch {}
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={toggleOpen}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-h-[500px] bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[420px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <Bell className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.isRead && handleMarkAsRead(n.id)}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 cursor-pointer transition-colors ${
                    n.isRead
                      ? 'bg-white hover:bg-gray-50'
                      : 'bg-blue-50 hover:bg-blue-100'
                  }`}
                >
                  <span className="text-lg mt-0.5 flex-shrink-0">
                    {TYPE_ICONS[n.type] || '🔔'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className={`text-sm truncate ${n.isRead ? 'text-gray-700' : 'text-gray-900 font-semibold'}`}>
                        {n.title}
                      </p>
                      {!n.isRead && (
                        <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full ml-2" />
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
