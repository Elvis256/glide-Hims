import api from './api';
import type { Supplier } from './suppliers';

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

/** One row of the ledger, assembled by getSupplierLedger from GRNs, paid
 *  payment vouchers and approved credit/debit notes. These rows are built in
 *  memory — they carry no id and no description. `credit` increases the
 *  payable (GRN, debit note), `debit` reduces it (payment, credit note). */
export interface LedgerEntry {
  date: string;
  type: 'GRN' | 'Payment' | 'Credit Note' | 'Debit Note';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface SupplierLedger {
  supplier: Supplier;
  openingBalance: number;
  transactions: LedgerEntry[];
  closingBalance: number;
}

/** Buckets are keyed by GRN age: current ≤30d, days30 31-60, days60 61-90,
 *  days90 91-120, over90 >120. `total` is the supplier's outstanding balance
 *  (posted GRNs minus paid vouchers), so it does not equal the bucket sum. */
export interface AgingBucket {
  supplierId: string;
  supplierName: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  over90: number;
  total: number;
}

export interface SupplierAgingReport {
  suppliers: AgingBucket[];
  totals: Omit<AgingBucket, 'supplierId' | 'supplierName'>;
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
    /**
     * The endpoint has always accepted a cheque number and bank reference and
     * the page never sent either, so a cheque payment could not be reconciled
     * against the bank statement — while the voucher detail view happily
     * displayed a bankReference that nothing could populate.
     */
    process: async (
      id: string,
      bankDetails?: { chequeNumber?: string; bankReference?: string },
    ): Promise<void> => {
      await api.post(`/supplier-finance/payments/${id}/process`, bankDetails ?? {});
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
    // startDate/endDate are REQUIRED — the controller feeds them straight to
    // new Date(), so omitting them makes the query range an Invalid Date.
    getLedger: async (
      supplierId: string,
      startDate: string,
      endDate: string,
    ): Promise<SupplierLedger> => {
      const response = await api.get(`/supplier-finance/reports/supplier-ledger/${supplierId}`, {
        params: { startDate, endDate },
      });
      return response.data;
    },
    // facilityId is REQUIRED — the GRN/payment lookups filter on it.
    getAging: async (facilityId: string): Promise<SupplierAgingReport> => {
      const response = await api.get('/supplier-finance/reports/aging', { params: { facilityId } });
      return response.data;
    },
    getPaymentSummary: async (params?: Record<string, any>): Promise<any> => {
      const response = await api.get('/supplier-finance/reports/payment-summary', { params });
      return response.data;
    },
  },
};
