import api from './api';

export interface LabTest {
  id: string;
  code: string;
  name: string;
  category: string;
  sampleType?: string;
  normalRange?: string;
  unit?: string;
  turnaroundTime?: string;
  price: number;
  cost?: number;
  isActive?: boolean;
}

export interface LabOrder {
  id: string;
  orderNumber: string;
  encounterId?: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
    phone?: string;
    room?: string;
  };
  doctorId?: string;
  doctor?: {
    id: string;
    fullName: string;
  };
  tests: LabOrderTest[];
  priority?: 'routine' | 'urgent' | 'stat';
  status: 'pending' | 'sample_collected' | 'processing' | 'completed' | 'cancelled' | 'collected' | 'verified' | 'in-progress';
  clinicalNotes?: string;
  orderedBy?: string;
  assignedTo?: string;
  collectedAt?: string;
  collectedBy?: string;
  sampleType?: string;
  sampleId?: string;
  completedAt?: string;
  createdAt: string;
}

export interface LabOrderTest {
  id: string;
  orderId?: string;
  testId: string;
  testName: string;
  name?: string;
  testCode?: string;
  category?: string;
  status: 'pending' | 'collected' | 'processing' | 'completed';
  result?: LabResult;
  price?: number;
  parameters?: Array<{ name: string; unit: string; referenceRange: string; criticalLow?: number; criticalHigh?: number }>;
}

export interface LabResult {
  id: string;
  testId: string;
  parameters: LabParameter[];
  interpretation?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  createdAt: string;
}

export interface LabParameter {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag?: 'normal' | 'low' | 'high' | 'critical';
}

export interface CreateLabOrderDto {
  encounterId: string;
  patientId: string;
  doctorId: string;
  tests: Array<{ testId: string; testCode: string; testName: string; price: number }>;
  priority?: 'routine' | 'urgent' | 'stat';
  clinicalNotes?: string;
}

export interface RecordResultDto {
  testId: string;
  parameters: LabParameter[];
  interpretation?: string;
}

export interface CreateResultDto {
  orderId: string;
  values: Array<{ parameter: string; value: string; unit: string; status: string }>;
  notes?: string;
}

export const labService = {
  // Orders
  orders: {
    list: async (params?: { status?: string; patientId?: string; date?: string }): Promise<LabOrder[]> => {
      const response = await api.get<LabOrder[]>('/lab/orders', { params });
      return response.data;
    },
    getPending: async (): Promise<LabOrder[]> => {
      const response = await api.get<LabOrder[]>('/lab/orders/pending');
      return response.data;
    },
    getById: async (id: string): Promise<LabOrder> => {
      const response = await api.get<LabOrder>(`/lab/orders/${id}`);
      return response.data;
    },
    create: async (data: CreateLabOrderDto): Promise<LabOrder> => {
      const response = await api.post<LabOrder>('/lab/orders', data);
      return response.data;
    },
    collectSample: async (orderId: string): Promise<LabOrder> => {
      const response = await api.post<LabOrder>(`/lab/orders/${orderId}/collect`);
      return response.data;
    },
    startProcessing: async (orderId: string): Promise<LabOrder> => {
      const response = await api.post<LabOrder>(`/lab/orders/${orderId}/process`);
      return response.data;
    },
    assign: async (orderId: string, technician: string): Promise<LabOrder> => {
      const response = await api.patch<LabOrder>(`/lab/orders/${orderId}/assign`, { technician });
      return response.data;
    },
    updateStatus: async (orderId: string, status: string): Promise<LabOrder> => {
      const response = await api.patch<LabOrder>(`/lab/orders/${orderId}/status`, { status });
      return response.data;
    },
  },

  // Results
  results: {
    create: async (data: CreateResultDto): Promise<LabResult> => {
      const response = await api.post<LabResult>(`/lab/orders/${data.orderId}/results`, data);
      return response.data;
    },
    record: async (orderId: string, data: RecordResultDto): Promise<LabResult> => {
      const response = await api.post<LabResult>(`/lab/orders/${orderId}/results`, data);
      return response.data;
    },
    verify: async (resultId: string): Promise<LabResult> => {
      const response = await api.post<LabResult>(`/lab/results/${resultId}/verify`);
      return response.data;
    },
    getByPatient: async (patientId: string): Promise<LabResult[]> => {
      const response = await api.get<LabResult[]>(`/lab/results/patient/${patientId}`);
      return response.data;
    },
  },

  // Test catalog
  tests: {
    list: async (): Promise<LabTest[]> => {
      const response = await api.get('/lab/tests');
      return response.data;
    },
    getByCategory: async (category: string): Promise<LabTest[]> => {
      const response = await api.get(`/lab/tests/category/${category}`);
      return response.data;
    },
    create: async (data: Partial<LabTest>): Promise<LabTest> => {
      const response = await api.post('/lab/tests', data);
      return response.data;
    },
    update: async (id: string, data: Partial<LabTest>): Promise<LabTest> => {
      const response = await api.patch(`/lab/tests/${id}`, data);
      return response.data;
    },
    toggleActive: async (id: string): Promise<LabTest> => {
      const response = await api.patch(`/lab/tests/${id}/toggle`);
      return response.data;
    },
  },
};

export default labService;
