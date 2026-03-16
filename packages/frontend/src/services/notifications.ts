import api from './api';

export interface InAppNotification {
  id: string;
  targetUserId: string;
  facilityId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, any>;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(limit = 50, offset = 0): Promise<InAppNotification[]> {
  const page = Math.floor(offset / limit) + 1;
  const { data } = await api.get('/in-app-notifications', { params: { limit, page } });
  return data.data || data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/in-app-notifications/unread-count');
  return data.count;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/in-app-notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/in-app-notifications/read-all');
}
