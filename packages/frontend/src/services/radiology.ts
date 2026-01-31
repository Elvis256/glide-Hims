import api from './api';

// Types matching backend entities
export interface ImagingModality {
  id: string;
  facilityId: string;
  name: string;
  modalityType: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'mammography' | 'fluoroscopy' | 'nuclear' | 'pet';
  manufacturer?: string;
  model?: string;
  location?: string;
  isActive: boolean;
  isAvailable: boolean;
}

export interface ImagingOrder {
  id: string;
  orderNumber: string;
  facilityId: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    firstName: string;
    lastName: string;
    fullName?: string;
  };
  encounterId?: string;
  modalityId: string;
  modality?: ImagingModality | string;
  studyType: string;
  examType?: string; // Legacy alias for studyType
  bodyPart?: string;
  clinicalHistory?: string;
  clinicalIndication?: string;
  priority: 'routine' | 'urgent' | 'stat';
  status: 'ordered' | 'scheduled' | 'in_progress' | 'completed' | 'reported' | 'cancelled' | 'pending';
  orderedById: string;
  orderedBy?: { firstName: string; lastName: string; fullName?: string };
  doctor?: { id: string; fullName: string };
  orderedAt: string;
  scheduledAt?: string;
  performedById?: string;
  performedBy?: { firstName: string; lastName: string };
  performedAt?: string;
  completedAt?: string; // Legacy alias for performedAt
  technologistNotes?: string;
  accessionNumber?: string;
  imageCount?: number;
  assignedTo?: string;
  createdAt: string;
}

export interface ImagingResult {
  id: string;
  imagingOrderId: string;
  orderId?: string; // Legacy alias
  findings: string;
  impression: string;
  recommendations?: string;
  findingCategory: 'normal' | 'abnormal' | 'critical' | 'incidental';
  isCritical: boolean;
  reportedById: string;
  reportedBy?: { firstName: string; lastName: string };
  radiologist?: { id: string; fullName: string }; // Legacy alias
  reportedAt: string;
  verifiedById?: string;
  verifiedBy?: { firstName: string; lastName: string };
  verifiedAt?: string;
  status?: 'draft' | 'finalized' | 'pending' | 'preliminary' | 'final'; // Legacy support
  images?: Array<{ id: string; url: string; description?: string }>;
  createdAt: string;
}

export interface DashboardStats {
  totalModalities: number;
  pendingOrders: number;
  todayOrders: number;
  completedPendingReport: number;
  reportedToday: number;
}

export interface CreateImagingOrderDto {
  facilityId: string;
  patientId: string;
  encounterId?: string;
  modalityId: string;
  studyType: string;
  bodyPart?: string;
  clinicalHistory?: string;
  clinicalIndication?: string;
  priority?: 'routine' | 'urgent' | 'stat';
}

export interface CreateImagingResultDto {
  imagingOrderId: string;
  findings: string;
  impression: string;
  recommendations?: string;
  findingCategory?: 'normal' | 'abnormal' | 'critical' | 'incidental';
  isCritical?: boolean;
}

export const radiologyService = {
  // Dashboard - matches backend /radiology/dashboard
  dashboard: {
    get: async (facilityId: string): Promise<DashboardStats> => {
      const response = await api.get('/radiology/dashboard', { params: { facilityId } });
      return response.data;
    },
    getTurnaroundStats: async (facilityId: string, startDate: string, endDate: string): Promise<any[]> => {
      const response = await api.get('/radiology/stats/turnaround', { params: { facilityId, startDate, endDate } });
      return response.data;
    },
  },

  // Modalities - matches backend /radiology/modalities
  modalities: {
    list: async (facilityId: string, params?: { type?: string; active?: boolean }): Promise<ImagingModality[]> => {
      const response = await api.get('/radiology/modalities', { params: { facilityId, ...params } });
      return response.data;
    },
    create: async (data: Partial<ImagingModality>): Promise<ImagingModality> => {
      const response = await api.post('/radiology/modalities', data);
      return response.data;
    },
  },

  // Orders - matches backend /radiology/orders
  orders: {
    list: async (facilityId: string, params?: { status?: string; modalityId?: string; patientId?: string; priority?: string; date?: string }): Promise<ImagingOrder[]> => {
      const response = await api.get('/radiology/orders', { params: { facilityId, ...params } });
      return response.data;
    },
    getWorklist: async (facilityId: string): Promise<ImagingOrder[]> => {
      const response = await api.get('/radiology/worklist', { params: { facilityId } });
      return response.data;
    },
    getPendingReports: async (facilityId: string): Promise<ImagingOrder[]> => {
      const response = await api.get('/radiology/pending-reports', { params: { facilityId } });
      return response.data;
    },
    getById: async (id: string): Promise<ImagingOrder> => {
      const response = await api.get(`/radiology/orders/${id}`);
      return response.data;
    },
    create: async (data: CreateImagingOrderDto): Promise<ImagingOrder> => {
      const response = await api.post('/radiology/orders', data);
      return response.data;
    },
    schedule: async (orderId: string, scheduledAt: string): Promise<ImagingOrder> => {
      const response = await api.patch(`/radiology/orders/${orderId}/schedule`, { scheduledAt });
      return response.data;
    },
    start: async (orderId: string): Promise<ImagingOrder> => {
      const response = await api.post(`/radiology/orders/${orderId}/start`);
      return response.data;
    },
    // Legacy alias for backward compatibility
    startExam: async (orderId: string): Promise<ImagingOrder> => {
      const response = await api.post(`/radiology/orders/${orderId}/start`);
      return response.data;
    },
    complete: async (orderId: string, data?: { technologistNotes?: string; accessionNumber?: string; imageCount?: number }): Promise<ImagingOrder> => {
      const response = await api.post(`/radiology/orders/${orderId}/complete`, data || {});
      return response.data;
    },
    cancel: async (orderId: string): Promise<ImagingOrder> => {
      const response = await api.post(`/radiology/orders/${orderId}/cancel`);
      return response.data;
    },
  },

  // Results - matches backend /radiology/results
  results: {
    getForOrder: async (orderId: string): Promise<ImagingResult | null> => {
      const response = await api.get(`/radiology/orders/${orderId}/result`);
      return response.data;
    },
    create: async (data: CreateImagingResultDto): Promise<ImagingResult> => {
      const response = await api.post('/radiology/results', data);
      return response.data;
    },
    // Legacy method for backward compatibility
    getByPatient: async (patientId: string): Promise<ImagingResult[]> => {
      // Note: This endpoint doesn't exist in backend - returns empty array
      // Frontend should use orders.list with patientId filter instead
      console.warn('radiologyService.results.getByPatient is deprecated - use orders.list with patientId filter');
      return [];
    },
  },
};

// Legacy type aliases for backward compatibility
export type RadiologyOrder = ImagingOrder;
export type RadiologyResult = ImagingResult;

export default radiologyService;
