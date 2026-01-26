import api from './api';

// Pharmacy Sale
export interface PharmacySale {
  id: string;
  saleNumber: string;
  storeId: string;
  saleType: 'walk-in' | 'prescription' | 'inpatient' | 'wholesale';
  patientId?: string;
  patient?: {
    id: string;
    mrn: string;
    fullName: string;
  };
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  totalAmount: number;
  amountPaid: number;
  paymentMethod?: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit';
  transactionReference?: string;
  status: 'pending' | 'completed' | 'cancelled';
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface SaleItem {
  id: string;
  saleId: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  totalPrice: number;
  instructions?: string;
}

// Drug Classification
export interface DrugClassification {
  id: string;
  drugId: string;
  drugName: string;
  genericName?: string;
  brandName?: string;
  schedule?: string;
  therapeuticClass?: string;
  isControlled: boolean;
  isNarcotic: boolean;
  highAlert: boolean;
  isOnFormulary: boolean;
  createdAt: string;
}

// Drug Interaction
export interface DrugInteraction {
  id: string;
  drug1Id: string;
  drug2Id: string;
  drug1Name: string;
  drug2Name: string;
  severity: 'minor' | 'moderate' | 'major' | 'contraindicated';
  description: string;
  recommendation?: string;
}

// Supplier
export interface Supplier {
  id: string;
  facilityId: string;
  code: string;
  name: string;
  type: 'pharmaceutical' | 'medical_supplies' | 'equipment' | 'consumables' | 'general';
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
  status: 'active' | 'inactive' | 'blocked';
  createdAt: string;
}

// DTOs
export interface CreatePharmacySaleDto {
  storeId: string;
  saleType: 'walk-in' | 'prescription' | 'inpatient' | 'wholesale';
  patientId?: string;
  customerName?: string;
  customerPhone?: string;
  prescriptionId?: string;
  paymentMethod?: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit';
  transactionReference?: string;
  discountAmount?: number;
  notes?: string;
  items: CreateSaleItemDto[];
}

export interface CreateSaleItemDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  instructions?: string;
}

export interface CompleteSaleDto {
  amountPaid: number;
  paymentMethod: 'cash' | 'card' | 'mobile_money' | 'insurance' | 'credit';
  transactionReference?: string;
}

export interface CreateSupplierDto {
  facilityId: string;
  code: string;
  name: string;
  type: 'pharmaceutical' | 'medical_supplies' | 'equipment' | 'consumables' | 'general';
  contactPerson?: string;
  email?: string;
  phone?: string;
  altPhone?: string;
  address?: string;
  city?: string;
  country?: string;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  bankName?: string;
  bankAccount?: string;
  notes?: string;
}

export interface SaleListParams {
  storeId?: string;
  status?: string;
  date?: string;
  limit?: number;
}

export interface SupplierListParams {
  facilityId?: string;
  type?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface DailySalesSummary {
  date: string;
  totalSales: number;
  totalAmount: number;
  byPaymentMethod: Record<string, number>;
  bySaleType: Record<string, number>;
}

export const pharmacyService = {
  // Sales
  sales: {
    list: async (params?: SaleListParams): Promise<PharmacySale[]> => {
      const response = await api.get<PharmacySale[]>('/pharmacy/sales', { params });
      return response.data;
    },
    getById: async (id: string): Promise<PharmacySale> => {
      const response = await api.get<PharmacySale>(`/pharmacy/sales/${id}`);
      return response.data;
    },
    create: async (data: CreatePharmacySaleDto): Promise<PharmacySale> => {
      const response = await api.post<PharmacySale>('/pharmacy/sales', data);
      return response.data;
    },
    complete: async (id: string, data: CompleteSaleDto): Promise<PharmacySale> => {
      const response = await api.post<PharmacySale>(`/pharmacy/sales/${id}/complete`, data);
      return response.data;
    },
    cancel: async (id: string): Promise<PharmacySale> => {
      const response = await api.post<PharmacySale>(`/pharmacy/sales/${id}/cancel`);
      return response.data;
    },
    getDailySummary: async (date?: string): Promise<DailySalesSummary> => {
      const response = await api.get<DailySalesSummary>('/pharmacy/summary/daily', { params: { date } });
      return response.data;
    },
  },

  // Drug Management
  drugs: {
    listClassifications: async (params?: {
      schedule?: string;
      therapeuticClass?: string;
      isControlled?: boolean;
      isOnFormulary?: boolean;
    }): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications', { params });
      return response.data;
    },
    getControlled: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/controlled');
      return response.data;
    },
    getNarcotics: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/narcotics');
      return response.data;
    },
    getHighAlert: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/high-alert');
      return response.data;
    },
    getFormulary: async (): Promise<DrugClassification[]> => {
      const response = await api.get<DrugClassification[]>('/drug-management/classifications/formulary');
      return response.data;
    },
    checkInteractions: async (drugIds: string[]): Promise<DrugInteraction[]> => {
      const response = await api.post<DrugInteraction[]>('/drug-management/interactions/check', { drugIds });
      return response.data;
    },
    getMajorInteractions: async (): Promise<DrugInteraction[]> => {
      const response = await api.get<DrugInteraction[]>('/drug-management/interactions', { params: { severity: 'major' } });
      return response.data;
    },
  },

  // Suppliers
  suppliers: {
    list: async (params?: SupplierListParams): Promise<{ data: Supplier[]; total: number }> => {
      const response = await api.get('/suppliers', { params });
      return response.data;
    },
    getActive: async (facilityId: string): Promise<Supplier[]> => {
      const response = await api.get<Supplier[]>('/suppliers/active', { params: { facilityId } });
      return response.data;
    },
    getById: async (id: string): Promise<Supplier> => {
      const response = await api.get<Supplier>(`/suppliers/${id}`);
      return response.data;
    },
    create: async (data: CreateSupplierDto): Promise<Supplier> => {
      const response = await api.post<Supplier>('/suppliers', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreateSupplierDto> & { status?: string }): Promise<Supplier> => {
      const response = await api.put<Supplier>(`/suppliers/${id}`, data);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/suppliers/${id}`);
    },
    getDashboard: async (): Promise<{
      totalSuppliers: number;
      activeSuppliers: number;
      byType: Record<string, number>;
    }> => {
      const response = await api.get('/suppliers/dashboard');
      return response.data;
    },
  },
};

export default pharmacyService;
