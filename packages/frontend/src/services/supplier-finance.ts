import api from './api';

export interface PaymentVoucher {
  id: string;
  voucherNumber: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  amount: number;
  currency: string;
  paymentMethod?: string;
  bankAccount?: string;
  referenceNumber?: string;
  invoiceIds?: string[];
  status: 'draft' | 'submitted' | 'approved' | 'processed' | 'cancelled';
  notes?: string;
  createdBy?: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface CreditNote {
  id: string;
  creditNoteNumber: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  amount: number;
  reason: string;
  referenceInvoice?: string;
  status: 'draft' | 'approved' | 'applied' | 'cancelled';
  appliedToInvoices?: string[];
  createdAt: string;
}

export interface SupplierLedger {
  supplierId: string;
  supplierName: string;
  totalPurchases: number;
  totalPayments: number;
  totalCredits: number;
  outstandingBalance: number;
  entries: LedgerEntry[];
}

export interface LedgerEntry {
  id: string;
  date: string;
  type: 'invoice' | 'payment' | 'credit_note' | 'debit_note';
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface AgingBucket {
  range: string;
  amount: number;
  count: number;
  suppliers: string[];
}

export const supplierFinanceService = {
  payments: {
    list: async (params?: Record<string, any>): Promise<PaymentVoucher[]> => {
      const response = await api.get('/supplier-finance/payments', { params });
      return response.data?.data || response.data || [];
    },
    getById: async (id: string): Promise<PaymentVoucher> => {
      const response = await api.get(`/supplier-finance/payments/${id}`);
      return response.data;
    },
    create: async (data: Partial<PaymentVoucher>): Promise<PaymentVoucher> => {
      const response = await api.post('/supplier-finance/payments', data);
      return response.data;
    },
    submit: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/payments/${id}/submit`);
    },
    approve: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/payments/${id}/approve`);
    },
    process: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/payments/${id}/process`);
    },
    cancel: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/payments/${id}/cancel`);
    },
  },
  creditNotes: {
    list: async (params?: Record<string, any>): Promise<CreditNote[]> => {
      const response = await api.get('/supplier-finance/credit-notes', { params });
      return response.data?.data || response.data || [];
    },
    getById: async (id: string): Promise<CreditNote> => {
      const response = await api.get(`/supplier-finance/credit-notes/${id}`);
      return response.data;
    },
    create: async (data: Partial<CreditNote>): Promise<CreditNote> => {
      const response = await api.post('/supplier-finance/credit-notes', data);
      return response.data;
    },
    approve: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/credit-notes/${id}/approve`);
    },
    apply: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/credit-notes/${id}/apply`);
    },
    cancel: async (id: string): Promise<void> => {
      await api.post(`/supplier-finance/credit-notes/${id}/cancel`);
    },
  },
  reports: {
    getLedger: async (supplierId: string): Promise<SupplierLedger> => {
      const response = await api.get(`/supplier-finance/reports/supplier-ledger/${supplierId}`);
      return response.data;
    },
    getAging: async (): Promise<AgingBucket[]> => {
      const response = await api.get('/supplier-finance/reports/aging');
      return response.data?.data || response.data || [];
    },
    getPaymentSummary: async (params?: Record<string, any>): Promise<any> => {
      const response = await api.get('/supplier-finance/reports/payment-summary', { params });
      return response.data;
    },
  },
};
