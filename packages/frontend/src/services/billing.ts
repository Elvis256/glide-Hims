import api from './api';

// Invoice
export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  encounterId?: string;
  type: 'opd' | 'ipd' | 'pharmacy' | 'lab' | 'radiology';
  subtotal: number;
  discount: number;
  tax: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: 'draft' | 'pending' | 'partial' | 'paid' | 'cancelled' | 'refunded';
  paymentType: 'cash' | 'insurance' | 'corporate' | 'membership';
  insurancePolicyId?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  serviceId?: string;
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  totalPrice: number;
}

export interface CreateInvoiceDto {
  patientId: string;
  encounterId?: string;
  items: Array<{
    serviceCode: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountPercent?: number;
  }>;
  taxPercent?: number;
  notes?: string;
}

export interface AddInvoiceItemDto {
  serviceId?: string;
  serviceCode: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
}

// Payment
export interface Payment {
  id: string;
  receiptNumber?: string;
  invoiceId: string;
  invoice?: Invoice;
  amount: number;
  paymentMethod: string;
  reference?: string;
  referenceNumber?: string;
  receivedBy?: string;
  patientName?: string;
  notes?: string;
  status?: 'completed' | 'voided' | 'pending';
  createdAt: string;
}

export interface CreatePaymentDto {
  amount: number;
  paymentMethod: string;
  reference?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface InvoiceQueryParams {
  patientId?: string;
  type?: string;
  status?: string;
  paymentType?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

export interface DailyRevenue {
  date: string;
  totalRevenue: number;
  cashRevenue: number;
  insuranceRevenue: number;
  invoiceCount: number;
  paymentCount: number;
  byType: Record<string, number>;
  byMethod: Record<string, number>;
}

export const billingService = {
  // Invoices
  invoices: {
    list: async (params?: InvoiceQueryParams): Promise<{ data: Invoice[]; total: number }> => {
      const response = await api.get('/billing/invoices', { params });
      return response.data;
    },
    getPending: async (): Promise<Invoice[]> => {
      const response = await api.get<Invoice[]>('/billing/invoices/pending');
      return response.data;
    },
    getByNumber: async (invoiceNumber: string): Promise<Invoice> => {
      const response = await api.get<Invoice>(`/billing/invoices/number/${invoiceNumber}`);
      return response.data;
    },
    getById: async (id: string): Promise<Invoice> => {
      const response = await api.get<Invoice>(`/billing/invoices/${id}`);
      return response.data;
    },
    create: async (data: CreateInvoiceDto): Promise<Invoice> => {
      const response = await api.post<Invoice>('/billing/invoices', data);
      return response.data;
    },
    addItem: async (invoiceId: string, item: AddInvoiceItemDto): Promise<InvoiceItem> => {
      const response = await api.post<InvoiceItem>(`/billing/invoices/${invoiceId}/items`, item);
      return response.data;
    },
    getPayments: async (invoiceId: string): Promise<Payment[]> => {
      const response = await api.get<Payment[]>(`/billing/invoices/${invoiceId}/payments`);
      return response.data;
    },
  },

  // Payments
  payments: {
    list: async (params?: { startDate?: string; endDate?: string; method?: string }): Promise<Payment[]> => {
      const response = await api.get<Payment[]>('/billing/payments', { params });
      return response.data;
    },
    record: async (invoiceId: string, data: CreatePaymentDto): Promise<Payment> => {
      const response = await api.post<Payment>(`/billing/invoices/${invoiceId}/payments`, data);
      return response.data;
    },
    void: async (paymentId: string, reason: string): Promise<Payment> => {
      const response = await api.patch<Payment>(`/billing/payments/${paymentId}/void`, { reason });
      return response.data;
    },
  },

  // Revenue
  revenue: {
    getDaily: async (date?: string): Promise<DailyRevenue> => {
      const response = await api.get<DailyRevenue>('/billing/revenue/daily', { params: { date } });
      return response.data;
    },
  },
};

export default billingService;
