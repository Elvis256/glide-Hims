import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../store/auth';

// Use relative URL to leverage Vite proxy, or fall back to env var for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Custom event for session expiry notification
export const SESSION_EXPIRED_EVENT = 'session-expired';

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
    detail: { message: 'Your session has expired. Please log in again.' }
  }));
};

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = useAuthStore.getState().accessToken;
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken } = response.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          // Token refresh failed - session expired
          dispatchSessionExpired();
          useAuthStore.getState().logout();
          
          // Small delay to show notification before redirect
          setTimeout(() => {
            window.location.href = '/login?expired=true';
          }, 100);
          
          return Promise.reject(refreshError);
        }
      } else {
        // No refresh token - not logged in or session expired
        const wasAuthenticated = useAuthStore.getState().isAuthenticated;
        useAuthStore.getState().logout();
        
        if (wasAuthenticated) {
          dispatchSessionExpired();
          setTimeout(() => {
            window.location.href = '/login?expired=true';
          }, 100);
        } else {
          window.location.href = '/login';
        }
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
