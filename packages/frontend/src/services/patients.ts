import api from './api';

export type PatientPaymentType = 'cash' | 'insurance' | 'membership' | 'corporate';

/** Where registration actually stores the billing details. */
export interface PatientBillingMetadata {
  paymentType?: PatientPaymentType;
  insuranceProvider?: string;
  insuranceId?: string;
  insurancePolicyNumber?: string;
  membershipType?: string;
  corporateName?: string;
  weight?: number;
  height?: number;
}

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
  allergies?: string[];
  /**
   * These six are NOT columns and no endpoint has ever sent them. The patients
   * table has no weight, height, payment_type, insurance_provider,
   * insurance_policy_number or membership_type — registration puts them in
   * `metadata`, which is where OPDTokenPage and WaitingPatientsPage correctly
   * read them from. Kept optional so that a payload which somehow carries them
   * still type-checks, but read them through the helpers below: the pages that
   * used `patient.paymentType` directly were counting a field that is always
   * undefined, so the Patients dashboard reported 0 insurance and 0 corporate
   * patients for every hospital while the data sat in metadata all along.
   */
  weight?: number;
  height?: number;
  paymentType?: PatientPaymentType;
  insuranceProvider?: string;
  insurancePolicyNumber?: string;
  membershipType?: string;
  userId?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
    email?: string;
    address?: string;
    nationalId?: string;
  };
  metadata?: Record<string, unknown>;
  maritalStatus?: string;
  occupation?: string;
  language?: string;
  photographUrl?: string;
  status?: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Read a billing detail from wherever it actually is: `metadata` first, since
 * that is what registration writes and what the API returns, then the
 * top-level field for any endpoint that flattens it.
 */
/**
 * Structural, not `Partial<Patient>`: several pages carry their own narrower
 * patient record (PatientSearchPage's PatientRecord types `allergies` as a
 * string), and these helpers only ever need the billing bits.
 */
type PatientLike = {
  metadata?: unknown;
  paymentType?: string;
  insuranceProvider?: string;
  membershipType?: string;
  weight?: number;
};

function billing(p?: PatientLike | null): PatientBillingMetadata {
  return ((p?.metadata as PatientBillingMetadata | undefined) ?? {}) as PatientBillingMetadata;
}

export function patientPaymentType(p?: PatientLike | null): PatientPaymentType {
  return (billing(p).paymentType ?? p?.paymentType ?? 'cash') as PatientPaymentType;
}

export function patientInsuranceProvider(p?: PatientLike | null): string | undefined {
  return billing(p).insuranceProvider ?? p?.insuranceProvider;
}

export function patientMembershipType(p?: PatientLike | null): string | undefined {
  return billing(p).membershipType ?? p?.membershipType;
}

export function patientWeight(p?: PatientLike | null): number | undefined {
  return billing(p).weight ?? p?.weight;
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
  allergies?: string[];
  maritalStatus?: string;
  occupation?: string;
  language?: string;
  nextOfKin?: {
    name?: string;
    phone?: string;
    relationship?: string;
    email?: string;
    address?: string;
    nationalId?: string;
  };
  metadata?: Record<string, unknown>;
  /** Override the server-side high-confidence duplicate guard (set after the
   *  receptionist reviews the duplicate warning and confirms a new person). */
  forceCreate?: boolean;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {
  status?: 'active' | 'inactive';
}

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
    gender: string;
    confidenceScore: number;
    confidenceLevel: 'high' | 'medium' | 'low';
    matchReasons: string[];
    lastVisit?: string;
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
    // Controller returns { message, data: patient } (inside the standard
    // envelope, which the interceptor strips) — unwrap the inner data too.
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
    const response = await api.get('/patients/document-categories');
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
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
    const response = await api.get(`/patients/${patientId}/documents`, { params });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
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
    const response = await api.get(`/patients/${patientId}/notes`);
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
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

  // ==================== USER LINKING API ====================

  // Link user account to patient
  linkUser: async (patientId: string, userId: string): Promise<Patient> => {
    const response = await api.post<{ message: string; data: Patient }>(
      `/patients/${patientId}/link-user`,
      { userId }
    );
    return response.data.data;
  },

  // Unlink user account from patient
  unlinkUser: async (patientId: string): Promise<Patient> => {
    const response = await api.delete<{ message: string; data: Patient }>(
      `/patients/${patientId}/unlink-user`
    );
    return response.data.data;
  },

  // Get linked user information
  getLinkedUser: async (patientId: string): Promise<{
    linked: boolean;
    user?: {
      id: string;
      username: string;
      fullName: string;
      email?: string;
      phone?: string;
    };
  }> => {
    const response = await api.get<{
      data: {
        linked: boolean;
        user?: {
          id: string;
          username: string;
          fullName: string;
          email?: string;
          phone?: string;
        };
      };
    }>(`/patients/${patientId}/linked-user`);
    return response.data.data;
  },

  // Merge two patient records (secondary into primary)
  mergePatients: async (primaryId: string, secondaryId: string, reason?: string): Promise<any> => {
    const response = await api.post(`/patients/${primaryId}/merge/${secondaryId}`, { reason });
    return response.data;
  },

  // Get merge history
  getMergeHistory: async (): Promise<any[]> => {
    const response = await api.get('/patients/merges/history');
    return response.data;
  },
};

export default patientsService;
