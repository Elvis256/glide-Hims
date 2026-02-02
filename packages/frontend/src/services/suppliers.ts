import api from './api';

export enum SupplierStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum SupplierType {
  PHARMACEUTICAL = 'pharmaceutical',
  MEDICAL_EQUIPMENT = 'medical_equipment',
  CONSUMABLES = 'consumables',
  GENERAL = 'general',
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  type: SupplierType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit: number;
  bankName?: string;
  bankAccount?: string;
  status: SupplierStatus;
  notes?: string;
  facilityId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSupplierDto {
  facilityId: string;
  code: string;
  name: string;
  type?: SupplierType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  type?: SupplierType;
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankName?: string;
  bankAccount?: string;
  status?: SupplierStatus;
  notes?: string;
}

export interface SupplierListResponse {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
}

export const supplierService = {
  list: async (facilityId: string, options?: {
    type?: SupplierType;
    status?: SupplierStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<SupplierListResponse> => {
    const params = new URLSearchParams({ facilityId });
    if (options?.type) params.append('type', options.type);
    if (options?.status) params.append('status', options.status);
    if (options?.search) params.append('search', options.search);
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    const response = await api.get(`/suppliers?${params.toString()}`);
    return response.data;
  },

  getActive: async (facilityId: string): Promise<Supplier[]> => {
    const response = await api.get(`/suppliers/active?facilityId=${facilityId}`);
    return response.data;
  },

  getDashboard: async (facilityId: string) => {
    const response = await api.get(`/suppliers/dashboard?facilityId=${facilityId}`);
    return response.data;
  },

  getById: async (id: string): Promise<Supplier> => {
    const response = await api.get(`/suppliers/${id}`);
    return response.data;
  },

  create: async (dto: CreateSupplierDto): Promise<Supplier> => {
    const response = await api.post('/suppliers', dto);
    return response.data;
  },

  update: async (id: string, dto: UpdateSupplierDto): Promise<Supplier> => {
    const response = await api.put(`/suppliers/${id}`, dto);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/suppliers/${id}`);
  },
};

export default supplierService;
