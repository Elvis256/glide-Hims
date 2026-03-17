import { useAuthStore } from '../store/auth';

// Default facility ID used as fallback when user context is unavailable
const DEFAULT_FACILITY_ID = 'a384ef80-c0c9-4d20-a198-fd646470c88f';

/**
 * Get the current user's facility ID from auth store.
 * Falls back to localStorage active facility, then default facility ID.
 */
export function getFacilityId(): string {
  const user = useAuthStore.getState().user;
  return user?.facilityId
    || sessionStorage.getItem('glide_active_facility_id')
    || DEFAULT_FACILITY_ID;
}

/**
 * React hook to get facility ID with reactivity.
 * Use this in components that need to re-render when facility changes.
 */
export function useFacilityId(): string {
  const user = useAuthStore((state) => state.user);
  return user?.facilityId
    || sessionStorage.getItem('glide_active_facility_id')
    || DEFAULT_FACILITY_ID;
}

export { DEFAULT_FACILITY_ID };
