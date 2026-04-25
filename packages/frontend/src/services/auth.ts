import api from './api';
import type { LoginRequest, LoginResponse, User } from '../types';

export const authService = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  refreshToken: async (): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/refresh', {});
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Ignore errors — cookies will expire naturally
    }
  },

  getProfile: async (): Promise<User> => {
    const response = await api.get<User>('/auth/profile');
    return response.data;
  },

  getMe: async (): Promise<{ accessibleModules: string[]; permissions: string[]; roles: string[]; facilityMode?: string; businessType?: string }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword });
  },

  enterTenant: async (tenantId: string): Promise<LoginResponse> => {
    const response = await api.post<LoginResponse>('/auth/enter-tenant', { tenantId });
    return response.data;
  },
};
