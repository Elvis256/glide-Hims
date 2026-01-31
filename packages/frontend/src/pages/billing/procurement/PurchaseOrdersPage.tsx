import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  Eye,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  Calendar,
  DollarSign,
  Package,
  Building2,
  FileText,
  Printer,
  Download,
  AlertCircle,
  RefreshCw,
  MoreVertical,
  Loader2,
} from 'lucide-react';

// Map backend status to UI status
type BackendPOStatus = 'draft' | 'pending_approval' | 'approved' | 'sent' | 'partially_received' | 'received' | 'cancelled';
type POStatus = 'Draft' | 'Sent' | 'Partial' | 'Received' | 'Closed';

const statusMap: Record<BackendPOStatus, POStatus> = {
  draft: 'Draft',
  pending_approval: 'Draft',
  approved: 'Draft',
  sent: 'Sent',
  partially_received: 'Partial',
  received: 'Received',
  cancelled: 'Closed',
};

const reverseStatusMap: Record<POStatus, BackendPOStatus[]> = {
  Draft: ['draft', 'pending_approval', 'approved'],
  Sent: ['sent'],
  Partial: ['partially_received'],
  Received: ['received'],
  Closed: ['cancelled'],
};

interface POItem {
  id: string;
  name: string;
  quantity: number;
  receivedQty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: string;
  rfqNumber: string;
  vendor: {
    id: string;
    name: string;
    email: string;
    phone: string;
    address: string;
  };
  items: POItem[];
  totalAmount: number;
  status: POStatus;
  backendStatus: BackendPOStatus;
  createdDate: string;
  sentDate?: string;
  expectedDelivery: string;
  deliveryAddress: string;
  paymentTerms: string;
  notes?: string;
  amendments: {
    date: string;
    description: string;
    by: string;
  }[];
}

interface BackendPurchaseOrder {
  id: string;
  orderNumber: string;
  status: BackendPOStatus;
  supplierId: string;
  supplier?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  items: Array<{
    id: string;
    itemName?: string;
    name?: string;
    quantity: number;
    receivedQuantity?: number;
    unit?: string;
    unitPrice: number;
    totalPrice?: number;
  }>;
  totalAmount: number;
  orderDate: string;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
}

interface CreatePurchaseOrderData {
  supplierId: string;
  items: Array<{
    itemId?: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }>;
  expectedDeliveryDate?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
}

const getFacilityId = () => localStorage.getItem('facilityId') || '';

const transformBackendPO = (po: BackendPurchaseOrder): PurchaseOrder => ({
  id: po.id,
  poNumber: po.orderNumber,
  rfqNumber: '',
  vendor: {
    id: po.supplier?.id || po.supplierId,
    name: po.supplier?.name || 'Unknown Vendor',
    email: po.supplier?.email || '',
    phone: po.supplier?.phone || '',
    address: po.supplier?.address || '',
  },
  items: po.items.map((item) => ({
    id: item.id,
    name: item.itemName || item.name || '',
    quantity: item.quantity,
    receivedQty: item.receivedQuantity || 0,
    unit: item.unit || 'unit',
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice || item.quantity * item.unitPrice,
  })),
  totalAmount: po.totalAmount,
  status: statusMap[po.status] || 'Draft',
  backendStatus: po.status,
  createdDate: po.orderDate,
  sentDate: po.status === 'sent' ? po.orderDate : undefined,
  expectedDelivery: po.expectedDeliveryDate || '',
  deliveryAddress: po.deliveryAddress || '',
  paymentTerms: po.paymentTerms || 'Net 30',
  notes: po.notes,
  amendments: [],
});

const statusConfig: Record<POStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Edit className="w-3 h-3" /> },
  Sent: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Send className="w-3 h-3" /> },
  Partial: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Package className="w-3 h-3" /> },
  Received: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Closed: { color: 'text-purple-600', bg: 'bg-purple-100', icon: <CheckCircle className="w-3 h-3" /> },
};

export default function PurchaseOrdersPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'All'>('All');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [createFormData, setCreateFormData] = useState<Partial<CreatePurchaseOrderData>>({});

  const facilityId = getFacilityId();

  // Fetch purchase orders
  const { data: purchaseOrders = [], isLoading, refetch } = useQuery({
    queryKey: ['purchase-orders', facilityId, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (facilityId) params.append('facilityId', facilityId);
      if (statusFilter !== 'All') {
        const backendStatuses = reverseStatusMap[statusFilter];
        if (backendStatuses.length === 1) {
          params.append('status', backendStatuses[0]);
        }
      }
      const response = await api.get(`/procurement/purchase-orders?${params.toString()}`);
      const data = response.data as BackendPurchaseOrder[];
      return data.map(transformBackendPO);
    },
  });

  // Create purchase order mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreatePurchaseOrderData) => {
      const response = await api.post('/procurement/purchase-orders', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setShowCreateModal(false);
      setCreateFormData({});
    },
  });

  // Approve purchase order mutation
  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/procurement/purchase-orders/${id}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setSelectedPO(null);
    },
  });

  // Send to supplier mutation
  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/procurement/purchase-orders/${id}/send`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setSelectedPO(null);
    },
  });

  // Cancel purchase order mutation
  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/procurement/purchase-orders/${id}/cancel`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      setSelectedPO(null);
    },
  });

  const isActionLoading = createMutation.isPending || approveMutation.isPending || sendMutation.isPending || cancelMutation.isPending;

  const handleSendToVendor = () => {
    if (selectedPO) {
      if (selectedPO.backendStatus === 'draft') {
        approveMutation.mutate(selectedPO.id, {
          onSuccess: () => {
            sendMutation.mutate(selectedPO.id);
          },
        });
      } else if (selectedPO.backendStatus === 'approved') {
        sendMutation.mutate(selectedPO.id);
      } else {
        sendMutation.mutate(selectedPO.id);
      }
    }
  };

  const handleCancelPO = () => {
    if (selectedPO && window.confirm('Are you sure you want to cancel this purchase order?')) {
      cancelMutation.mutate(selectedPO.id);
    }
  };

  const handleCreatePO = (sendImmediately: boolean) => {
    if (!createFormData.supplierId) {
      alert('Please select a supplier');
      return;
    }
    createMutation.mutate(createFormData as CreatePurchaseOrderData, {
      onSuccess: (data) => {
        if (sendImmediately && data?.id) {
          sendMutation.mutate(data.id);
        }
      },
    });
  };

  const filteredPOs = useMemo(() => {
    return purchaseOrders.filter((po) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.vendor.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'All' || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [purchaseOrders, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    return purchaseOrders.reduce(
      (acc, po) => {
        acc[po.status] = (acc[po.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  }, [purchaseOrders]);

  const getDeliveryProgress = (po: PurchaseOrder) => {
    const totalQty = po.items.reduce((sum, item) => sum + item.quantity, 0);
    const receivedQty = po.items.reduce((sum, item) => sum + item.receivedQty, 0);
    return Math.round((receivedQty / totalQty) * 100);
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ShoppingCart className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
              <p className="text-sm text-gray-500">Manage and track purchase orders</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create PO
          </button>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {(['Draft', 'Sent', 'Partial', 'Received', 'Closed'] as POStatus[]).map((status) => (
            <div
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                statusFilter === status ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`p-1 rounded ${statusConfig[status].bg}`}>
                  {statusConfig[status].icon}
                </span>
                <span className="text-sm text-gray-600">{status}</span>
              </div>
              <p className="text-xl font-bold text-gray-900 mt-1">{statusCounts[status] || 0}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search PO number or vendor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => setStatusFilter('All')}
            className={`px-3 py-2 text-sm rounded-lg ${
              statusFilter === 'All' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            Show All
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* PO List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Loader2 className="w-12 h-12 mb-4 text-blue-500 animate-spin" />
              <p className="text-sm text-gray-500">Loading purchase orders...</p>
            </div>
          ) : filteredPOs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ShoppingCart className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Purchase Orders</h3>
              <p className="text-sm text-gray-500 mb-4">Create a PO from an approved quotation</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Create PO
              </button>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredPOs.map((po) => {
              const progress = getDeliveryProgress(po);
              const isOverdue = new Date(po.expectedDelivery) < new Date() && po.status !== 'Received' && po.status !== 'Closed';
              
              return (
                <div
                  key={po.id}
                  onClick={() => setSelectedPO(po)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedPO?.id === po.id ? 'ring-2 ring-blue-500 border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-blue-600">{po.poNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[po.status].bg} ${statusConfig[po.status].color}`}
                        >
                          {statusConfig[po.status].icon}
                          {po.status}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                        {po.amendments.length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-600">
                            <RefreshCw className="w-3 h-3" />
                            Amended
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{po.vendor.name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {po.rfqNumber}
                        </span>
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {po.items.length} items
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Due: {po.expectedDelivery}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-lg font-bold text-gray-900">
                        <DollarSign className="w-4 h-4" />
                        {po.totalAmount.toLocaleString()}
                      </div>
                      <p className="text-xs text-gray-500">{po.paymentTerms}</p>
                    </div>
                  </div>

                  {/* Delivery Progress */}
                  {(po.status === 'Partial' || po.status === 'Sent') && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-600">Delivery Progress</span>
                        <span className="font-medium">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            progress === 100 ? 'bg-green-500' : progress > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPO && (
          <div className="w-[420px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">PO Details</h2>
              <button onClick={() => setSelectedPO(null)} className="p-1 hover:bg-gray-200 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">PO Number</p>
                  <p className="font-mono font-bold text-lg text-blue-600">{selectedPO.poNumber}</p>
                </div>
                <div className="flex gap-2">
                  <button className="p-2 border rounded-lg hover:bg-gray-50">
                    <Printer className="w-4 h-4 text-gray-600" />
                  </button>
                  <button className="p-2 border rounded-lg hover:bg-gray-50">
                    <Download className="w-4 h-4 text-gray-600" />
                  </button>
                </div>
              </div>

              {/* Vendor Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Vendor</p>
                <p className="font-medium text-gray-900">{selectedPO.vendor.name}</p>
                <p className="text-sm text-gray-500">{selectedPO.vendor.email}</p>
                <p className="text-sm text-gray-500">{selectedPO.vendor.phone}</p>
                <p className="text-sm text-gray-500 mt-1">{selectedPO.vendor.address}</p>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Created</p>
                  <p className="text-sm">{selectedPO.createdDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Sent</p>
                  <p className="text-sm">{selectedPO.sentDate || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Expected Delivery</p>
                  <p className="text-sm font-medium">{selectedPO.expectedDelivery}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Terms</p>
                  <p className="text-sm">{selectedPO.paymentTerms}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Item</th>
                        <th className="text-right px-3 py-2 font-medium">Qty</th>
                        <th className="text-right px-3 py-2 font-medium">Rcvd</th>
                        <th className="text-right px-3 py-2 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedPO.items.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-3 py-2">{item.name}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={item.receivedQty === item.quantity ? 'text-green-600' : item.receivedQty > 0 ? 'text-yellow-600' : 'text-gray-400'}>
                              {item.receivedQty}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">${item.totalPrice.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr className="border-t">
                        <td className="px-3 py-2" colSpan={3}>Total</td>
                        <td className="px-3 py-2 text-right">${selectedPO.totalAmount.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Delivery Address */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Delivery Address</p>
                <p className="text-sm text-gray-700">{selectedPO.deliveryAddress}</p>
              </div>

              {/* Amendments */}
              {selectedPO.amendments.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Amendments</p>
                  <div className="space-y-2">
                    {selectedPO.amendments.map((amendment, idx) => (
                      <div key={idx} className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-sm">
                        <p className="text-gray-900">{amendment.description}</p>
                        <p className="text-xs text-gray-500 mt-1">{amendment.date} by {amendment.by}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedPO.status === 'Draft' && (
                  <>
                    <button
                      onClick={handleSendToVendor}
                      disabled={isActionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendMutation.isPending || approveMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      Send to Vendor
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                      <Edit className="w-4 h-4" />
                      Edit PO
                    </button>
                    <button
                      onClick={handleCancelPO}
                      disabled={isActionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Cancel PO
                    </button>
                  </>
                )}
                {(selectedPO.status === 'Sent' || selectedPO.status === 'Partial') && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      <Package className="w-4 h-4" />
                      Record Delivery
                    </button>
                    <button
                      onClick={() => setShowAmendModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Amend PO
                    </button>
                    <button
                      onClick={handleCancelPO}
                      disabled={isActionLoading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {cancelMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <XCircle className="w-4 h-4" />
                      )}
                      Cancel PO
                    </button>
                  </>
                )}
                {selectedPO.status === 'Received' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                    <CheckCircle className="w-4 h-4" />
                    Close PO
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Truck className="w-4 h-4" />
                  Track Delivery
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Purchase Order</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier ID</label>
                <input
                  type="text"
                  value={createFormData.supplierId || ''}
                  onChange={(e) => setCreateFormData({ ...createFormData, supplierId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter supplier ID"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                  <input
                    type="date"
                    value={createFormData.expectedDeliveryDate || ''}
                    onChange={(e) => setCreateFormData({ ...createFormData, expectedDeliveryDate: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                  <select
                    value={createFormData.paymentTerms || 'Net 30'}
                    onChange={(e) => setCreateFormData({ ...createFormData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Net 15">Net 15</option>
                    <option value="Net 30">Net 30</option>
                    <option value="Net 45">Net 45</option>
                    <option value="Net 60">Net 60</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                <textarea
                  value={createFormData.deliveryAddress || ''}
                  onChange={(e) => setCreateFormData({ ...createFormData, deliveryAddress: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={2}
                  placeholder="Enter delivery address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Instructions</label>
                <textarea
                  value={createFormData.notes || ''}
                  onChange={(e) => setCreateFormData({ ...createFormData, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Any special delivery or handling instructions"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateFormData({});
                }}
                disabled={createMutation.isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreatePO(false)}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save as Draft
              </button>
              <button
                onClick={() => handleCreatePO(true)}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                Create & Send
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Amend Modal */}
      {showAmendModal && selectedPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Amend Purchase Order</h2>
              <p className="text-sm text-gray-500">{selectedPO.poNumber}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amendment Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
                  <option>Quantity Change</option>
                  <option>Delivery Date Change</option>
                  <option>Delivery Address Change</option>
                  <option>Price Adjustment</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  placeholder="Describe the amendment..."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowAmendModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                <RefreshCw className="w-4 h-4" />
                Submit Amendment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}