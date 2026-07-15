import api from './api';

/** Mirrors backend ProviderType (database/entities/provider.entity.ts).
 *  There is no 'doctor' member — a physician is 'physician'. */
export type ProviderType =
  | 'physician'
  | 'surgeon'
  | 'nurse'
  | 'midwife'
  | 'pharmacist'
  | 'lab_technician'
  | 'radiologist'
  | 'physiotherapist'
  | 'dentist'
  | 'clinical_officer'
  | 'specialist'
  | 'consultant'
  | 'intern'
  | 'other';

export interface Provider {
  id: string;
  userId?: string;
  /** The provider's own name column — always present.
   *  `user` is a nullable relation (userId is optional), so read fullName. */
  fullName: string;
  title?: string;
  user?: { id: string; fullName?: string; email?: string; phone?: string } | null;
  providerType: ProviderType;
  specialty?: string;
  subSpecialty?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  qualifications?: { degree: string; institution: string; year: number }[];
  phone?: string;
  email?: string;
  /** Mirrors backend ProviderStatus — was missing on_leave/terminated. */
  status: 'active' | 'inactive' | 'on_leave' | 'suspended' | 'terminated';
  registrationNumber?: string;
  regulatoryBody?: string;
  facilityId?: string;
  departmentId?: string;
  department?: { id: string; name: string };
  createdAt?: string;
}

export const providersService = {
  /** Params must match backend ProviderSearchDto exactly — the API runs
   *  forbidNonWhitelisted, so an unknown key (e.g. `type`) 400s the request. */
  list: async (params?: {
    search?: string;
    facilityId?: string;
    departmentId?: string;
    providerType?: ProviderType;
    specialty?: string;
    status?: Provider['status'];
    canPrescribe?: boolean;
  }): Promise<Provider[]> => {
    const response = await api.get('/providers', { params });
    return Array.isArray(response.data) ? response.data : response.data?.data || [];
  },
  getById: async (id: string): Promise<Provider> => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  },
  create: async (data: Partial<Provider>): Promise<Provider> => {
    const response = await api.post<{ message: string; data: Provider }>('/providers', data);
    return response.data.data;
  },
  update: async (id: string, data: Partial<Provider>): Promise<Provider> => {
    const response = await api.patch<{ message: string; data: Provider }>(`/providers/${id}`, data);
    return response.data.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/providers/${id}`);
  },
  getTypes: async (): Promise<string[]> => {
    const response = await api.get('/providers/types');
    return response.data;
  },
  getSpecialties: async (): Promise<string[]> => {
    const response = await api.get('/providers/specialties');
    return response.data;
  },
  /** Active providers whose licence expires within `daysAhead`.
   *  Returns Provider[] — there is no provider_credentials table; licence data
   *  lives on the provider itself. */
  getLicenseExpiry: async (daysAhead = 30, includeExpired = true): Promise<Provider[]> => {
    const response = await api.get('/providers/license-expiry', {
      params: { daysAhead, includeExpired },
    });
    return Array.isArray(response.data) ? response.data : [];
  },
};
