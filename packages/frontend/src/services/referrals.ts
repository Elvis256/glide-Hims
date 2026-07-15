import api from './api';

export type ReferralStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled' | 'expired';
export type ReferralPriority = 'routine' | 'urgent' | 'emergency';
export type ReferralType = 'internal' | 'external';

export interface ReferralPatient {
  id: string;
  mrn: string;
  fullName: string;
  gender: string;
  dateOfBirth: string;
}

export interface ReferralFacility {
  id: string;
  name: string;
  type?: string;
}

export interface ReferralUser {
  id: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}

export interface Referral {
  id: string;
  referralNumber: string;
  patientId: string;
  patient?: ReferralPatient;
  type: ReferralType;
  priority: ReferralPriority;
  status: ReferralStatus;
  reason: string;
  reasonDetails?: string;
  clinicalSummary: string;
  provisionalDiagnosis?: string;
  referringDepartment?: string;
  referredToDepartment?: string;
  referredToSpecialty?: string;
  fromFacilityId: string;
  fromFacility?: ReferralFacility;
  toFacilityId?: string;
  toFacility?: ReferralFacility;
  externalFacilityName?: string;
  externalFacilityAddress?: string;
  externalFacilityPhone?: string;
  referredById: string;
  referredBy?: ReferralUser;
  acceptedById?: string;
  acceptedBy?: ReferralUser;
  acceptedAt?: string;
  appointmentDate?: string;
  appointmentTime?: string;
  feedbackNotes?: string;
  rejectionReason?: string;
  completedAt?: string;
  expiryDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReferralFilter {
  status?: ReferralStatus;
  type?: ReferralType;
  priority?: ReferralPriority;
  patientId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface ReferralStats {
  incoming: number;
  outgoing: number;
  completed: number;
  pending: number;
}

export const referralsService = {
  // Get all referrals with optional filters
  getAll: async (filter?: ReferralFilter): Promise<Referral[]> => {
    const response = await api.get<Referral[]>('/referrals', { params: filter });
    return response.data;
  },

  // Get outgoing (sent) referrals for current facility
  getOutgoing: async (): Promise<Referral[]> => {
    const response = await api.get<Referral[]>('/referrals/outgoing');
    return response.data;
  },

  // Get incoming referrals for current facility.
  // Omit `status` for the full inbound list; pass one to filter. The backend
  // used to hardcode PENDING here, which made accepted referrals vanish.
  getIncoming: async (status?: ReferralStatus): Promise<Referral[]> => {
    const response = await api.get<Referral[]>('/referrals/incoming', {
      params: status ? { status } : undefined,
    });
    return Array.isArray(response.data) ? response.data : [];
  },

  // Accept an incoming referral (receiving facility only)
  accept: async (
    id: string,
    data: { appointmentDate?: string; appointmentTime?: string; notes?: string } = {},
  ): Promise<Referral> => {
    const response = await api.post<Referral>(`/referrals/${id}/accept`, data);
    return response.data;
  },

  // Reject an incoming referral (receiving facility only)
  reject: async (id: string, rejectionReason: string): Promise<Referral> => {
    const response = await api.post<Referral>(`/referrals/${id}/reject`, { rejectionReason });
    return response.data;
  },

  // Get referral by ID
  getById: async (id: string): Promise<Referral> => {
    const response = await api.get<Referral>(`/referrals/${id}`);
    return response.data;
  },

  // Get referrals by patient
  getByPatient: async (patientId: string): Promise<Referral[]> => {
    const response = await api.get<Referral[]>(`/referrals/patient/${patientId}`);
    return response.data;
  },

  // Get referral stats
  getStats: async (fromDate?: string, toDate?: string): Promise<ReferralStats> => {
    const params: Record<string, string> = {};
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const response = await api.get<ReferralStats>('/referrals/stats', { params });
    return response.data;
  },

  // Cancel a referral
  cancel: async (id: string, reason: string): Promise<Referral> => {
    const response = await api.post<Referral>(`/referrals/${id}/cancel`, { reason });
    return response.data;
  },

  // Mark a referral as completed (receiving facility only)
  complete: async (
    id: string,
    data: { feedbackNotes?: string; destinationEncounterId?: string } = {},
  ): Promise<Referral> => {
    const response = await api.post<Referral>(`/referrals/${id}/complete`, data);
    return response.data;
  },

  // Create a new referral
  create: async (data: {
    patientId: string;
    sourceEncounterId?: string;
    type: ReferralType;
    priority: ReferralPriority;
    reason: ReferralReasonValue;
    reasonDetails?: string;
    clinicalSummary: string;
    referredToDepartment?: string;
    referredToSpecialty?: string;
    externalFacilityName?: string;
    externalFacilityAddress?: string;
    externalFacilityPhone?: string;
    appointmentDate?: string;
    provisionalDiagnosis?: string;
  }): Promise<Referral> => {
    const response = await api.post<Referral>('/referrals', data);
    return response.data;
  },
};

// Backend ReferralReason enum values — keep in sync with referral.entity.ts
export type ReferralReasonValue =
  | 'specialist_consultation'
  | 'diagnostic_services'
  | 'surgical_intervention'
  | 'higher_level_care'
  | 'inpatient_admission'
  | 'maternity_care'
  | 'mental_health'
  | 'rehabilitation'
  | 'palliative_care'
  | 'other';

export default referralsService;
