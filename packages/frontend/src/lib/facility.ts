import { useAuthStore } from '../store/auth';

// Historical fallback used when neither the user record nor session storage
// has a facility. We keep this exported for backwards compatibility, but it
// is NOT used as a silent runtime default any more — silently filling a
// random UUID would mask "user has no facility assigned" bugs and could
// surface unrelated data. New code should treat an empty string as
// "facility unknown" and fail loudly (e.g. the API request errors with a
// clear message instead of returning a bogus empty list).
const DEFAULT_FACILITY_ID = 'a384ef80-c0c9-4d20-a198-fd646470c88f';

function resolveFacilityId(user: { facilityId?: string | null } | null | undefined): string {
  return (
    user?.facilityId ||
    sessionStorage.getItem('glide_active_facility_id') ||
    ''
  );
}

/**
 * Get the current user's facility ID from auth store.
 * Returns '' when no facility is known — callers must handle the empty
 * case (skip the query, or surface a clear "no facility selected" UX).
 */
export function getFacilityId(): string {
  return resolveFacilityId(useAuthStore.getState().user);
}

/**
 * React hook to get facility ID with reactivity.
 * Use this in components that need to re-render when facility changes.
 */
export function useFacilityId(): string {
  const user = useAuthStore((state) => state.user);
  return resolveFacilityId(user);
}

export { DEFAULT_FACILITY_ID };
