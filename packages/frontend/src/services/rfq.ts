import api from './api';

// RFQ Types
export type RFQStatus = 'draft' | 'sent' | 'pending_responses' | 'responses_received' | 'closed' | 'cancelled';
export type QuotationStatus = 'received' | 'under_review' | 'selected' | 'rejected';
export type ApprovalLevel = 'manager' | 'finance' | 'director';
export type QuotationApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface RFQItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  specifications?: string;
}

export interface RFQVendor {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string; email?: string };
  hasResponded: boolean;
  responseDate?: string;
  invitedDate?: string;
}

export interface VendorQuotationItem {
  id: string;
  rfqItemId: string;
  rfqItem?: RFQItem;
  unitPrice: number;
  totalPrice: number;
  deliveryDays?: number;
  inStock: boolean;
  notes?: string;
}

export interface QuotationApproval {
  id: string;
  quotationId: string;
  level: ApprovalLevel;
  status: QuotationApprovalStatus;
  approverId?: string;
  approver?: { id: string; fullName: string };
  approvedAt?: string;
  comments?: string;
}

export interface VendorQuotation {
  id: string;
  quotationNumber: string;
  rfqId: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  totalAmount: number;
  deliveryDays: number;
  paymentTerms?: string;
  warranty?: string;
  validUntil: string;
  receivedDate: string;
  notes?: string;
  status: QuotationStatus;
  items: VendorQuotationItem[];
  approvals?: QuotationApproval[];
  createdAt: string;
}

export interface RFQ {
  id: string;
  rfqNumber: string;
  title: string;
  facilityId: string;
  purchaseRequestId?: string;
  purchaseRequest?: { id: string; requestNumber: string };
  deadline: string;
  sentDate?: string;
  closedDate?: string;
  notes?: string;
  instructions?: string;
  status: RFQStatus;
  createdById: string;
  createdBy?: { id: string; fullName: string };
  items: RFQItem[];
  vendors: RFQVendor[];
  quotations: VendorQuotation[];
  createdAt: string;
  updatedAt: string;
}

// DTOs
export interface CreateRFQItemDto {
  itemCode: string;
  itemName: string;
  quantity: number;
  unit?: string;
  specifications?: string;
}

export interface CreateRFQDto {
  title: string;
  facilityId: string;
  purchaseRequestId?: string;
  deadline: string;
  notes?: string;
  instructions?: string;
  items: CreateRFQItemDto[];
  vendorIds?: string[];
}

export interface CreateQuotationItemDto {
  rfqItemId: string;
  unitPrice: number;
  totalPrice: number;
  deliveryDays?: number;
  inStock?: boolean;
  notes?: string;
}

export interface CreateQuotationDto {
  rfqId: string;
  supplierId: string;
  quotationNumber: string;
  totalAmount: number;
  deliveryDays: number;
  paymentTerms?: string;
  warranty?: string;
  validUntil: string;
  notes?: string;
  items: CreateQuotationItemDto[];
}

export const rfqService = {
  // RFQs
  list: async (facilityId: string, status?: RFQStatus): Promise<RFQ[]> => {
    const response = await api.get<RFQ[]>('/rfq', { params: { facilityId, status } });
    return response.data;
  },
  getById: async (id: string): Promise<RFQ> => {
    const response = await api.get<RFQ>(`/rfq/${id}`);
    return response.data;
  },
  create: async (data: CreateRFQDto): Promise<RFQ> => {
    const response = await api.post<RFQ>('/rfq', data);
    return response.data;
  },
  update: async (id: string, data: Partial<CreateRFQDto>): Promise<RFQ> => {
    const response = await api.put<RFQ>(`/rfq/${id}`, data);
    return response.data;
  },
  addVendors: async (id: string, vendorIds: string[]): Promise<RFQ> => {
    const response = await api.post<RFQ>(`/rfq/${id}/vendors`, { vendorIds });
    return response.data;
  },
  send: async (id: string): Promise<RFQ> => {
    const response = await api.post<RFQ>(`/rfq/${id}/send`);
    return response.data;
  },
  close: async (id: string): Promise<RFQ> => {
    const response = await api.post<RFQ>(`/rfq/${id}/close`);
    return response.data;
  },

  // Quotations
  quotations: {
    list: async (rfqId: string): Promise<VendorQuotation[]> => {
      const response = await api.get<VendorQuotation[]>(`/rfq/${rfqId}/quotations`);
      return response.data;
    },
    getById: async (id: string): Promise<VendorQuotation> => {
      const response = await api.get<VendorQuotation>(`/rfq/quotations/${id}`);
      return response.data;
    },
    receive: async (data: CreateQuotationDto): Promise<VendorQuotation> => {
      const response = await api.post<VendorQuotation>('/rfq/quotations', data);
      return response.data;
    },
    selectWinner: async (quotationId: string): Promise<VendorQuotation> => {
      const response = await api.post<VendorQuotation>(`/rfq/quotations/${quotationId}/select`);
      return response.data;
    },
  },

  // Approvals
  approvals: {
    getPending: async (facilityId: string, level?: ApprovalLevel): Promise<QuotationApproval[]> => {
      const response = await api.get<QuotationApproval[]>('/rfq/approvals/pending', { params: { facilityId, level } });
      return response.data;
    },
    approve: async (id: string, comments?: string): Promise<QuotationApproval> => {
      const response = await api.post<QuotationApproval>(`/rfq/approvals/${id}/approve`, { comments });
      return response.data;
    },
    reject: async (id: string, comments: string): Promise<QuotationApproval> => {
      const response = await api.post<QuotationApproval>(`/rfq/approvals/${id}/reject`, { comments });
      return response.data;
    },
  },
};

export default rfqService;
