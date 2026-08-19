import React, { useState, useMemo } from 'react';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api, { getApiErrorMessage } from '../../../services/api';
import { getFacilityId } from '../../../lib/facility';
import { CatalogItemPicker, type SelectedItem } from '../../../components/catalog';
import { CategoryContextBanner, useProcurementCategory } from '../../../components/procurement/CategoryContextBanner';
import { ApprovalChainTimeline } from '../../../components/procurement/ApprovalChainTimeline';
import { rfqService, type VendorQuotation } from '../../../services/rfq';
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
  Calendar,
  DollarSign,
  Package,
  Building2,
  FileText,
  Printer,
  Download,
  AlertCircle,
  MoreVertical,
  Loader2,
} from 'lucide-react';

// Map backend status to UI status
/** Mirrors POStatus in backend database/entities/purchase-order.entity.ts. */
type BackendPOStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'partially_received'
  | 'fully_received'
  | 'cancelled'
  | 'closed';
/**
 * Cancelled used to display as "Closed" and both pending_approval and
 * approved displayed as "Draft". So a cancelled order was indistinguishable
 * from a fulfilled one, and an order sitting on the CFO's desk looked like
 * nobody had finished writing it. All three are now their own state.
 */
type POStatus =
  | 'Draft'
  | 'Awaiting Approval'
  | 'Approved'
  | 'Sent'
  | 'Partial'
  | 'Received'
  | 'Closed'
  | 'Cancelled';

const statusMap: Record<BackendPOStatus, POStatus> = {
  draft: 'Draft',
  pending_approval: 'Awaiting Approval',
  approved: 'Approved',
  sent: 'Sent',
  partially_received: 'Partial',
  fully_received: 'Received',
  cancelled: 'Cancelled',
  closed: 'Closed',
};

const reverseStatusMap: Record<POStatus, BackendPOStatus[]> = {
  Draft: ['draft'],
  'Awaiting Approval': ['pending_approval'],
  Approved: ['approved'],
  Sent: ['sent'],
  Partial: ['partially_received'],
  Received: ['fully_received'],
  Closed: ['closed'],
  Cancelled: ['cancelled'],
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
    itemName: string;
    itemUnit?: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  totalAmount: number;
  orderDate: string;
  expectedDelivery?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
}

/** Mirrors CreatePurchaseOrderDto. The backend runs ValidationPipe with
 *  forbidNonWhitelisted, so any key not on the DTO rejects the whole request. */
interface CreatePurchaseOrderData {
  facilityId: string;
  supplierId: string;
  items: Array<{
    itemId: string;
    itemCode: string;
    itemName: string;
    itemUnit: string;
    quantityOrdered: number;
    unitPrice: number;
  }>;
  expectedDelivery?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  notes?: string;
}

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
  // decimal columns arrive from TypeORM as strings — coerce before arithmetic
  items: (po.items ?? []).map((item) => ({
    id: item.id,
    name: item.itemName,
    quantity: Number(item.quantityOrdered),
    receivedQty: Number(item.quantityReceived ?? 0),
    unit: item.itemUnit || 'unit',
    unitPrice: Number(item.unitPrice),
    totalPrice: Number(item.lineTotal),
  })),
  totalAmount: Number(po.totalAmount),
  status: statusMap[po.status] || 'Draft',
  backendStatus: po.status,
  createdDate: po.orderDate,
  sentDate: po.status === 'sent' ? po.orderDate : undefined,
  expectedDelivery: po.expectedDelivery || '',
  deliveryAddress: po.deliveryAddress || '',
  paymentTerms: po.paymentTerms || 'Net 30',
  notes: po.notes,
});

const statusConfig: Record<POStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Edit className="w-3 h-3" /> },
  'Awaiting Approval': {
    color: 'text-amber-700',
    bg: 'bg-amber-100',
    icon: <Clock className="w-3 h-3" />,
  },
  Approved: { color: 'text-teal-700', bg: 'bg-teal-100', icon: <CheckCircle className="w-3 h-3" /> },
  Sent: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Send className="w-3 h-3" /> },
  Partial: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Package className="w-3 h-3" /> },
  Received: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" /> },
  Closed: { color: 'text-purple-600', bg: 'bg-purple-100', icon: <CheckCircle className="w-3 h-3" /> },
  Cancelled: { color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" /> },
};

export default function PurchaseOrdersPage() {
  const { category: __procCategory } = useProcurementCategory();
  const catalogModule: 'pharmacy' | 'general' | 'all' = __procCategory === 'drugs' ? 'pharmacy' : __procCategory === 'supplies' ? 'general' : 'all';

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<POStatus | 'All'>('All');
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [cancellingPO, setCancellingPO] = useState<PurchaseOrder | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFromQuoteModal, setShowFromQuoteModal] = useState(false);
  const [fromQuoteSelectedId, setFromQuoteSelectedId] = useState<string | null>(null);
  const [fromQuoteExpectedDelivery, setFromQuoteExpectedDelivery] = useState('');
  const [fromQuoteDeliveryAddress, setFromQuoteDeliveryAddress] = useState('');
  const [fromQuoteNotes, setFromQuoteNotes] = useState('');
  const [createFormData, setCreateFormData] = useState<Partial<CreatePurchaseOrderData>>({});

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const showCreateModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showCreateModal,
    onClose: () => setShowCreateModal(false),
  });
  const showFromQuoteModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showFromQuoteModal,
    onClose: () => setShowFromQuoteModal(false),
  });
  const [poLineItems, setPoLineItems] = useState<Array<{ rowId: string; itemId: string; itemCode: string; itemName: string; itemUnit: string; quantityOrdered: number; unitPrice: number }>>([
    { rowId: '1', itemId: '', itemCode: '', itemName: '', itemUnit: 'unit', quantityOrdered: 1, unitPrice: 0 },
  ]);

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
      setPoLineItems([{ rowId: '1', itemId: '', itemCode: '', itemName: '', itemUnit: 'unit', quantityOrdered: 1, unitPrice: 0 }]);
    },
  });

  // Approved (selected) quotations available for PO conversion
  const { data: selectedQuotations = [], isLoading: selectedQuotesLoading } = useQuery<VendorQuotation[]>({
    queryKey: ['selected-quotations', facilityId],
    queryFn: () => rfqService.quotations.listSelected(facilityId),
    enabled: !!facilityId && showFromQuoteModal,
  });

  const createFromQuotationMutation = useMutation({
    mutationFn: async (payload: {
      quotationId: string;
      expectedDelivery?: string;
      deliveryAddress?: string;
      notes?: string;
    }) => {
      const response = await api.post('/procurement/purchase-orders/from-quotation', payload);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['selected-quotations'] });
      setShowFromQuoteModal(false);
      setFromQuoteSelectedId(null);
      setFromQuoteExpectedDelivery('');
      setFromQuoteDeliveryAddress('');
      setFromQuoteNotes('');
      toast.success('Purchase order created from approved quotation');
    },
    onError: (err: any) => {
      toast.error(getApiErrorMessage(err, 'Failed to create PO from quotation'));
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
    },
    // Approval genuinely refuses above the single-approver cap when no
    // approval chain is configured, so name that case in the fallback.
    onError: (err: any) =>
      toast.error(getApiErrorMessage(err, 'Failed to approve purchase order')),
  });

  // Send to supplier mutation
  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await api.put(`/procurement/purchase-orders/${id}/send`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      toast.success('Purchase order sent to supplier');
      setSelectedPO(null);
    },
    onError: (err: any) =>
      toast.error(getApiErrorMessage(err, 'Failed to send purchase order')),
  });

  // Cancel purchase order mutation.
  //
  // The endpoint has always taken a reason and the page never sent one, so
  // every cancellation was recorded as unexplained — and cancelling now also
  // hands the quantities back to the requisition and releases the budget it
  // was holding, which is exactly the kind of thing an auditor asks "why" of.
  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const response = await api.put(`/procurement/purchase-orders/${id}/cancel`, { reason });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-requests'] });
      toast.success('Purchase order cancelled');
      setCancellingPO(null);
      setSelectedPO(null);
    },
    onError: (err: any) =>
      toast.error(getApiErrorMessage(err, 'Failed to cancel purchase order')),
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


  const handleCreatePO = (sendImmediately: boolean) => {
    if (!facilityId) {
      toast.error('No facility selected');
      return;
    }
    if (!createFormData.supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    const validItems = poLineItems.filter((i) => i.itemId && i.quantityOrdered > 0);
    if (validItems.length === 0) {
      toast.error('Add at least one item to the purchase order');
      return;
    }
    const payload: CreatePurchaseOrderData = {
      facilityId,
      supplierId: createFormData.supplierId!,
      items: validItems.map((i) => ({
        itemId: i.itemId,
        itemCode: i.itemCode,
        itemName: i.itemName,
        itemUnit: i.itemUnit,
        quantityOrdered: i.quantityOrdered,
        unitPrice: i.unitPrice,
      })),
      expectedDelivery: createFormData.expectedDelivery,
      deliveryAddress: createFormData.deliveryAddress,
      paymentTerms: createFormData.paymentTerms,
      notes: createFormData.notes,
    };
    createMutation.mutate(payload, {
      onSuccess: (data) => {
        if (sendImmediately && data?.id) {
          sendMutation.mutate(data.id);
        }
        setPoLineItems([{ rowId: '1', itemId: '', itemCode: '', itemName: '', itemUnit: 'unit', quantityOrdered: 1, unitPrice: 0 }]);
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
      <CategoryContextBanner />
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFromQuoteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              title="Convert an approved quotation into a Purchase Order"
            >
              <FileText className="w-4 h-4" />
              From Quotation
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create PO
            </button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {(
            [
              'Draft',
              'Awaiting Approval',
              'Approved',
              'Sent',
              'Partial',
              'Received',
              'Closed',
              'Cancelled',
            ] as POStatus[]
          ).map((status) => (
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
              const isOverdue =
                new Date(po.expectedDelivery) < new Date() &&
                !['Received', 'Closed', 'Cancelled'].includes(po.status);
              
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

              {/* Approval chain (real, from policy resolver) */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Approval Chain</p>
                <ApprovalChainTimeline documentId={selectedPO.id} documentType="PO" />
              </div>

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {['draft', 'pending_approval', 'approved'].includes(selectedPO.backendStatus) && (
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
                    <button
                      onClick={() => setCancellingPO(selectedPO)}
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
                    <button
                      onClick={() => setCancellingPO(selectedPO)}
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={showCreateModalDialogRef}
        >
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
                    value={createFormData.expectedDelivery || ''}
                    onChange={(e) => setCreateFormData({ ...createFormData, expectedDelivery: e.target.value })}
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

              {/* Items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Order Items</label>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2">Item</th>
                        <th className="text-left px-3 py-2 w-20">Qty</th>
                        <th className="text-left px-3 py-2 w-16">Unit</th>
                        <th className="text-left px-3 py-2 w-24">Unit Price</th>
                        <th className="px-3 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {poLineItems.map((line) => (
                        <tr key={line.rowId} className="border-t">
                          <td className="px-3 py-2 min-w-[200px]">
                            <CatalogItemPicker
                              module={catalogModule}
                              value={line.itemId ? { id: line.itemId, source: 'inventory', code: line.itemCode, name: line.itemName, unit: line.itemUnit } : null}
                              onChange={(picked) =>
                                setPoLineItems((prev) =>
                                  prev.map((l) =>
                                    l.rowId === line.rowId
                                      ? {
                                          ...l,
                                          itemId: picked?.id || '',
                                          itemCode: picked?.code || '',
                                          itemName: picked?.name || '',
                                          itemUnit: picked?.unit || l.itemUnit,
                                          unitPrice: picked?.lastPrice ?? picked?.sellingPrice ?? l.unitPrice,
                                        }
                                      : l,
                                  ),
                                )
                              }
                              size="sm"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={1}
                              value={line.quantityOrdered || ''}
                              onChange={(e) =>
                                setPoLineItems((prev) =>
                                  prev.map((l) =>
                                    l.rowId === line.rowId ? { ...l, quantityOrdered: parseInt(e.target.value) || 0 } : l,
                                  ),
                                )
                              }
                              className="w-16 px-2 py-1 border rounded text-sm"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="text"
                              value={line.itemUnit}
                              onChange={(e) =>
                                setPoLineItems((prev) =>
                                  prev.map((l) => (l.rowId === line.rowId ? { ...l, itemUnit: e.target.value } : l)),
                                )
                              }
                              className="w-14 px-2 py-1 border rounded text-sm"
                              placeholder="unit"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              value={line.unitPrice || ''}
                              onChange={(e) =>
                                setPoLineItems((prev) =>
                                  prev.map((l) =>
                                    l.rowId === line.rowId ? { ...l, unitPrice: parseFloat(e.target.value) || 0 } : l,
                                  ),
                                )
                              }
                              className="w-20 px-2 py-1 border rounded text-sm"
                              placeholder="0.00"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => setPoLineItems((prev) => prev.filter((l) => l.rowId !== line.rowId))}
                              className="text-red-400 hover:text-red-600"
                              disabled={poLineItems.length === 1}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPoLineItems((prev) => [
                      ...prev,
                      { rowId: String(Date.now()), itemId: '', itemCode: '', itemName: '', itemUnit: 'unit', quantityOrdered: 1, unitPrice: 0 },
                    ])
                  }
                  className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
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

      {/* Create PO From Approved Quotation Modal */}
      {showFromQuoteModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={showFromQuoteModalDialogRef}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create PO from Approved Quotation</h2>
                <p className="text-sm text-gray-500">
                  Pick a quotation that has cleared the approval workflow.
                </p>
              </div>
              <button
                onClick={() => {
                  setShowFromQuoteModal(false);
                  setFromQuoteSelectedId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {selectedQuotesLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading approved
                  quotations…
                </div>
              ) : selectedQuotations.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm font-medium text-gray-900">
                    No approved quotations awaiting PO conversion
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Quotations appear here once they have passed all required
                    approval levels.
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {selectedQuotations.map((q) => {
                      const isSelected = fromQuoteSelectedId === q.id;
                      return (
                        <div
                          key={q.id}
                          onClick={() => setFromQuoteSelectedId(q.id)}
                          className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-green-500 ring-2 ring-green-500 bg-green-50'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-mono text-sm font-medium text-green-700">
                                  {q.quotationNumber}
                                </span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                  Approved
                                </span>
                              </div>
                              <div className="text-sm text-gray-900 font-medium">
                                {q.supplier?.name || 'Unknown supplier'}
                              </div>
                              <div className="text-xs text-gray-500">
                                RFQ {(q as any).rfq?.rfqNumber} ·{' '}
                                {q.items?.length || 0} items · {q.deliveryDays}d
                                delivery
                              </div>
                              {q.validUntil && (
                                <div className="text-xs text-gray-500 mt-0.5">
                                  Valid until{' '}
                                  {new Date(q.validUntil).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                UGX {Number(q.totalAmount).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {q.paymentTerms}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {fromQuoteSelectedId && (
                    <div className="border-t pt-4 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900">
                        Purchase Order Details
                      </h3>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Expected Delivery
                          </label>
                          <input
                            type="date"
                            value={fromQuoteExpectedDelivery}
                            onChange={(e) =>
                              setFromQuoteExpectedDelivery(e.target.value)
                            }
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Delivery Address
                          </label>
                          <input
                            type="text"
                            value={fromQuoteDeliveryAddress}
                            onChange={(e) =>
                              setFromQuoteDeliveryAddress(e.target.value)
                            }
                            placeholder="Facility default if blank"
                            className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Notes
                        </label>
                        <textarea
                          value={fromQuoteNotes}
                          onChange={(e) => setFromQuoteNotes(e.target.value)}
                          rows={2}
                          placeholder="Optional notes for the supplier"
                          className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFromQuoteModal(false);
                  setFromQuoteSelectedId(null);
                }}
                disabled={createFromQuotationMutation.isPending}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!fromQuoteSelectedId) return;
                  createFromQuotationMutation.mutate({
                    quotationId: fromQuoteSelectedId,
                    expectedDelivery: fromQuoteExpectedDelivery || undefined,
                    deliveryAddress: fromQuoteDeliveryAddress || undefined,
                    notes: fromQuoteNotes || undefined,
                  });
                }}
                disabled={
                  !fromQuoteSelectedId || createFromQuotationMutation.isPending
                }
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {createFromQuotationMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Create Purchase Order
              </button>
            </div>
          </div>
        </div>
      )}

      {cancellingPO && (
        <CancelPOModal
          po={cancellingPO}
          isSubmitting={cancelMutation.isPending}
          onClose={() => setCancellingPO(null)}
          onConfirm={(reason) => cancelMutation.mutate({ id: cancellingPO.id, reason })}
        />
      )}
    </div>
  );
}

/**
 * Cancelling is not a yes/no question.
 *
 * It used to be a window.confirm with no reason field, which meant the audit
 * record said only that someone cancelled. Cancelling also returns the
 * outstanding quantity to the originating requisition and releases the budget
 * the order was holding, so this spells out what is about to happen and makes
 * the reason a requirement rather than an afterthought.
 */
export function CancelPOModal({
  po,
  isSubmitting,
  onClose,
  onConfirm,
}: {
  po: PurchaseOrder;
  isSubmitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const dialogRef = useDialogA11y<HTMLDivElement>({ open: true, onClose });
  const canSubmit = reason.trim().length >= 3 && !isSubmitting;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-po-title"
      ref={dialogRef}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="px-5 py-3 border-b">
          <h3 id="cancel-po-title" className="font-semibold text-gray-900">
            Cancel {po.poNumber}?
          </h3>
          <p className="text-sm text-gray-500">
            {po.vendor?.name || 'Supplier'} · {po.items?.length || 0} line
            {(po.items?.length || 0) === 1 ? '' : 's'}
          </p>
        </div>

        <div className="p-5 space-y-4">
          <ul className="text-sm text-gray-700 space-y-1 list-disc pl-5">
            <li>The supplier will no longer be expected to deliver.</li>
            <li>Anything not yet received goes back to the requisition to be re-ordered.</li>
            <li>Budget held for this order is released.</li>
            <li>Goods already received stay received — this does not reverse them.</li>
          </ul>

          <div>
            <label htmlFor="cancel-reason" className="block text-sm text-gray-700 mb-1">
              Reason for cancelling <span className="text-red-600">required</span>
            </label>
            <textarea
              id="cancel-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. supplier out of stock, price increased beyond quotation, duplicate order"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Keep order
          </button>
          <button
            type="button"
            onClick={() => canSubmit && onConfirm(reason.trim())}
            disabled={!canSubmit}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Cancel order
          </button>
        </div>
      </div>
    </div>
  );
}