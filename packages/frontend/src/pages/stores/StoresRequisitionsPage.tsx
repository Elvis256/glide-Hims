import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  FileText,
  Clock,
  CheckCircle,
  Send,
  AlertTriangle,
  Filter,
  Trash2,
  Edit2,
  ChevronRight,
  Package,
  TrendingDown,
  Loader2,
  X,
  ClipboardList,
} from 'lucide-react';
import { procurementService, type PurchaseRequest, type PRStatus, type PRPriority, type CreatePurchaseRequestDto, type CreatePRItemDto } from '../../services/procurement';
import { storesService, type InventoryItem } from '../../services/stores';
import { formatCurrency } from '../../lib/currency';

type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
type Urgency = 'Normal' | 'Urgent' | 'Critical';

interface RequisitionItem {
  id: string;
  itemName: string;
  itemCode: string;
  itemUnit: string;
  currentStock: number;
  reorderLevel: number;
  requestedQty: number;
  unitPrice: number;
}

interface Requisition {
  id: string;
  requisitionNo: string;
  createdDate: string;
  status: RequisitionStatus;
  urgency: Urgency;
  items: RequisitionItem[];
  createdBy: string;
  notes: string;
  totalEstimated: number;
}

const mapPRStatus = (status: PRStatus): RequisitionStatus => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'submitted': return 'Submitted';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return 'Draft';
  }
};

const mapPriority = (priority: string): Urgency => {
  switch (priority) {
    case 'urgent': return 'Urgent';
    case 'high': return 'Critical';
    default: return 'Normal';
  }
};

const mapUrgencyToPriority = (urgency: Urgency): PRPriority => {
  switch (urgency) {
    case 'Urgent': return 'urgent';
    case 'Critical': return 'high';
    default: return 'normal';
  }
};

const transformPurchaseRequest = (pr: PurchaseRequest): Requisition => ({
  id: pr.id,
  requisitionNo: pr.requestNumber,
  createdDate: new Date(pr.createdAt).toLocaleDateString(),
  status: mapPRStatus(pr.status),
  urgency: mapPriority(pr.priority),
  items: pr.items.map(item => ({
    id: item.id,
    itemName: item.itemName,
    itemCode: item.itemCode,
    itemUnit: item.itemUnit || 'unit',
    currentStock: 0,
    reorderLevel: 0,
    requestedQty: item.quantityRequested,
    unitPrice: item.unitPriceEstimated || 0,
  })),
  createdBy: pr.requestedBy?.fullName || 'Unknown',
  notes: pr.notes || '',
  totalEstimated: pr.totalEstimated,
});

export default function StoresRequisitionsPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'All'>('All');
  const [showNewRequisition, setShowNewRequisition] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

  // New requisition form state
  const [newReqUrgency, setNewReqUrgency] = useState<Urgency>('Normal');
  const [newReqNotes, setNewReqNotes] = useState('');
  const [newReqItems, setNewReqItems] = useState<{ item: InventoryItem; quantity: number }[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  // Fetch purchase requests from API
  const { data: purchaseRequests = [], isLoading, error } = useQuery({
    queryKey: ['storesPurchaseRequests'],
    queryFn: () => procurementService.purchaseRequests.list(),
  });

  // Fetch inventory items for item selection
  const { data: inventoryData } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => storesService.inventory.list({ limit: 1000 }),
  });

  // Fetch low stock items for suggestions
  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['lowStockItems'],
    queryFn: () => storesService.inventory.getLowStock(),
  });

  const inventoryItems = inventoryData?.data || [];

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (id: string) => procurementService.purchaseRequests.submit(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['storesPurchaseRequests'] }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePurchaseRequestDto) => procurementService.purchaseRequests.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['storesPurchaseRequests'] });
      resetNewReqForm();
      setShowNewRequisition(false);
    },
  });

  const resetNewReqForm = () => {
    setNewReqUrgency('Normal');
    setNewReqNotes('');
    setNewReqItems([]);
    setItemSearch('');
  };

  const handleCreateRequisition = (submitAfterCreate: boolean) => {
    if (newReqItems.length === 0) return;

    const facilityId = localStorage.getItem('facilityId') || '';
    const items: CreatePRItemDto[] = newReqItems.map(({ item, quantity }) => ({
      itemId: item.id,
      itemCode: item.sku,
      itemName: item.name,
      itemUnit: item.unit,
      quantityRequested: quantity,
      unitPriceEstimated: item.unitCost,
    }));

    const dto: CreatePurchaseRequestDto = {
      facilityId,
      priority: mapUrgencyToPriority(newReqUrgency),
      notes: newReqNotes,
      items,
    };

    createMutation.mutate(dto);
  };

  const addItemToRequisition = (item: InventoryItem) => {
    if (!newReqItems.find(i => i.item.id === item.id)) {
      const suggestedQty = Math.max(item.maxStock - item.currentStock, item.minStock);
      setNewReqItems([...newReqItems, { item, quantity: suggestedQty > 0 ? suggestedQty : 10 }]);
    }
    setItemSearch('');
  };

  const removeItemFromRequisition = (itemId: string) => {
    setNewReqItems(newReqItems.filter(i => i.item.id !== itemId));
  };

  const updateItemQuantity = (itemId: string, quantity: number) => {
    setNewReqItems(newReqItems.map(i => 
      i.item.id === itemId ? { ...i, quantity: Math.max(1, quantity) } : i
    ));
  };

  const filteredInventoryItems = useMemo(() => {
    if (!itemSearch.trim()) return [];
    return inventoryItems.filter(item =>
      item.name.toLowerCase().includes(itemSearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(itemSearch.toLowerCase())
    ).slice(0, 10);
  }, [inventoryItems, itemSearch]);

  // Transform and filter requisitions
  const requisitions = useMemo(() => 
    purchaseRequests.map(transformPurchaseRequest),
    [purchaseRequests]
  );

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchesSearch =
        req.requisitionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.items.some((item) => item.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesStatus = statusFilter === 'All' || req.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [requisitions, searchTerm, statusFilter]);

  const stats = useMemo(() => ({
    total: requisitions.length,
    draft: requisitions.filter(r => r.status === 'Draft').length,
    submitted: requisitions.filter(r => r.status === 'Submitted').length,
    approved: requisitions.filter(r => r.status === 'Approved').length,
  }), [requisitions]);

  const newReqTotal = useMemo(() => 
    newReqItems.reduce((sum, { item, quantity }) => sum + (item.unitCost || 0) * quantity, 0),
    [newReqItems]
  );

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
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-600 font-medium">Failed to load requisitions</p>
          <p className="text-gray-500 text-sm mt-1">Please try again later</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: RequisitionStatus) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Submitted': return 'bg-blue-100 text-blue-700';
      case 'Approved': return 'bg-green-100 text-green-700';
      case 'Rejected': return 'bg-red-100 text-red-700';
    }
  };

  const getUrgencyColor = (urgency: Urgency) => {
    switch (urgency) {
      case 'Normal': return 'bg-gray-100 text-gray-600';
      case 'Urgent': return 'bg-orange-100 text-orange-700';
      case 'Critical': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: RequisitionStatus) => {
    switch (status) {
      case 'Draft': return <FileText className="w-4 h-4" />;
      case 'Submitted': return <Clock className="w-4 h-4" />;
      case 'Approved': return <CheckCircle className="w-4 h-4" />;
      case 'Rejected': return <AlertTriangle className="w-4 h-4" />;
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Store Requisitions</h1>
          <p className="text-gray-600">Create and manage inventory requisition requests</p>
        </div>
        <button
          onClick={() => setShowNewRequisition(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ClipboardList className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Requisitions</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Edit2 className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-700">{stats.draft}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Send className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Submitted</p>
              <p className="text-2xl font-bold text-blue-600">{stats.submitted}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by requisition number or item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as RequisitionStatus | 'All')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
            </div>
          </div>

          {/* Requisitions Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Requisition</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Est. Value</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Urgency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRequisitions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No requisitions found</p>
                        <p className="text-gray-400 text-sm mt-1">Create a new requisition to get started</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequisitions.map((req) => (
                      <tr
                        key={req.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedRequisition?.id === req.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedRequisition(req)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{req.requisitionNo}</p>
                            <p className="text-sm text-gray-500">{req.createdBy}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{req.createdDate}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                            {req.items.length} items
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatCurrency(req.totalEstimated)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(req.urgency)}`}>
                            {req.urgency}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(req.status)}`}>
                            {getStatusIcon(req.status)}
                            {req.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {req.status === 'Draft' && (
                              <>
                                <button 
                                  className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                                  title="Submit for approval"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    submitMutation.mutate(req.id);
                                  }}
                                  disabled={submitMutation.isPending}
                                >
                                  {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                </button>
                                <button className="p-1.5 hover:bg-red-100 rounded text-red-600" title="Delete">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button className="p-1.5 hover:bg-gray-100 rounded" title="View details">
                              <ChevronRight className="w-4 h-4 text-gray-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Low Stock Suggestions Panel */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-orange-50">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-900">Low Stock Alerts</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Items below reorder level</p>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {lowStockItems.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No low stock items</p>
                <p className="text-gray-400 text-xs mt-1">All items are above reorder levels</p>
              </div>
            ) : (
              lowStockItems.slice(0, 10).map((item) => (
                <div key={item.id} className="p-3 border border-orange-200 rounded-lg bg-orange-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Stock: {item.currentStock}</span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500">Min: {item.minStock}</span>
                      </div>
                    </div>
                    <Package className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-medium text-orange-700">
                      Need: {Math.max(item.minStock - item.currentStock, 0)} {item.unit}
                    </span>
                    <button 
                      onClick={() => {
                        setShowNewRequisition(true);
                        addItemToRequisition(item);
                      }}
                      className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Detail Sidebar */}
      {selectedRequisition && (
        <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-xl border-l border-gray-200 z-40 overflow-auto">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
            <h2 className="font-semibold text-gray-900">{selectedRequisition.requisitionNo}</h2>
            <button
              onClick={() => setSelectedRequisition(null)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRequisition.status)}`}>
                {getStatusIcon(selectedRequisition.status)}
                {selectedRequisition.status}
              </span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getUrgencyColor(selectedRequisition.urgency)}`}>
                {selectedRequisition.urgency}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Created By</p>
                <p className="font-medium">{selectedRequisition.createdBy}</p>
              </div>
              <div>
                <p className="text-gray-500">Date</p>
                <p className="font-medium">{selectedRequisition.createdDate}</p>
              </div>
              <div>
                <p className="text-gray-500">Total Items</p>
                <p className="font-medium">{selectedRequisition.items.length}</p>
              </div>
              <div>
                <p className="text-gray-500">Est. Value</p>
                <p className="font-medium">{formatCurrency(selectedRequisition.totalEstimated)}</p>
              </div>
            </div>
            {selectedRequisition.notes && (
              <div>
                <p className="text-gray-500 text-sm">Notes</p>
                <p className="text-sm mt-1">{selectedRequisition.notes}</p>
              </div>
            )}
            <div>
              <p className="text-gray-500 text-sm mb-2">Items</p>
              <div className="space-y-2">
                {selectedRequisition.items.map((item) => (
                  <div key={item.id} className="p-2 bg-gray-50 rounded-lg">
                    <p className="font-medium text-sm">{item.itemName}</p>
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Qty: {item.requestedQty} {item.itemUnit}</span>
                      <span>{formatCurrency(item.unitPrice * item.requestedQty)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {selectedRequisition.status === 'Draft' && (
              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={() => submitMutation.mutate(selectedRequisition.id)}
                  disabled={submitMutation.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Submit
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* New Requisition Modal */}
      {showNewRequisition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Requisition</h2>
              <button
                onClick={() => {
                  setShowNewRequisition(false);
                  resetNewReqForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level</label>
                    <select 
                      value={newReqUrgency}
                      onChange={(e) => setNewReqUrgency(e.target.value as Urgency)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Urgent">Urgent</option>
                      <option value="Critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Total</label>
                    <div className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg font-medium">
                      {formatCurrency(newReqTotal)}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="Search items by name or SKU..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {filteredInventoryItems.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {filteredInventoryItems.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => addItemToRequisition(item)}
                            className="w-full px-4 py-2 text-left hover:bg-gray-50 flex justify-between items-center"
                          >
                            <div>
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.sku} · Stock: {item.currentStock} {item.unit}</p>
                            </div>
                            <Plus className="w-4 h-4 text-blue-600" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Selected Items */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {newReqItems.length === 0 ? (
                    <div className="p-8 text-center">
                      <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-500">No items added yet</p>
                      <p className="text-xs text-gray-400 mt-1">Search and add items above</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Item</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Stock</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 w-28">Quantity</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Subtotal</th>
                          <th className="px-3 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {newReqItems.map(({ item, quantity }) => (
                          <tr key={item.id}>
                            <td className="px-3 py-2">
                              <p className="font-medium text-sm">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.sku}</p>
                            </td>
                            <td className="px-3 py-2 text-sm text-gray-600">
                              {item.currentStock} {item.unit}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="1"
                                value={quantity}
                                onChange={(e) => updateItemQuantity(item.id, parseInt(e.target.value) || 1)}
                                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                              />
                            </td>
                            <td className="px-3 py-2 text-sm text-right font-medium">
                              {formatCurrency((item.unitCost || 0) * quantity)}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                onClick={() => removeItemFromRequisition(item.id)}
                                className="p-1 hover:bg-red-100 rounded text-red-600"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Justification</label>
                  <textarea
                    value={newReqNotes}
                    onChange={(e) => setNewReqNotes(e.target.value)}
                    placeholder="Add any notes or justification for this requisition..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-between items-center">
              <div className="text-sm text-gray-500">
                {newReqItems.length} item{newReqItems.length !== 1 ? 's' : ''} · Total: <span className="font-semibold text-gray-900">{formatCurrency(newReqTotal)}</span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNewRequisition(false);
                    resetNewReqForm();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleCreateRequisition(false)}
                  disabled={newReqItems.length === 0 || createMutation.isPending}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save as Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
