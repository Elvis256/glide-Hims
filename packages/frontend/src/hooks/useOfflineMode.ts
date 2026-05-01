/**
 * Phase D — Offline mode detection and cache management hook.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { offlineDb, setCacheRefreshed, getCacheAge, CACHE_TTL_MS, type CachedItem } from '../lib/offlineDb';
import { api } from '../services/api';

export interface OfflineModeState {
  isOnline: boolean;
  cacheAge: number | null; // ms since last cache refresh, null if never
  isCacheStale: boolean;
  isRefreshingCache: boolean;
  cachedItemCount: number;
  refreshCache: () => Promise<void>;
}

export function useOfflineMode(): OfflineModeState {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [isRefreshingCache, setIsRefreshingCache] = useState(false);
  const [cachedItemCount, setCachedItemCount] = useState(0);
  const refreshingRef = useRef(false);

  const updateCacheAge = useCallback(async () => {
    const age = await getCacheAge();
    setCacheAge(age);
    const count = await offlineDb.cachedItems.count();
    setCachedItemCount(count);
  }, []);

  const refreshCache = useCallback(async () => {
    if (refreshingRef.current || !navigator.onLine) return;
    refreshingRef.current = true;
    setIsRefreshingCache(true);
    try {
      let offset = 0;
      const limit = 200;
      const allItems: CachedItem[] = [];

      // Paginated fetch with 500ms throttle between pages
      while (true) {
        const res = await api.get('/pharmacy/items/sync-bundle', {
          params: { limit, offset },
        });
        const { items: page } = res.data as { items: CachedItem[]; total: number };
        if (!page || page.length === 0) break;

        const now = Date.now();
        for (const item of page) {
          allItems.push({ ...item, cachedAt: now });
        }
        if (page.length < limit) break;
        offset += limit;
        await new Promise((r) => setTimeout(r, 500));
      }

      // Atomic replace
      await offlineDb.transaction('rw', offlineDb.cachedItems, async () => {
        await offlineDb.cachedItems.clear();
        await offlineDb.cachedItems.bulkPut(allItems);
      });

      await setCacheRefreshed();
      await updateCacheAge();
    } catch {
      // Silently fail — we still have old cache if any
    } finally {
      refreshingRef.current = false;
      setIsRefreshingCache(false);
    }
  }, [updateCacheAge]);

  // Initial load
  useEffect(() => {
    updateCacheAge();
  }, [updateCacheAge]);

  // Online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Refresh cache on reconnect
      refreshCache();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshCache]);

  // Initial cache refresh on mount if online and stale
  useEffect(() => {
    if (navigator.onLine) {
      getCacheAge().then((age) => {
        const stale = age === null || age > CACHE_TTL_MS;
        if (stale) refreshCache();
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCacheStale = cacheAge === null || cacheAge > CACHE_TTL_MS;

  return {
    isOnline,
    cacheAge,
    isCacheStale,
    isRefreshingCache,
    cachedItemCount,
    refreshCache,
  };
}
