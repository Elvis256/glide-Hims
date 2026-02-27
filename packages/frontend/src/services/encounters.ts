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
  status: 'registered' | 'triage' | 'waiting' | 'in_consultation' | 'pending_lab' | 'pending_pharmacy' | 'pending_payment' | 'admitted' | 'discharged' | 'completed' | 'cancelled';
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
  facilityId: string;
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

/** Normalize backend encounter fields to frontend Encounter interface */
function normalizeEncounter(raw: any): Encounter {
  return {
    ...raw,
    // Backend returns attendingProvider; frontend expects doctor
    doctor: raw.doctor || raw.attendingProvider
      ? {
          id: (raw.doctor || raw.attendingProvider)?.id,
          fullName: (raw.doctor || raw.attendingProvider)?.fullName || (raw.doctor || raw.attendingProvider)?.username,
          specialization: (raw.doctor || raw.attendingProvider)?.specialization,
        }
      : undefined,
    doctorId: raw.doctorId || raw.attendingProviderId,
    // Backend returns department as object { id, name }; frontend expects string
    department: typeof raw.department === 'object' && raw.department
      ? raw.department.name
      : raw.department,
    visitDate: raw.visitDate || raw.startTime || raw.createdAt,
  };
}

export const encountersService = {
  // Create new encounter/visit
  create: async (data: CreateEncounterDto): Promise<Encounter> => {
    const response = await api.post<Encounter>('/encounters', data);
    return normalizeEncounter(response.data);
  },

  // List encounters with filters
  list: async (params?: EncounterQueryParams): Promise<{ data: Encounter[]; total: number }> => {
    const response = await api.get('/encounters', { params });
    const raw = response.data;
    return {
      data: (raw.data || []).map(normalizeEncounter),
      total: raw.total || 0,
    };
  },

  // Get today's patient queue
  getQueue: async (): Promise<Encounter[]> => {
    const response = await api.get<any[]>('/encounters/queue');
    return (response.data || []).map(normalizeEncounter);
  },

  // Get today's statistics
  getTodayStats: async (): Promise<TodayStats> => {
    const response = await api.get<TodayStats>('/encounters/stats/today');
    return response.data;
  },

  // Get encounter by visit number
  getByVisitNumber: async (visitNumber: string): Promise<Encounter> => {
    const response = await api.get<Encounter>(`/encounters/visit/${visitNumber}`);
    return normalizeEncounter(response.data);
  },

  // Get encounter by ID
  getById: async (id: string): Promise<Encounter> => {
    const response = await api.get<Encounter>(`/encounters/${id}`);
    return normalizeEncounter(response.data);
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
