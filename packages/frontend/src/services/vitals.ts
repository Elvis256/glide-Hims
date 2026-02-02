import api from './api';

export interface VitalRecord {
  id: string;
  encounterId: string;
  temperature?: number;
  pulse?: number;
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bloodGlucose?: number;
  painScale?: number;
  notes?: string;
  recordedById: string;
  recordedBy?: {
    id: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateVitalDto {
  encounterId: string;
  temperature?: number;
  pulse?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weight?: number;
  height?: number;
  bloodGlucose?: number;
  painScale?: number;
  notes?: string;
}

export const vitalsService = {
  // Create vital record
  create: async (data: CreateVitalDto): Promise<VitalRecord> => {
    const response = await api.post<VitalRecord>('/vitals', data);
    return response.data;
  },

  // Get vitals for encounter
  getByEncounter: async (encounterId: string): Promise<VitalRecord[]> => {
    const response = await api.get<VitalRecord[]>(`/vitals/encounter/${encounterId}`);
    return response.data;
  },

  // Get latest vitals for encounter
  getLatestByEncounter: async (encounterId: string): Promise<VitalRecord | null> => {
    const response = await api.get<VitalRecord>(`/vitals/encounter/${encounterId}/latest`);
    return response.data;
  },

  // Get patient vital history
  getPatientHistory: async (patientId: string, limit?: number): Promise<VitalRecord[]> => {
    const response = await api.get<VitalRecord[]>(`/vitals/patient/${patientId}/history`, {
      params: { limit },
    });
    return response.data;
  },

  // Get single vital record
  getById: async (id: string): Promise<VitalRecord> => {
    const response = await api.get<VitalRecord>(`/vitals/${id}`);
    return response.data;
  },

  // Update vital record
  update: async (id: string, data: Partial<CreateVitalDto>): Promise<VitalRecord> => {
    const response = await api.patch<VitalRecord>(`/vitals/${id}`, data);
    return response.data;
  },

  // Delete vital record
  delete: async (id: string): Promise<void> => {
    await api.delete(`/vitals/${id}`);
  },
};

export default vitalsService;
