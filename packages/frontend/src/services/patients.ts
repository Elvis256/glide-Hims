import api from './api';

export interface Patient {
  id: string;
  mrn: string;
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  allergies?: string;
  weight?: number;
  height?: number;
  paymentType?: 'cash' | 'insurance' | 'membership' | 'corporate';
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  membershipType?: string;
  userId?: string; // Linked user account for biometric verification
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePatientDto {
  fullName: string;
  gender: 'male' | 'female' | 'other';
  dateOfBirth: string;
  nationalId?: string;
  phone?: string;
  email?: string;
  address?: string;
  bloodGroup?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

export interface PatientSearchParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DuplicateCheckResult {
  hasDuplicates: boolean;
  duplicates: Array<{
    id: string;
    mrn: string;
    fullName: string;
    dateOfBirth: string;
    phone?: string;
    nationalId?: string;
  }>;
}

// Document categories matching backend
export type DocumentCategory = 
  | 'clinical' | 'lab_report' | 'imaging' | 'prescription' 
  | 'discharge_summary' | 'referral' | 'medical_history'
  | 'identification' | 'insurance_card'
  | 'financial' | 'receipt' | 'claim' | 'payment_proof'
  | 'consent' | 'registration_form' | 'other';

export interface PatientDocument {
  id: string;
  patientId: string;
  category: DocumentCategory;
  documentName: string;
  description?: string;
  filePath: string;
  fileType?: string;
  fileSize?: number;
  originalFilename?: string;
  documentDate?: string;
  notes?: string;
  tags?: string[];
  uploadedBy: string;
  uploader?: { fullName?: string; username?: string };
  isConfidential: boolean;
  accessCount: number;
  lastAccessedAt?: string;
  createdAt: string;
}

export interface UploadDocumentDto {
  category: DocumentCategory;
  description?: string;
  documentDate?: string;
  notes?: string;
}

export interface DocumentCategoryOption {
  value: DocumentCategory;
  label: string;
}

// Note types
export type NoteType = 'clinical' | 'administrative';

export interface PatientNote {
  id: string;
  patientId: string;
  type: NoteType;
  content: string;
  createdById: string;
  createdBy?: { fullName?: string; username?: string };
  createdAt: string;
}

export interface CreateNoteDto {
  type: NoteType;
  content: string;
}

export const patientsService = {
  // Create a new patient
  create: async (data: CreatePatientDto): Promise<Patient> => {
    const response = await api.post<{ message: string; data: Patient }>('/patients', data);
    return response.data.data;
  },

  // Check for duplicate patients before registration
  checkDuplicates: async (data: CreatePatientDto): Promise<DuplicateCheckResult> => {
    const response = await api.post<DuplicateCheckResult>('/patients/check-duplicates', data);
    return response.data;
  },

  // Search patients
  search: async (params: PatientSearchParams): Promise<PaginatedResponse<Patient>> => {
    const response = await api.get<PaginatedResponse<Patient>>('/patients', { params });
    return response.data;
  },

  // Get patient by ID
  getById: async (id: string): Promise<Patient> => {
    const response = await api.get<Patient>(`/patients/${id}`);
    return response.data;
  },

  // Get patient by MRN
  getByMRN: async (mrn: string): Promise<Patient> => {
    const response = await api.get<Patient>(`/patients/mrn/${mrn}`);
    return response.data;
  },

  // Update patient
  update: async (id: string, data: UpdatePatientDto): Promise<Patient> => {
    const response = await api.patch<{ message: string; data: Patient }>(`/patients/${id}`, data);
    return response.data.data;
  },

  // Delete patient (soft delete)
  delete: async (id: string): Promise<void> => {
    await api.delete(`/patients/${id}`);
  },

  // ==================== DOCUMENT METHODS ====================

  // Get available document categories for current user
  getDocumentCategories: async (): Promise<DocumentCategoryOption[]> => {
    const response = await api.get<{ data: DocumentCategoryOption[] }>('/patients/document-categories');
    return response.data.data;
  },

  // Upload a document
  uploadDocument: async (patientId: string, file: File, dto: UploadDocumentDto): Promise<PatientDocument> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', dto.category);
    if (dto.description) formData.append('description', dto.description);
    if (dto.documentDate) formData.append('documentDate', dto.documentDate);
    if (dto.notes) formData.append('notes', dto.notes);

    const response = await api.post<{ message: string; data: PatientDocument }>(
      `/patients/${patientId}/documents`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    );
    return response.data.data;
  },

  // Get patient documents (filtered by role)
  getDocuments: async (patientId: string, category?: DocumentCategory): Promise<PatientDocument[]> => {
    const params = category ? { category } : {};
    const response = await api.get<{ data: PatientDocument[] }>(`/patients/${patientId}/documents`, { params });
    return response.data.data;
  },

  // Get document statistics
  getDocumentStats: async (patientId: string): Promise<Array<{ category: string; count: number }>> => {
    const response = await api.get<{ data: Array<{ category: string; count: number }> }>(
      `/patients/${patientId}/documents/stats`
    );
    return response.data.data;
  },

  // Get document metadata
  getDocument: async (documentId: string): Promise<PatientDocument> => {
    const response = await api.get<{ data: PatientDocument }>(`/patients/documents/${documentId}`);
    return response.data.data;
  },

  // Download document file (returns blob)
  downloadDocumentBlob: async (documentId: string): Promise<Blob> => {
    const response = await api.get(`/patients/documents/${documentId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // Delete document
  deleteDocument: async (documentId: string): Promise<void> => {
    await api.delete(`/patients/documents/${documentId}`);
  },

  // ==================== NOTES API ====================

  // Create patient note
  createNote: async (patientId: string, dto: CreateNoteDto): Promise<PatientNote> => {
    const response = await api.post<{ message: string; data: PatientNote }>(
      `/patients/${patientId}/notes`,
      dto
    );
    return response.data.data;
  },

  // Get patient notes
  getNotes: async (patientId: string): Promise<PatientNote[]> => {
    const response = await api.get<{ data: PatientNote[] }>(`/patients/${patientId}/notes`);
    return response.data.data;
  },

  // Get single note
  getNote: async (noteId: string): Promise<PatientNote> => {
    const response = await api.get<{ data: PatientNote }>(`/patients/notes/${noteId}`);
    return response.data.data;
  },

  // Delete note
  deleteNote: async (noteId: string): Promise<void> => {
    await api.delete(`/patients/notes/${noteId}`);
  },
};

export default patientsService;
