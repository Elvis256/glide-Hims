import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/auth';

// Session timeout configuration
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity
const WARNING_BEFORE_TIMEOUT_MS = 5 * 60 * 1000; // Show warning 5 minutes before timeout

interface UseSessionTimeoutOptions {
  onTimeout?: () => void;
  onWarning?: (remainingMs: number) => void;
  timeoutMs?: number;
  warningBeforeMs?: number;
}

/**
 * Hook to manage session timeout due to inactivity
 * Auto-logs out user after period of inactivity
 */
export function useSessionTimeout(options: UseSessionTimeoutOptions = {}) {
  const {
    onTimeout,
    onWarning,
    timeoutMs = SESSION_TIMEOUT_MS,
    warningBeforeMs = WARNING_BEFORE_TIMEOUT_MS,
  } = options;

  const { isAuthenticated, logout } = useAuthStore();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  const handleTimeout = useCallback(() => {
    console.log('[SESSION] Session timed out due to inactivity');
    if (onTimeout) {
      onTimeout();
    } else {
      logout();
      // Redirect will happen via ProtectedRoute
    }
  }, [logout, onTimeout]);

  const handleWarning = useCallback(() => {
    if (onWarning) {
      onWarning(warningBeforeMs);
    } else {
      // Default warning behavior - could show a modal
      console.warn('[SESSION] Session will expire in', warningBeforeMs / 1000 / 60, 'minutes');
    }
  }, [onWarning, warningBeforeMs]);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();

    // Clear existing timers
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);

    if (!isAuthenticated) return;

    // Set warning timer
    warningRef.current = setTimeout(() => {
      handleWarning();
    }, timeoutMs - warningBeforeMs);

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      handleTimeout();
    }, timeoutMs);
  }, [isAuthenticated, timeoutMs, warningBeforeMs, handleTimeout, handleWarning]);

  useEffect(() => {
    if (!isAuthenticated) {
      // Clear timers when not authenticated
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      return;
    }

    // Activity events to track
    const activityEvents = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle reset to avoid excessive calls
    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        throttleTimeout = null;
        resetTimer();
      }, 1000); // Only reset at most once per second
    };

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, throttledReset);
    });

    // Initial timer setup
    resetTimer();

    // Cleanup
    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, throttledReset);
      });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isAuthenticated, resetTimer]);

  return {
    resetTimer,
    lastActivity: lastActivityRef.current,
  };
}

export default useSessionTimeout;
