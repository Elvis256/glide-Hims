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
  status: 'draft' | 'pending' | 'partially_paid' | 'paid' | 'cancelled' | 'refunded';
  paymentType: 'cash' | 'insurance' | 'corporate' | 'membership';
  insurancePolicyId?: string;
  dueDate?: string;
  notes?: string;
  items?: InvoiceItem[];
  payments?: Payment[];
  createdAt: string;
  updatedAt: string;
}

/** Normalize backend field names to frontend Invoice interface */
function normalizeInvoice(raw: any): Invoice {
  return {
    ...raw,
    // Map backend camelCase → frontend aliases
    discount: raw.discountAmount ?? raw.discount ?? 0,
    tax: raw.taxAmount ?? raw.tax ?? 0,
    paidAmount: raw.amountPaid ?? raw.paidAmount ?? 0,
    balance: raw.balanceDue ?? raw.balance ?? 0,
    paymentType: raw.paymentType ?? 'cash',
    dueDate: raw.dueDate ?? undefined,
    items: (raw.items || []).map((item: any) => ({
      ...item,
      totalPrice: item.amount ?? item.totalPrice ?? (item.quantity * item.unitPrice),
    })),
  };
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
  paidAt?: string;
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
  search?: string;
  patientMrn?: string;
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
      const raw = response.data;
      return { data: (raw.data || []).map(normalizeInvoice), total: raw.total || 0 };
    },
    getPending: async (): Promise<Invoice[]> => {
      const response = await api.get<any[]>('/billing/invoices/pending');
      return (response.data || []).map(normalizeInvoice);
    },
    getByNumber: async (invoiceNumber: string): Promise<Invoice> => {
      const response = await api.get(`/billing/invoices/number/${invoiceNumber}`);
      return normalizeInvoice(response.data);
    },
    getById: async (id: string): Promise<Invoice> => {
      const response = await api.get(`/billing/invoices/${id}`);
      return normalizeInvoice(response.data);
    },
    create: async (data: CreateInvoiceDto): Promise<Invoice> => {
      const response = await api.post('/billing/invoices', data);
      return normalizeInvoice(response.data);
    },
    addItem: async (invoiceId: string, item: AddInvoiceItemDto): Promise<InvoiceItem> => {
      const response = await api.post<InvoiceItem>(`/billing/invoices/${invoiceId}/items`, item);
      return response.data;
    },
    getPayments: async (invoiceId: string): Promise<Payment[]> => {
      const response = await api.get<Payment[]>(`/billing/invoices/${invoiceId}/payments`);
      return response.data;
    },
    cancel: async (invoiceId: string, reason?: string): Promise<Invoice> => {
      const response = await api.patch(`/billing/invoices/${invoiceId}/cancel`, { reason });
      return normalizeInvoice(response.data);
    },
    refund: async (invoiceId: string, reason?: string): Promise<Invoice> => {
      const response = await api.patch(`/billing/invoices/${invoiceId}/refund`, { reason });
      return normalizeInvoice(response.data);
    },
  },

  // Payments
  payments: {
    list: async (params?: { startDate?: string; endDate?: string; method?: string }): Promise<Payment[]> => {
      const response = await api.get<any[]>('/billing/payments', { params });
      // Transform backend field names to frontend expectations
      return response.data.map(p => ({
        ...p,
        paymentMethod: p.method || p.paymentMethod,
        receivedBy: p.receivedBy?.username || p.receivedBy,
        patientName: p.patientName || p.invoice?.patient?.fullName,
      }));
    },
    record: async (invoiceId: string, data: CreatePaymentDto): Promise<Payment> => {
      const response = await api.post<Payment>('/billing/payments', {
        invoiceId,
        amount: data.amount,
        method: data.paymentMethod,
        transactionReference: data.reference,
      });
      return response.data;
    },
    getById: async (paymentId: string): Promise<Payment & { invoice?: Invoice }> => {
      const response = await api.get(`/billing/payments/${paymentId}`);
      const raw = response.data;
      return {
        ...raw,
        paymentMethod: raw.method || raw.paymentMethod,
        receivedBy: raw.receivedBy?.username || raw.receivedBy?.fullName || raw.receivedBy,
        invoice: raw.invoice ? normalizeInvoice(raw.invoice) : undefined,
      };
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
    getDashboard: async (facilityId: string, period?: string) => {
      const response = await api.get('/billing/revenue/dashboard', { params: { facilityId, period } });
      return response.data;
    },
  },
};

export default billingService;
