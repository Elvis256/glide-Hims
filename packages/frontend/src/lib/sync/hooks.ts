import { useState, useEffect, useCallback } from 'react';
import { getSyncStatus, subscribeSyncStatus, syncNow, getConflicts } from './syncManager';
import type { SyncStatus, SyncResult } from './syncManager';
import { getPendingCount } from './syncQueue';
import type { SyncConflictLocal } from './db';

/**
 * Hook to get current sync status
 */
export function useSyncStatus(): SyncStatus {
  const [status, setStatus] = useState<SyncStatus>({
    isOnline: navigator.onLine,
    isSyncing: false,
    pendingCount: 0,
    conflictCount: 0,
    lastSyncAt: null,
  });

  useEffect(() => {
    // Get initial status
    getSyncStatus().then(setStatus);

    // Subscribe to updates
    const unsubscribe = subscribeSyncStatus(setStatus);

    return unsubscribe;
  }, []);

  return status;
}

/**
 * Hook to trigger sync manually
 */
export function useSync(facilityId: string) {
  const status = useSyncStatus();
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerSync = useCallback(async () => {
    setError(null);
    try {
      const result = await syncNow(facilityId);
      setLastResult(result);
      if (!result.success || result.errors.length > 0) {
        setError(result.errors.join(', '));
      }
      return result;
    } catch (err: any) {
      setError(err.message || 'Sync failed');
      return null;
    }
  }, [facilityId]);

  return {
    ...status,
    triggerSync,
    lastResult,
    error,
  };
}

/**
 * Hook for pending changes count
 */
export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => getPendingCount().then(setCount);
    update();

    // Update every 5 seconds
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  return count;
}

/**
 * Hook for sync conflicts
 */
export function useSyncConflicts(): {
  conflicts: SyncConflictLocal[];
  refresh: () => Promise<void>;
  loading: boolean;
} {
  const [conflicts, setConflicts] = useState<SyncConflictLocal[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getConflicts();
      setConflicts(result);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { conflicts, refresh, loading };
}

/**
 * Hook for online status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
