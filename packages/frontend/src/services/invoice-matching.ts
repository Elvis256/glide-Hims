import api from './api';

export type InvoiceMatchStatus = 'pending' | 'matched' | 'mismatch' | 'flagged' | 'approved' | 'paid';
export type MatchVarianceType = 'none' | 'quantity' | 'price' | 'both' | 'accepted';

export interface InvoiceMatchItem {
  id: string;
  matchId: string;
  itemCode: string;
  itemName: string;
  poQuantity: number;
  grnQuantity: number;
  invoiceQuantity: number;
  poUnitPrice: number;
  invoiceUnitPrice: number;
  quantityVariance: number;
  priceVariance: number;
  totalVariance: number;
  varianceType: MatchVarianceType;
  notes?: string;
}

export interface InvoiceMatch {
  id: string;
  matchNumber: string;
  facilityId: string;
  purchaseOrderId: string;
  purchaseOrder?: { id: string; orderNumber: string; supplier?: { id: string; name: string; code: string } };
  grnId: string;
  grn?: { id: string; grnNumber: string };
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  vendorInvoiceRef?: string;
  poAmount: number;
  grnAmount: number;
  amountVariance: number;
  status: InvoiceMatchStatus;
  matchedById?: string;
  matchedBy?: { id: string; fullName: string };
  approvedById?: string;
  approvedBy?: { id: string; fullName: string };
  approvalDate?: string;
  approvalNotes?: string;
  paymentDate?: string;
  paymentReference?: string;
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

// DTOs
export interface CreateInvoiceMatchItemDto {
  itemCode: string;
  itemName: string;
  poQuantity: number;
  grnQuantity: number;
  invoiceQuantity: number;
  poUnitPrice: number;
  invoiceUnitPrice: number;
  notes?: string;
}

export interface CreateInvoiceMatchDto {
  facilityId: string;
  purchaseOrderId: string;
  grnId: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceAmount: number;
  vendorInvoiceRef?: string;
  items: CreateInvoiceMatchItemDto[];
}

export interface ResolveVarianceDto {
  resolution: MatchVarianceType;
  adjustedQuantity?: number;
  adjustedPrice?: number;
  notes: string;
}

export const invoiceMatchingService = {
  list: async (facilityId: string, status?: InvoiceMatchStatus): Promise<InvoiceMatch[]> => {
    const response = await api.get<InvoiceMatch[]>('/invoice-matching', { params: { facilityId, status } });
    return response.data;
  },
  getById: async (id: string): Promise<InvoiceMatch> => {
    const response = await api.get<InvoiceMatch>(`/invoice-matching/${id}`);
    return response.data;
  },
  create: async (data: CreateInvoiceMatchDto): Promise<InvoiceMatch> => {
    const response = await api.post<InvoiceMatch>('/invoice-matching', data);
    return response.data;
  },
  resolveVariance: async (itemId: string, data: ResolveVarianceDto): Promise<InvoiceMatchItem> => {
    const response = await api.post<InvoiceMatchItem>(`/invoice-matching/items/${itemId}/resolve`, data);
    return response.data;
  },
  approve: async (id: string, notes?: string): Promise<InvoiceMatch> => {
    const response = await api.post<InvoiceMatch>(`/invoice-matching/${id}/approve`, { notes });
    return response.data;
  },
  markAsPaid: async (id: string, paymentRef: string): Promise<InvoiceMatch> => {
    const response = await api.post<InvoiceMatch>(`/invoice-matching/${id}/paid`, { paymentRef });
    return response.data;
  },
  flag: async (id: string, reason: string): Promise<InvoiceMatch> => {
    const response = await api.post<InvoiceMatch>(`/invoice-matching/${id}/flag`, { reason });
    return response.data;
  },
  getStats: async (facilityId: string): Promise<InvoiceMatchStats> => {
    const response = await api.get<InvoiceMatchStats>('/invoice-matching/stats', { params: { facilityId } });
    return response.data;
  },
};

export default invoiceMatchingService;
