import api from './api';

// Contract Types
export type ContractStatus = 'draft' | 'active' | 'expiring_soon' | 'expired' | 'renewed' | 'terminated';

export interface ContractAmendment {
  id: string;
  contractId: string;
  amendmentNumber: string;
  description: string;
  changes: Record<string, any>;
  effectiveDate: string;
  createdAt: string;
}

export interface VendorContract {
  id: string;
  contractNumber: string;
  title: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  facilityId: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  termsAndConditions?: string;
  documents?: Record<string, string>;
  status: ContractStatus;
  renewalCount: number;
  terminationReason?: string;
  terminationDate?: string;
  amendments: ContractAmendment[];
  createdAt: string;
  updatedAt: string;
}

export interface ContractStats {
  active: number;
  expiringSoon: number;
  expired: number;
  total: number;
  totalActiveValue: number;
}

// DTOs
export interface CreateVendorContractDto {
  contractNumber: string;
  title: string;
  supplierId: string;
  facilityId: string;
  startDate: string;
  endDate: string;
  totalValue: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  termsAndConditions?: string;
  documents?: Record<string, string>;
}

export interface UpdateVendorContractDto {
  title?: string;
  startDate?: string;
  endDate?: string;
  totalValue?: number;
  paymentTerms?: string;
  deliveryTerms?: string;
  termsAndConditions?: string;
  status?: ContractStatus;
}

export interface CreateAmendmentDto {
  contractId: string;
  amendmentNumber: string;
  description: string;
  changes: Record<string, any>;
  effectiveDate: string;
}

export interface RenewContractDto {
  newEndDate: string;
  newTotalValue?: number;
  notes?: string;
}

export const vendorContractsService = {
  list: async (facilityId: string, status?: ContractStatus, supplierId?: string): Promise<VendorContract[]> => {
    const response = await api.get<VendorContract[]>('/vendor-contracts', { params: { facilityId, status, supplierId } });
    return response.data;
  },
  getById: async (id: string): Promise<VendorContract> => {
    const response = await api.get<VendorContract>(`/vendor-contracts/${id}`);
    return response.data;
  },
  create: async (data: CreateVendorContractDto): Promise<VendorContract> => {
    const response = await api.post<VendorContract>('/vendor-contracts', data);
    return response.data;
  },
  update: async (id: string, data: UpdateVendorContractDto): Promise<VendorContract> => {
    const response = await api.put<VendorContract>(`/vendor-contracts/${id}`, data);
    return response.data;
  },
  activate: async (id: string): Promise<VendorContract> => {
    const response = await api.post<VendorContract>(`/vendor-contracts/${id}/activate`);
    return response.data;
  },
  renew: async (id: string, data: RenewContractDto): Promise<VendorContract> => {
    const response = await api.post<VendorContract>(`/vendor-contracts/${id}/renew`, data);
    return response.data;
  },
  terminate: async (id: string, reason: string): Promise<VendorContract> => {
    const response = await api.post<VendorContract>(`/vendor-contracts/${id}/terminate`, { reason });
    return response.data;
  },
  addAmendment: async (data: CreateAmendmentDto): Promise<ContractAmendment> => {
    const response = await api.post<ContractAmendment>('/vendor-contracts/amendments', data);
    return response.data;
  },
  getStats: async (facilityId: string): Promise<ContractStats> => {
    const response = await api.get<ContractStats>('/vendor-contracts/stats', { params: { facilityId } });
    return response.data;
  },
  getExpiring: async (facilityId: string, daysAhead?: number): Promise<VendorContract[]> => {
    const response = await api.get<VendorContract[]>('/vendor-contracts/expiring', { params: { facilityId, daysAhead } });
    return response.data;
  },
};

export default vendorContractsService;
