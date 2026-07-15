import api from './api';

export interface PaymentVoucherItem {
  id: string;
  description: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  amount: number;
  grnId?: string;
}

export interface PaymentVoucher {
  id: string;
  voucherNumber: string;
  supplierId: string;
  supplier?: { id: string; name: string };
  facilityId: string;
  purchaseOrderId?: string;
  purchaseOrder?: { id: string; orderNumber: string };
  paymentDate: string;
  grossAmount: number;
  withholdingTax: number;
  otherDeductions: number;
  netAmount: number;
  paymentMethod: 'cash' | 'bank_transfer' | 'cheque' | 'mobile_money' | 'credit_card';
  chequeNumber?: string;
  bankReference?: string;
  bankName?: string;
  accountNumber?: string;
  description?: string;
  remarks?: string;
  journalEntryId?: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'cancelled';
  preparedBy?: { id: string; fullName: string };
  approvedBy?: { id: string; fullName: string };
  approvedAt?: string;
  paidBy?: { id: string; fullName: string };
  paidAt?: string;
  items: PaymentVoucherItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentVoucherDto {
  facilityId: string;
  supplierId: string;
  purchaseOrderId?: string;
  paymentDate: string;
  grossAmount: number;
  withholdingTax?: number;
  otherDeductions?: number;
  paymentMethod: string;
  chequeNumber?: string;
  bankReference?: string;
  bankName?: string;
  accountNumber?: string;
  description?: string;
  remarks?: string;
  items: {
    description: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    amount: number;
    grnId?: string;
  }[];
}

/** Mirrors backend SupplierCreditNote entity. Amount columns are `decimal`, so
 *  TypeORM returns them as STRINGS — coerce with Number() before arithmetic. */
export interface CreditNote {
  id: string;
  noteNumber: string;
  noteType: 'credit_note' | 'debit_note';
  supplierId: string;
  /** Joined by listCreditNotes. */
  supplier?: { id: string; name: string };
  facilityId: string;
  noteDate: string;
  supplierInvoiceNumber?: string;
  grnId?: string;
  reason: string;
  reasonDetails?: string;
  subtotalAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  appliedAmount: number | string;
  balanceAmount: number | string;
  status: 'draft' | 'pending_approval' | 'approved' | 'applied' | 'cancelled';
  /** UUID columns, NOT relations. The createdByUser/approvedByUser relations
   *  exist on the entity but listCreditNotes does not join them. */
  createdBy: string;
  approvedBy?: string;
  createdByUser?: { id: string; fullName: string };
  approvedByUser?: { id: string; fullName: string };
  approvedAt?: string;
  notes?: string;
  items: any[];
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
    // facilityId is REQUIRED — listCreditNotes filters on it unconditionally.
    list: async (params: {
      facilityId: string;
      noteType?: CreditNote['noteType'];
      status?: CreditNote['status'];
      supplierId?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }): Promise<CreditNote[]> => {
      const response = await api.get('/supplier-finance/credit-notes', { params });
      return Array.isArray(response.data) ? response.data : response.data?.data || [];
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
    // ApplyCreditNoteDto requires both fields — posting an empty body 400s.
    apply: async (id: string, paymentVoucherId: string, amount: number): Promise<void> => {
      await api.post(`/supplier-finance/credit-notes/${id}/apply`, { paymentVoucherId, amount });
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
