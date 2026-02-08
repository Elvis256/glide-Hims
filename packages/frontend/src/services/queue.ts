import api from './api';

export interface QueueEntry {
  id: string;
  patientId: string;
  encounterId?: string;
  facilityId?: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    phone?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  ticketNumber: string;
  tokenNumber?: string; // Alias for ticketNumber
  servicePoint: string;
  priority: number;
  status: 'waiting' | 'called' | 'in_service' | 'completed' | 'skipped' | 'no_show' | 'cancelled';
  estimatedWaitMinutes?: number;
  notes?: string;
  roomNumber?: string;
  counterNumber?: string;
  calledAt?: string;
  serviceStartedAt?: string;
  serviceEndedAt?: string;
  createdAt: string;
}

export interface CreateQueueEntryDto {
  patientId: string;
  servicePoint: 'registration' | 'triage' | 'consultation' | 'laboratory' | 'radiology' | 'pharmacy' | 'billing' | 'cashier' | 'injection' | 'dressing' | 'vitals' | 'records';
  priority?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10;
  notes?: string;
  assignedDoctorId?: string;
}

export interface QueueStats {
  waiting: number;
  inService: number;
  completed: number;
  noShow: number;
  total: number;
  averageWaitMinutes: number;
  averageServiceMinutes: number;
}

export interface QueueQueryParams {
  date?: string;
  servicePoint?: string;
  status?: string;
}

export const queueService = {
  // Add patient to queue
  addToQueue: async (data: CreateQueueEntryDto): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>('/queue', data);
    return response.data;
  },

  // Get queue entries
  getQueue: async (params?: QueueQueryParams): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>('/queue', { params });
    return response.data;
  },

  // Get waiting patients for a service point
  getWaiting: async (servicePoint: string): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>(`/queue/waiting/${servicePoint}`);
    return response.data;
  },

  // Get queue entries by service point (for doctor dashboard)
  getByServicePoint: async (servicePoint: string, assignedDoctorId?: string): Promise<QueueEntry[]> => {
    const params: Record<string, string> = { servicePoint };
    if (assignedDoctorId) {
      params.assignedDoctorId = assignedDoctorId;
    }
    const response = await api.get<QueueEntry[]>('/queue', { params });
    return response.data;
  },

  // Get queue statistics
  getStats: async (servicePoint?: string): Promise<QueueStats> => {
    const response = await api.get<QueueStats>('/queue/stats', { params: servicePoint ? { servicePoint } : {} });
    return response.data;
  },

  // Get patient's queue status
  getPatientQueue: async (patientId: string): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>(`/queue/patient/${patientId}`);
    return response.data;
  },

  // Get single queue entry
  getById: async (id: string): Promise<QueueEntry> => {
    const response = await api.get<QueueEntry>(`/queue/${id}`);
    return response.data;
  },

  // Call next patient
  callNext: async (servicePoint: string): Promise<QueueEntry | null> => {
    const response = await api.post<QueueEntry | null>('/queue/call-next', { servicePoint });
    return response.data;
  },

  // Call specific patient
  call: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/call`);
    return response.data;
  },

  // Recall patient (call again)
  recall: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/recall`);
    return response.data;
  },

  // Start service
  startService: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/start-service`);
    return response.data;
  },

  // Complete service
  complete: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/complete`);
    return response.data;
  },

  // Transfer to next service point
  transfer: async (id: string, nextServicePoint: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/transfer`, { nextServicePoint });
    return response.data;
  },

  // Skip patient
  skip: async (id: string, reason?: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/skip`, { reason });
    return response.data;
  },

  // Mark as no-show
  noShow: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/no-show`);
    return response.data;
  },

  // Cancel queue entry
  cancel: async (id: string, reason?: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/cancel`, { reason });
    return response.data;
  },

  // Requeue skipped or no-show patient
  requeue: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/requeue`);
    return response.data;
  },

  // Get queue displays
  getDisplays: async (): Promise<Array<{ id: string; displayCode: string; servicePoints: string[] }>> => {
    const response = await api.get('/queue/displays');
    return response.data;
  },

  // Get display queue
  getDisplayQueue: async (displayCode: string): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>(`/queue/displays/${displayCode}/queue`);
    return response.data;
  },
};

export default queueService;
