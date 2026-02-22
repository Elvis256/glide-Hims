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
  tokenNumber?: string;
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
  // New fields
  visitType?: string;
  chiefComplaintAtToken?: string;
  patientConditionFlags?: string[];
  onHold?: boolean;
  holdReason?: string;
  previousServicePoint?: string;
}

export type VisitType =
  | 'new_visit'
  | 'follow_up'
  | 'procedure_only'
  | 'lab_collection'
  | 'pharmacy_pickup'
  | 'emergency'
  | 'referral'
  | 'review';

export interface CreateQueueEntryDto {
  patientId: string;
  servicePoint: string;
  priority?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10;
  priorityReason?: string;
  departmentId?: string;
  notes?: string;
  assignedDoctorId?: string;
  /** Visit type determines routing (new_visit → triage, follow_up → consultation, etc.) */
  visitType?: VisitType;
  /** Chief complaint captured at reception before triage */
  chiefComplaintAtToken?: string;
  /** Condition flags: elderly, pregnant, wheelchair, child, appears_unwell */
  patientConditionFlags?: string[];
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

export interface ServiceConfig {
  opdEntryPoint: string;
  capacityLimits: Record<string, number>;
  priorityRules: Array<{ condition: string; priority: number; label: string }>;
  triageDispositions: Array<{ value: string; label: string; servicePoint: string; priority?: number }>;
}

/** Maps visit type to the correct OPD entry service point */
export function getEntryServicePoint(visitType: VisitType, config?: ServiceConfig): string {
  if (!visitType || visitType === 'new_visit') {
    return config?.opdEntryPoint || 'triage';
  }
  const map: Record<VisitType, string> = {
    new_visit: config?.opdEntryPoint || 'triage',
    follow_up: 'consultation',
    procedure_only: 'injection',
    lab_collection: 'laboratory',
    pharmacy_pickup: 'pharmacy',
    emergency: 'triage',
    referral: config?.opdEntryPoint || 'triage',
    review: 'consultation',
  };
  return map[visitType] || config?.opdEntryPoint || 'triage';
}

/** Maps condition flags to priority level (lowest numeric value wins) */
export function getPriorityFromFlags(flags: string[], config?: ServiceConfig): number {
  if (!flags || flags.length === 0) return 10; // ROUTINE
  const rules = config?.priorityRules || [
    { condition: 'emergency', priority: 1 },
    { condition: 'appears_unwell', priority: 2 },
    { condition: 'elderly', priority: 4 },
    { condition: 'disabled', priority: 5 },
    { condition: 'pregnant', priority: 6 },
    { condition: 'child', priority: 7 },
  ];
  let highest = 10;
  for (const flag of flags) {
    const rule = rules.find((r) => r.condition === flag);
    if (rule && rule.priority < highest) highest = rule.priority;
  }
  return highest;
}

export const queueService = {
  addToQueue: async (data: CreateQueueEntryDto): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>('/queue', data);
    return response.data;
  },

  getQueue: async (params?: QueueQueryParams): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>('/queue', { params });
    return response.data;
  },

  getWaiting: async (servicePoint: string): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>(`/queue/waiting/${servicePoint}`);
    return response.data;
  },

  getByServicePoint: async (servicePoint: string, assignedDoctorId?: string): Promise<QueueEntry[]> => {
    const params: Record<string, string> = { servicePoint };
    if (assignedDoctorId) params.assignedDoctorId = assignedDoctorId;
    const response = await api.get<QueueEntry[]>('/queue', { params });
    return response.data;
  },

  getStats: async (servicePoint?: string): Promise<QueueStats> => {
    const response = await api.get<QueueStats>('/queue/stats', {
      params: servicePoint ? { servicePoint } : {},
    });
    return response.data;
  },

  getPatientQueue: async (patientId: string): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>(`/queue/patient/${patientId}`);
    return response.data;
  },

  getById: async (id: string): Promise<QueueEntry> => {
    const response = await api.get<QueueEntry>(`/queue/${id}`);
    return response.data;
  },

  getServiceConfig: async (): Promise<ServiceConfig> => {
    const response = await api.get<ServiceConfig>('/queue/service-config');
    return response.data;
  },

  upsertServiceConfig: async (config: Partial<ServiceConfig>): Promise<ServiceConfig> => {
    const response = await api.put<ServiceConfig>('/queue/service-config', config);
    return response.data;
  },

  getAuditLog: async (queueId: string): Promise<any[]> => {
    const response = await api.get<any[]>(`/queue/${queueId}/audit-log`);
    return response.data;
  },

  callNext: async (servicePoint: string): Promise<QueueEntry | null> => {
    const response = await api.post<QueueEntry | null>('/queue/call-next', { servicePoint });
    return response.data;
  },

  call: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/call`);
    return response.data;
  },

  recall: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/recall`);
    return response.data;
  },

  startService: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/start-service`);
    return response.data;
  },

  complete: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/complete`);
    return response.data;
  },

  transfer: async (id: string, nextServicePoint: string, transferReason?: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/transfer`, { nextServicePoint, transferReason });
    return response.data;
  },

  skip: async (id: string, reason?: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/skip`, { skipReason: reason || 'No reason provided' });
    return response.data;
  },

  noShow: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/no-show`);
    return response.data;
  },

  cancel: async (id: string, reason?: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/cancel`, { reason });
    return response.data;
  },

  requeue: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/requeue`);
    return response.data;
  },

  hold: async (id: string, holdReason: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/hold`, { holdReason });
    return response.data;
  },

  unhold: async (id: string): Promise<QueueEntry> => {
    const response = await api.post<QueueEntry>(`/queue/${id}/unhold`);
    return response.data;
  },

  getDisplays: async (): Promise<Array<{ id: string; displayCode: string; servicePoints: string[] }>> => {
    const response = await api.get('/queue/displays');
    return response.data;
  },

  getDisplayQueue: async (displayCode: string): Promise<QueueEntry[]> => {
    const response = await api.get<QueueEntry[]>(`/queue/displays/${displayCode}/queue`);
    return response.data;
  },
};

export default queueService;
