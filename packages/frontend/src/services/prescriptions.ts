import api from './api';

export interface Prescription {
  id: string;
  prescriptionNumber: string;
  encounterId: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  doctorId: string;
  doctor?: {
    id: string;
    fullName: string;
  };
  items: PrescriptionItem[];
  status: 'pending' | 'partial' | 'dispensed' | 'cancelled' | 'dispensing' | 'ready' | 'collected';
  priority?: 'high' | 'normal' | 'low';
  notes?: string;
  createdAt: string;
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  drugId: string;
  drugName: string;
  drugCode?: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  dispensedQuantity: number;
  instructions?: string;
  unitPrice?: number;
  isDispensed?: boolean;
  status: 'pending' | 'dispensed' | 'out-of-stock';
}

export interface UpdatePrescriptionItemDto {
  drugName?: string;
  drugCode?: string;
  dose?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  unitPrice?: number;
  instructions?: string;
}

export interface DispenseDto {
  prescriptionId: string;
  items: Array<{
    prescriptionItemId: string;
    quantity: number;
    batchNumber?: string;
    expiryDate?: string;
    unitPrice?: number;
  }>;
  counselingProvided: boolean;
  notes?: string;
  dispenserSignature?: string;
}

export interface PrescriptionQueryParams {
  patientId?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface CreatePrescriptionItemDto {
  drugCode: string;
  drugName: string;
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions?: string;
}

export interface ControlledSubstanceLog {
  id: string;
  prescriptionItemId: string;
  dispensationId: string;
  drugSchedule: string;
  quantityDispensed: number;
  runningBalance: number;
  dispensedById: string;
  dispensedBy?: { id: string; fullName: string };
  witnessId?: string;
  witness?: { id: string; fullName: string };
  witnessSignature?: string;
  witnessedAt?: string;
  doubleCheckById?: string;
  doubleCheckBy?: { id: string; fullName: string };
  doubleCheckedAt?: string;
  notes?: string;
  facilityId?: string;
  prescriptionItem?: PrescriptionItem;
  createdAt: string;
}

export interface ControlledSubstanceQueryParams {
  facilityId?: string;
  drugSchedule?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface CreatePrescriptionDto {
  encounterId: string;
  items: CreatePrescriptionItemDto[];
  notes?: string;
  prescriberSignature?: string;
}

export const prescriptionsService = {
  // Create a new prescription
  create: async (data: CreatePrescriptionDto): Promise<Prescription> => {
    const response = await api.post<Prescription>('/prescriptions', data);
    return response.data;
  },

  // List prescriptions
  list: async (params?: PrescriptionQueryParams): Promise<Prescription[]> => {
    const response = await api.get('/prescriptions', { params });
    // API returns { data: [...], total: ... }
    return response.data?.data || response.data || [];
  },

  // Get pending prescriptions (pharmacy queue)
  getPending: async (): Promise<Prescription[]> => {
    const response = await api.get('/prescriptions/queue');
    return response.data?.data || response.data || [];
  },

  // Get by ID
  getById: async (id: string): Promise<Prescription> => {
    const response = await api.get<Prescription>(`/prescriptions/${id}`);
    return response.data;
  },

  // Get by prescription number
  getByNumber: async (prescriptionNumber: string): Promise<Prescription> => {
    const response = await api.get<Prescription>(`/prescriptions/number/${prescriptionNumber}`);
    return response.data;
  },

  // Search prescriptions
  search: async (query: string): Promise<Prescription[]> => {
    const response = await api.get<Prescription[]>('/prescriptions/search', { params: { q: query } });
    return response.data;
  },

  // Dispense prescription
  dispense: async (data: DispenseDto): Promise<Prescription> => {
    const response = await api.post<Prescription>('/prescriptions/dispense', data);
    return response.data;
  },

  // Mark item as out of stock
  markOutOfStock: async (prescriptionItemId: string): Promise<PrescriptionItem> => {
    const response = await api.post<PrescriptionItem>(`/prescriptions/items/${prescriptionItemId}/out-of-stock`);
    return response.data;
  },

  // Get patient prescriptions
  getPatientPrescriptions: async (patientId: string): Promise<Prescription[]> => {
    const response = await api.get<Prescription[]>(`/prescriptions/patient/${patientId}`);
    return response.data;
  },

  // Update prescription status
  updateStatus: async (prescriptionId: string, status: string, notes?: string): Promise<Prescription> => {
    const response = await api.patch<Prescription>(`/prescriptions/${prescriptionId}/status`, { status, notes });
    return response.data;
  },

  // Administer medication (nursing)
  administerMedication: async (prescriptionItemId: string, data: {
    administeredAt?: string;
    notes?: string;
    routeOfAdministration?: string;
    doseGiven?: number;
    witnessId?: string;
  }) => {
    const response = await api.post(`/prescriptions/${prescriptionItemId}/administer`, data);
    return response.data;
  },

  // Get administration history
  getAdministrationHistory: async (prescriptionId: string) => {
    const response = await api.get(`/prescriptions/${prescriptionId}/administrations`);
    return response.data;
  },

  // Update a prescription item (pharmacist edit)
  updateItem: async (itemId: string, data: UpdatePrescriptionItemDto): Promise<PrescriptionItem> => {
    const response = await api.patch<PrescriptionItem>(`/prescriptions/items/${itemId}`, data);
    return response.data;
  },

  // Remove a prescription item
  removeItem: async (prescriptionId: string, itemId: string): Promise<Prescription> => {
    const response = await api.delete<Prescription>(`/prescriptions/${prescriptionId}/items/${itemId}`);
    return response.data;
  },

  // Get dispensing timing analytics
  getTimingAnalytics: async (dateFrom?: string, dateTo?: string): Promise<any> => {
    const response = await api.get('/prescriptions/analytics/timing', { params: { dateFrom, dateTo } });
    return response.data;
  },

  // ─── E-Prescription Digital Signatures ───

  // Verify a prescription signature
  verifySignature: async (prescriptionId: string): Promise<Prescription> => {
    const response = await api.post<Prescription>(`/prescriptions/${prescriptionId}/verify-signature`);
    return response.data;
  },

  // ─── Controlled Substance Methods ───

  // Add witness to controlled substance dispense
  addControlledWitness: async (logId: string, data: { witnessId: string; witnessSignature?: string }): Promise<ControlledSubstanceLog> => {
    const response = await api.post<ControlledSubstanceLog>(`/prescriptions/controlled/${logId}/witness`, data);
    return response.data;
  },

  // Double-check verification for controlled substance
  doubleCheckControlled: async (logId: string, checkerId: string): Promise<ControlledSubstanceLog> => {
    const response = await api.post<ControlledSubstanceLog>(`/prescriptions/controlled/${logId}/double-check`, { checkerId });
    return response.data;
  },

  // Get narcotics register for a specific item
  getNarcoticsRegister: async (itemId: string, facilityId: string): Promise<ControlledSubstanceLog[]> => {
    const response = await api.get<ControlledSubstanceLog[]>(`/prescriptions/controlled/register/${itemId}`, { params: { facilityId } });
    return response.data;
  },

  // Get full controlled substance register
  getControlledSubstanceRegister: async (params?: ControlledSubstanceQueryParams): Promise<{ data: ControlledSubstanceLog[]; total: number }> => {
    const response = await api.get('/prescriptions/controlled/register', { params });
    return response.data;
  },
};

  // ─── DUR Reports ───

  getDURPrescribingPatterns: async (params?: { dateFrom?: string; dateTo?: string; facilityId?: string }) => {
    const response = await api.get('/prescriptions/analytics/dur/prescribing-patterns', { params });
    return response.data;
  },

  getDURTherapeuticTrends: async (params?: { dateFrom?: string; dateTo?: string; facilityId?: string }) => {
    const response = await api.get('/prescriptions/analytics/dur/therapeutic-trends', { params });
    return response.data;
  },

  getDURPrescriberStats: async (params?: { dateFrom?: string; dateTo?: string; facilityId?: string }) => {
    const response = await api.get('/prescriptions/analytics/dur/prescriber-stats', { params });
    return response.data;
  },

  getDURSummary: async (params?: { dateFrom?: string; dateTo?: string; facilityId?: string }) => {
    const response = await api.get('/prescriptions/analytics/dur/summary', { params });
    return response.data;
  },
};

export default prescriptionsService;
