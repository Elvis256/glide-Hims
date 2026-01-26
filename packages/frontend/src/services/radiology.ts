import api from './api';

export interface RadiologyOrder {
  id: string;
  orderNumber: string;
  encounterId?: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  doctorId?: string;
  doctor?: {
    id: string;
    fullName: string;
  };
  modality: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'mammogram' | 'fluoroscopy';
  examType: string;
  bodyPart: string;
  priority?: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'reported' | 'cancelled';
  clinicalHistory?: string;
  assignedTo?: string;
  scheduledAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface RadiologyResult {
  id: string;
  orderId: string;
  findings: string;
  impression: string;
  recommendations?: string;
  radiologistId: string;
  radiologist?: {
    id: string;
    fullName: string;
  };
  images?: Array<{ id: string; url: string; description?: string }>;
  status: 'draft' | 'finalized';
  createdAt: string;
  finalizedAt?: string;
}

export interface CreateRadiologyOrderDto {
  encounterId?: string;
  patientId: string;
  doctorId: string;
  modality: string;
  examType: string;
  bodyPart: string;
  priority?: 'routine' | 'urgent' | 'stat';
  clinicalHistory?: string;
}

export const radiologyService = {
  // Orders
  orders: {
    list: async (params?: { status?: string; modality?: string; date?: string }): Promise<RadiologyOrder[]> => {
      const response = await api.get<RadiologyOrder[]>('/radiology/orders', { params });
      return response.data;
    },
    getPending: async (): Promise<RadiologyOrder[]> => {
      const response = await api.get<RadiologyOrder[]>('/radiology/orders/pending');
      return response.data;
    },
    getById: async (id: string): Promise<RadiologyOrder> => {
      const response = await api.get<RadiologyOrder>(`/radiology/orders/${id}`);
      return response.data;
    },
    create: async (data: CreateRadiologyOrderDto): Promise<RadiologyOrder> => {
      const response = await api.post<RadiologyOrder>('/radiology/orders', data);
      return response.data;
    },
    schedule: async (orderId: string, scheduledAt: string): Promise<RadiologyOrder> => {
      const response = await api.patch<RadiologyOrder>(`/radiology/orders/${orderId}/schedule`, { scheduledAt });
      return response.data;
    },
    startExam: async (orderId: string): Promise<RadiologyOrder> => {
      const response = await api.post<RadiologyOrder>(`/radiology/orders/${orderId}/start`);
      return response.data;
    },
    complete: async (orderId: string): Promise<RadiologyOrder> => {
      const response = await api.post<RadiologyOrder>(`/radiology/orders/${orderId}/complete`);
      return response.data;
    },
    assign: async (orderId: string, technician: string): Promise<RadiologyOrder> => {
      const response = await api.patch<RadiologyOrder>(`/radiology/orders/${orderId}/assign`, { technician });
      return response.data;
    },
    updateStatus: async (orderId: string, status: string): Promise<RadiologyOrder> => {
      const response = await api.patch<RadiologyOrder>(`/radiology/orders/${orderId}/status`, { status });
      return response.data;
    },
  },

  // Results/Reports
  results: {
    create: async (orderId: string, data: { findings: string; impression: string; recommendations?: string }): Promise<RadiologyResult> => {
      const response = await api.post<RadiologyResult>(`/radiology/orders/${orderId}/results`, data);
      return response.data;
    },
    finalize: async (resultId: string): Promise<RadiologyResult> => {
      const response = await api.post<RadiologyResult>(`/radiology/results/${resultId}/finalize`);
      return response.data;
    },
    getByPatient: async (patientId: string): Promise<RadiologyResult[]> => {
      const response = await api.get<RadiologyResult[]>(`/radiology/results/patient/${patientId}`);
      return response.data;
    },
  },

  // Exam catalog
  exams: {
    list: async (): Promise<Array<{ id: string; modality: string; examType: string; bodyPart: string; price: number }>> => {
      const response = await api.get('/radiology/exams');
      return response.data;
    },
    getByModality: async (modality: string): Promise<Array<{ id: string; examType: string; bodyPart: string; price: number }>> => {
      const response = await api.get(`/radiology/exams/modality/${modality}`);
      return response.data;
    },
  },
};

export default radiologyService;
