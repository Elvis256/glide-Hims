import api from './api';

export interface FixedAsset {
  id: string;
  facilityId: string;
  departmentId?: string;
  department?: string;
  assetCode: string;
  name: string;
  description?: string;
  category: string;
  subCategory?: string;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  supplier?: string;
  purchaseOrderNumber?: string;
  purchaseDate?: string;
  purchaseCost?: number;
  acquisitionDate?: string;
  acquisitionCost?: number;
  installationCost?: number;
  totalCost?: number;
  residualValue?: number;
  salvageValue?: number;
  usefulLifeYears?: number;
  usefulLifeMonths?: number;
  depreciationMethod?: string;
  depreciationRate?: number;
  depreciationStartDate?: string;
  accumulatedDepreciation?: number;
  bookValue?: number;
  currentMarketValue?: number;
  remainingLife?: string;
  status: string;
  condition: string;
  location?: string;
  assignedTo?: string;
  custodianId?: string;
  custodian?: { id: string; fullName: string };
  warrantyExpiry?: string;
  nextMaintenanceDate?: string;
  maintenanceIntervalDays?: number;
  isInsured?: boolean;
  insurancePolicyNumber?: string;
  insuredValue?: number;
  insuranceExpiry?: string;
  disposalDate?: string;
  disposalMethod?: string;
  disposalAmount?: number;
  disposalValue?: number;
  disposalReason?: string;
  imageUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
  asset?: FixedAsset;
  facilityId: string;
  type: string;
  maintenanceDate: string;
  description: string;
  performedBy?: string;
  serviceProvider?: string;
  cost: number;
  nextDueDate?: string;
  findings?: string;
  recommendations?: string;
}

export interface AssetTransfer {
  id: string;
  assetId: string;
  asset?: FixedAsset;
  facilityId: string;
  fromDepartment?: string;
  fromLocation?: string;
  toDepartment?: string;
  toLocation?: string;
  reason?: string;
  status: string;
  notes?: string;
  createdAt?: string;
  approvedAt?: string;
  completedAt?: string;
}

export interface AssetDepreciation {
  id: string;
  assetId: string;
  periodYear: number;
  periodMonth: number;
  openingBookValue: number;
  depreciationAmount: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
  isPosted: boolean;
  postedAt?: string;
}

export const assetsService = {
  // Assets CRUD
  async list(facilityId: string, filters?: { category?: string; status?: string; search?: string }) {
    const params = { facilityId, ...filters };
    const { data } = await api.get('/assets', { params });
    return data as FixedAsset[];
  },

  async get(id: string) {
    const { data } = await api.get(`/assets/${id}`);
    return data as FixedAsset;
  },

  async create(asset: Partial<FixedAsset>) {
    const { data } = await api.post('/assets', asset);
    return data as FixedAsset;
  },

  async update(id: string, asset: Partial<FixedAsset>) {
    const { data } = await api.put(`/assets/${id}`, asset);
    return data as FixedAsset;
  },

  async delete(id: string) {
    await api.delete(`/assets/${id}`);
  },

  // Depreciation
  async runDepreciation(facilityId: string, period: string) {
    const [year, month] = period.split('-').map(Number);
    const { data } = await api.post('/assets/depreciation/run', { facilityId, year, month });
    return data as AssetDepreciation[];
  },

  async getDepreciationSchedule(assetId: string) {
    const { data } = await api.get(`/assets/${assetId}/depreciation`);
    return data as AssetDepreciation[];
  },

  async getDepreciationReport(facilityId: string) {
    const { data } = await api.get('/assets/depreciation/report', { params: { facilityId } });
    return data;
  },

  // Maintenance
  async recordMaintenance(maintenance: Partial<AssetMaintenance>) {
    const { data } = await api.post('/assets/maintenance', maintenance);
    return data as AssetMaintenance;
  },

  async getMaintenanceHistory(assetId: string) {
    const { data } = await api.get(`/assets/${assetId}/maintenance`);
    return data as AssetMaintenance[];
  },

  async getMaintenanceDue(facilityId: string, daysAhead = 30) {
    const { data } = await api.get('/assets/maintenance/due', { params: { facilityId, daysAhead } });
    return data as FixedAsset[];
  },

  // Transfers
  async initiateTransfer(transfer: Partial<AssetTransfer>) {
    const { data } = await api.post('/assets/transfers', transfer);
    return data as AssetTransfer;
  },

  async approveTransfer(transferId: string) {
    const { data } = await api.put(`/assets/transfers/${transferId}/approve`);
    return data as AssetTransfer;
  },

  async completeTransfer(transferId: string) {
    const { data } = await api.put(`/assets/transfers/${transferId}/complete`);
    return data as AssetTransfer;
  },

  async getTransfers(facilityId: string, status?: string) {
    const { data } = await api.get('/assets/transfers', { params: { facilityId, status } });
    return data as AssetTransfer[];
  },

  // Disposal
  async dispose(id: string, data: { disposalDate: string; disposalValue: number; disposalReason: string; status: string }) {
    const response = await api.put(`/assets/${id}/dispose`, data);
    return response.data as FixedAsset;
  },

  // Reports
  async getValuation(facilityId: string) {
    const { data } = await api.get('/assets/valuation', { params: { facilityId } });
    return data;
  },

  async getRegister(facilityId: string) {
    const { data } = await api.get('/assets/register', { params: { facilityId } });
    return data as FixedAsset[];
  },
};

export default assetsService;
