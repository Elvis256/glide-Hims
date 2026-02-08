import api from './api';

// Types
export interface InsurancePriceList {
  id: string;
  insuranceProviderId: string;
  insuranceProviderName?: string;
  serviceId?: string;
  serviceName?: string;
  labTestId?: string;
  labTestName?: string;
  agreedPrice: number;
  currency: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingRule {
  id: string;
  name: string;
  description?: string;
  ruleType: 'insurance' | 'membership' | 'loyalty' | 'promotion' | 'volume' | 'time_based';
  discountType: 'percentage' | 'fixed_amount' | 'price_list';
  discountValue?: number;
  priority: number;
  canStack: boolean;
  stackWithTypes?: string[];
  appliesTo: 'services' | 'lab' | 'pharmacy' | 'all';
  conditions?: Record<string, any>;
  validFrom?: string;
  validTo?: string;
  isActive: boolean;
}

export interface AppliedDiscount {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  discountType: string;
  discountAmount: number;
  description?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  insuranceAdjustment: number;
  membershipDiscount: number;
  loyaltyDiscount: number;
  otherDiscounts: number;
  subtotal: number;
  tax: number;
  total: number;
}

export interface ResolvedPrice {
  originalPrice: number;
  finalPrice: number;
  currency: string;
  payerType: string;
  appliedDiscounts: AppliedDiscount[];
  breakdown: PriceBreakdown;
}

export interface ResolvePriceRequest {
  serviceId?: string;
  labTestId?: string;
  patientId?: string;
  encounterId?: string;
  insuranceProviderId?: string;
  payerType?: 'cash' | 'insurance' | 'corporate';
  quantity?: number;
}

export interface PriceComparison {
  serviceId?: string;
  labTestId?: string;
  itemName: string;
  basePrice: number;
  prices: {
    providerId: string;
    providerName: string;
    agreedPrice: number;
    discount: number;
    discountPercent: number;
  }[];
}

export interface CreateInsurancePriceListDto {
  insuranceProviderId: string;
  serviceId?: string;
  labTestId?: string;
  agreedPrice: number;
  currency?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  notes?: string;
}

export interface BulkCreateInsurancePriceListDto {
  insuranceProviderId: string;
  items: {
    serviceId?: string;
    labTestId?: string;
    agreedPrice: number;
  }[];
  effectiveFrom?: string;
  effectiveTo?: string;
}

export interface CreatePricingRuleDto {
  name: string;
  description?: string;
  ruleType: 'insurance' | 'membership' | 'loyalty' | 'promotion' | 'volume' | 'time_based';
  discountType: 'percentage' | 'fixed_amount' | 'price_list';
  discountValue?: number;
  priority?: number;
  canStack?: boolean;
  stackWithTypes?: string[];
  appliesTo?: 'services' | 'lab' | 'pharmacy' | 'all';
  conditions?: Record<string, any>;
  validFrom?: string;
  validTo?: string;
}

// API Functions

// Price Resolution
export const resolvePrice = async (dto: ResolvePriceRequest): Promise<ResolvedPrice> => {
  const response = await api.post('/pricing/resolve', dto);
  return response.data;
};

export const comparePrices = async (serviceId?: string, labTestId?: string): Promise<PriceComparison> => {
  const params = new URLSearchParams();
  if (serviceId) params.append('serviceId', serviceId);
  if (labTestId) params.append('labTestId', labTestId);
  const response = await api.get(`/pricing/compare?${params.toString()}`);
  return response.data;
};

// Insurance Price Lists
export const getInsurancePriceLists = async (query: {
  insuranceProviderId?: string;
  serviceId?: string;
  labTestId?: string;
  isActive?: boolean;
}): Promise<InsurancePriceList[]> => {
  const params = new URLSearchParams();
  if (query.insuranceProviderId) params.append('insuranceProviderId', query.insuranceProviderId);
  if (query.serviceId) params.append('serviceId', query.serviceId);
  if (query.labTestId) params.append('labTestId', query.labTestId);
  if (query.isActive !== undefined) params.append('isActive', String(query.isActive));
  const response = await api.get(`/pricing/insurance-price-lists?${params.toString()}`);
  return response.data;
};

export const getInsurancePriceListById = async (id: string): Promise<InsurancePriceList> => {
  const response = await api.get(`/pricing/insurance-price-lists/${id}`);
  return response.data;
};

export const createInsurancePriceList = async (dto: CreateInsurancePriceListDto): Promise<InsurancePriceList> => {
  const response = await api.post('/pricing/insurance-price-lists', dto);
  return response.data;
};

export const bulkCreateInsurancePriceLists = async (dto: BulkCreateInsurancePriceListDto): Promise<InsurancePriceList[]> => {
  const response = await api.post('/pricing/insurance-price-lists/bulk', dto);
  return response.data;
};

export const updateInsurancePriceList = async (id: string, dto: Partial<CreateInsurancePriceListDto>): Promise<InsurancePriceList> => {
  const response = await api.patch(`/pricing/insurance-price-lists/${id}`, dto);
  return response.data;
};

export const deleteInsurancePriceList = async (id: string): Promise<void> => {
  await api.delete(`/pricing/insurance-price-lists/${id}`);
};

// Pricing Rules
export const getPricingRules = async (): Promise<PricingRule[]> => {
  const response = await api.get('/pricing/rules');
  return response.data;
};

export const getPricingRuleById = async (id: string): Promise<PricingRule> => {
  const response = await api.get(`/pricing/rules/${id}`);
  return response.data;
};

export const createPricingRule = async (dto: CreatePricingRuleDto): Promise<PricingRule> => {
  const response = await api.post('/pricing/rules', dto);
  return response.data;
};

export const updatePricingRule = async (id: string, dto: Partial<CreatePricingRuleDto>): Promise<PricingRule> => {
  const response = await api.patch(`/pricing/rules/${id}`, dto);
  return response.data;
};

export const deletePricingRule = async (id: string): Promise<void> => {
  await api.delete(`/pricing/rules/${id}`);
};
