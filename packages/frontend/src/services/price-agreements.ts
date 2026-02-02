import api from './api';

export type PriceAgreementStatus = 'draft' | 'pending' | 'active' | 'expired' | 'terminated';

export interface VolumeDiscount {
  minQuantity: number;
  maxQuantity: number | null;
  discountPercent: number;
}

export interface PriceHistory {
  price: number;
  date: string;
  changePercent: number;
}

export interface PriceAgreement {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  facilityId: string;
  itemId?: string;
  itemCode: string;
  itemName: string;
  category?: string;
  unitPrice: number;
  unit: string;
  validFrom: string;
  validTo: string;
  volumeDiscounts?: VolumeDiscount[];
  priceHistory?: PriceHistory[];
  notes?: string;
  isBestPrice?: boolean;
  status: PriceAgreementStatus;
  createdById: string;
  createdBy?: { id: string; fullName: string };
  approvedById?: string;
  approvedBy?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface PriceAgreementStats {
  active: number;
  pending: number;
  expired: number;
  total: number;
  uniqueItemsCovered: number;
}

export interface PriceComparison {
  id: string;
  supplier: { id: string; name: string; code: string };
  itemCode: string;
  itemName: string;
  unitPrice: number;
  effectivePrice: number;
  appliedDiscount: number;
  unit: string;
  validTo: string;
}

// DTOs
export interface CreatePriceAgreementDto {
  supplierId: string;
  facilityId: string;
  itemId?: string;
  itemCode: string;
  itemName: string;
  category?: string;
  unitPrice: number;
  unit?: string;
  validFrom: string;
  validTo: string;
  volumeDiscounts?: VolumeDiscount[];
  notes?: string;
}

export interface UpdatePriceAgreementDto {
  unitPrice?: number;
  validFrom?: string;
  validTo?: string;
  volumeDiscounts?: VolumeDiscount[];
  notes?: string;
  status?: PriceAgreementStatus;
}

export const priceAgreementsService = {
  list: async (facilityId: string, options?: { status?: PriceAgreementStatus; supplierId?: string; itemCode?: string }): Promise<PriceAgreement[]> => {
    const response = await api.get<PriceAgreement[]>('/price-agreements', { params: { facilityId, ...options } });
    return response.data;
  },
  getById: async (id: string): Promise<PriceAgreement> => {
    const response = await api.get<PriceAgreement>(`/price-agreements/${id}`);
    return response.data;
  },
  create: async (data: CreatePriceAgreementDto): Promise<PriceAgreement> => {
    const response = await api.post<PriceAgreement>('/price-agreements', data);
    return response.data;
  },
  update: async (id: string, data: UpdatePriceAgreementDto): Promise<PriceAgreement> => {
    const response = await api.put<PriceAgreement>(`/price-agreements/${id}`, data);
    return response.data;
  },
  activate: async (id: string): Promise<PriceAgreement> => {
    const response = await api.post<PriceAgreement>(`/price-agreements/${id}/activate`);
    return response.data;
  },
  terminate: async (id: string, reason: string): Promise<PriceAgreement> => {
    const response = await api.post<PriceAgreement>(`/price-agreements/${id}/terminate`, { reason });
    return response.data;
  },
  comparePrices: async (facilityId: string, itemCode: string, quantity?: number): Promise<PriceComparison[]> => {
    const response = await api.post<PriceComparison[]>('/price-agreements/compare', { itemCode, quantity }, { params: { facilityId } });
    return response.data;
  },
  getBestPrice: async (facilityId: string, itemCode: string, quantity?: number): Promise<PriceComparison | null> => {
    const response = await api.get<PriceComparison>(`/price-agreements/best-price/${itemCode}`, { params: { facilityId, quantity } });
    return response.data;
  },
  getStats: async (facilityId: string): Promise<PriceAgreementStats> => {
    const response = await api.get<PriceAgreementStats>('/price-agreements/stats', { params: { facilityId } });
    return response.data;
  },
  getExpiring: async (facilityId: string, daysAhead?: number): Promise<PriceAgreement[]> => {
    const response = await api.get<PriceAgreement[]>('/price-agreements/expiring', { params: { facilityId, daysAhead } });
    return response.data;
  },
};

export default priceAgreementsService;
