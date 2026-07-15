import api from './api';

export interface ClinicalNote {
  id: string;
  encounterId: string;
  providerId: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnoses?: {
    code: string;
    description: string;
    type: 'primary' | 'secondary' | 'differential';
  }[];
  followUpDate?: string;
  followUpNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateClinicalNoteDto {
  encounterId: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  diagnoses?: {
    code: string;
    description: string;
    type: 'primary' | 'secondary' | 'differential';
  }[];
  followUpDate?: string;
  followUpNotes?: string;
}

export interface UpdateClinicalNoteDto extends Partial<CreateClinicalNoteDto> {}

export const clinicalNotesService = {
  // Create a clinical note
  create: async (data: CreateClinicalNoteDto): Promise<ClinicalNote> => {
    const response = await api.post('/clinical-notes', data);
    const result = response.data;
    return (result as any)?.data || result;
  },

  // Get clinical notes for an encounter
  getByEncounter: async (encounterId: string): Promise<ClinicalNote[]> => {
    const response = await api.get(`/clinical-notes/encounter/${encounterId}`);
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  },

  // Get patient clinical notes history
  getPatientHistory: async (patientId: string): Promise<ClinicalNote[]> => {
    const response = await api.get(`/clinical-notes/patient/${patientId}/history`);
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  },

  // Get a single clinical note
  getById: async (id: string): Promise<ClinicalNote> => {
    const response = await api.get(`/clinical-notes/${id}`);
    const data = response.data;
    return (data as any)?.data || data;
  },

  // Update a clinical note
  update: async (id: string, data: UpdateClinicalNoteDto): Promise<ClinicalNote> => {
    const response = await api.patch(`/clinical-notes/${id}`, data);
    const result = response.data;
    return (result as any)?.data || result;
  },

  // Delete a clinical note
  delete: async (id: string): Promise<void> => {
    await api.delete(`/clinical-notes/${id}`);
  },
};

export default clinicalNotesService;
