import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  Send,
  Truck,
  Package,
  Building2,
  Calendar,
  Filter,
  Eye,
  ChevronRight,
  Printer,
  Download,
  AlertCircle,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { procurementService, type PurchaseOrder, type POStatus } from '../../../services/procurement';
import { formatCurrency } from '../../../lib/currency';

type DisplayPOStatus = 'Draft' | 'Sent' | 'Confirmed' | 'Partially Delivered' | 'Delivered' | 'Cancelled';

interface POItem {
  id: string;
  medication: string;
  quantity: number;
  unitPrice: number;
  receivedQty: number;
}

interface DisplayPurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  supplierEmail: string;
  createdDate: string;
  expectedDelivery: string;
  status: DisplayPOStatus;
  items: POItem[];
  paymentTerms: string;
  deliveryAddress: string;
  notes: string;
  requisitionRef?: string;
}

// Map API status to display status
const mapPOStatus = (status: POStatus): DisplayPOStatus => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'pending_approval': return 'Draft';
    case 'approved': return 'Confirmed';
    case 'sent': return 'Sent';
    case 'partial': return 'Partially Delivered';
    case 'received': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: return 'Draft';
  }
};

// Transform API data to display format
const transformPurchaseOrder = (po: PurchaseOrder): DisplayPurchaseOrder => ({
  id: po.id,
  poNumber: po.orderNumber,
  supplier: po.supplier?.name || 'Unknown Supplier',
  supplierEmail: '',
  createdDate: new Date(po.createdAt).toLocaleDateString(),
  expectedDelivery: po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '',
  status: mapPOStatus(po.status),
  items: po.items.map(item => ({
    id: item.id,
    medication: item.itemName,
    quantity: item.quantityOrdered,
    unitPrice: item.unitPrice,
    receivedQty: item.quantityReceived,
  })),
  paymentTerms: po.paymentTerms || '',
  deliveryAddress: po.deliveryAddress || '',
  notes: po.notes || '',
  requisitionRef: po.purchaseRequestId,
});

export default function PharmacyPOPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.procurement')) {
    return <AccessDenied />;
  }

  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DisplayPOStatus | 'All'>('All');
  const [showNewPO, setShowNewPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<DisplayPurchaseOrder | null>(null);

  // Fetch purchase orders from API
  const { data: purchaseOrders = [], isLoading, error } = useQuery({
    queryKey: ['purchaseOrders'],
    queryFn: () => procurementService.purchaseOrders.list(),
  });

  // Send PO mutation
  const sendMutation = useMutation({
    mutationFn: (id: string) => procurementService.purchaseOrders.send(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
  });

  // Approve PO mutation
  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.purchaseOrders.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchaseOrders'] }),
  });

  // Transform data
  const displayPOs = useMemo(() => 
    purchaseOrders.map(transformPurchaseOrder),
    [purchaseOrders]
  );

  const filteredPOs = useMemo(() => {
    return displayPOs.filter((po) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.items.some((item) => item.medication.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [displayPOs, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = displayPOs.reduce((sum, po) => 
      sum + po.items.reduce((iSum, i) => iSum + i.quantity * i.unitPrice, 0), 0);
    return {
      total: displayPOs.length,
      pending: displayPOs.filter(po => po.status === 'Draft' || po.status === 'Sent').length,
      inTransit: displayPOs.filter(po => po.status === 'Confirmed' || po.status === 'Partially Delivered').length,
      delivered: displayPOs.filter(po => po.status === 'Delivered').length,
      totalValue,
    };
  }, [displayPOs]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <p className="text-red-600">Failed to load purchase orders</p>
      </div>
    );
  }

  const getStatusColor = (status: DisplayPOStatus) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Confirmed': return 'bg-indigo-100 text-indigo-700';
      case 'Partially Delivered': return 'bg-orange-100 text-orange-700';
      case 'Delivered': return 'bg-green-100 text-green-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: DisplayPOStatus) => {
    switch (status) {
      case 'Draft': return <FileText className="w-4 h-4" />;
      case 'Sent': return <Send className="w-4 h-4" />;
      case 'Confirmed': return <CheckCircle className="w-4 h-4" />;
      case 'Partially Delivered': return <Truck className="w-4 h-4" />;
      case 'Delivered': return <Package className="w-4 h-4" />;
      case 'Cancelled': return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getDaysUntilDelivery = (date: string) => {
    const today = new Date();
    const delivery = new Date(date);
    return Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Purchase Orders</h1>
          <p className="text-gray-600">Create and track medication purchase orders</p>
        </div>
        <button
          onClick={() => setShowNewPO(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Purchase Order
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total POs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Clock className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-indigo-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Truck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Transit</p>
              <p className="text-2xl font-bold text-orange-600">{stats.inTransit}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Delivered</p>
              <p className="text-2xl font-bold text-green-600">{stats.delivered}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-purple-600">
                {formatCurrency(stats.totalValue)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by PO number, supplier, or medication..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as DisplayPOStatus | 'All')}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Sent">Sent</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Partially Delivered">Partially Delivered</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* PO Table */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-auto h-full">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">PO Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Created</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expected Delivery</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Total Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500 font-medium">No purchase orders found</p>
                    <p className="text-gray-400 text-sm mt-1">Create a new purchase order to get started</p>
                  </td>
                </tr>
              ) : (
                filteredPOs.map((po) => {
                  const totalValue = po.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
                  const daysUntil = getDaysUntilDelivery(po.expectedDelivery);

                  return (
                    <tr
                      key={po.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        selectedPO?.id === po.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedPO(po)}
                    >
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{po.poNumber}</p>
                          {po.requisitionRef && (
                            <p className="text-xs text-gray-500">Ref: {po.requisitionRef}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-400" />
                          <div>
                            <p className="text-gray-900">{po.supplier}</p>
                            <p className="text-xs text-gray-500">{po.supplierEmail}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{po.createdDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{po.expectedDelivery}</span>
                          {po.status !== 'Delivered' && po.status !== 'Cancelled' && daysUntil <= 2 && daysUntil > 0 && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                              {daysUntil}d
                            </span>
                          )}
                          {po.status !== 'Delivered' && po.status !== 'Cancelled' && daysUntil <= 0 && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                          {po.items.length} items
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {formatCurrency(totalValue)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(po.status)}`}>
                          {getStatusIcon(po.status)}
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600">
                            <Printer className="w-4 h-4" />
                          </button>
                          {po.status === 'Confirmed' && (
                            <button className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                              Receive
                            </button>
                          )}
                          {po.status === 'Draft' && (
                            <button 
                              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                sendMutation.mutate(po.id);
                              }}
                              disabled={sendMutation.isPending}
                            >
                              {sendMutation.isPending ? 'Sending...' : 'Send'}
                            </button>
                          )}
                          <button className="p-1.5 hover:bg-gray-100 rounded">
                            <ChevronRight className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New PO Modal */}
      {showNewPO && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Purchase Order</h2>
              <button
                onClick={() => setShowNewPO(false)}
                className="p-2 hover:bg-gray-100 rounded-lg text-xl"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select supplier...</option>
                      <option value="1">PharmaCorp Kenya</option>
                      <option value="2">MediSupply Ltd</option>
                      <option value="3">HealthCare Distributors</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Requisition</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select requisition (optional)...</option>
                      <option value="REQ-2024-001">REQ-2024-001 - Approved</option>
                      <option value="REQ-2024-002">REQ-2024-002 - Approved</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                      <option value="COD">Cash on Delivery</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Items</label>
                  <div className="border border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Medication</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Quantity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Unit Price</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Total</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td colSpan={5} className="px-3 py-4 text-center text-gray-500 text-sm">
                            No items added. Select a requisition or add items manually.
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <button className="mt-2 text-sm text-blue-600 hover:underline">
                    + Add Item Manually
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    placeholder="e.g., Main Pharmacy Store, Ground Floor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Add any special instructions..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">Export as PDF</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewPO(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                  Save as Draft
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                  <Send className="w-4 h-4" />
                  Send to Supplier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
