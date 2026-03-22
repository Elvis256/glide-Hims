import api from './api';

export interface TransferItem {
  itemId: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  unitCost?: number;
}

export interface CreateTransferDto {
  sourceFacilityId: string;
  destinationFacilityId: string;
  reason: 'near_expiry' | 'surplus' | 'stockout_relief' | 'redistribution' | 'other';
  notes?: string;
  items: TransferItem[];
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceFacilityId: string;
  destinationFacilityId: string;
  sourceFacility?: { id: string; name: string };
  destinationFacility?: { id: string; name: string };
  status: 'requested' | 'approved' | 'in_transit' | 'received' | 'cancelled' | 'rejected';
  reason: string;
  notes?: string;
  totalValue?: number;
  items?: StockTransferItem[];
  requestedBy?: { id: string; fullName: string };
  approvedBy?: { id: string; fullName: string };
  createdAt: string;
  updatedAt: string;
}

export interface StockTransferItem {
  id: string;
  itemId: string;
  item?: { id: string; name: string; code: string; unit: string };
  batchNumber?: string;
  expiryDate?: string;
  requestedQuantity: number;
  approvedQuantity?: number;
  receivedQuantity?: number;
  unitCost: number;
}

export interface TransferDashboard {
  pendingRequests: number;
  inTransit: number;
  receivedThisMonth: number;
  totalTransferredValue: number;
  recentTransfers: StockTransfer[];
}

export const stockTransferService = {
  create: (data: CreateTransferDto) =>
    api.post('/stock-transfers', data).then((r) => r.data),

  list: (params: { status?: string; direction?: string; facilityId?: string }) =>
    api.get('/stock-transfers', { params }).then((r) => r.data),

  getOne: (id: string) =>
    api.get(`/stock-transfers/${id}`).then((r) => r.data),

  getDashboard: (facilityId: string) =>
    api.get('/stock-transfers/dashboard', { params: { facilityId } }).then((r) => r.data),

  approve: (id: string, data: { items: Array<{ itemId: string; approvedQuantity: number }> }) =>
    api.patch(`/stock-transfers/${id}/approve`, data).then((r) => r.data),

  reject: (id: string, reason: string) =>
    api.patch(`/stock-transfers/${id}/reject`, { reason }).then((r) => r.data),

  ship: (id: string) =>
    api.patch(`/stock-transfers/${id}/ship`).then((r) => r.data),

  receive: (id: string, data: { items: Array<{ itemId: string; receivedQuantity: number }> }) =>
    api.patch(`/stock-transfers/${id}/receive`, data).then((r) => r.data),

  cancel: (id: string, reason: string) =>
    api.patch(`/stock-transfers/${id}/cancel`, { reason }).then((r) => r.data),
};

export default stockTransferService;
