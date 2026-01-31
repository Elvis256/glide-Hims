import { useAuthStore } from '../store/auth';

// Default facility ID used as fallback when user context is unavailable
const DEFAULT_FACILITY_ID = 'b94b30c8-f98e-4a70-825e-253224a1cb91';

/**
 * Get the current user's facility ID from auth store.
 * Falls back to default facility ID if not available.
 */
export function getFacilityId(): string {
  const user = useAuthStore.getState().user;
  return user?.facilityId || DEFAULT_FACILITY_ID;
}

/**
 * React hook to get facility ID with reactivity.
 * Use this in components that need to re-render when facility changes.
 */
export function useFacilityId(): string {
  const user = useAuthStore((state) => state.user);
  return user?.facilityId || DEFAULT_FACILITY_ID;
}

export { DEFAULT_FACILITY_ID };
