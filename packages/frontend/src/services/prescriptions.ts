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
  dose: string;
  frequency: string;
  duration: string;
  quantity: number;
  dispensedQuantity: number;
  instructions?: string;
  status: 'pending' | 'dispensed' | 'out-of-stock';
}

export interface DispenseDto {
  prescriptionId: string;
  items: Array<{
    prescriptionItemId: string;
    quantity: number;
    batchNumber?: string;
    expiryDate?: string;
  }>;
  counselingProvided: boolean;
  notes?: string;
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

export interface CreatePrescriptionDto {
  encounterId: string;
  items: CreatePrescriptionItemDto[];
  notes?: string;
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
    const response = await api.get('/prescriptions/pending');
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
  updateStatus: async (prescriptionId: string, status: string): Promise<Prescription> => {
    const response = await api.patch<Prescription>(`/prescriptions/${prescriptionId}/status`, { status });
    return response.data;
  },
};

export default prescriptionsService;
