import api from './api';

// Service Category
export interface ServiceCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  createdAt: string;
}

// Service
export interface Service {
  id: string;
  code: string;
  name: string;
  categoryId: string;
  category?: ServiceCategory;
  tier?: 'STANDARD' | 'PREMIUM' | 'VIP';
  basePrice: number;
  department?: string;
  description?: string;
  isPackage?: boolean;
  durationMinutes?: number;
  requiresAppointment?: boolean;
  facilityId?: string;
  isActive: boolean;
  createdAt: string;
}

// Service Price
export interface ServicePrice {
  id: string;
  serviceId: string;
  tier: 'STANDARD' | 'PREMIUM' | 'VIP';
  price: number;
  effectiveFrom: string;
  effectiveTo?: string;
  facilityId?: string;
}

// Service Package
export interface ServicePackage {
  id: string;
  code: string;
  name: string;
  description?: string;
  packagePrice: number;
  validDays?: number;
  includedServices: Array<{ serviceId: string; quantity: number; service?: Service }>;
  isActive: boolean;
  createdAt: string;
}

// DTOs
export interface CreateServiceCategoryDto {
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}

export interface CreateServiceDto {
  code: string;
  name: string;
  categoryId: string;
  tier?: 'STANDARD' | 'PREMIUM' | 'VIP';
  basePrice: number;
  description?: string;
  isPackage?: boolean;
  isActive?: boolean;
  durationMinutes?: number;
  requiresAppointment?: boolean;
  facilityId?: string;
}

export interface CreateServicePriceDto {
  serviceId: string;
  tier: 'STANDARD' | 'PREMIUM' | 'VIP';
  price: number;
  effectiveFrom: string;
  effectiveTo?: string;
  facilityId?: string;
}

export interface CreateServicePackageDto {
  code: string;
  name: string;
  description?: string;
  packagePrice: number;
  validDays?: number;
  includedServices: Array<{ serviceId: string; quantity: number }>;
}

export interface ServiceListParams {
  categoryId?: string;
  tier?: string;
  facilityId?: string;
}

export const servicesService = {
  // Categories
  categories: {
    list: async (): Promise<ServiceCategory[]> => {
      const response = await api.get<ServiceCategory[]>('/services/categories');
      return response.data;
    },
    create: async (data: CreateServiceCategoryDto): Promise<ServiceCategory> => {
      const response = await api.post<ServiceCategory>('/services/categories', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreateServiceCategoryDto>): Promise<ServiceCategory> => {
      const response = await api.patch<ServiceCategory>(`/services/categories/${id}`, data);
      return response.data;
    },
  },

  // Services
  list: async (params?: ServiceListParams): Promise<Service[]> => {
    const response = await api.get<Service[]>('/services', { params });
    return response.data;
  },

  getById: async (id: string): Promise<Service> => {
    const response = await api.get<Service>(`/services/${id}`);
    return response.data;
  },

  create: async (data: CreateServiceDto): Promise<Service> => {
    const response = await api.post<Service>('/services', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateServiceDto>): Promise<Service> => {
    const response = await api.patch<Service>(`/services/${id}`, data);
    return response.data;
  },

  // Pricing
  setPrice: async (data: CreateServicePriceDto): Promise<ServicePrice> => {
    const response = await api.post<ServicePrice>('/services/prices', data);
    return response.data;
  },

  getPrice: async (serviceId: string, tier?: string, facilityId?: string): Promise<ServicePrice> => {
    const response = await api.get<ServicePrice>(`/services/${serviceId}/price`, {
      params: { tier, facilityId },
    });
    return response.data;
  },

  // Packages
  packages: {
    list: async (): Promise<ServicePackage[]> => {
      const response = await api.get<ServicePackage[]>('/services/packages');
      return response.data;
    },
    create: async (data: CreateServicePackageDto): Promise<ServicePackage> => {
      const response = await api.post<ServicePackage>('/services/packages', data);
      return response.data;
    },
  },
};

export default servicesService;
