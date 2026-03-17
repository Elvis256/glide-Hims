import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth';

// Use relative URL to leverage Vite proxy, or fall back to env var for production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

/**
 * Extract a user-friendly error message from an API error response.
 * Works with Axios errors, standard errors, and unknown error types.
 */
export function getApiErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  if (axios.isAxiosError(error)) {
    // Try to get message from response body (NestJS format)
    const data = error.response?.data;
    if (data?.message) {
      // Handle validation errors with field-level details
      if (data.details && Array.isArray(data.details)) {
        return data.details
          .map((d: { field?: string; errors?: string[] }) =>
            d.errors?.join(', ') || ''
          )
          .filter(Boolean)
          .join('. ');
      }
      // Handle array of messages (validation errors)
      if (Array.isArray(data.message)) {
        return data.message.join(', ');
      }
      return data.message;
    }
    // Fallback to status text
    if (error.response?.statusText) {
      return error.response.statusText;
    }
    // Fallback to error message
    if (error.message) {
      return error.message;
    }
  }
  
  if (error instanceof Error) {
    return error.message;
  }
  
  if (typeof error === 'string') {
    return error;
  }
  
  return fallback;
}

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

// Request interceptor - add auth token and facility ID
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken, user } = useAuthStore.getState();
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    // Prefer the active facility chosen via FacilitySwitcher (sessionStorage),
    // falling back to the facility assigned at login time.
    const activeFacilityId =
      sessionStorage.getItem('glide_active_facility_id') || user?.facilityId;
    if (activeFacilityId && config.headers) {
      config.headers['x-facility-id'] = activeFacilityId;
    }
    // Send tenant context for multi-tenant isolation
    const tenantId =
      sessionStorage.getItem('glide_active_tenant_id') || user?.tenantId || user?.facility?.tenant?.id;
    if (tenantId && config.headers) {
      config.headers['x-tenant-id'] = tenantId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Token refresh mutex to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
  refreshSubscribers.push(cb);
}

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      if (isRefreshing) {
        // Another refresh is in progress — wait for it to finish then retry
        return new Promise((resolve) => {
          addRefreshSubscriber((newToken: string) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
            }
            resolve(api(originalRequest));
          });
        });
      }

      const refreshToken = useAuthStore.getState().refreshToken;
      if (refreshToken) {
        isRefreshing = true;
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refreshToken,
          });
          
          const { accessToken, refreshToken: newRefreshToken, user } = response.data;
          useAuthStore.getState().setTokens(accessToken, newRefreshToken);
          if (user) {
            useAuthStore.getState().setUser(user);
          }
          
          isRefreshing = false;
          onTokenRefreshed(accessToken);
          
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          }
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          refreshSubscribers = [];
          
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

    // 403 Forbidden - user lacks required permission/role
    if (error.response?.status === 403) {
      const data = error.response.data as Record<string, unknown> | undefined;
      const message = typeof data?.message === 'string'
        ? data.message
        : 'You do not have permission to perform this action.';
      toast.error('Access Denied', { description: message });
    }
    
    return Promise.reject(error);
  }
);

export default api;
