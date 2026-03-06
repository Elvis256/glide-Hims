import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../store/auth';
import { useNotificationStore } from '../store/notifications';
import { getNotifications, getUnreadCount } from '../services/notifications';

const SOCKET_URL = (import.meta.env.VITE_API_URL || '/api/v1').replace('/api/v1', '');

export function useNotificationSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { accessToken, isAuthenticated } = useAuthStore();
  const { addNotification, setNotifications, setUnreadCount } = useNotificationStore();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Fetch initial data
    getNotifications(50, 0)
      .then(setNotifications)
      .catch(() => {});
    getUnreadCount()
      .then(setUnreadCount)
      .catch(() => {});

    // Connect socket
    const socket = io(`${SOCKET_URL}/notifications`, {
      auth: { token: accessToken },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    });

    socket.on('connect', () => {
      console.log('[Notifications] WebSocket connected');
    });

    socket.on('notification', (notification) => {
      addNotification(notification);
    });

    socket.on('disconnect', (reason) => {
      console.log('[Notifications] WebSocket disconnected:', reason);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, accessToken]);
}
