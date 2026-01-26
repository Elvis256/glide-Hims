import api from './api';

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  paymentType?: 'cash' | 'insurance' | 'membership' | 'corporate';
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  membershipType?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePatientDto {
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

export interface PatientSearchParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: Array<{
    id: string;
    mrn: string;
    fullName: string;
    dateOfBirth: string;
    phone?: string;
    nationalId?: string;
  }>;
}

export const patientsService = {
  // Create a new patient
  create: async (data: CreatePatientDto): Promise<Patient> => {
    const response = await api.post<{ message: string; data: Patient }>('/patients', data);
    return response.data.data;
  },

  // Check for duplicate patients before registration
  checkDuplicates: async (data: CreatePatientDto): Promise<DuplicateCheckResult> => {
    const response = await api.post<DuplicateCheckResult>('/patients/check-duplicates', data);
    return response.data;
  },

  // Search patients
  search: async (params: PatientSearchParams): Promise<PaginatedResponse<Patient>> => {
    const response = await api.get<PaginatedResponse<Patient>>('/patients', { params });
    return response.data;
  },

  // Get patient by ID
  getById: async (id: string): Promise<Patient> => {
    const response = await api.get<Patient>(`/patients/${id}`);
    return response.data;
  },

  // Get patient by MRN
  getByMRN: async (mrn: string): Promise<Patient> => {
    const response = await api.get<Patient>(`/patients/mrn/${mrn}`);
    return response.data;
  },

  // Update patient
  update: async (id: string, data: UpdatePatientDto): Promise<Patient> => {
    const response = await api.patch<{ message: string; data: Patient }>(`/patients/${id}`, data);
    return response.data.data;
  },

  // Delete patient (soft delete)
  delete: async (id: string): Promise<void> => {
    await api.delete(`/patients/${id}`);
  },
};

export default patientsService;
