import api from './api';

export interface Provider {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  providerType: string;
  specialty?: string;
  licenseNumber?: string;
  licenseExpiry?: string;
  npi?: string;
  phone?: string;
  email?: string;
  status: 'active' | 'inactive' | 'suspended';
  facilityId?: string;
  createdAt?: string;
}

export interface ProviderCredential {
  id: string;
  providerId: string;
  credentialType: string;
  credentialNumber: string;
  issuingAuthority: string;
  issueDate: string;
  expiryDate: string;
  status: 'active' | 'expired' | 'pending_renewal';
  verificationStatus?: 'verified' | 'unverified' | 'pending';
}

export const providersService = {
  list: async (params?: Record<string, any>): Promise<Provider[]> => {
    const response = await api.get('/providers', { params });
    return response.data?.data || response.data || [];
  },
  getById: async (id: string): Promise<Provider> => {
    const response = await api.get(`/providers/${id}`);
    return response.data;
  },
  create: async (data: Partial<Provider>): Promise<Provider> => {
    const response = await api.post('/providers', data);
    return response.data;
  },
  update: async (id: string, data: Partial<Provider>): Promise<Provider> => {
    const response = await api.patch(`/providers/${id}`, data);
    return response.data;
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
  getLicenseExpiry: async (): Promise<ProviderCredential[]> => {
    const response = await api.get('/providers/license-expiry');
    return response.data?.data || response.data || [];
  },
};
