import api from './api';

export interface InAppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  senderName?: string;
  isRead: boolean;
  createdAt: string;
}

export const inAppNotificationService = {
  async getNotifications(limit = 50, offset = 0) {
    const { data } = await api.get('/in-app-notifications', {
      params: { limit, offset },
    });
    return data as { notifications: InAppNotification[]; total: number };
  },

  async getUnreadCount() {
    const { data } = await api.get('/in-app-notifications/unread-count');
    return data as { count: number };
  },

  async markAsRead(id: string) {
    await api.patch(`/in-app-notifications/${id}/read`);
  },

  async markAllAsRead() {
    await api.patch('/in-app-notifications/read-all');
  },
};
