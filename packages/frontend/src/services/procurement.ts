import api from './api';

// Purchase Request Types
export type PRStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'ordered' | 'cancelled';
export type PRPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface PRItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit?: string;
  quantityRequested: number;
  quantityApproved?: number;
  unitPriceEstimated?: number;
  specifications?: string;
  notes?: string;
}

export interface PurchaseRequest {
  id: string;
  requestNumber: string;
  facilityId: string;
  departmentId?: string;
  requestedById: string;
  requestedBy?: { id: string; fullName: string };
  status: PRStatus;
  priority: PRPriority;
  justification?: string;
  requiredDate?: string;
  totalEstimated: number;
  approvedById?: string;
  approvedBy?: { id: string; fullName: string };
  approvedAt?: string;
  rejectionReason?: string;
  notes?: string;
  items: PRItem[];
  createdAt: string;
  updatedAt: string;
}

// Purchase Order Types
export type POStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partial' | 'received' | 'cancelled';

export interface POItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit?: string;
  quantityOrdered: number;
  quantityReceived: number;
  unitPrice: number;
  taxRate?: number;
  discountPercent?: number;
  lineTotal: number;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  orderNumber: string;
  facilityId: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  purchaseRequestId?: string;
  status: POStatus;
  orderDate: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  deliveryAddress?: string;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  terms?: string;
  notes?: string;
  approvedById?: string;
  approvedAt?: string;
  sentAt?: string;
  items: POItem[];
  createdAt: string;
  updatedAt: string;
}

// Goods Receipt Note Types
export type GRNStatus = 'pending' | 'inspected' | 'approved' | 'posted' | 'rejected';

export interface GRNItem {
  id: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit?: string;
  quantityExpected: number;
  quantityReceived: number;
  quantityAccepted?: number;
  quantityRejected?: number;
  unitCost: number;
  lineTotal: number;
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  rejectionReason?: string;
  notes?: string;
}

export interface GoodsReceipt {
  id: string;
  grnNumber: string;
  facilityId: string;
  supplierId: string;
  supplier?: { id: string; name: string; code: string };
  purchaseOrderId?: string;
  purchaseOrder?: { id: string; orderNumber: string };
  status: GRNStatus;
  receivedDate: string;
  deliveryNoteNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  subtotal: number;
  totalAmount: number;
  inspectedById?: string;
  inspectedAt?: string;
  inspectionNotes?: string;
  approvedById?: string;
  approvedAt?: string;
  postedById?: string;
  postedAt?: string;
  notes?: string;
  items: GRNItem[];
  createdAt: string;
  updatedAt: string;
}

// Dashboard Types
export interface ProcurementDashboard {
  pendingRequests: number;
  pendingOrders: number;
  pendingReceipts: number;
  totalSpendMonth: number;
  recentRequests: PurchaseRequest[];
  recentOrders: PurchaseOrder[];
}

// DTOs
export interface CreatePRItemDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit?: string;
  quantityRequested: number;
  unitPriceEstimated?: number;
  specifications?: string;
  notes?: string;
}

export interface CreatePurchaseRequestDto {
  facilityId: string;
  departmentId?: string;
  priority?: PRPriority;
  justification?: string;
  requiredDate?: string;
  notes?: string;
  items: CreatePRItemDto[];
}

export interface CreatePOItemDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit?: string;
  quantityOrdered: number;
  unitPrice: number;
  taxRate?: number;
  discountPercent?: number;
  notes?: string;
}

export interface CreatePurchaseOrderDto {
  facilityId: string;
  supplierId: string;
  purchaseRequestId?: string;
  orderDate?: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  deliveryAddress?: string;
  terms?: string;
  notes?: string;
  items: CreatePOItemDto[];
}

export interface CreatePOFromPRDto {
  purchaseRequestId: string;
  supplierId: string;
  expectedDelivery?: string;
  paymentTerms?: string;
  itemPrices?: { itemId: string; unitPrice: number }[];
}

export interface CreateGRNItemDto {
  itemId: string;
  itemCode: string;
  itemName: string;
  itemUnit?: string;
  quantityExpected: number;
  quantityReceived: number;
  unitCost: number;
  batchNumber?: string;
  expiryDate?: string;
  manufactureDate?: string;
  purchaseOrderItemId?: string;
  notes?: string;
}

export interface CreateGoodsReceiptDto {
  facilityId: string;
  supplierId: string;
  purchaseOrderId?: string;
  deliveryNoteNumber?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceAmount?: number;
  notes?: string;
  items: CreateGRNItemDto[];
}

export interface InspectGRNDto {
  inspectedItems: {
    itemId: string;
    quantityAccepted: number;
    quantityRejected: number;
    rejectionReason?: string;
  }[];
  inspectionNotes?: string;
}

// Query Params
export interface PRQueryParams {
  facilityId?: string;
  status?: PRStatus;
  priority?: PRPriority;
  startDate?: string;
  endDate?: string;
}

export interface POQueryParams {
  facilityId?: string;
  status?: POStatus;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export interface GRNQueryParams {
  facilityId?: string;
  status?: GRNStatus;
  supplierId?: string;
  startDate?: string;
  endDate?: string;
}

export const procurementService = {
  // Dashboard
  getDashboard: async (facilityId: string): Promise<ProcurementDashboard> => {
    const response = await api.get<ProcurementDashboard>('/procurement/dashboard', { params: { facilityId } });
    return response.data;
  },

  // Purchase Requests
  purchaseRequests: {
    list: async (params?: PRQueryParams): Promise<PurchaseRequest[]> => {
      const response = await api.get<PurchaseRequest[]>('/procurement/purchase-requests', { params });
      return response.data;
    },
    getById: async (id: string): Promise<PurchaseRequest> => {
      const response = await api.get<PurchaseRequest>(`/procurement/purchase-requests/${id}`);
      return response.data;
    },
    create: async (data: CreatePurchaseRequestDto): Promise<PurchaseRequest> => {
      const response = await api.post<PurchaseRequest>('/procurement/purchase-requests', data);
      return response.data;
    },
    submit: async (id: string): Promise<PurchaseRequest> => {
      const response = await api.put<PurchaseRequest>(`/procurement/purchase-requests/${id}/submit`);
      return response.data;
    },
    approve: async (id: string, data?: { approvedItems?: { itemId: string; quantityApproved: number }[] }): Promise<PurchaseRequest> => {
      const response = await api.put<PurchaseRequest>(`/procurement/purchase-requests/${id}/approve`, data);
      return response.data;
    },
    reject: async (id: string, rejectionReason: string): Promise<PurchaseRequest> => {
      const response = await api.put<PurchaseRequest>(`/procurement/purchase-requests/${id}/reject`, { rejectionReason });
      return response.data;
    },
  },

  // Purchase Orders
  purchaseOrders: {
    list: async (params?: POQueryParams): Promise<PurchaseOrder[]> => {
      const response = await api.get<PurchaseOrder[]>('/procurement/purchase-orders', { params });
      return response.data;
    },
    getById: async (id: string): Promise<PurchaseOrder> => {
      const response = await api.get<PurchaseOrder>(`/procurement/purchase-orders/${id}`);
      return response.data;
    },
    create: async (data: CreatePurchaseOrderDto): Promise<PurchaseOrder> => {
      const response = await api.post<PurchaseOrder>('/procurement/purchase-orders', data);
      return response.data;
    },
    createFromPR: async (data: CreatePOFromPRDto): Promise<PurchaseOrder> => {
      const response = await api.post<PurchaseOrder>('/procurement/purchase-orders/from-pr', data);
      return response.data;
    },
    approve: async (id: string): Promise<PurchaseOrder> => {
      const response = await api.put<PurchaseOrder>(`/procurement/purchase-orders/${id}/approve`);
      return response.data;
    },
    send: async (id: string): Promise<PurchaseOrder> => {
      const response = await api.put<PurchaseOrder>(`/procurement/purchase-orders/${id}/send`);
      return response.data;
    },
    cancel: async (id: string): Promise<PurchaseOrder> => {
      const response = await api.put<PurchaseOrder>(`/procurement/purchase-orders/${id}/cancel`);
      return response.data;
    },
  },

  // Goods Receipt Notes
  goodsReceipts: {
    list: async (params?: GRNQueryParams): Promise<GoodsReceipt[]> => {
      const response = await api.get<GoodsReceipt[]>('/procurement/goods-receipts', { params });
      return response.data;
    },
    getById: async (id: string): Promise<GoodsReceipt> => {
      const response = await api.get<GoodsReceipt>(`/procurement/goods-receipts/${id}`);
      return response.data;
    },
    create: async (data: CreateGoodsReceiptDto): Promise<GoodsReceipt> => {
      const response = await api.post<GoodsReceipt>('/procurement/goods-receipts', data);
      return response.data;
    },
    createFromPO: async (purchaseOrderId: string, receivedItems: { itemId: string; quantityReceived: number; batchNumber?: string; expiryDate?: string }[]): Promise<GoodsReceipt> => {
      const response = await api.post<GoodsReceipt>('/procurement/goods-receipts/from-po', { purchaseOrderId, receivedItems });
      return response.data;
    },
    inspect: async (id: string, data: InspectGRNDto): Promise<GoodsReceipt> => {
      const response = await api.put<GoodsReceipt>(`/procurement/goods-receipts/${id}/inspect`, data);
      return response.data;
    },
    approve: async (id: string): Promise<GoodsReceipt> => {
      const response = await api.put<GoodsReceipt>(`/procurement/goods-receipts/${id}/approve`);
      return response.data;
    },
    post: async (id: string): Promise<GoodsReceipt> => {
      const response = await api.put<GoodsReceipt>(`/procurement/goods-receipts/${id}/post`);
      return response.data;
    },
  },
};

export default procurementService;
