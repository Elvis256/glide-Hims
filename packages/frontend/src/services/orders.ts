import api from './api';

export type OrderType = 'lab' | 'radiology' | 'pharmacy' | 'procedure';
export type OrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type OrderPriority = 'routine' | 'urgent' | 'stat';

export interface TestCode {
  code: string;
  name: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  orderType: OrderType;
  status: OrderStatus;
  priority: OrderPriority;
  encounterId: string;
  encounter?: {
    id: string;
    visitNumber: string;
    patient?: {
      id: string;
      mrn: string;
      fullName: string;
    };
  };
  orderedById: string;
  orderedBy?: {
    id: string;
    fullName: string;
  };
  instructions?: string;
  clinicalNotes?: string;
  testCodes?: TestCode[];
  resultData?: Record<string, unknown>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderDto {
  encounterId: string;
  orderType: OrderType;
  priority?: OrderPriority;
  instructions?: string;
  clinicalNotes?: string;
  testCodes?: TestCode[];
}

export interface OrderQueryParams {
  orderType?: OrderType;
  status?: OrderStatus;
  encounterId?: string;
  facilityId?: string;
  priority?: OrderPriority;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface LabResult {
  testCode: string;
  testName: string;
  resultValue: string;
  unit?: string;
  referenceRange?: string;
  abnormalFlag?: 'high' | 'low' | 'critical' | 'normal';
  notes?: string;
}

export interface SubmitLabResultsDto {
  results: LabResult[];
  interpretation?: string;
}

export interface SubmitRadiologyReportDto {
  findings: string;
  impression?: string;
  recommendation?: string;
}

export const ordersService = {
  // Create a new order
  create: async (data: CreateOrderDto): Promise<Order> => {
    const response = await api.post<Order>('/orders', data);
    return response.data;
  },

  // List orders with filters
  list: async (params?: OrderQueryParams): Promise<{ data: Order[]; total: number }> => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  // Get order by ID
  getById: async (id: string): Promise<Order> => {
    const response = await api.get<Order>(`/orders/${id}`);
    return response.data;
  },

  // Get orders for an encounter
  getByEncounter: async (encounterId: string): Promise<Order[]> => {
    const response = await api.get<Order[]>(`/orders/encounter/${encounterId}`);
    return response.data;
  },

  // Get lab queue
  getLabQueue: async (facilityId: string): Promise<Order[]> => {
    const response = await api.get<Order[]>(`/orders/queue/lab/${facilityId}`);
    return response.data;
  },

  // Get radiology queue
  getRadiologyQueue: async (facilityId: string): Promise<Order[]> => {
    const response = await api.get<Order[]>(`/orders/queue/radiology/${facilityId}`);
    return response.data;
  },

  // Get order statistics
  getStats: async (facilityId: string, orderType?: OrderType): Promise<Record<string, number>> => {
    const params = orderType ? { orderType } : {};
    const response = await api.get(`/orders/stats/${facilityId}`, { params });
    return response.data;
  },

  // Start processing an order
  startProcessing: async (id: string): Promise<Order> => {
    const response = await api.post<Order>(`/orders/${id}/start`);
    return response.data;
  },

  // Complete an order with results
  complete: async (id: string, resultData: SubmitLabResultsDto | SubmitRadiologyReportDto): Promise<Order> => {
    const response = await api.post<Order>(`/orders/${id}/complete`, resultData);
    return response.data;
  },

  // Submit lab results
  submitLabResults: async (id: string, data: SubmitLabResultsDto): Promise<Order> => {
    const response = await api.post<Order>(`/orders/${id}/lab-results`, data);
    return response.data;
  },

  // Submit radiology report
  submitRadiologyReport: async (id: string, data: SubmitRadiologyReportDto): Promise<Order> => {
    const response = await api.post<Order>(`/orders/${id}/radiology-report`, data);
    return response.data;
  },

  // Cancel an order
  cancel: async (id: string, reason: string): Promise<Order> => {
    const response = await api.post<Order>(`/orders/${id}/cancel`, { reason });
    return response.data;
  },
};

export default ordersService;
