import api from './api';

export interface MembershipPlan {
  id: string;
  name: string;
  tier: 'basic' | 'silver' | 'gold' | 'platinum';
  monthlyFee: number;
  annualFee: number;
  discountPercent: number;
  familyMembers: number;
  benefits: string[];
  isActive: boolean;
  membersCount?: number;
  createdAt?: string;
}

export interface Membership {
  id: string;
  patientId: string;
  planId: string;
  plan?: MembershipPlan;
  membershipNumber: string;
  startDate: string;
  endDate?: string;
  status: 'active' | 'expired' | 'suspended' | 'cancelled';
  familyMembers?: Array<{ patientId: string; relationship: string }>;
  createdAt: string;
}

export interface CreateMembershipDto {
  patientId: string;
  planId: string;
  startDate: string;
  paymentMethod: string;
}

export interface CreatePlanDto {
  name: string;
  tier: 'basic' | 'silver' | 'gold' | 'platinum';
  monthlyFee: number;
  annualFee: number;
  discountPercent: number;
  familyMembers: number;
  benefits: string[];
}

export const membershipService = {
  // Plans
  plans: {
    list: async (): Promise<MembershipPlan[]> => {
      const response = await api.get<MembershipPlan[]>('/membership/plans');
      return response.data;
    },
    getById: async (id: string): Promise<MembershipPlan> => {
      const response = await api.get<MembershipPlan>(`/membership/plans/${id}`);
      return response.data;
    },
    create: async (data: CreatePlanDto): Promise<MembershipPlan> => {
      const response = await api.post<MembershipPlan>('/membership/plans', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreatePlanDto>): Promise<MembershipPlan> => {
      const response = await api.patch<MembershipPlan>(`/membership/plans/${id}`, data);
      return response.data;
    },
    toggleActive: async (id: string): Promise<MembershipPlan> => {
      const response = await api.patch<MembershipPlan>(`/membership/plans/${id}/toggle`);
      return response.data;
    },
  },

  // Memberships
  memberships: {
    list: async (params?: { planId?: string; status?: string }): Promise<Membership[]> => {
      const response = await api.get<Membership[]>('/membership/memberships', { params });
      return response.data;
    },
    getByPatient: async (patientId: string): Promise<Membership | null> => {
      const response = await api.get<Membership>(`/membership/patients/${patientId}`);
      return response.data;
    },
    create: async (data: CreateMembershipDto): Promise<Membership> => {
      const response = await api.post<Membership>('/membership/memberships', data);
      return response.data;
    },
    cancel: async (id: string): Promise<Membership> => {
      const response = await api.post<Membership>(`/membership/memberships/${id}/cancel`);
      return response.data;
    },
    renew: async (id: string, endDate: string): Promise<Membership> => {
      const response = await api.post<Membership>(`/membership/memberships/${id}/renew`, { endDate });
      return response.data;
    },
  },
};

export default membershipService;
