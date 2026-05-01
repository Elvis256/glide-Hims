/**
 * Phase D — Persistent offline mode banner.
 * Shows when navigator.onLine is false, with cache age and sync status.
 */
import { WifiOff, RefreshCw, AlertTriangle } from 'lucide-react';
import type { OfflineModeState } from '../hooks/useOfflineMode';

interface Props {
  state: OfflineModeState;
}

function formatAge(ms: number | null): string {
  if (ms === null) return 'never';
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function OfflineBanner({ state }: Props) {
  const { isOnline, cacheAge, isCacheStale, isRefreshingCache, cachedItemCount, refreshCache } =
    state;

  if (isOnline) return null;

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 bg-amber-500 px-4 py-2 text-sm text-white shadow-md">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span className="font-semibold">Offline mode</span>
      <span className="text-amber-100">— sales will sync when reconnected.</span>
      {isCacheStale && (
        <span className="flex items-center gap-1 text-amber-100">
          <AlertTriangle className="h-3 w-3" />
          Cache stale ({formatAge(cacheAge)})
        </span>
      )}
      {!isCacheStale && (
        <span className="text-amber-100 text-xs">
          {cachedItemCount} items cached · refreshed {formatAge(cacheAge)}
        </span>
      )}
      <span className="text-amber-100 text-xs ml-auto">
        Interaction check unavailable offline
      </span>
      <button
        onClick={refreshCache}
        disabled={isRefreshingCache || !isOnline}
        className="ml-2 flex items-center gap-1 rounded bg-amber-600 px-2 py-0.5 text-xs hover:bg-amber-700 disabled:opacity-50"
        title="Refresh item cache"
      >
        <RefreshCw className={`h-3 w-3 ${isRefreshingCache ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  );
}
