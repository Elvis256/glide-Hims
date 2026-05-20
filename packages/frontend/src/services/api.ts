import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';
import { useAuthStore } from '../store/auth';
import { logger } from '../lib/logger';

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
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

function createRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to fallback
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// Custom event for session expiry notification
export const SESSION_EXPIRED_EVENT = 'session-expired';

const dispatchSessionExpired = () => {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, {
    detail: { message: 'Your session has expired. Please log in again.' }
  }));
};

// Request interceptor - attach facility/tenant context headers
// Auth is handled automatically via httpOnly cookies (no manual token attachment)
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { user } = useAuthStore.getState();
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

    if (config.headers && !config.headers['x-request-id']) {
      config.headers['x-request-id'] = createRequestId();
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Token refresh mutex to prevent concurrent refresh attempts
let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let refreshRejectSubscribers: ((error: any) => void)[] = [];

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
  refreshRejectSubscribers = [];
}

function onTokenRefreshFailed(error: any) {
  refreshRejectSubscribers.forEach((cb) => cb(error));
  refreshSubscribers = [];
  refreshRejectSubscribers = [];
}

function addRefreshSubscriber(
  resolve: (token: string) => void,
  reject: (error: any) => void,
) {
  refreshSubscribers.push(resolve);
  refreshRejectSubscribers.push(reject);
}

// Response interceptor – auto-unwrap backend StandardResponse envelope
// Backend wraps ALL responses in { statusCode, data, timestamp [, meta] }.
// Strip the envelope so every caller receives the real payload in response.data.
api.interceptors.response.use(
  (response) => {
    const body = response.data;
    if (
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      'statusCode' in body &&
      'timestamp' in body &&
      'data' in body
    ) {
      response.data = body.data;
      // Preserve pagination/meta envelope so callers can access total/totalPages/etc.
      (response as unknown as { meta?: unknown }).meta = (body as Record<string, unknown>).meta;
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept login/auth failures — let them bubble to the caller
      const url = originalRequest.url || '';
      if (url.includes('/auth/login') || url.includes('/auth/register')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      
      if (isRefreshing) {
        // Another refresh is in progress — wait for it to finish then retry
        return new Promise((resolve, reject) => {
          addRefreshSubscriber(
            (newToken: string) => {
              if (originalRequest.headers) {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
              }
              resolve(api(originalRequest));
            },
            (err: any) => {
              reject(err);
            },
          );
        });
      }

      // Attempt cookie-based refresh (httpOnly cookie is sent automatically)
      const hasAuth = useAuthStore.getState().isAuthenticated;
      if (hasAuth) {
        isRefreshing = true;
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
            withCredentials: true,
          });
          
          const refreshData = response.data?.data || response.data;
          const { user } = refreshData;
          if (user) {
            useAuthStore.getState().setUser(user);
          }
          
          isRefreshing = false;
          onTokenRefreshed('cookie');
          
          // Retry with cookies (no Authorization header needed)
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          onTokenRefreshFailed(refreshError);
          
          // Token refresh failed - session expired
          dispatchSessionExpired();
          useAuthStore.getState().logout();
          const kind = localStorage.getItem('glide_login_kind');
          const slug = localStorage.getItem('glide_tenant_slug');
          localStorage.removeItem('glide_tenant_slug');
          localStorage.removeItem('glide_active_tenant_id');
          if (kind === 'system') {
            window.location.href = '/system/login?expired=true';
          } else {
            window.location.href = slug ? `/login/${slug}?expired=true` : '/login?expired=true';
          }
          
          return Promise.reject(refreshError);
        }
      } else {
        // Not authenticated - redirect to login
        useAuthStore.getState().logout();
        const kind = localStorage.getItem('glide_login_kind');
        const slug = localStorage.getItem('glide_tenant_slug');
        localStorage.removeItem('glide_tenant_slug');
        localStorage.removeItem('glide_active_tenant_id');
        if (kind === 'system') {
          window.location.href = '/system/login';
        } else {
          window.location.href = slug ? `/login/${slug}` : '/login';
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

    // Log all API errors (except 401 which is handled above).
    // We deliberately do NOT pass `error.response.data` here: response
    // bodies routinely contain PHI (patient names, MRNs, claim payloads,
    // validation error messages echoing back submitted fields) and the
    // logger holds a 200-entry circular buffer that can be scraped via
    // DevTools. Status + method + URL is enough for triage; full
    // payloads stay in the network panel only.
    if (error.response?.status !== 401) {
      logger.apiError(
        originalRequest?.method || 'UNKNOWN',
        originalRequest?.url || 'unknown',
        error.response?.status,
        undefined,
        error,
      );
    }
    
    return Promise.reject(error);
  }
);

export default api;
