import api from './api';

// ========== Types ==========

export interface DrugLabel {
  id: string;
  brandName: string;
  genericName: string;
  manufacturer: string;
  dosageForm: string;
  route: string;
  indications: string;
  warnings: string;
  contraindications: string;
  dosage: string;
  adverseReactions: string;
  drugInteractions: string;
  activeIngredients: string[];
}

export interface DrugInteraction {
  drug1: string;
  drug2: string;
  description: string;
  severity: 'low' | 'moderate' | 'high';
}

export interface AdverseEvent {
  reportId: string;
  receiveDate: string;
  serious: boolean;
  seriousnessHospitalization: boolean;
  seriousnessDeath: boolean;
  patientAge?: number;
  patientSex?: string;
  reactions: string[];
  drugs: Array<{ name: string; role: string }>;
}

export interface DrugRecall {
  recallNumber: string;
  recallInitiationDate: string;
  productDescription: string;
  reason: string;
  classification: string;
  status: string;
}

export interface SideEffectStat {
  reaction: string;
  count: number;
}

export interface LabTestReference {
  code: string;
  name: string;
  category: string;
  specimen: string;
  units: string;
  referenceRange?: {
    low?: number;
    high?: number;
    text?: string;
  };
  criticalRange?: {
    low?: number;
    high?: number;
  };
}

export interface LOINCCode {
  code: string;
  display: string;
  longName: string;
  shortName?: string;
  class: string;
  units?: string;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  cost?: string;
  status: string;
  recipient: string;
}

export interface IntegrationStatus {
  openFDA: { configured: boolean; description: string };
  africasTalking: { configured: boolean; balance?: { currency: string; balance: string }; description: string };
  loinc: { configured: boolean; description: string };
}

// ========== Service ==========

export const integrationsService = {
  // Status
  getStatus: async (): Promise<IntegrationStatus> => {
    const response = await api.get('/integrations/status');
    return response.data;
  },

  // ========== Drug Database (openFDA) ==========
  
  searchDrugs: async (query: string, limit = 10): Promise<{ data: DrugLabel[]; count: number }> => {
    const response = await api.get('/integrations/drugs/search', { params: { q: query, limit } });
    return response.data;
  },

  checkDrugInteractions: async (drugs: string[]): Promise<{ hasInteractions: boolean; interactions: DrugInteraction[] }> => {
    const response = await api.post('/integrations/drugs/interactions', { drugs });
    return response.data;
  },

  getAdverseEvents: async (drug: string, limit = 20): Promise<{ data: AdverseEvent[]; count: number }> => {
    const response = await api.get('/integrations/drugs/adverse-events', { params: { drug, limit } });
    return response.data;
  },

  getSideEffects: async (drug: string): Promise<{ data: SideEffectStat[] }> => {
    const response = await api.get('/integrations/drugs/side-effects', { params: { drug } });
    return response.data;
  },

  getDrugRecalls: async (query?: string, limit = 20): Promise<{ data: DrugRecall[]; count: number }> => {
    const response = await api.get('/integrations/drugs/recalls', { params: { q: query, limit } });
    return response.data;
  },

  // ========== Lab Tests (LOINC) ==========

  searchLOINC: async (query: string, limit = 20): Promise<{ data: LOINCCode[]; count: number }> => {
    const response = await api.get('/integrations/loinc/search', { params: { q: query, limit } });
    return response.data;
  },

  getCommonLabTests: async (category?: string): Promise<{ data: LabTestReference[]; count: number }> => {
    const response = await api.get('/integrations/loinc/common', { params: { category } });
    return response.data;
  },

  getLabCategories: async (): Promise<{ data: string[] }> => {
    const response = await api.get('/integrations/loinc/categories');
    return response.data;
  },

  checkLabValue: async (loincCode: string, value: number): Promise<{
    status: 'normal' | 'low' | 'high' | 'critical-low' | 'critical-high' | 'unknown';
    referenceRange?: { low?: number; high?: number };
    criticalRange?: { low?: number; high?: number };
  }> => {
    const response = await api.post('/integrations/loinc/check-value', { loincCode, value });
    return response.data;
  },

  // ========== SMS (Africa's Talking) ==========

  getSMSStatus: async (): Promise<{ configured: boolean; balance?: { currency: string; balance: string } }> => {
    const response = await api.get('/integrations/sms/status');
    return response.data;
  },

  sendSMS: async (to: string, message: string, from?: string): Promise<SMSResult> => {
    const response = await api.post('/integrations/sms/send', { to, message, from });
    return response.data;
  },

  sendBulkSMS: async (recipients: string[], message: string): Promise<{ sent: number; failed: number; results: SMSResult[] }> => {
    const response = await api.post('/integrations/sms/send-bulk', { recipients, message });
    return response.data;
  },

  sendAppointmentReminder: async (data: {
    phone: string;
    patientName: string;
    appointmentDate: string;
    appointmentTime: string;
    doctorName?: string;
    hospitalName?: string;
  }): Promise<SMSResult> => {
    const response = await api.post('/integrations/sms/appointment-reminder', data);
    return response.data;
  },

  sendLabResultsNotification: async (data: {
    phone: string;
    patientName: string;
    hospitalName?: string;
  }): Promise<SMSResult> => {
    const response = await api.post('/integrations/sms/lab-results', data);
    return response.data;
  },

  sendPrescriptionReady: async (data: {
    phone: string;
    patientName: string;
    pharmacyLocation?: string;
  }): Promise<SMSResult> => {
    const response = await api.post('/integrations/sms/prescription-ready', data);
    return response.data;
  },
};

export default integrationsService;
