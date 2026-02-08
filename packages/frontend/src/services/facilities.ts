import api from './api';

// Facility
export interface Facility {
  id: string;
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'lab';
  tenantId: string;
  parentFacilityId?: string;
  location?: string;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  settings?: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
}

// Department
export interface Department {
  id: string;
  name: string;
  code: string;
  facilityId: string;
  parentId?: string;
  parent?: Department;
  children?: Department[];
  description?: string;
  headUserId?: string;
  location?: string;
  staffCount?: number;
  status?: string;
  isActive: boolean;
  createdAt: string;
}

// Unit
export interface Unit {
  id: string;
  name: string;
  departmentId: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

// DTOs
export interface CreateFacilityDto {
  name: string;
  type: 'hospital' | 'clinic' | 'pharmacy' | 'lab';
  tenantId: string;
  parentFacilityId?: string;
  location?: string;
  contact?: {
    phone?: string;
    email?: string;
    address?: string;
  };
  settings?: Record<string, unknown>;
}

export interface CreateDepartmentDto {
  name: string;
  code: string;
  facilityId: string;
  parentId?: string;
  description?: string;
}

export interface CreateUnitDto {
  name: string;
  departmentId: string;
  description?: string;
}

export interface FacilityPublicInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
}

export const facilitiesService = {
  // Public info (no auth required)
  getPublicInfo: async (): Promise<FacilityPublicInfo> => {
    const response = await api.get<FacilityPublicInfo>('/facilities/public/info');
    return response.data;
  },

  // Facilities
  list: async (tenantId?: string): Promise<Facility[]> => {
    const response = await api.get<Facility[]>('/facilities', { params: tenantId ? { tenantId } : {} });
    return response.data;
  },

  getById: async (id: string): Promise<Facility> => {
    const response = await api.get<Facility>(`/facilities/${id}`);
    return response.data;
  },

  create: async (data: CreateFacilityDto): Promise<Facility> => {
    const response = await api.post<Facility>('/facilities', data);
    return response.data;
  },

  update: async (id: string, data: Partial<CreateFacilityDto>): Promise<Facility> => {
    const response = await api.patch<Facility>(`/facilities/${id}`, data);
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/facilities/${id}`);
  },

  // Departments
  departments: {
    list: async (facilityId: string): Promise<Department[]> => {
      const response = await api.get<Department[]>(`/facilities/${facilityId}/departments`);
      return response.data;
    },
    listAll: async (): Promise<Department[]> => {
      const response = await api.get<Department[]>('/facilities/departments');
      return response.data;
    },
    create: async (facilityId: string, data: Omit<CreateDepartmentDto, 'facilityId'>): Promise<Department> => {
      const response = await api.post<Department>(`/facilities/${facilityId}/departments`, { ...data, facilityId });
      return response.data;
    },
    update: async (id: string, data: Partial<CreateDepartmentDto>): Promise<Department> => {
      const response = await api.patch<Department>(`/facilities/departments/${id}`, data);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/facilities/departments/${id}`);
    },
  },

  // Units
  units: {
    listByDepartment: async (departmentId: string): Promise<Unit[]> => {
      const response = await api.get<Unit[]>(`/facilities/departments/${departmentId}/units`);
      return response.data;
    },
    listByFacility: async (facilityId: string): Promise<Unit[]> => {
      const response = await api.get<Unit[]>(`/facilities/${facilityId}/units`);
      return response.data;
    },
    getById: async (id: string): Promise<Unit> => {
      const response = await api.get<Unit>(`/facilities/units/${id}`);
      return response.data;
    },
    create: async (departmentId: string, data: Omit<CreateUnitDto, 'departmentId'>): Promise<Unit> => {
      const response = await api.post<Unit>(`/facilities/departments/${departmentId}/units`, { ...data, departmentId });
      return response.data;
    },
    update: async (id: string, data: Partial<CreateUnitDto>): Promise<Unit> => {
      const response = await api.patch<Unit>(`/facilities/units/${id}`, data);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/facilities/units/${id}`);
    },
  },
};

export default facilitiesService;
