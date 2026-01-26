import api from './api';

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Medical Supplies' | 'Equipment' | 'Consumables' | 'Linen' | 'Stationery' | string;
  sku: string;
  currentStock: number;
  minStock: number;
  maxStock: number;
  unit: string;
  location: string;
  unitCost?: number;
  lastUpdated: string;
  createdAt?: string;
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  reference?: string;
  reason?: string;
  fromLocation?: string;
  toLocation?: string;
  performedBy: string;
  createdAt: string;
}

export interface Store {
  id: string;
  name: string;
  code: string;
  type: 'main' | 'pharmacy' | 'lab' | 'department';
  location?: string;
  managerId?: string;
  isActive: boolean;
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
}

export interface InventoryQueryParams {
  category?: string;
  location?: string;
  lowStock?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

export const storesService = {
  // Inventory Items
  inventory: {
    list: async (params?: InventoryQueryParams): Promise<{ data: InventoryItem[]; total: number }> => {
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
    list: async (): Promise<Store[]> => {
      const response = await api.get<Store[]>('/stores');
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
};

export default storesService;
