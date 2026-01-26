import api from './api';

export type FollowUpStatus = 'scheduled' | 'confirmed' | 'checked_in' | 'completed' | 'missed' | 'cancelled' | 'rescheduled';

export type FollowUpType = 'routine' | 'post_procedure' | 'lab_review' | 'imaging_review' | 'medication_review' | 'chronic_care' | 'wound_care' | 'post_discharge' | 'vaccination' | 'anc' | 'pnc' | 'immunization' | 'other';

export type FollowUpPriority = 'high' | 'medium' | 'low';

export interface FollowUp {
  id: string;
  appointmentNumber: string;
  type: FollowUpType;
  status: FollowUpStatus;
  priority: FollowUpPriority;
  scheduledDate: string;
  scheduledTime?: string;
  durationMinutes: number;
  reason?: string;
  instructions?: string;
  reminderSent: boolean;
  smsReminder: boolean;
  confirmedAt?: string;
  checkedInAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  missedReason?: string;
  outcomeNotes?: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    phone?: string;
    email?: string;
    gender?: string;
  };
  providerId?: string;
  provider?: {
    id: string;
    fullName: string;
  };
  departmentId?: string;
  department?: {
    id: string;
    name: string;
  };
  facilityId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateFollowUpDto {
  patientId: string;
  sourceEncounterId?: string;
  type: FollowUpType;
  priority?: FollowUpPriority;
  scheduledDate: string;
  scheduledTime?: string;
  durationMinutes?: number;
  reason?: string;
  instructions?: string;
  departmentId?: string;
  providerId?: string;
  smsReminder?: boolean;
  daysBeforeReminder?: number;
}

export interface RescheduleFollowUpDto {
  newDate: string;
  newTime?: string;
  reason?: string;
}

export interface CompleteFollowUpDto {
  followUpEncounterId?: string;
  outcomeNotes?: string;
}

export interface CancelFollowUpDto {
  cancellationReason: string;
}

export interface FollowUpFilterParams {
  patientId?: string;
  status?: FollowUpStatus;
  type?: FollowUpType;
  providerId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface FollowUpStats {
  total: number;
  completed: number;
  missed: number;
  cancelled: number;
  completionRate: number | string;
  noShowRate: number | string;
}

export const followUpsService = {
  // Create a new follow-up
  create: async (data: CreateFollowUpDto): Promise<FollowUp> => {
    const response = await api.post<FollowUp>('/follow-ups', data);
    return response.data;
  },

  // Get all follow-ups with filters
  findAll: async (params?: FollowUpFilterParams): Promise<FollowUp[]> => {
    const response = await api.get<FollowUp[]>('/follow-ups', { params });
    return response.data;
  },

  // Get follow-up by ID
  findOne: async (id: string): Promise<FollowUp> => {
    const response = await api.get<FollowUp>(`/follow-ups/${id}`);
    return response.data;
  },

  // Get today's appointments
  getTodaysAppointments: async (departmentId?: string): Promise<FollowUp[]> => {
    const response = await api.get<FollowUp[]>('/follow-ups/today', {
      params: { departmentId },
    });
    return response.data;
  },

  // Get stats
  getStats: async (fromDate?: string, toDate?: string): Promise<FollowUpStats> => {
    const response = await api.get<FollowUpStats>('/follow-ups/stats', {
      params: { fromDate, toDate },
    });
    return response.data;
  },

  // Get follow-ups by patient
  findByPatient: async (patientId: string): Promise<FollowUp[]> => {
    const response = await api.get<FollowUp[]>(`/follow-ups/patient/${patientId}`);
    return response.data;
  },

  // Get upcoming follow-ups for a patient
  getUpcoming: async (patientId: string): Promise<FollowUp[]> => {
    const response = await api.get<FollowUp[]>(`/follow-ups/patient/${patientId}/upcoming`);
    return response.data;
  },

  // Confirm appointment
  confirm: async (id: string): Promise<FollowUp> => {
    const response = await api.post<FollowUp>(`/follow-ups/${id}/confirm`);
    return response.data;
  },

  // Check in
  checkIn: async (id: string): Promise<FollowUp> => {
    const response = await api.post<FollowUp>(`/follow-ups/${id}/check-in`);
    return response.data;
  },

  // Complete appointment
  complete: async (id: string, data: CompleteFollowUpDto): Promise<FollowUp> => {
    const response = await api.post<FollowUp>(`/follow-ups/${id}/complete`, data);
    return response.data;
  },

  // Reschedule appointment
  reschedule: async (id: string, data: RescheduleFollowUpDto): Promise<FollowUp> => {
    const response = await api.post<FollowUp>(`/follow-ups/${id}/reschedule`, data);
    return response.data;
  },

  // Cancel appointment
  cancel: async (id: string, data: CancelFollowUpDto): Promise<FollowUp> => {
    const response = await api.post<FollowUp>(`/follow-ups/${id}/cancel`, data);
    return response.data;
  },

  // Mark as missed
  markMissed: async (id: string, reason?: string): Promise<FollowUp> => {
    const response = await api.post<FollowUp>(`/follow-ups/${id}/mark-missed`, { reason });
    return response.data;
  },

  // Send reminders
  sendReminders: async (): Promise<{ message: string }> => {
    const response = await api.post<{ message: string }>('/follow-ups/send-reminders');
    return response.data;
  },
};

export default followUpsService;
