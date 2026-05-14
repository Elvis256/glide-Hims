import api from './api';

export type AssetClass = 'medical' | 'it' | 'furniture' | 'vehicle' | 'utility' | 'building' | 'other';
export type AssetCriticality = 'life_support' | 'high' | 'medium' | 'low';
export type TransferStage = 'origin_dept_head' | 'receiving_dept_head' | 'store_keeper';
export type DisposalMethod = 'sale' | 'scrap' | 'donation' | 'trade_in' | 'write_off';
export type DisposalStatus =
  | 'requested'
  | 'biomed_review'
  | 'committee_approval'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';
export type AllocationStatus =
  | 'requested'
  | 'dept_head_approved'
  | 'allocated'
  | 'returned'
  | 'rejected'
  | 'cancelled';

export interface FixedAsset {
  id: string;
  facilityId: string;
  departmentId?: string;
  department?: { id: string; name: string };
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
  acquisitionDate?: string;
  acquisitionCost?: number;
  installationCost?: number;
  totalCost?: number;
  salvageValue?: number;
  usefulLifeMonths?: number;
  depreciationMethod?: string;
  depreciationRate?: number;
  depreciationStartDate?: string;
  accumulatedDepreciation?: number;
  bookValue?: number;
  currentMarketValue?: number;
  status: string;
  condition: string;
  location?: string;
  custodianId?: string;
  custodian?: { id: string; firstName?: string; lastName?: string; fullName?: string };
  warrantyExpiry?: string;
  nextMaintenanceDate?: string;
  maintenanceIntervalDays?: number;
  isInsured?: boolean;
  insurancePolicyNumber?: string;
  insuredValue?: number;
  insuranceExpiry?: string;
  disposalDate?: string;
  disposalValue?: number;
  disposalReason?: string;
  imageUrl?: string;
  notes?: string;
  // hospital extension
  assetClass?: AssetClass;
  criticalityLevel?: AssetCriticality;
  categoryId?: string;
  parentAssetId?: string;
  buildingId?: string;
  floorId?: string;
  roomId?: string;
  calibrationIntervalDays?: number;
  lastCalibrationDate?: string;
  nextCalibrationDue?: string;
  biomedEngineerId?: string;
  amcVendor?: string;
  amcStartDate?: string;
  amcEndDate?: string;
  amcContractRef?: string;
  barcodeQr?: string;
  rfidTag?: string;
  assetTag?: string;
  isCapex?: boolean;
  replacementCost?: number;
  purchaseOrderId?: string;
  grnId?: string;
  createdAt: string;
}

export interface AssetMaintenance {
  id: string;
  assetId: string;
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

export interface AssetTransferApproval {
  id: string;
  transferId: string;
  stage: TransferStage;
  decision: 'pending' | 'approved' | 'rejected';
  decidedBy?: string;
  decidedAt?: string;
  comments?: string;
}

export interface AssetTransfer {
  id: string;
  transferNumber?: string;
  assetId: string;
  asset?: FixedAsset;
  fromFacilityId: string;
  fromDepartmentId?: string;
  toFacilityId: string;
  toDepartmentId?: string;
  toCustodianId?: string;
  transferDate: string;
  reason?: string;
  transferredBy: string;
  receivedBy?: string;
  receivedDate?: string;
  status: string;
  approvals?: AssetTransferApproval[];
  createdAt?: string;
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
  journalEntryId?: string;
  postedAt?: string;
}

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  assetClass: AssetClass;
  parentId?: string;
  defaultUsefulLifeMonths?: number;
  defaultDepreciationMethod?: string;
  defaultDepreciationRate?: number;
  defaultCalibrationIntervalDays?: number;
  defaultMaintenanceIntervalDays?: number;
  isActive: boolean;
  description?: string;
  createdAt?: string;
}

export interface AssetAllocation {
  id: string;
  allocationNumber: string;
  assetId: string;
  asset?: FixedAsset;
  facilityId: string;
  departmentId?: string;
  custodianId: string;
  custodian?: { id: string; firstName?: string; lastName?: string };
  roomId?: string;
  allocationDate: string;
  expectedReturnDate?: string;
  actualReturnDate?: string;
  status: AllocationStatus;
  purpose?: string;
  requestedBy: string;
  approvedBy?: string;
  approvedAt?: string;
  conditionOnIssue?: string;
  conditionOnReturn?: string;
  notes?: string;
  createdAt?: string;
}

export interface AssetDisposal {
  id: string;
  disposalNumber: string;
  assetId: string;
  asset?: FixedAsset;
  facilityId: string;
  method: DisposalMethod;
  status: DisposalStatus;
  reason: string;
  expectedValue: number;
  actualValue: number;
  buyer?: string;
  requestedDate: string;
  requestedBy: string;
  biomedReviewedBy?: string;
  biomedReviewedAt?: string;
  biomedAssessment?: string;
  committeeApprovals?: { userId: string; role: string; decision: string; at: string; comments?: string }[];
  disposalDate?: string;
  completedBy?: string;
  journalEntryId?: string;
  notes?: string;
  attachments?: string[];
  createdAt?: string;
}

export interface AssetLocationHistory {
  id: string;
  assetId: string;
  facilityId: string;
  departmentId?: string;
  roomId?: string;
  locationLabel?: string;
  custodianId?: string;
  movedAt: string;
  movedBy?: string;
  reason?: string;
  referenceId?: string;
  notes?: string;
}

export const assetsService = {
  // ===== Assets CRUD =====
  async list(
    facilityId: string,
    filters?: {
      category?: string;
      categoryId?: string;
      assetClass?: string;
      criticalityLevel?: string;
      status?: string;
      departmentId?: string;
      custodianId?: string;
      search?: string;
    },
  ) {
    const { data } = await api.get('/assets', { params: { facilityId, ...filters } });
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

  // ===== Depreciation =====
  async runDepreciation(facilityId: string, period: string) {
    const [year, month] = period.split('-').map(Number);
    const { data } = await api.post('/assets/depreciation/run', { facilityId, year, month });
    return data as AssetDepreciation[];
  },
  async getDepreciationSchedule(assetId: string) {
    const { data } = await api.get(`/assets/${assetId}/depreciation`);
    return data as AssetDepreciation[];
  },
  async getDepreciationReport(facilityId: string, year?: number, month?: number) {
    const y = year || new Date().getFullYear();
    const { data } = await api.get('/assets/reports/depreciation', {
      params: { facilityId, year: y, month },
    });
    return data;
  },

  // ===== Maintenance =====
  async recordMaintenance(assetId: string, m: Partial<AssetMaintenance> & { maintenanceType?: string; nextMaintenanceDate?: string }) {
    const { data } = await api.post(`/assets/${assetId}/maintenance`, m);
    return data as AssetMaintenance;
  },
  async getMaintenanceHistory(assetId: string) {
    const { data } = await api.get(`/assets/${assetId}/maintenance`);
    return data as AssetMaintenance[];
  },
  async getMaintenanceDue(facilityId: string, daysAhead = 30) {
    const { data } = await api.get('/assets/maintenance-due', { params: { facilityId, daysAhead } });
    return data as FixedAsset[];
  },
  async getCalibrationDue(facilityId: string, daysAhead = 30) {
    const { data } = await api.get('/assets/calibration-due', { params: { facilityId, daysAhead } });
    return data as FixedAsset[];
  },
  async getAmcExpiring(facilityId: string, daysAhead = 60) {
    const { data } = await api.get('/assets/amc-expiring', { params: { facilityId, daysAhead } });
    return data as FixedAsset[];
  },
  async getWarrantyExpiring(facilityId: string, daysAhead = 60) {
    const { data } = await api.get('/assets/warranty-expiring', { params: { facilityId, daysAhead } });
    return data as FixedAsset[];
  },

  // ===== Transfers (workflow) =====
  async initiateTransfer(assetId: string, t: Partial<AssetTransfer>) {
    const { data } = await api.post(`/assets/${assetId}/transfer`, t);
    return data as AssetTransfer;
  },
  async listTransfers(facilityId: string, status?: string) {
    const { data } = await api.get('/assets/transfers', { params: { facilityId, status } });
    return data as AssetTransfer[];
  },
  async approveTransferStage(
    transferId: string,
    body: { stage: TransferStage; decision: 'approved' | 'rejected'; comments?: string },
  ) {
    const { data } = await api.put(`/assets/transfers/${transferId}/approve`, body);
    return data as AssetTransfer;
  },
  async completeTransfer(transferId: string, body?: { receivedBy?: string; conditionOnReceipt?: string; notes?: string }) {
    const { data } = await api.post(`/assets/transfers/${transferId}/complete`, body || {});
    return data as AssetTransfer;
  },
  async getTransferHistory(assetId: string) {
    const { data } = await api.get(`/assets/${assetId}/transfers`);
    return data as AssetTransfer[];
  },

  // ===== Categories =====
  async listCategories(filters?: { assetClass?: string; isActive?: boolean }) {
    const { data } = await api.get('/assets/categories', { params: filters });
    return data as AssetCategory[];
  },
  async createCategory(c: Partial<AssetCategory>) {
    const { data } = await api.post('/assets/categories', c);
    return data as AssetCategory;
  },
  async updateCategory(id: string, c: Partial<AssetCategory>) {
    const { data } = await api.put(`/assets/categories/${id}`, c);
    return data as AssetCategory;
  },
  async deleteCategory(id: string) {
    await api.delete(`/assets/categories/${id}`);
  },

  // ===== Allocations =====
  async listAllocations(facilityId: string, filters?: { status?: string; custodianId?: string; assetId?: string }) {
    const { data } = await api.get('/assets/allocations', { params: { facilityId, ...filters } });
    return data as AssetAllocation[];
  },
  async createAllocation(a: Partial<AssetAllocation>) {
    const { data } = await api.post('/assets/allocations', a);
    return data as AssetAllocation;
  },
  async approveAllocation(id: string, body: { decision: 'approved' | 'rejected'; comments?: string }) {
    const { data } = await api.put(`/assets/allocations/${id}/approve`, body);
    return data as AssetAllocation;
  },
  async issueAllocation(id: string) {
    const { data } = await api.put(`/assets/allocations/${id}/issue`);
    return data as AssetAllocation;
  },
  async returnAllocation(id: string, body: { returnDate: string; conditionOnReturn?: string; notes?: string }) {
    const { data } = await api.put(`/assets/allocations/${id}/return`, body);
    return data as AssetAllocation;
  },

  // ===== Disposal workflow =====
  async listDisposals(facilityId: string, filters?: { status?: string; method?: string }) {
    const { data } = await api.get('/assets/disposals', { params: { facilityId, ...filters } });
    return data as AssetDisposal[];
  },
  async createDisposalRequest(body: Partial<AssetDisposal> & { method: DisposalMethod; assetId: string; facilityId: string; reason: string }) {
    const { data } = await api.post('/assets/disposals', body);
    return data as AssetDisposal;
  },
  async biomedReview(id: string, body: { assessment: string; recommendation: 'approve' | 'reject' }) {
    const { data } = await api.put(`/assets/disposals/${id}/biomed-review`, body);
    return data as AssetDisposal;
  },
  async committeeDecision(id: string, body: { role: string; decision: 'approved' | 'rejected'; comments?: string }) {
    const { data } = await api.put(`/assets/disposals/${id}/committee-decision`, body);
    return data as AssetDisposal;
  },
  async completeDisposal(id: string, body: { disposalDate: string; actualValue: number; buyer?: string; notes?: string }) {
    const { data } = await api.put(`/assets/disposals/${id}/complete`, body);
    return data as AssetDisposal;
  },
  // Legacy quick-dispose
  async dispose(id: string, body: { disposalDate: string; disposalValue: number; disposalReason: string; status: string }) {
    const { data } = await api.post(`/assets/${id}/dispose`, body);
    return data as FixedAsset;
  },

  // ===== Location history =====
  async getLocationHistory(assetId: string) {
    const { data } = await api.get(`/assets/${assetId}/location-history`);
    return data as AssetLocationHistory[];
  },
  async recordLocation(
    assetId: string,
    body: { departmentId?: string; roomId?: string; locationLabel?: string; custodianId?: string; reason?: string; notes?: string },
  ) {
    const { data } = await api.post(`/assets/${assetId}/location`, body);
    return data as AssetLocationHistory;
  },

  // ===== Reports =====
  async getValuation(facilityId: string) {
    const { data } = await api.get('/assets/valuation', { params: { facilityId } });
    return data;
  },
  async getRegister(facilityId: string) {
    const { data } = await api.get('/assets/register', { params: { facilityId } });
    return data as FixedAsset[];
  },
  async getLossOnDisposal(facilityId: string, startDate: string, endDate: string) {
    const { data } = await api.get('/assets/reports/loss-on-disposal', {
      params: { facilityId, startDate, endDate },
    });
    return data;
  },
  async getAgeAnalysis(facilityId: string) {
    const { data } = await api.get('/assets/reports/age-analysis', { params: { facilityId } });
    return data;
  },
  async getMaintenanceCostReport(facilityId: string, startDate: string, endDate: string) {
    const { data } = await api.get('/assets/reports/maintenance-cost', {
      params: { facilityId, startDate, endDate },
    });
    return data;
  },
};

export default assetsService;
