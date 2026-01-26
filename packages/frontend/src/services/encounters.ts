import api from './api';

export interface Encounter {
  id: string;
  visitNumber: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
    phone?: string;
  };
  type: 'opd' | 'ipd' | 'emergency' | 'day-case';
  status: 'waiting' | 'in-progress' | 'completed' | 'discharged' | 'cancelled';
  department?: string;
  doctorId?: string;
  doctor?: {
    id: string;
    fullName: string;
    specialization?: string;
  };
  chiefComplaint?: string;
  notes?: string;
  visitDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEncounterDto {
  patientId: string;
  type: 'opd' | 'ipd' | 'emergency' | 'day-case';
  department?: string;
  doctorId?: string;
  chiefComplaint?: string;
  notes?: string;
}

export interface UpdateEncounterDto extends Partial<CreateEncounterDto> {}

export interface EncounterQueryParams {
  patientId?: string;
  type?: string;
  status?: string;
  department?: string;
  doctorId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface TodayStats {
  total: number;
  waiting: number;
  inProgress: number;
  completed: number;
  byDepartment: Record<string, number>;
}

export const encountersService = {
  // Create new encounter/visit
  create: async (data: CreateEncounterDto): Promise<Encounter> => {
    const response = await api.post<Encounter>('/encounters', data);
    return response.data;
  },

  // List encounters with filters
  list: async (params?: EncounterQueryParams): Promise<{ data: Encounter[]; total: number }> => {
    const response = await api.get('/encounters', { params });
    return response.data;
  },

  // Get today's patient queue
  getQueue: async (): Promise<Encounter[]> => {
    const response = await api.get<Encounter[]>('/encounters/queue');
    return response.data;
  },

  // Get today's statistics
  getTodayStats: async (): Promise<TodayStats> => {
    const response = await api.get<TodayStats>('/encounters/stats/today');
    return response.data;
  },

  // Get encounter by visit number
  getByVisitNumber: async (visitNumber: string): Promise<Encounter> => {
    const response = await api.get<Encounter>(`/encounters/visit/${visitNumber}`);
    return response.data;
  },

  // Get encounter by ID
  getById: async (id: string): Promise<Encounter> => {
    const response = await api.get<Encounter>(`/encounters/${id}`);
    return response.data;
  },

  // Update encounter
  update: async (id: string, data: UpdateEncounterDto): Promise<Encounter> => {
    const response = await api.patch<Encounter>(`/encounters/${id}`, data);
    return response.data;
  },

  // Update encounter status
  updateStatus: async (id: string, status: Encounter['status']): Promise<Encounter> => {
    const response = await api.patch<Encounter>(`/encounters/${id}/status`, { status });
    return response.data;
  },

  // Delete encounter
  delete: async (id: string): Promise<void> => {
    await api.delete(`/encounters/${id}`);
  },
};

export default encountersService;
