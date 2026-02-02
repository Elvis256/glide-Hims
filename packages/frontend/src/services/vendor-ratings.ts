import api from './api';

export interface VendorRating {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  facilityId: string;
  purchaseOrderId?: string;
  purchaseOrder?: { id: string; orderNumber: string };
  deliveryTimeRating: number;
  qualityRating: number;
  priceRating: number;
  serviceRating: number;
  overallRating: number;
  comments?: string;
  ratedById: string;
  ratedBy?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface VendorRatingSummary {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  totalReviews: number;
  avgDeliveryTime: number;
  avgQuality: number;
  avgPrice: number;
  avgService: number;
  avgOverall: number;
  lastReviewDate?: string;
  trend: 'up' | 'down' | 'stable';
}

// DTOs
export interface CreateVendorRatingDto {
  supplierId: string;
  facilityId: string;
  purchaseOrderId?: string;
  deliveryTimeRating: number;
  qualityRating: number;
  priceRating: number;
  serviceRating: number;
  comments?: string;
}

export interface UpdateVendorRatingDto {
  deliveryTimeRating?: number;
  qualityRating?: number;
  priceRating?: number;
  serviceRating?: number;
  comments?: string;
}

export const vendorRatingsService = {
  list: async (facilityId: string, supplierId?: string): Promise<VendorRating[]> => {
    const response = await api.get<VendorRating[]>('/vendor-ratings', { params: { facilityId, supplierId } });
    return response.data;
  },
  getById: async (id: string): Promise<VendorRating> => {
    const response = await api.get<VendorRating>(`/vendor-ratings/${id}`);
    return response.data;
  },
  create: async (data: CreateVendorRatingDto): Promise<VendorRating> => {
    const response = await api.post<VendorRating>('/vendor-ratings', data);
    return response.data;
  },
  update: async (id: string, data: UpdateVendorRatingDto): Promise<VendorRating> => {
    const response = await api.put<VendorRating>(`/vendor-ratings/${id}`, data);
    return response.data;
  },
  delete: async (id: string): Promise<void> => {
    await api.delete(`/vendor-ratings/${id}`);
  },
  getSummary: async (supplierId: string): Promise<VendorRatingSummary | null> => {
    const response = await api.get<VendorRatingSummary>(`/vendor-ratings/summary/${supplierId}`);
    return response.data;
  },
  getAllSummaries: async (): Promise<VendorRatingSummary[]> => {
    const response = await api.get<VendorRatingSummary[]>('/vendor-ratings/summaries');
    return response.data;
  },
  getTopVendors: async (limit?: number): Promise<VendorRatingSummary[]> => {
    const response = await api.get<VendorRatingSummary[]>('/vendor-ratings/top', { params: { limit } });
    return response.data;
  },
};

export default vendorRatingsService;
