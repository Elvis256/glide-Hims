import api from './api';

// ============ Types ============

export interface AdherenceRecord {
  id: string;
  patientId: string;
  prescriptionItemId: string;
  prescriptionItem?: {
    id: string;
    drugName: string;
    dose: string;
    frequency: string;
    duration: string;
  };
  scheduledDate: string;
  scheduledTime: string;
  takenAt?: string;
  skippedAt?: string;
  skipReason?: string;
  status: 'pending' | 'taken' | 'skipped' | 'missed';
}

export interface AdherenceSummary {
  adherenceRate: number;
  totalScheduled: number;
  taken: number;
  skipped: number;
  missed: number;
  pending: number;
  currentMedicationsCount: number;
}

export interface RecordAdherenceDto {
  status: 'taken' | 'skipped';
  skipReason?: string;
}

// ============ Service ============

export const adherenceService = {
  generateSchedule: async (prescriptionId: string): Promise<{ generated: number; prescriptionId: string }> => {
    const response = await api.post(`/adherence/generate/${prescriptionId}`);
    return response.data;
  },

  recordAdherence: async (recordId: string, data: RecordAdherenceDto): Promise<AdherenceRecord> => {
    const response = await api.put<AdherenceRecord>(`/adherence/${recordId}`, data);
    return response.data;
  },

  getPatientAdherence: async (
    patientId: string,
    params?: { dateFrom?: string; dateTo?: string },
  ): Promise<AdherenceRecord[]> => {
    const response = await api.get<AdherenceRecord[]>(`/adherence/patient/${patientId}`, { params });
    return response.data;
  },

  getAdherenceSummary: async (patientId: string): Promise<AdherenceSummary> => {
    const response = await api.get<AdherenceSummary>(`/adherence/summary/${patientId}`);
    return response.data;
  },
};

export default adherenceService;
