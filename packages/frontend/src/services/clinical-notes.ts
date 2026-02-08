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
    return response.data;
  },

  // Get clinical notes for an encounter
  getByEncounter: async (encounterId: string): Promise<ClinicalNote[]> => {
    const response = await api.get(`/clinical-notes/encounter/${encounterId}`);
    return response.data.data || response.data || [];
  },

  // Get a single clinical note
  getById: async (id: string): Promise<ClinicalNote> => {
    const response = await api.get(`/clinical-notes/${id}`);
    return response.data;
  },

  // Update a clinical note
  update: async (id: string, data: UpdateClinicalNoteDto): Promise<ClinicalNote> => {
    const response = await api.patch(`/clinical-notes/${id}`, data);
    return response.data;
  },

  // Delete a clinical note
  delete: async (id: string): Promise<void> => {
    await api.delete(`/clinical-notes/${id}`);
  },
};

export default clinicalNotesService;
