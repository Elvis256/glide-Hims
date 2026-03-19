import api from './api';

export type ReturnStatus = 'pending' | 'authorized' | 'shipped' | 'received_by_supplier' | 'credit_issued' | 'completed' | 'rejected';
export type ReturnReason = 'expired' | 'near_expiry' | 'damaged' | 'recalled' | 'overstock' | 'quality_issue';

export interface SupplierReturnItem {
  id: string;
  itemId: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unitValue?: number;
  notes?: string;
  item?: { id: string; name: string; code: string };
}

export interface SupplierReturn {
  id: string;
  returnNumber: string;
  supplierId: string;
  facilityId: string;
  reason: ReturnReason;
  status: ReturnStatus;
  notes?: string;
  authorizationNumber?: string;
  creditNoteNumber?: string;
  actualCredit?: number;
  shippingDate?: string;
  receivedDate?: string;
  items?: SupplierReturnItem[];
  supplier?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface SupplierReturnStats {
  total: number;
  pending: number;
  authorized: number;
  shipped: number;
  completed: number;
  totalValue: number;
}

const supplierReturnsService = {
  async create(data: {
    supplierId: string;
    facilityId: string;
    reason: ReturnReason;
    notes?: string;
    items: Array<{
      itemId: string;
      batchNumber?: string;
      expiryDate?: string;
      quantity: number;
      unitValue?: number;
      notes?: string;
    }>;
  }): Promise<SupplierReturn> {
    const response = await api.post('/supplier-returns', data);
    return response.data;
  },

  async list(params?: {
    facilityId?: string;
    supplierId?: string;
    status?: ReturnStatus;
    reason?: ReturnReason;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<SupplierReturn[]> {
    const response = await api.get('/supplier-returns', { params });
    return response.data;
  },

  async getById(id: string): Promise<SupplierReturn> {
    const response = await api.get(`/supplier-returns/${id}`);
    return response.data;
  },

  async getByFacility(facilityId: string): Promise<SupplierReturn[]> {
    const response = await api.get(`/supplier-returns/facility/${facilityId}`);
    return response.data;
  },

  async getBySupplier(supplierId: string, facilityId: string): Promise<SupplierReturn[]> {
    const response = await api.get(`/supplier-returns/supplier/${supplierId}/facility/${facilityId}`);
    return response.data;
  },

  async getStats(facilityId: string): Promise<SupplierReturnStats> {
    const response = await api.get(`/supplier-returns/stats/${facilityId}`);
    return response.data;
  },

  async getSummary(facilityId: string): Promise<any> {
    const response = await api.get(`/supplier-returns/summary/${facilityId}`);
    return response.data;
  },

  async update(id: string, data: {
    status?: ReturnStatus;
    authorizationNumber?: string;
    creditNoteNumber?: string;
    actualCredit?: number;
    shippingDate?: string;
    receivedDate?: string;
    notes?: string;
  }): Promise<SupplierReturn> {
    const response = await api.put(`/supplier-returns/${id}`, data);
    return response.data;
  },

  async updateStatus(id: string, status: ReturnStatus): Promise<SupplierReturn> {
    const response = await api.put(`/supplier-returns/${id}/status/${status}`);
    return response.data;
  },
};

export default supplierReturnsService;
