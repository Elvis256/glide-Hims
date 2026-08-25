import api from './api';
import { useAuthStore } from '../store/auth';

// Insurance Provider
export interface InsuranceProvider {
  id: string;
  name: string;
  code: string;
  /** Server field is providerType; `type` was never sent. */
  providerType: 'private' | 'government' | 'corporate';
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateProviderDto {
  /** Required by the API; omitting it fails validation. */
  facilityId: string;
  name: string;
  code: string;
  /** Server field is providerType. Sending `type` rejected the whole create. */
  providerType?: 'private' | 'government' | 'corporate';
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
  patient?: {
    id: string;
    fullName: string;
    mrn: string;
  };
  policyNumber: string;
  memberNumber?: string;
  // This interface carried a phantom alias beside each real field —
  // principalName, relationship, coverageLimit, copayPercent, startDate and
  // endDate. None of them exist on the payload and, unlike billing.ts, this
  // service has no normaliser, so anything reading them got undefined. Only
  // the names the API actually sends are declared now.
  principalMemberNumber?: string;
  memberType?: 'principal' | 'spouse' | 'child' | 'dependent';
  coverageType: 'inpatient' | 'outpatient' | 'comprehensive' | 'maternity' | 'dental' | 'optical' | 'both';
  annualLimit?: number;
  usedAmount?: number;
  copayPercentage?: number;
  copayAmount?: number;
  effectiveDate?: string;
  expiryDate?: string;
  status: 'active' | 'inactive' | 'expired' | 'suspended' | 'pending' | 'cancelled';
  isVerified?: boolean;
  verifiedAt?: string;
  createdAt: string;
}

// Mirrors backend CreatePolicyDto — effectiveDate/expiryDate (NOT
// startDate/endDate) and memberNumber is REQUIRED.
export interface CreatePolicyDto {
  patientId: string;
  providerId: string;
  policyNumber: string;
  memberNumber: string;
  memberType?: string;
  principalMemberNumber?: string;
  employerName?: string;
  coverageType?: string;
  annualLimit?: number;
  copayPercentage?: number;
  effectiveDate: string;
  expiryDate: string;
}

// Pre-Authorization — mirrors pre-authorization.entity.ts
export interface PreAuth {
  id: string;
  policyId: string;
  policy?: InsurancePolicy;
  authNumber: string;
  authType: string;
  primaryDiagnosis?: string;
  clinicalJustification?: string;
  proposedTreatment?: string;
  estimatedCost: number;
  approvedAmount?: number | string;
  status: 'pending' | 'submitted' | 'approved' | 'denied' | 'expired';
  denialReason?: string;
  validUntil?: string;
  submittedAt?: string;
  processedAt?: string;
  createdAt: string;
}

// Mirrors backend CreatePreAuthDto (patientId/serviceType/notes do not exist
// there — forbidNonWhitelisted 400s them).
export interface CreatePreAuthDto {
  facilityId: string;
  policyId: string;
  authType: 'admission' | 'surgery' | 'procedure' | 'investigation' | 'maternity' | 'extension';
  primaryDiagnosis: string;
  diagnosisCode?: string;
  clinicalJustification: string;
  proposedTreatment: string;
  estimatedCost: number;
}

// Claim
// Mirrors insurance-claim.entity.ts (totalClaimed/totalApproved/denialReason —
// totalAmount/approvedAmount/rejectionReason never existed on the backend).
export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  policy?: InsurancePolicy;
  patientId: string;
  patient?: { id: string; fullName: string; mrn?: string };
  encounterId?: string;
  claimType?: string;
  serviceDate?: string;
  primaryDiagnosis?: string;
  totalClaimed: number | string;
  totalApproved?: number | string;
  totalPaid?: number | string;
  status:
    | 'draft'
    | 'submitted'
    | 'acknowledged'
    | 'in_review'
    | 'approved'
    | 'partially_approved'
    | 'rejected'
    | 'paid'
    | 'appealed'
    | 'cancelled';
  denialReason?: string;
  submittedAt?: string;
  processedAt?: string;
  paidAt?: string;
  createdAt: string;
}

// Mirrors backend CreateClaimDto (patientId/totalAmount are forbidden there).
export interface CreateClaimDto {
  facilityId: string;
  policyId: string;
  encounterId?: string;
  preAuthId?: string;
  claimType: 'outpatient' | 'inpatient' | 'maternity' | 'emergency' | 'surgical' | 'diagnostic';
  serviceDate: string;
  admissionDate?: string;
  dischargeDate?: string;
  primaryDiagnosis: string;
  diagnosisCode?: string;
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

// Mirrors backend CreateClaimItemDto — itemType and serviceDate are REQUIRED.
export interface CreateClaimItemDto {
  itemType: 'consultation' | 'procedure' | 'laboratory' | 'radiology' | 'pharmacy' | 'supplies' | string;
  serviceCode?: string;
  description: string;
  quantity?: number;
  unitPrice: number;
  serviceDate: string;
}

// Insurance encounter awaiting claim creation
export interface AwaitingClaimEncounter {
  encounterId: string;
  visitNumber: string;
  encounterType: string;
  encounterStatus: string;
  serviceDate: string;
  endDate?: string;
  patient: {
    id: string;
    mrn: string;
    fullName: string;
  };
  insurancePolicy: {
    id: string;
    policyNumber: string;
    memberNumber?: string;
  };
  provider: {
    id: string;
    name: string;
    code: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    totalAmount: number;
    itemCount: number;
  };
}

export const insuranceService = {
  // Coverage Check
  checkCoverage: async (data: {
    patientId: string;
    items: { drugId: string; quantity: number }[];
  }): Promise<{
    covered: boolean;
    coverageDetails: {
      drugId: string;
      covered: boolean;
      /** Exactly one of these is set — a share of the price, or a flat sum. */
      copayPercentage?: number;
      copayAmount?: number;
      requiresPreAuth: boolean;
      rejectionReason?: string;
    }[];
  }> => {
    const response = await api.post('/insurance/check-coverage', data);
    return response.data;
  },

  // Providers
  providers: {
    list: async (facilityId?: string): Promise<InsuranceProvider[]> => {
      const fId =
        facilityId ||
        sessionStorage.getItem('glide_active_facility_id') ||
        useAuthStore.getState().user?.facilityId;
      const response = await api.get<InsuranceProvider[]>('/insurance/providers', {
        params: { facilityId: fId },
      });
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
      // Nothing sets glide_active_facility_id — without the auth-store
      // fallback the list queried facilityId=null and came back empty.
      const facilityId =
        sessionStorage.getItem('glide_active_facility_id') ||
        useAuthStore.getState().user?.facilityId;
      const response = await api.get<PreAuth[]>('/insurance/pre-auth', {
        params: { facilityId, ...params },
      });
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
      const facilityId =
        sessionStorage.getItem('glide_active_facility_id') ||
        useAuthStore.getState().user?.facilityId;
      const response = await api.get<Claim[]>('/insurance/claims', {
        params: { facilityId, ...params },
      });
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
      // Backend ProcessClaimDto: approvedAmount required, denialReason optional
      const response = await api.post<Claim>(`/insurance/claims/${id}/reject`, {
        approvedAmount: 0,
        denialReason: reason,
      });
      return response.data;
    },
    recordPayment: async (id: string, amount: number, paymentDate: string, reference?: string): Promise<Claim> => {
      // Backend RecordPaymentDto: paidAmount + paymentReference (+ paymentDate)
      const response = await api.post<Claim>(`/insurance/claims/${id}/payment`, {
        paidAmount: amount,
        paymentReference: reference || 'N/A',
        paymentDate,
      });
      return response.data;
    },
  },

  // Encounters awaiting claims
  encounters: {
    getAwaitingClaims: async (params?: { providerId?: string; startDate?: string; endDate?: string }): Promise<AwaitingClaimEncounter[]> => {
      const facilityId = sessionStorage.getItem('glide_active_facility_id');
      const response = await api.get<AwaitingClaimEncounter[]>('/insurance/encounters/awaiting-claims', {
        params: { ...params, facilityId },
      });
      return response.data;
    },
    createClaimFromEncounter: async (encounterId: string): Promise<Claim> => {
      const facilityId = sessionStorage.getItem('glide_active_facility_id');
      const response = await api.post<Claim>(`/insurance/encounters/${encounterId}/create-claim`, null, {
        params: { facilityId },
      });
      return response.data;
    },
  },

  // Dashboard & Analytics
  dashboard: {
    get: async (facilityId?: string): Promise<any> => {
      const fId =
        facilityId ||
        sessionStorage.getItem('glide_active_facility_id') ||
        useAuthStore.getState().user?.facilityId;
      const response = await api.get('/insurance/dashboard', { params: { facilityId: fId } });
      return response.data;
    },
    getDenialsAnalysis: async (params: { startDate: string; endDate: string }): Promise<any> => {
      const facilityId = sessionStorage.getItem('glide_active_facility_id');
      const response = await api.get('/insurance/reports/denials-analysis', {
        params: { ...params, facilityId },
      });
      return response.data;
    },
    getProviderPerformance: async (params: { startDate: string; endDate: string }): Promise<any> => {
      const facilityId = sessionStorage.getItem('glide_active_facility_id');
      const response = await api.get('/insurance/reports/provider-performance', {
        params: { ...params, facilityId },
      });
      return response.data;
    },
  },

  // Batch operations
  batchSubmitClaims: async (encounterIds: string[]): Promise<{
    submitted: number;
    failed: number;
    errors: Array<{ encounterId: string; error: string }>;
  }> => {
    const facilityId = sessionStorage.getItem('glide_active_facility_id');
    const response = await api.post('/insurance/batch-submit', { encounterIds }, {
      params: { facilityId },
    });
    return response.data;
  },
};
