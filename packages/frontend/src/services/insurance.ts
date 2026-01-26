import api from './api';

// Insurance Provider
export interface InsuranceProvider {
  id: string;
  name: string;
  code: string;
  type: 'private' | 'government' | 'corporate';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateProviderDto {
  name: string;
  code: string;
  type: 'private' | 'government' | 'corporate';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

// Insurance Policy
export interface InsurancePolicy {
  id: string;
  patientId: string;
  providerId: string;
  provider?: InsuranceProvider;
  policyNumber: string;
  memberNumber?: string;
  principalName?: string;
  relationship?: string;
  coverageType: 'inpatient' | 'outpatient' | 'comprehensive' | 'maternity' | 'dental';
  coverageLimit?: number;
  usedAmount?: number;
  copayPercent?: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'inactive' | 'expired' | 'suspended';
  verifiedAt?: string;
  createdAt: string;
}

export interface CreatePolicyDto {
  patientId: string;
  providerId: string;
  policyNumber: string;
  memberNumber?: string;
  principalName?: string;
  relationship?: string;
  coverageType: 'inpatient' | 'outpatient' | 'comprehensive' | 'maternity' | 'dental';
  coverageLimit?: number;
  copayPercent?: number;
  startDate: string;
  endDate: string;
}

// Pre-Authorization
export interface PreAuth {
  id: string;
  policyId: string;
  policy?: InsurancePolicy;
  patientId: string;
  requestNumber: string;
  serviceType: string;
  estimatedCost: number;
  approvedAmount?: number;
  status: 'pending' | 'submitted' | 'approved' | 'denied' | 'expired';
  notes?: string;
  denialReason?: string;
  validUntil?: string;
  submittedAt?: string;
  processedAt?: string;
  createdAt: string;
}

export interface CreatePreAuthDto {
  policyId: string;
  patientId: string;
  serviceType: string;
  estimatedCost: number;
  notes?: string;
}

// Claim
export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  policy?: InsurancePolicy;
  patientId: string;
  encounterId?: string;
  totalAmount: number;
  approvedAmount?: number;
  paidAmount?: number;
  status: 'draft' | 'submitted' | 'processing' | 'approved' | 'rejected' | 'paid' | 'appealed';
  rejectionReason?: string;
  submittedAt?: string;
  processedAt?: string;
  paidAt?: string;
  createdAt: string;
}

export interface CreateClaimDto {
  policyId: string;
  patientId: string;
  encounterId?: string;
  totalAmount: number;
}

export interface ClaimItem {
  id: string;
  claimId: string;
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface CreateClaimItemDto {
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export const insuranceService = {
  // Providers
  providers: {
    list: async (): Promise<InsuranceProvider[]> => {
      const response = await api.get<InsuranceProvider[]>('/insurance/providers');
      return response.data;
    },
    getById: async (id: string): Promise<InsuranceProvider> => {
      const response = await api.get<InsuranceProvider>(`/insurance/providers/${id}`);
      return response.data;
    },
    create: async (data: CreateProviderDto): Promise<InsuranceProvider> => {
      const response = await api.post<InsuranceProvider>('/insurance/providers', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreateProviderDto>): Promise<InsuranceProvider> => {
      const response = await api.patch<InsuranceProvider>(`/insurance/providers/${id}`, data);
      return response.data;
    },
  },

  // Policies
  policies: {
    list: async (params?: { patientId?: string; status?: string }): Promise<InsurancePolicy[]> => {
      const response = await api.get<InsurancePolicy[]>('/insurance/policies', { params });
      return response.data;
    },
    getById: async (id: string): Promise<InsurancePolicy> => {
      const response = await api.get<InsurancePolicy>(`/insurance/policies/${id}`);
      return response.data;
    },
    getByPatient: async (patientId: string): Promise<InsurancePolicy[]> => {
      const response = await api.get<InsurancePolicy[]>(`/insurance/patients/${patientId}/policies`);
      return response.data;
    },
    create: async (data: CreatePolicyDto): Promise<InsurancePolicy> => {
      const response = await api.post<InsurancePolicy>('/insurance/policies', data);
      return response.data;
    },
    verify: async (id: string): Promise<InsurancePolicy> => {
      const response = await api.post<InsurancePolicy>(`/insurance/policies/${id}/verify`);
      return response.data;
    },
    updateStatus: async (id: string, status: InsurancePolicy['status']): Promise<InsurancePolicy> => {
      const response = await api.patch<InsurancePolicy>(`/insurance/policies/${id}/status`, { status });
      return response.data;
    },
  },

  // Pre-Authorization
  preAuth: {
    list: async (params?: { patientId?: string; status?: string }): Promise<PreAuth[]> => {
      const response = await api.get<PreAuth[]>('/insurance/pre-auth', { params });
      return response.data;
    },
    getById: async (id: string): Promise<PreAuth> => {
      const response = await api.get<PreAuth>(`/insurance/pre-auth/${id}`);
      return response.data;
    },
    create: async (data: CreatePreAuthDto): Promise<PreAuth> => {
      const response = await api.post<PreAuth>('/insurance/pre-auth', data);
      return response.data;
    },
    submit: async (id: string): Promise<PreAuth> => {
      const response = await api.post<PreAuth>(`/insurance/pre-auth/${id}/submit`);
      return response.data;
    },
    approve: async (id: string, approvedAmount: number, validUntil: string): Promise<PreAuth> => {
      const response = await api.post<PreAuth>(`/insurance/pre-auth/${id}/approve`, { approvedAmount, validUntil });
      return response.data;
    },
    deny: async (id: string, reason: string): Promise<PreAuth> => {
      const response = await api.post<PreAuth>(`/insurance/pre-auth/${id}/deny`, { reason });
      return response.data;
    },
  },

  // Claims
  claims: {
    list: async (params?: { patientId?: string; status?: string }): Promise<Claim[]> => {
      const response = await api.get<Claim[]>('/insurance/claims', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Claim> => {
      const response = await api.get<Claim>(`/insurance/claims/${id}`);
      return response.data;
    },
    create: async (data: CreateClaimDto): Promise<Claim> => {
      const response = await api.post<Claim>('/insurance/claims', data);
      return response.data;
    },
    addItem: async (claimId: string, item: CreateClaimItemDto): Promise<ClaimItem> => {
      const response = await api.post<ClaimItem>(`/insurance/claims/${claimId}/items`, item);
      return response.data;
    },
    submit: async (id: string): Promise<Claim> => {
      const response = await api.post<Claim>(`/insurance/claims/${id}/submit`);
      return response.data;
    },
    approve: async (id: string, approvedAmount: number): Promise<Claim> => {
      const response = await api.post<Claim>(`/insurance/claims/${id}/approve`, { approvedAmount });
      return response.data;
    },
    reject: async (id: string, reason: string): Promise<Claim> => {
      const response = await api.post<Claim>(`/insurance/claims/${id}/reject`, { reason });
      return response.data;
    },
    recordPayment: async (id: string, amount: number, paymentDate: string, reference?: string): Promise<Claim> => {
      const response = await api.post<Claim>(`/insurance/claims/${id}/payment`, { amount, paymentDate, reference });
      return response.data;
    },
  },
};

export default insuranceService;
