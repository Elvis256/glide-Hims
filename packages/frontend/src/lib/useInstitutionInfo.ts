import { useQuery } from '@tanstack/react-query';
import { facilitiesService, type FacilityPublicInfo } from '../services/facilities';
import { useFacilityId } from './facility';

const DEFAULTS: FacilityPublicInfo = {
  name: 'Hospital',
  address: '',
  phone: '',
  email: '',
  logo: '',
  taxId: '',
};

/**
 * Fetches and caches institution public info (name, address, phone, logo, taxId).
 * Cached for 10 minutes to avoid redundant API calls across pages.
 */
export function useInstitutionInfo(): FacilityPublicInfo {
  const facilityId = useFacilityId();
  const { data } = useQuery({
    queryKey: ['institution-public-info', facilityId],
    queryFn: () => facilitiesService.getPublicInfo(facilityId),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
  return data || DEFAULTS;
}
