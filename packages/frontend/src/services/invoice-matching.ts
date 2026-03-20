import api from './api';

export type InvoiceMatchStatus = 'pending' | 'matched' | 'mismatch' | 'flagged' | 'approved' | 'paid';

export interface InvoiceMatchItem {
  id: string;
  matchId: string;
  itemId: string;
  itemName: string;
  poQty: number;
  poPrice: number;
  grnQty: number;
  invoiceQty: number;
  invoicePrice: number;
  qtyMatch: boolean;
  priceMatch: boolean;
}

export interface InvoiceMatch {
  id: string;
  matchNumber: string;
  facilityId: string;
  purchaseOrderId: string;
  purchaseOrder?: { id: string; orderNumber: string; items?: any[]; supplier?: { id: string; name: string; code?: string } };
  grnId: string;
  goodsReceipt?: { id: string; grnNumber: string; items?: any[] };
  vendorInvoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  invoiceTotal: number;
  poTotal: number;
  grnTotal: number;
  variance: number;
  variancePercent: number;
  paymentScheduled?: string;
  notes?: string;
  status: InvoiceMatchStatus;
  supplierId: string;
  supplier?: { id: string; name: string; code?: string };
  approvedById?: string;
  approvedBy?: { id: string; fullName: string };
  approvedAt?: string;
  items: InvoiceMatchItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceMatchStats {
  pending: number;
  matched: number;
  mismatch: number;
  approved: number;
  paid: number;
  flagged: number;
  totalVarianceAmount: number;
}

export interface CreateInvoiceMatchItemDto {
  itemId: string;
  itemName: string;
  poQty: number;
  poPrice: number;
  grnQty?: number;
  invoiceQty: number;
  invoicePrice: number;
}

export interface CreateInvoiceMatchDto {
  facilityId: string;
  purchaseOrderId: string;
  grnId: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate?: string;
  invoiceAmount: number;
  items: CreateInvoiceMatchItemDto[];
}

export interface ApproveMatchDto {
  notes?: string;
  paymentScheduled?: string;
}

export const invoiceMatchingService = {
  list: async (facilityId: string, status?: InvoiceMatchStatus): Promise<InvoiceMatch[]> => {
    const response = await api.get('/invoice-matching', { params: { facilityId, status } });
    const data = response.data;
    return Array.isArray(data) ? data : (data?.data || []);
  },
  getById: async (id: string): Promise<InvoiceMatch> => {
    const response = await api.get(`/invoice-matching/${id}`);
    return response.data;
  },
  create: async (data: CreateInvoiceMatchDto): Promise<InvoiceMatch> => {
    const response = await api.post('/invoice-matching', data);
    return response.data;
  },
  approve: async (id: string, dto?: ApproveMatchDto): Promise<InvoiceMatch> => {
    const response = await api.post(`/invoice-matching/${id}/approve`, dto || {});
    return response.data;
  },
  markAsPaid: async (id: string): Promise<InvoiceMatch> => {
    const response = await api.post(`/invoice-matching/${id}/paid`);
    return response.data;
  },
  flag: async (id: string, reason: string): Promise<InvoiceMatch> => {
    const response = await api.post(`/invoice-matching/${id}/flag`, { reason });
    return response.data;
  },
  getStats: async (facilityId: string): Promise<InvoiceMatchStats> => {
    const response = await api.get('/invoice-matching/stats', { params: { facilityId } });
    return response.data;
  },
};

export default invoiceMatchingService;
