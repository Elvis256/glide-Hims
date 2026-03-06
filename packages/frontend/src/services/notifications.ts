import api from './api';

export interface InAppNotification {
  id: string;
  userId: string;
  facilityId?: string;
  type: string;
  title: string;
  message: string;
  referenceType?: string;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
}

export async function getNotifications(limit = 50, offset = 0): Promise<InAppNotification[]> {
  const { data } = await api.get('/notifications', { params: { limit, offset } });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get('/notifications/unread-count');
  return data.count;
}

export async function markAsRead(id: string): Promise<void> {
  await api.patch(`/notifications/${id}/read`);
}

export async function markAllAsRead(): Promise<void> {
  await api.patch('/notifications/read-all');
}
