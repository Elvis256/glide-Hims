import api from './api';

// Enums matching backend
export const DisposalMethod = {
  INCINERATION: 'incineration',
  CHEMICAL: 'chemical',
  LANDFILL: 'landfill',
  RETURN_TO_MANUFACTURER: 'return_to_manufacturer',
} as const;
export type DisposalMethod = (typeof DisposalMethod)[keyof typeof DisposalMethod];

export const ComplianceStatus = {
  COMPLIANT: 'compliant',
  PENDING_REVIEW: 'pending_review',
  NON_COMPLIANT: 'non_compliant',
} as const;
export type ComplianceStatus = (typeof ComplianceStatus)[keyof typeof ComplianceStatus];

// Interfaces
export interface DisposalRecord {
  id: string;
  itemId: string;
  item?: { id: string; name: string };
  batchNumber?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  disposalDate: string;
  disposalMethod: DisposalMethod;
  witness?: string;
  certificateNumber?: string;
  complianceStatus: ComplianceStatus;
  reason?: string;
  notes?: string;
  facilityId: string;
  facility?: { id: string; name: string };
  disposedById: string;
  disposedBy?: { id: string; firstName: string; lastName: string };
  approvedById?: string;
  approvedBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDisposalDto {
  itemId: string;
  batchNumber?: string;
  quantity: number;
  unitValue?: number;
  disposalDate: string;
  disposalMethod: DisposalMethod;
  witness?: string;
  certificateNumber?: string;
  reason?: string;
  notes?: string;
  facilityId: string;
}

export interface UpdateDisposalDto {
  complianceStatus?: ComplianceStatus;
  certificateNumber?: string;
  notes?: string;
  approvedById?: string;
}

export interface DisposalQueryDto {
  facilityId?: string;
  disposalMethod?: DisposalMethod;
  complianceStatus?: ComplianceStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export const disposalService = {
  create: (data: CreateDisposalDto) =>
    api.post<DisposalRecord>('/disposal', data),

  list: (params?: DisposalQueryDto) =>
    api.get<DisposalRecord[]>('/disposal', { params }),

  getById: (id: string) =>
    api.get<DisposalRecord>(`/disposal/${id}`),

  getByFacility: (facilityId: string) =>
    api.get<DisposalRecord[]>(`/disposal/facility/${facilityId}`),

  getStats: (facilityId: string, params?: { startDate?: string; endDate?: string }) =>
    api.get(`/disposal/stats/${facilityId}`, { params }),

  getSummary: (facilityId: string) =>
    api.get(`/disposal/summary/${facilityId}`),

  update: (id: string, data: UpdateDisposalDto) =>
    api.put<DisposalRecord>(`/disposal/${id}`, data),

  approve: (id: string) =>
    api.put<DisposalRecord>(`/disposal/${id}/approve`),
};

export default disposalService;
