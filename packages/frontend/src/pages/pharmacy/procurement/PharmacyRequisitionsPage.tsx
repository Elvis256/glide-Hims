import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { procurementService, type PurchaseRequest, type PRStatus, type CreatePRItemDto, type PRPriority } from '../../../services/procurement';
import { storesService, type Drug } from '../../../services/stores';
import { useFacilityId } from '../../../lib/facility';
import { formatCurrency } from '../../../lib/currency';

type RequisitionStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected';
type Urgency = 'Normal' | 'Urgent' | 'Critical';

interface RequisitionItem {
  id: string;
  medication: string;
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
}

interface ReorderSuggestion {
  id: string;
  medication: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQty: number;
  code: string;
  unit: string;
}

// Map API status to display status
const mapPRStatus = (status: PRStatus): RequisitionStatus => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'submitted': return 'Submitted';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    default: return 'Draft';
  }
};

// Map priority to urgency
const mapPriority = (priority: string): Urgency => {
  switch (priority) {
    case 'urgent': return 'Urgent';
    case 'high': return 'Critical';
    default: return 'Normal';
  }
};

// Transform API data to display format
const transformPurchaseRequest = (pr: PurchaseRequest): Requisition => ({
  id: pr.id,
  requisitionNo: pr.requestNumber,
  createdDate: new Date(pr.createdAt).toLocaleDateString(),
  status: mapPRStatus(pr.status),
  urgency: mapPriority(pr.priority),
  items: pr.items.map(item => ({
    id: item.id,
    medication: item.itemName,
    currentStock: 0,
    reorderLevel: 0,
    requestedQty: item.quantityRequested,
    unitPrice: item.unitPriceEstimated || 0,
  })),
  createdBy: pr.requestedBy?.fullName || 'Unknown',
  notes: pr.notes || '',
});

export default function PharmacyRequisitionsPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('pharmacy.procurement')) {
    return <AccessDenied />;
  }

  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequisitionStatus | 'All'>('All');
  const [showNewRequisition, setShowNewRequisition] = useState(false);
  const [selectedRequisition, setSelectedRequisition] = useState<Requisition | null>(null);

  // New requisition modal state
  const [newPriority, setNewPriority] = useState<PRPriority>('normal');
  const [newNotes, setNewNotes] = useState('');
  const [newItems, setNewItems] = useState<CreatePRItemDto[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  // Fetch purchase requests from API
  const { data: purchaseRequests = [], isLoading, error } = useQuery({
    queryKey: ['purchaseRequests'],
    queryFn: () => procurementService.purchaseRequests.list(),
  });

  // Fetch low-stock items for reorder suggestions
  const { data: lowStockItems = [] } = useQuery({
    queryKey: ['lowStockItems'],
    queryFn: () => storesService.inventory.getLowStock(),
  });

  const autoReorderSuggestions = useMemo<ReorderSuggestion[]>(() =>
    lowStockItems.map(item => ({
      id: item.id,
      medication: item.name,
      currentStock: item.currentStock,
      reorderLevel: item.minStock,
      suggestedQty: Math.max(item.maxStock - item.currentStock, item.minStock),
      code: item.code || item.sku || '',
      unit: item.unit,
    })),
    [lowStockItems]
  );

  // Item search for modal
  const { data: searchedItems = [] } = useQuery({
    queryKey: ['items-search-pr', itemSearch],
    queryFn: () => storesService.items.search(itemSearch, undefined, 20),
    enabled: itemSearch.length > 1,
  });

  // Submit mutation
  const submitMutation = useMutation({
    mutationFn: (id: string) => procurementService.purchaseRequests.submit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
      toast.success('Requisition submitted for approval');
    },
    onError: () => toast.error('Failed to submit requisition'),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data: { facilityId: string; priority: PRPriority; notes?: string; items: CreatePRItemDto[] }) =>
      procurementService.purchaseRequests.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
      resetModal();
      toast.success('Requisition created successfully');
    },
    onError: () => toast.error('Failed to create requisition'),
  });

  const resetModal = useCallback(() => {
    setShowNewRequisition(false);
    setNewPriority('normal');
    setNewNotes('');
    setNewItems([]);
    setItemSearch('');
  }, []);

  const handleAddItem = useCallback((drug: Drug) => {
    if (newItems.some(i => i.itemId === drug.id)) return;
    setNewItems(prev => [...prev, {
      itemId: drug.id,
      itemCode: drug.code || drug.sku || '',
      itemName: drug.name,
      itemUnit: drug.unit,
      quantityRequested: 1,
      unitPriceEstimated: drug.sellingPrice || 0,
    }]);
    setItemSearch('');
  }, [newItems]);

  const handleAddSuggestion = useCallback((s: ReorderSuggestion) => {
    if (newItems.some(i => i.itemId === s.id)) return;
    setNewItems(prev => [...prev, {
      itemId: s.id,
      itemCode: s.code,
      itemName: s.medication,
      itemUnit: s.unit,
      quantityRequested: s.suggestedQty,
      unitPriceEstimated: 0,
    }]);
    if (!showNewRequisition) setShowNewRequisition(true);
  }, [newItems, showNewRequisition]);

  const handleAddAllSuggestions = useCallback(() => {
    const toAdd = autoReorderSuggestions.filter(s => !newItems.some(i => i.itemId === s.id));
    if (toAdd.length === 0) return;
    setNewItems(prev => [...prev, ...toAdd.map(s => ({
      itemId: s.id,
      itemCode: s.code,
      itemName: s.medication,
      itemUnit: s.unit,
      quantityRequested: s.suggestedQty,
      unitPriceEstimated: 0,
    }))]);
    if (!showNewRequisition) setShowNewRequisition(true);
  }, [autoReorderSuggestions, newItems, showNewRequisition]);

  const handleSaveDraft = useCallback(() => {
    if (newItems.length === 0) { toast.error('Add at least one item'); return; }
    createMutation.mutate({ facilityId, priority: newPriority, notes: newNotes || undefined, items: newItems });
  }, [facilityId, newPriority, newNotes, newItems, createMutation]);

  const handleSubmitForApproval = useCallback(async () => {
    if (newItems.length === 0) { toast.error('Add at least one item'); return; }
    try {
      const pr = await procurementService.purchaseRequests.create({ facilityId, priority: newPriority, notes: newNotes || undefined, items: newItems });
      await procurementService.purchaseRequests.submit(pr.id);
      queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
      resetModal();
      toast.success('Requisition submitted for approval');
    } catch {
      toast.error('Failed to create and submit requisition');
    }
  }, [facilityId, newPriority, newNotes, newItems, queryClient, resetModal]);

  // Transform and filter requisitions
  const requisitions = useMemo(() => 
    purchaseRequests.map(transformPurchaseRequest),
    [purchaseRequests]
  );

  const filteredRequisitions = useMemo(() => {
    return requisitions.filter((req) => {
      const matchesSearch =
        req.requisitionNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.items.some((item) => item.medication.toLowerCase().includes(searchTerm.toLowerCase()));
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
        <p className="text-red-600">Failed to load requisitions</p>
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
          <h1 className="text-2xl font-bold text-gray-900">Drug Requisitions</h1>
          <p className="text-gray-600">Create and manage medication requisition requests</p>
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
              <FileText className="w-5 h-5 text-blue-600" />
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
                  placeholder="Search by requisition number or medication..."
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
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No requisitions found</p>
                        <p className="text-gray-400 text-sm mt-1">Create a new requisition to get started</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRequisitions.map((req) => {
                      const totalValue = req.items.reduce((sum, item) => sum + item.requestedQty * item.unitPrice, 0);
                      return (
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
                            {formatCurrency(totalValue)}
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
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      submitMutation.mutate(req.id);
                                    }}
                                    disabled={submitMutation.isPending}
                                  >
                                    {submitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    className="p-1.5 hover:bg-red-100 rounded text-red-600"
                                    title="Cancel requisition"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      procurementService.purchaseRequests.reject(req.id, 'Cancelled by user')
                                        .then(() => {
                                          queryClient.invalidateQueries({ queryKey: ['purchaseRequests'] });
                                          toast.success('Requisition cancelled');
                                        })
                                        .catch(() => toast.error('Failed to cancel requisition'));
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              <button
                                className="p-1.5 hover:bg-gray-100 rounded"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequisition(req);
                                }}
                              >
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
        </div>

        {/* Auto-Reorder Suggestions Panel */}
        <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-orange-50">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
              <h2 className="font-semibold text-gray-900">Auto-Reorder Suggestions</h2>
            </div>
            <p className="text-sm text-gray-600 mt-1">Based on current stock levels</p>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-3">
            {autoReorderSuggestions.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No reorder suggestions</p>
                <p className="text-gray-400 text-xs mt-1">All items are above reorder levels</p>
              </div>
            ) : (
              autoReorderSuggestions.map((item) => (
                <div key={item.id} className="p-3 border border-orange-200 rounded-lg bg-orange-50/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.medication}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Stock: {item.currentStock}</span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500">Min: {item.reorderLevel}</span>
                      </div>
                    </div>
                    <Package className="w-4 h-4 text-orange-500" />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-sm font-medium text-orange-700">
                      Suggest: {item.suggestedQty} units
                    </span>
                    <button
                      className="px-2 py-1 text-xs bg-orange-600 text-white rounded hover:bg-orange-700"
                      onClick={() => handleAddSuggestion(item)}
                    >
                      Add
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-200">
            <button
              className="w-full py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:bg-gray-300"
              disabled={autoReorderSuggestions.length === 0}
              onClick={handleAddAllSuggestions}
            >
              Add All to Requisition
            </button>
          </div>
        </div>
      </div>

      {/* New Requisition Modal */}
      {showNewRequisition && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Requisition</h2>
              <button
                onClick={resetModal}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(80vh-130px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Urgency Level</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as PRPriority)}
                  >
                    <option value="normal">Normal</option>
                    <option value="high">Urgent</option>
                    <option value="urgent">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Medications</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search medications to add..."
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {searchedItems.length > 0 && itemSearch.length > 1 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-40 overflow-auto">
                        {searchedItems.map((drug: Drug) => (
                          <button
                            key={drug.id}
                            onClick={() => handleAddItem(drug)}
                            className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                          >
                            <span className="font-medium">{drug.name}</span>
                            {drug.strength && <span className="text-gray-500 ml-1">{drug.strength}</span>}
                            {drug.form && <span className="text-gray-400 ml-1">({drug.form})</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  {newItems.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center">No items added yet. Search and add medications above.</p>
                  ) : (
                    <div className="space-y-3">
                      {newItems.map((item, idx) => (
                        <div key={item.itemId} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                            <p className="text-xs text-gray-500">{item.itemCode} · {item.itemUnit}</p>
                          </div>
                          <input
                            type="number"
                            min="1"
                            value={item.quantityRequested}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 1;
                              setNewItems(prev => prev.map((it, i) => i === idx ? { ...it, quantityRequested: val } : it));
                            }}
                            className="w-20 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Qty"
                          />
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unitPriceEstimated || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setNewItems(prev => prev.map((it, i) => i === idx ? { ...it, unitPriceEstimated: val } : it));
                            }}
                            className="w-24 px-2 py-1 text-sm border rounded focus:ring-2 focus:ring-blue-500"
                            placeholder="Price"
                          />
                          <button
                            onClick={() => setNewItems(prev => prev.filter((_, i) => i !== idx))}
                            className="p-1 hover:bg-red-100 rounded text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Add any notes or justification..."
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={resetModal}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300"
                disabled={newItems.length === 0 || createMutation.isPending}
                onClick={handleSaveDraft}
              >
                {createMutation.isPending ? 'Saving...' : 'Save as Draft'}
              </button>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                disabled={newItems.length === 0 || createMutation.isPending}
                onClick={handleSubmitForApproval}
              >
                Submit for Approval
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
