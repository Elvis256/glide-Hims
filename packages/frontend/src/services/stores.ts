import api from './api';

export interface InventoryItem {
  id: string;
  name: string;
  genericName?: string;
  code?: string;
  category: 'Medical Supplies' | 'Equipment' | 'Consumables' | 'Linen' | 'Stationery' | string;
  sku: string;
  currentStock: number;
  availableStock?: number;
  minStock: number;
  maxStock: number;
  unit: string;
  location?: string;
  unitCost?: number;
  sellingPrice?: number;
  // items.retail_price / items.wholesale_price — nullable columns, so null
  // means "not priced", which is distinct from a price of 0.
  retailPrice?: number | null;
  wholesalePrice?: number | null;
  lastUpdated: string;
  isLowStock?: boolean;
  batchNumber?: string | null;
  expiryDate?: string | null;
  createdAt?: string;
}

export interface InventoryStats {
  totalItems: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  totalValue: number;
}

export interface InventoryResponse {
  data: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  stats?: InventoryStats;
}

/**
 * The stock ledger's real shape.
 *
 * This interface used to describe fields the API has never sent — `type`,
 * `reason`, `reference`, `performedBy`, `fromLocation`, `toLocation`. Because
 * every one of them was declared, reading them type-checked, and four screens
 * filtered on `type === 'in' | 'out' | 'adjustment'` against a value that was
 * always undefined. Returns, stock adjustments, consumption reports and unit
 * issue were therefore permanently empty, with no error anywhere: the filter
 * simply matched nothing. The server field is `movementType`, and its values
 * are the MovementType enum below — 'in' and 'out' are not among them.
 */
export type StockMovementType =
  | 'purchase'
  | 'sale'
  | 'adjustment'
  | 'transfer_in'
  | 'transfer_out'
  | 'return'
  | 'expired'
  | 'damaged';

/** Movements that raise stock on hand. */
export const INBOUND_MOVEMENTS: StockMovementType[] = ['purchase', 'return', 'transfer_in'];
/** Movements that reduce it. */
export const OUTBOUND_MOVEMENTS: StockMovementType[] = [
  'sale',
  'transfer_out',
  'expired',
  'damaged',
];

export function isInbound(m: Pick<StockMovement, 'movementType'>): boolean {
  return INBOUND_MOVEMENTS.includes(m.movementType);
}
export function isOutbound(m: Pick<StockMovement, 'movementType'>): boolean {
  return OUTBOUND_MOVEMENTS.includes(m.movementType);
}
/** Display name of whoever recorded the movement, or undefined if unjoined. */
export function movementActor(m: Pick<StockMovement, 'createdBy'>): string | undefined {
  const n = m.createdBy?.fullName?.trim();
  return n || undefined;
}

export interface StockMovement {
  id: string;
  itemId: string;
  item?: InventoryItem;
  storeId?: string;
  store?: Store;
  movementType: StockMovementType;
  quantity: number;
  balanceAfter?: number;
  unitCost?: number;
  batchNumber?: string;
  expiryDate?: string;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  createdById?: string;
  createdBy?: { id: string; fullName: string };
  facilityId?: string;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'pharmacy' | 'ward' | 'theatre' | 'lab' | 'radiology' | 'emergency' | 'department';
  description?: string;
  location?: string;
  facilityId?: string;
  managerId?: string;
  isActive: boolean;
  canDispense?: boolean;
}

export interface CreateItemDto {
  name: string;
  category: string;
  sku: string;
  minStock: number;
  maxStock: number;
  unit: string;
  location: string;
  unitCost?: number;
}

export interface StockAdjustmentDto {
  quantity: number;
  type: 'in' | 'out' | 'adjustment';
  reason: string;
  reference?: string;
  storeId?: string;
}

export interface InventoryQueryParams {
  category?: string;
  location?: string;
  lowStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  storeId?: string;
}

// Drug/Item for prescription
export interface Drug {
  id: string;
  code: string;
  sku?: string;
  name: string;
  genericName?: string;
  strength?: string;
  form?: string;
  unit: string;
  isDrug: boolean;
  requiresPrescription: boolean;
  isControlled?: boolean;
  sellingPrice: number;
  currentStock?: number;
}

export type TransferStatus = 'pending' | 'approved' | 'in_transit' | 'received' | 'cancelled';

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromStore: Store;
  fromStoreId: string;
  toStore: Store;
  toStoreId: string;
  status: TransferStatus;
  notes?: string;
  items: TransferItem[];
  requestedBy?: { id: string; firstName: string; lastName: string };
  approvedBy?: { id: string; firstName: string; lastName: string };
  receivedBy?: { id: string; firstName: string; lastName: string };
  createdAt: string;
  approvedAt?: string;
  receivedAt?: string;
}

export interface TransferItem {
  id: string;
  itemId: string;
  item?: Drug | InventoryItem;
  itemName: string;
  quantityRequested: number;
  quantityApproved?: number;
  quantityReceived?: number;
  batchNumber?: string;
  expiryDate?: string;
}

export interface CreateTransferDto {
  fromStoreId: string;
  toStoreId: string;
  items: { itemId: string; quantity: number; notes?: string }[];
  notes?: string;
}

/** Mirrors backend DisposalMethod (database/entities/disposal.entity.ts). */
export type DisposalMethod = 'incineration' | 'chemical' | 'landfill' | 'return_to_manufacturer';

/** Mirrors backend ComplianceStatus (database/entities/disposal.entity.ts). */
export type ComplianceStatus = 'compliant' | 'pending_review' | 'non_compliant';

/** Mirrors backend DisposalRecord entity. Note: disposal_records are PER ITEM,
 *  not per document — there is no multi-item disposal note. */
export interface DisposalRecord {
  id: string;
  itemId: string;
  item?: { id: string; name: string; sku?: string };
  batchNumber?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  disposalDate: string;
  disposalMethod: DisposalMethod;
  witness?: string;
  witness2?: string;
  certificateNumber?: string;
  complianceStatus: ComplianceStatus;
  reason?: string;
  notes?: string;
  facilityId: string;
  disposedById: string;
  disposedBy?: { id: string; fullName: string };
  approvedById?: string;
  approvedBy?: { id: string; fullName: string };
  createdAt: string;
}

export const storesService = {
  // Items/Drugs
  items: {
    search: async (query?: string, isDrug?: boolean, limit = 50, storeId?: string): Promise<Drug[]> => {
      const params: Record<string, string | number | boolean> = { limit };
      if (query) params.q = query;
      if (isDrug !== undefined) params.isDrug = isDrug;
      if (storeId) params.storeId = storeId;
      const response = await api.get<Drug[]>('/stores/items', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Drug> => {
      const response = await api.get<Drug>(`/stores/items/${id}`);
      return response.data;
    },
  },

  // Inventory Items
  inventory: {
    list: async (params?: InventoryQueryParams): Promise<InventoryResponse> => {
      const response = await api.get('/stores/inventory', { params });
      return response.data;
    },
    getById: async (id: string): Promise<InventoryItem> => {
      const response = await api.get<InventoryItem>(`/stores/inventory/${id}`);
      return response.data;
    },
    create: async (data: CreateItemDto): Promise<InventoryItem> => {
      const response = await api.post<InventoryItem>('/stores/inventory', data);
      return response.data;
    },
    update: async (id: string, data: Partial<CreateItemDto>): Promise<InventoryItem> => {
      const response = await api.patch<InventoryItem>(`/stores/inventory/${id}`, data);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await api.delete(`/stores/inventory/${id}`);
    },
    getLowStock: async (): Promise<InventoryItem[]> => {
      const response = await api.get<InventoryItem[]>('/stores/inventory/low-stock');
      return response.data;
    },
    getExpiringSoon: async (facilityId?: string, days = 90): Promise<(InventoryItem & { daysUntilExpiry: number; isExpired: boolean })[]> => {
      const response = await api.get('/stores/inventory/expiring-soon', { params: { facilityId, days } });
      return response.data;
    },
    getMovements: async (itemId: string, limit?: number): Promise<StockMovement[]> => {
      const response = await api.get<StockMovement[]>(`/stores/inventory/${itemId}/movements`, { params: { limit } });
      return response.data;
    },
  },

  // Disposal records (backend module: /disposal)
  disposal: {
    listByFacility: async (facilityId: string): Promise<DisposalRecord[]> => {
      const response = await api.get<DisposalRecord[]>(`/disposal/facility/${facilityId}`);
      return Array.isArray(response.data) ? response.data : [];
    },
  },

  // Stock Movements
  movements: {
    list: async (itemId?: string): Promise<StockMovement[]> => {
      const response = await api.get<StockMovement[]>('/stores/movements', { params: { itemId } });
      return response.data;
    },
    adjust: async (itemId: string, data: StockAdjustmentDto): Promise<StockMovement> => {
      const response = await api.post<StockMovement>(`/stores/inventory/${itemId}/adjust`, data);
      return response.data;
    },
    transfer: async (itemId: string, quantity: number, fromLocation: string, toLocation: string): Promise<StockMovement> => {
      const response = await api.post<StockMovement>(`/stores/inventory/${itemId}/transfer`, {
        quantity,
        fromLocation,
        toLocation,
      });
      return response.data;
    },
  },

  // Stores/Locations
  stores: {
    list: async (type?: string): Promise<Store[]> => {
      const params: Record<string, string> = {};
      if (type) params.type = type;
      const response = await api.get<Store[]>('/stores', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Store> => {
      const response = await api.get<Store>(`/stores/${id}`);
      return response.data;
    },
    create: async (data: Partial<Store>): Promise<Store> => {
      const response = await api.post<Store>('/stores', data);
      return response.data;
    },
    update: async (id: string, data: Partial<Store>): Promise<Store> => {
      const response = await api.patch<Store>(`/stores/${id}`, data);
      return response.data;
    },
  },

  // Categories summary
  getCategorySummary: async (): Promise<{ category: string; count: number; totalValue: number }[]> => {
    const response = await api.get('/stores/inventory/categories/summary');
    return response.data;
  },

  // Stock Transfers
  transfers: {
    list: async (storeId?: string, status?: TransferStatus, limit = 50): Promise<StockTransfer[]> => {
      const params: Record<string, string | number> = { limit };
      if (storeId) params.storeId = storeId;
      if (status) params.status = status;
      const response = await api.get<StockTransfer[]>('/stores/transfers/list', { params });
      return response.data;
    },
    getById: async (id: string): Promise<StockTransfer> => {
      const response = await api.get<StockTransfer>(`/stores/transfers/${id}`);
      return response.data;
    },
    create: async (dto: CreateTransferDto): Promise<StockTransfer> => {
      const response = await api.post<StockTransfer>('/stores/transfers', dto);
      return response.data;
    },
    approve: async (id: string, items?: { itemId: string; quantityApproved: number }[]): Promise<StockTransfer> => {
      const response = await api.post<StockTransfer>(`/stores/transfers/${id}/approve`, { items });
      return response.data;
    },
    receive: async (id: string, items?: { itemId: string; quantityReceived: number }[]): Promise<StockTransfer> => {
      const response = await api.post<StockTransfer>(`/stores/transfers/${id}/receive`, { items });
      return response.data;
    },
    cancel: async (id: string): Promise<StockTransfer> => {
      const response = await api.post<StockTransfer>(`/stores/transfers/${id}/cancel`);
      return response.data;
    },
  },
};

export default storesService;
