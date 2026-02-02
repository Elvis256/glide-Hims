import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
  X,
} from 'lucide-react';
import { procurementService, type PurchaseOrder, type POStatus } from '../../services/procurement';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';

type DisplayPOStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Sent' | 'Partially Delivered' | 'Delivered' | 'Cancelled';

interface POItem {
  id: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  receivedQty: number;
}

interface DisplayPurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  supplierCode: string;
  createdDate: string;
  expectedDelivery: string;
  status: DisplayPOStatus;
  items: POItem[];
  paymentTerms: string;
  deliveryAddress: string;
  notes: string;
  requisitionRef?: string;
  totalAmount: number;
}

const mapPOStatus = (status: POStatus): DisplayPOStatus => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'pending_approval': return 'Pending Approval';
    case 'approved': return 'Approved';
    case 'sent': return 'Sent';
    case 'partial': return 'Partially Delivered';
    case 'received': return 'Delivered';
    case 'cancelled': return 'Cancelled';
    default: return 'Draft';
  }
};

const transformPurchaseOrder = (po: PurchaseOrder): DisplayPurchaseOrder => ({
  id: po.id,
  poNumber: po.orderNumber,
  supplier: po.supplier?.name || 'Unknown Supplier',
  supplierCode: po.supplier?.code || '',
  createdDate: new Date(po.createdAt).toLocaleDateString(),
  expectedDelivery: po.expectedDelivery ? new Date(po.expectedDelivery).toLocaleDateString() : '',
  status: mapPOStatus(po.status),
  items: po.items.map(item => ({
    id: item.id,
    itemName: item.itemName,
    quantity: item.quantityOrdered,
    unitPrice: item.unitPrice,
    receivedQty: item.quantityReceived,
  })),
  paymentTerms: po.paymentTerms || '',
  deliveryAddress: po.deliveryAddress || '',
  notes: po.notes || '',
  requisitionRef: po.purchaseRequestId,
  totalAmount: po.totalAmount,
});

export default function StoresPOPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DisplayPOStatus | 'All'>('All');
  const [showNewPO, setShowNewPO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<DisplayPurchaseOrder | null>(null);

  // Form state for new PO
  const [poForm, setPOForm] = useState({
    supplierId: '',
    expectedDelivery: '',
    paymentTerms: 'Net 30',
    deliveryAddress: '',
    notes: '',
    items: [] as { itemId: string; itemName: string; quantity: number; unitPrice: number }[],
  });
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ itemId: '', itemName: '', quantity: 1, unitPrice: 0 });

  const { data: purchaseOrders = [], isLoading, error } = useQuery({
    queryKey: ['storesPurchaseOrders'],
    queryFn: () => procurementService.purchaseOrders.list(),
  });

  // Fetch suppliers for dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-for-po'],
    queryFn: async () => {
      const response = await fetch('/api/v1/suppliers?facilityId=');
      if (!response.ok) return { data: [] };
      return response.json();
    },
  });
  const suppliers = suppliersData?.data || [];

  // Create PO mutation
  const createMutation = useMutation({
    mutationFn: (data: typeof poForm) => procurementService.purchaseOrders.create({
      facilityId,
      supplierId: data.supplierId,
      expectedDelivery: data.expectedDelivery,
      paymentTerms: data.paymentTerms,
      deliveryAddress: data.deliveryAddress,
      notes: data.notes,
      items: data.items.map(item => ({
        itemId: item.itemId || crypto.randomUUID(),
        itemCode: item.itemId || '',
        itemName: item.itemName,
        quantityOrdered: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storesPurchaseOrders'] });
      setShowNewPO(false);
      setPOForm({
        supplierId: '',
        expectedDelivery: '',
        paymentTerms: 'Net 30',
        deliveryAddress: '',
        notes: '',
        items: [],
      });
    },
  });

  const addItemToForm = () => {
    if (!newItem.itemName || newItem.quantity <= 0) return;
    setPOForm(prev => ({
      ...prev,
      items: [...prev.items, { ...newItem, itemId: crypto.randomUUID() }],
    }));
    setNewItem({ itemId: '', itemName: '', quantity: 1, unitPrice: 0 });
    setShowAddItem(false);
  };

  const removeItemFromForm = (index: number) => {
    setPOForm(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const sendMutation = useMutation({
    mutationFn: (id: string) => procurementService.purchaseOrders.send(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storesPurchaseOrders'] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => procurementService.purchaseOrders.approve(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storesPurchaseOrders'] }),
  });

  const displayPOs = useMemo(() => 
    purchaseOrders.map(transformPurchaseOrder),
    [purchaseOrders]
  );

  const filteredPOs = useMemo(() => {
    return displayPOs.filter((po) => {
      const matchesSearch =
        po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.items.some((item) => item.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || po.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [displayPOs, searchTerm, statusFilter]);

  const stats = useMemo(() => {
    const totalValue = displayPOs.reduce((sum, po) => sum + po.totalAmount, 0);
    return {
      total: displayPOs.length,
      pending: displayPOs.filter(po => po.status === 'Draft' || po.status === 'Pending Approval' || po.status === 'Sent').length,
      inTransit: displayPOs.filter(po => po.status === 'Approved' || po.status === 'Partially Delivered').length,
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
      case 'Pending Approval': return 'bg-yellow-100 text-yellow-700';
      case 'Approved': return 'bg-indigo-100 text-indigo-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Partially Delivered': return 'bg-orange-100 text-orange-700';
      case 'Delivered': return 'bg-green-100 text-green-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: DisplayPOStatus) => {
    switch (status) {
      case 'Draft': return <FileText className="w-4 h-4" />;
      case 'Pending Approval': return <Clock className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Sent': return <Send className="w-4 h-4" />;
      case 'Partially Delivered': return <Truck className="w-4 h-4" />;
      case 'Delivered': return <Package className="w-4 h-4" />;
      case 'Cancelled': return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getDaysUntilDelivery = (date: string) => {
    if (!date) return null;
    const today = new Date();
    const delivery = new Date(date);
    return Math.ceil((delivery.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stores Purchase Orders</h1>
          <p className="text-gray-600">Create and manage purchase orders for store items</p>
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
              placeholder="Search by PO number, supplier, or item..."
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
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Sent">Sent</option>
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
                            {po.supplierCode && (
                              <p className="text-xs text-gray-500">{po.supplierCode}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{po.createdDate}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{po.expectedDelivery || '-'}</span>
                          {po.status !== 'Delivered' && po.status !== 'Cancelled' && daysUntil !== null && daysUntil <= 2 && daysUntil > 0 && (
                            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">
                              {daysUntil}d
                            </span>
                          )}
                          {po.status !== 'Delivered' && po.status !== 'Cancelled' && daysUntil !== null && daysUntil <= 0 && (
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
                        {formatCurrency(po.totalAmount)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(po.status)}`}>
                          {getStatusIcon(po.status)}
                          {po.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="View">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1.5 hover:bg-gray-100 rounded text-gray-600" title="Print">
                            <Printer className="w-4 h-4" />
                          </button>
                          {po.status === 'Pending Approval' && (
                            <button 
                              className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                approveMutation.mutate(po.id);
                              }}
                              disabled={approveMutation.isPending}
                            >
                              {approveMutation.isPending ? 'Approving...' : 'Approve'}
                            </button>
                          )}
                          {po.status === 'Approved' && (
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
                          {po.status === 'Sent' && (
                            <button className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">
                              Receive
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
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[60vh]">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={poForm.supplierId}
                      onChange={(e) => setPOForm({ ...poForm, supplierId: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select supplier...</option>
                      {suppliers.map((s: any) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {suppliers.length === 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        No suppliers found. Add suppliers from Stores → Suppliers first.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">From Requisition</label>
                    <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500">
                      <option value="">Select requisition (optional)...</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
                    <input
                      type="date"
                      value={poForm.expectedDelivery}
                      onChange={(e) => setPOForm({ ...poForm, expectedDelivery: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Terms</label>
                    <select
                      value={poForm.paymentTerms}
                      onChange={(e) => setPOForm({ ...poForm, paymentTerms: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Net 15">Net 15</option>
                      <option value="Net 30">Net 30</option>
                      <option value="Net 45">Net 45</option>
                      <option value="Net 60">Net 60</option>
                      <option value="COD">Cash on Delivery</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Order Items <span className="text-red-500">*</span>
                  </label>
                  <div className="border border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Item</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Quantity</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Unit Price</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-600">Total</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {poForm.items.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="px-3 py-4 text-center text-gray-500 text-sm">
                              No items added. Add items manually below.
                            </td>
                          </tr>
                        ) : (
                          poForm.items.map((item, idx) => (
                            <tr key={idx} className="border-t">
                              <td className="px-3 py-2 text-sm">{item.itemName}</td>
                              <td className="px-3 py-2 text-sm">{item.quantity}</td>
                              <td className="px-3 py-2 text-sm">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-3 py-2 text-sm font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                              <td className="px-3 py-2">
                                <button
                                  onClick={() => removeItemFromForm(idx)}
                                  className="text-red-500 hover:text-red-700"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                        {poForm.items.length > 0 && (
                          <tr className="border-t bg-gray-50">
                            <td colSpan={3} className="px-3 py-2 text-sm font-medium text-right">Total:</td>
                            <td className="px-3 py-2 text-sm font-bold">
                              {formatCurrency(poForm.items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0))}
                            </td>
                            <td></td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Add Item Form */}
                  {showAddItem ? (
                    <div className="mt-2 p-3 border border-blue-200 rounded-lg bg-blue-50">
                      <div className="grid grid-cols-4 gap-2">
                        <div className="col-span-2">
                          <input
                            type="text"
                            placeholder="Item name"
                            value={newItem.itemName}
                            onChange={(e) => setNewItem({ ...newItem, itemName: e.target.value })}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            placeholder="Qty"
                            min="1"
                            value={newItem.quantity}
                            onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                        <div>
                          <input
                            type="number"
                            placeholder="Price"
                            min="0"
                            step="0.01"
                            value={newItem.unitPrice}
                            onChange={(e) => setNewItem({ ...newItem, unitPrice: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={addItemToForm}
                          disabled={!newItem.itemName || newItem.quantity <= 0}
                          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                        <button
                          onClick={() => setShowAddItem(false)}
                          className="px-3 py-1 text-sm border rounded hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="mt-2 text-sm text-blue-600 hover:underline"
                    >
                      + Add Item Manually
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                  <input
                    type="text"
                    placeholder="e.g., Main Store, Ground Floor"
                    value={poForm.deliveryAddress}
                    onChange={(e) => setPOForm({ ...poForm, deliveryAddress: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Add any special instructions..."
                    value={poForm.notes}
                    onChange={(e) => setPOForm({ ...poForm, notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <Download className="w-4 h-4" />
                <span className="text-sm">Export as PDF (coming soon)</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowNewPO(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!poForm.supplierId) {
                      toast.error('Please select a supplier first.\n\nIf no suppliers are available, go to Stores → Suppliers to add one.');
                      return;
                    }
                    if (poForm.items.length === 0) {
                      toast.error('Please add at least one item to the order.');
                      return;
                    }
                    createMutation.mutate(poForm);
                  }}
                  disabled={createMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {createMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Submit for Approval
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
