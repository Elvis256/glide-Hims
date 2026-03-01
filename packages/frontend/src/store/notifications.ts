import { create } from 'zustand';
import type { InAppNotification } from '../services/inAppNotifications';

interface NotificationState {
  notifications: InAppNotification[];
  unreadCount: number;
  isOpen: boolean;
}

interface NotificationActions {
  addNotification: (notification: InAppNotification) => void;
  setNotifications: (notifications: InAppNotification[]) => void;
  setUnreadCount: (count: number) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  (set, get) => ({
    notifications: [],
    unreadCount: 0,
    isOpen: false,

    addNotification: (notification) =>
      set((state) => ({
        notifications: [notification, ...state.notifications].slice(0, 100),
        unreadCount: state.unreadCount + 1,
      })),

    setNotifications: (notifications) => set({ notifications }),

    setUnreadCount: (count) => set({ unreadCount: count }),

    markAsRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, isRead: true } : n,
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      })),

    markAllAsRead: () =>
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
        unreadCount: 0,
      })),

    setOpen: (open) => set({ isOpen: open }),
    toggleOpen: () => set((state) => ({ isOpen: !state.isOpen })),
  }),
);
