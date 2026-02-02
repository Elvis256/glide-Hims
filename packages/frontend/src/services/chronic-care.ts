import api from './api';

// Types
export type ChronicStatus = 'active' | 'controlled' | 'uncontrolled' | 'in_remission' | 'resolved';
export type ReminderChannel = 'email' | 'sms' | 'both';
export type NotificationType = 'email' | 'sms' | 'both';
export type NotificationProvider = 'smtp' | 'africas_talking' | 'twilio' | 'custom';

export interface ChronicCondition {
  id: string;
  icd10Code: string;
  name: string;
}

export interface ChronicPatient {
  id: string;
  patientId: string;
  patient: {
    id: string;
    mrn: string;
    fullName: string;
    phone?: string;
    email?: string;
    dateOfBirth?: string;
    gender?: string;
  };
  diagnosis: {
    id: string;
    icd10Code: string;
    name: string;
  };
  status: ChronicStatus;
  diagnosedDate: string;
  nextFollowUp?: string;
  followUpIntervalDays: number;
  reminderEnabled: boolean;
  lastVisit?: string;
  currentMedications?: string[];
  notes?: string;
}

export interface ChronicDashboardStats {
  totalPatients: number;
  activePatients: number;
  overdueFollowUps: number;
  upcomingFollowUps: number;
  conditionBreakdown: Array<{ condition: string; count: number }>;
}

export interface NotificationConfig {
  id: string;
  facilityId: string;
  type: NotificationType;
  provider?: NotificationProvider;
  isEnabled: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  fromEmail?: string;
  fromName?: string;
  smsApiUrl?: string;
  smsApiKey?: string;
  smsApiSecret?: string;
  smsSenderId?: string;
  smsUsername?: string;
  extraConfig?: Record<string, any>;
  lastTestedAt?: string;
  testSuccessful?: boolean;
}

export interface RegisterChronicConditionDto {
  patientId: string;
  diagnosisId: string;
  diagnosedDate: string;
  status?: ChronicStatus;
  notes?: string;
  nextFollowUp?: string;
  followUpIntervalDays?: number;
  reminderEnabled?: boolean;
  reminderDaysBefore?: number;
  primaryDoctorId?: string;
  currentMedications?: string[];
}

export interface SendReminderDto {
  patientId: string;
  type: 'appointment' | 'follow_up' | 'medication' | 'lab_test' | 'chronic_checkup';
  channel: ReminderChannel;
  subject: string;
  message: string;
}

export interface BulkReminderDto {
  patientIds: string[];
  subject: string;
  message: string;
  channel?: ReminderChannel;
}

// Chronic Care Service
export const chronicCareService = {
  // Dashboard
  getDashboard: async (facilityId: string): Promise<ChronicDashboardStats> => {
    const response = await api.get<ChronicDashboardStats>('/chronic-care/dashboard', {
      params: { facilityId },
    });
    return response.data;
  },

  // Get chronic conditions list (diagnoses)
  getConditionsList: async (): Promise<ChronicCondition[]> => {
    const response = await api.get<ChronicCondition[]>('/chronic-care/conditions');
    return response.data;
  },

  // Get chronic patients
  getPatients: async (facilityId: string, params?: {
    diagnosisId?: string;
    status?: ChronicStatus;
    search?: string;
    overdueFollowUp?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: ChronicPatient[]; total: number; page: number; limit: number; totalPages: number }> => {
    const response = await api.get('/chronic-care/patients', {
      params: { facilityId, ...params },
    });
    return response.data;
  },

  // Get patient's conditions
  getPatientConditions: async (patientId: string): Promise<ChronicPatient[]> => {
    const response = await api.get<ChronicPatient[]>(`/chronic-care/patients/${patientId}/conditions`);
    return response.data;
  },

  // Get overdue patients
  getOverduePatients: async (facilityId: string, limit?: number): Promise<ChronicPatient[]> => {
    const response = await api.get<ChronicPatient[]>('/chronic-care/overdue', {
      params: { facilityId, limit },
    });
    return response.data;
  },

  // Register chronic condition
  register: async (facilityId: string, data: RegisterChronicConditionDto) => {
    const response = await api.post('/chronic-care/register', data, {
      params: { facilityId },
    });
    return response.data;
  },

  // Update condition
  update: async (id: string, data: Partial<RegisterChronicConditionDto>) => {
    const response = await api.put(`/chronic-care/${id}`, data);
    return response.data;
  },

  // Record visit
  recordVisit: async (id: string, nextFollowUpDate?: string) => {
    const response = await api.post(`/chronic-care/${id}/record-visit`, { nextFollowUpDate });
    return response.data;
  },

  // Send reminder
  sendReminder: async (facilityId: string, conditionId: string) => {
    const response = await api.post(`/chronic-care/${conditionId}/send-reminder`, null, {
      params: { facilityId },
    });
    return response.data;
  },

  // Send bulk reminders
  sendBulkReminders: async (facilityId: string, data: BulkReminderDto) => {
    const response = await api.post('/chronic-care/send-bulk-reminders', data, {
      params: { facilityId },
    });
    return response.data;
  },
};

// Notifications Service
export const notificationsService = {
  // Get configuration
  getConfig: async (facilityId: string, type?: NotificationType): Promise<NotificationConfig[]> => {
    const response = await api.get<NotificationConfig[]>('/notifications/config', {
      params: { facilityId, type },
    });
    return response.data;
  },

  // Save configuration
  saveConfig: async (data: Partial<NotificationConfig>) => {
    const response = await api.post('/notifications/config', data);
    return response.data;
  },

  // Test configuration
  testConfig: async (facilityId: string, type: NotificationType, testEmail?: string, testPhone?: string) => {
    const response = await api.post('/notifications/config/test', {
      facilityId,
      type,
      testEmail,
      testPhone,
    });
    return response.data;
  },

  // Send immediate reminder
  sendReminder: async (facilityId: string, data: SendReminderDto) => {
    const response = await api.post('/notifications/send', data, {
      params: { facilityId },
    });
    return response.data;
  },

  // Get reminder history
  getHistory: async (facilityId: string, patientId?: string, limit?: number) => {
    const response = await api.get('/notifications/history', {
      params: { facilityId, patientId, limit },
    });
    return response.data;
  },
};

export default { chronicCareService, notificationsService };
