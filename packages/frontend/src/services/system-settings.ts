import api from './api';

// Interfaces
export interface SystemSetting {
  id: string;
  key: string;
  value: unknown;
  description?: string;
  tenantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertSettingDto {
  value: unknown;
  description?: string;
}

export const systemSettingsService = {
  list: (params?: { prefix?: string; tenantId?: string }) =>
    api.get<SystemSetting[]>('/settings', { params }),

  getByKey: (key: string, tenantId?: string) =>
    api.get<SystemSetting>(`/settings/${key}`, { params: { tenantId } }),

  getPublic: (key: string, tenantId?: string) =>
    api.get<SystemSetting>(`/settings/public/${key}`, { params: { tenantId } }),

  upsert: (key: string, data: UpsertSettingDto, tenantId?: string) =>
    api.put<{ message: string; data: SystemSetting }>(`/settings/${key}`, data, {
      params: { tenantId },
    }),

  delete: (key: string, tenantId?: string) =>
    api.delete<{ message: string }>(`/settings/${key}`, { params: { tenantId } }),
};

export default systemSettingsService;
