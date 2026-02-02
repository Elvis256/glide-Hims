import api from './api';

export type ProblemStatus = 'active' | 'chronic' | 'resolved' | 'inactive';
export type ProblemSeverity = 'mild' | 'moderate' | 'severe' | 'critical';

export interface Problem {
  id: string;
  patientId: string;
  patient?: {
    id: string;
    fullName: string;
    mrn: string;
  };
  diagnosisId?: string;
  diagnosis: string;
  icdCode: string;
  status: ProblemStatus;
  severity?: ProblemSeverity;
  onsetDate: string;
  resolvedDate?: string;
  notes?: string;
  lastReviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProblemDto {
  patientId: string;
  diagnosisId?: string;
  customDiagnosis?: string;
  customIcdCode?: string;
  status: ProblemStatus;
  severity?: ProblemSeverity;
  onsetDate: string;
  resolvedDate?: string;
  notes?: string;
  encounterId?: string;
}

export interface ProblemStats {
  total: number;
  active: number;
  chronic: number;
  resolved: number;
  inactive: number;
}

export const problemsService = {
  // Get patient problems
  getByPatient: async (patientId: string, status?: ProblemStatus): Promise<Problem[]> => {
    const response = await api.get<Problem[]>(`/problems/patient/${patientId}`, {
      params: { status },
    });
    return response.data;
  },

  // Get patient problem stats
  getPatientStats: async (patientId: string): Promise<ProblemStats> => {
    const response = await api.get<ProblemStats>(`/problems/patient/${patientId}/stats`);
    return response.data;
  },

  // Get single problem
  getOne: async (id: string): Promise<Problem> => {
    const response = await api.get<Problem>(`/problems/${id}`);
    return response.data;
  },

  // Create problem
  create: async (facilityId: string, data: CreateProblemDto): Promise<Problem> => {
    const response = await api.post(`/problems`, data, {
      params: { facilityId },
    });
    return response.data.data;
  },

  // Update problem
  update: async (id: string, data: Partial<CreateProblemDto>): Promise<Problem> => {
    const response = await api.patch(`/problems/${id}`, data);
    return response.data.data;
  },

  // Mark as resolved
  markResolved: async (id: string, resolvedDate?: string, notes?: string): Promise<Problem> => {
    const response = await api.patch(`/problems/${id}/resolve`, { resolvedDate, notes });
    return response.data.data;
  },

  // Delete problem
  delete: async (id: string): Promise<void> => {
    await api.delete(`/problems/${id}`);
  },

  // Search all problems
  search: async (facilityId: string, params?: {
    patientId?: string;
    status?: ProblemStatus;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Problem[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/problems', {
      params: { facilityId, ...params },
    });
    return response.data;
  },
};

export default problemsService;
