import api from './api';

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  genericName?: string;
  description?: string;
  categoryId?: string;
  subcategoryId?: string;
  brandId?: string;
  formulationId?: string;
  unitId?: string;
  storageConditionId?: string;
  unit: string;
  strength?: string;
  packSize?: number;
  isDrug: boolean;
  requiresPrescription: boolean;
  isControlled: boolean;
  requiresBatchTracking: boolean;
  requiresExpiryTracking: boolean;
  reorderLevel: number;
  maxStockLevel?: number;
  unitCost: number;
  sellingPrice: number;
  markupPercentage?: number;
  preferredSupplierId?: string;
  manufacturer?: string;
  barcode?: string;
  status: string;
  facilityId?: string;
  itemCategory?: { id: string; name: string };
  itemSubcategory?: { id: string; name: string };
  itemUnit?: { id: string; name: string; abbreviation?: string };
  itemFormulation?: { id: string; name: string };
  itemBrand?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface StockRecord {
  id: string;
  itemId: string;
  facilityId: string;
  storeId?: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lastMovementAt?: string;
  item?: InventoryItem;
}

export interface StockMovement {
  id: string;
  itemId: string;
  batchNumber?: string;
  expiryDate?: string;
  quantity: number;
  balanceAfter: number;
  movementType: string;
  unitCost: number;
  referenceType?: string;
  referenceId?: string;
  facilityId: string;
  storeId?: string;
  createdById: string;
  item?: InventoryItem;
  createdAt: string;
}

export interface ConsumptionRecord {
  itemId: string;
  itemName: string;
  totalConsumed: number;
  averageDaily: number;
  daysOfStock: number;
}

const inventoryService = {
  items: {
    async list(params?: Record<string, any>): Promise<InventoryItem[]> {
      const response = await api.get('/inventory/items', { params });
      return response.data;
    },

    async getById(id: string): Promise<InventoryItem> {
      const response = await api.get(`/inventory/items/${id}`);
      return response.data;
    },

    async create(data: Partial<InventoryItem>): Promise<InventoryItem> {
      const response = await api.post('/inventory/items', data);
      return response.data;
    },

    async update(id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
      const response = await api.put(`/inventory/items/${id}`, data);
      return response.data;
    },

    async delete(id: string): Promise<void> {
      await api.delete(`/inventory/items/${id}`);
    },
  },

  stock: {
    async list(params?: Record<string, any>): Promise<StockRecord[]> {
      const response = await api.get('/inventory/stock', { params });
      return response.data;
    },

    async getByItem(itemId: string, facilityId: string): Promise<StockRecord> {
      const response = await api.get(`/inventory/stock/${itemId}/${facilityId}`);
      return response.data;
    },

    async receive(data: {
      itemId: string;
      facilityId: string;
      storeId?: string;
      quantity: number;
      batchNumber?: string;
      expiryDate?: string;
      unitCost: number;
      referenceType?: string;
      referenceId?: string;
    }): Promise<StockMovement> {
      const response = await api.post('/inventory/stock/receive', data);
      return response.data;
    },

    async adjust(data: {
      itemId: string;
      facilityId: string;
      storeId?: string;
      quantity: number;
      reason: string;
    }): Promise<StockMovement> {
      const response = await api.post('/inventory/stock/adjust', data);
      return response.data;
    },

    async transfer(data: {
      itemId: string;
      fromFacilityId: string;
      toFacilityId: string;
      fromStoreId?: string;
      toStoreId?: string;
      quantity: number;
    }): Promise<StockMovement> {
      const response = await api.post('/inventory/stock/transfer', data);
      return response.data;
    },
  },

  movements: {
    async list(params?: {
      facilityId?: string;
      itemId?: string;
      movementType?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    }): Promise<StockMovement[]> {
      const response = await api.get('/inventory/movements', { params });
      return response.data;
    },
  },

  alerts: {
    async getLowStock(facilityId: string): Promise<StockRecord[]> {
      const response = await api.get(`/inventory/low-stock/${facilityId}`);
      return response.data;
    },

    async getExpiring(facilityId: string, days?: number): Promise<any[]> {
      const response = await api.get(`/inventory/expiring/${facilityId}`, {
        params: days ? { days } : undefined,
      });
      return response.data;
    },

    async getExpired(facilityId: string): Promise<any[]> {
      const response = await api.get(`/inventory/expired/${facilityId}`);
      return response.data;
    },
  },

  reports: {
    async getConsumption(params: {
      facilityId: string;
      startDate: string;
      endDate: string;
      itemId?: string;
    }): Promise<ConsumptionRecord[]> {
      const response = await api.get('/inventory/consumption', { params });
      return response.data;
    },
  },
};

export default inventoryService;
