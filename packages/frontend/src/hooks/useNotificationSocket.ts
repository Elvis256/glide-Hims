import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';
import { inAppNotificationService, type InAppNotification } from '../services/inAppNotifications';

const NOTIFICATION_ICONS: Record<string, string> = {
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

export function useNotificationSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated, user } = useAuthStore();
  const { addNotification, setNotifications, setUnreadCount } = useNotificationStore();

  // Load existing notifications on mount
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    inAppNotificationService.getNotifications(50, 0).then((data) => {
      setNotifications(data.notifications);
    }).catch(() => {});

    inAppNotificationService.getUnreadCount().then((data) => {
      setUnreadCount(data.count);
    }).catch(() => {});
  }, [isAuthenticated, accessToken]);

  // WebSocket connection
  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const wsUrl = import.meta.env.VITE_API_URL
      ? new URL(import.meta.env.VITE_API_URL).origin
      : window.location.origin;

    const socket = io(`${wsUrl}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 3000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      // Join department room if user has a department
      if (user?.departmentId) {
        socket.emit('join-department', user.departmentId);
      }
    });

    socket.on('notification', (data: InAppNotification) => {
      addNotification(data);

      const icon = NOTIFICATION_ICONS[data.type] || '🔔';
      toast(data.title, {
        description: data.message,
        icon,
        duration: 6000,
        action: data.metadata?.patientId
          ? {
              label: 'View',
              onClick: () => {},
            }
          : undefined,
      });
    });

    socket.on('disconnect', () => {});

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);
}
