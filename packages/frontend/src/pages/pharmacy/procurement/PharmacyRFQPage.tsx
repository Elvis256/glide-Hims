import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  FileQuestion,
  Clock,
  CheckCircle,
  Send,
  Building2,
  Calendar,
  Filter,
  Trash2,
  Eye,
  ChevronRight,
  Users,
  AlertCircle,
  Loader2,
  X,
  Package,
} from 'lucide-react';
import { usePermissions } from '../../../components/PermissionGate';
import AccessDenied from '../../../components/AccessDenied';
import { rfqService, type RFQ, type RFQStatus, type CreateRFQDto, type CreateRFQItemDto } from '../../../services/rfq';
import { supplierService } from '../../../services/suppliers';
import { storesService } from '../../../services/stores';
import { useFacilityId } from '../../../lib/facility';
import { toast } from 'sonner';

interface SelectedItem {
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  specifications: string;
}

export default function PharmacyRFQPage() {
  const { hasPermission } = usePermissions();

  if (!hasPermission('procurement.read') && !hasPermission('inventory.create')) {
    return <AccessDenied />;
  }

  const facilityId = useFacilityId();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RFQStatus | 'all'>('all');
  const [showNewRFQ, setShowNewRFQ] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Form state
  const [rfqTitle, setRfqTitle] = useState('');
  const [rfqDeadline, setRfqDeadline] = useState('');
  const [rfqNotes, setRfqNotes] = useState('');
  const [rfqInstructions, setRfqInstructions] = useState('');
  const [selectedSupplierIds, setSelectedSupplierIds] = useState<Set<string>>(new Set());
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');

  // Fetch RFQs
  const { data: rfqs = [], isLoading } = useQuery({
    queryKey: ['rfqs', facilityId, statusFilter],
    queryFn: () => rfqService.list(facilityId, statusFilter === 'all' ? undefined : statusFilter),
    enabled: !!facilityId,
  });

  // Fetch suppliers
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', 'active', facilityId],
    queryFn: () => supplierService.getActive(facilityId),
    enabled: !!facilityId,
  });

  // Search items
  const { data: searchResults = [] } = useQuery({
    queryKey: ['items-search-rfq', itemSearch],
    queryFn: () => storesService.items.search(itemSearch, undefined, 20),
    enabled: itemSearch.length >= 2,
  });

  // Create RFQ mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRFQDto) => rfqService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('RFQ created successfully');
      resetModal();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create RFQ');
    },
  });

  // Send RFQ mutation
  const sendMutation = useMutation({
    mutationFn: (id: string) => rfqService.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('RFQ sent to suppliers');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to send RFQ');
    },
  });

  // Close RFQ mutation
  const closeMutation = useMutation({
    mutationFn: (id: string) => rfqService.close(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('RFQ closed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to close RFQ');
    },
  });

  const filteredRFQs = useMemo(() => {
    if (!searchTerm) return rfqs;
    const term = searchTerm.toLowerCase();
    return rfqs.filter((rfq: RFQ) =>
      rfq.rfqNumber?.toLowerCase().includes(term) ||
      rfq.title?.toLowerCase().includes(term) ||
      rfq.items?.some((item) => item.itemName.toLowerCase().includes(term))
    );
  }, [rfqs, searchTerm]);

  const stats = useMemo(() => ({
    total: rfqs.length,
    sent: rfqs.filter((r: RFQ) => r.status === 'sent' || r.status === 'pending_responses').length,
    responsesReceived: rfqs.filter((r: RFQ) => r.status === 'responses_received').length,
    closed: rfqs.filter((r: RFQ) => r.status === 'closed').length,
  }), [rfqs]);

  const resetModal = useCallback(() => {
    setRfqTitle('');
    setRfqDeadline('');
    setRfqNotes('');
    setRfqInstructions('');
    setSelectedSupplierIds(new Set());
    setSelectedItems([]);
    setItemSearch('');
    setShowNewRFQ(false);
  }, []);

  const handleAddItem = useCallback((item: any) => {
    if (selectedItems.some(si => si.itemCode === (item.code || item.id))) return;
    setSelectedItems(prev => [...prev, {
      itemCode: item.code || item.id,
      itemName: item.name,
      quantity: 1,
      unit: item.unitOfMeasure || item.unit || 'unit',
      specifications: '',
    }]);
    setItemSearch('');
  }, [selectedItems]);

  const handleRemoveItem = useCallback((code: string) => {
    setSelectedItems(prev => prev.filter(i => i.itemCode !== code));
  }, []);

  const handleUpdateItemQty = useCallback((code: string, qty: number) => {
    setSelectedItems(prev => prev.map(i => i.itemCode === code ? { ...i, quantity: Math.max(1, qty) } : i));
  }, []);

  const handleUpdateItemSpec = useCallback((code: string, specs: string) => {
    setSelectedItems(prev => prev.map(i => i.itemCode === code ? { ...i, specifications: specs } : i));
  }, []);

  const handleToggleSupplier = useCallback((supplierId: string) => {
    setSelectedSupplierIds(prev => {
      const next = new Set(prev);
      if (next.has(supplierId)) next.delete(supplierId);
      else next.add(supplierId);
      return next;
    });
  }, []);

  const handleSubmit = useCallback((asDraft: boolean) => {
    if (!rfqTitle.trim()) { toast.error('Please enter an RFQ title'); return; }
    if (!rfqDeadline) { toast.error('Please set a response deadline'); return; }
    if (selectedItems.length === 0) { toast.error('Please add at least one item'); return; }
    if (!asDraft && selectedSupplierIds.size < 3) {
      toast.error('Minimum 3 suppliers required to send (competitive bidding)');
      return;
    }

    const items: CreateRFQItemDto[] = selectedItems.map(si => ({
      itemCode: si.itemCode,
      itemName: si.itemName,
      quantity: si.quantity,
      unit: si.unit,
      specifications: si.specifications || undefined,
    }));

    const data: CreateRFQDto = {
      title: rfqTitle,
      facilityId,
      deadline: new Date(rfqDeadline).toISOString(),
      notes: rfqNotes || undefined,
      instructions: rfqInstructions || undefined,
      items,
      vendorIds: Array.from(selectedSupplierIds),
    };

    createMutation.mutate(data);
  }, [rfqTitle, rfqDeadline, rfqNotes, rfqInstructions, selectedItems, selectedSupplierIds, facilityId, createMutation]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'sent': case 'pending_responses': return 'bg-blue-100 text-blue-800';
      case 'responses_received': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Draft';
      case 'sent': return 'Sent';
      case 'pending_responses': return 'Awaiting Responses';
      case 'responses_received': return 'Responses Received';
      case 'closed': return 'Closed';
      case 'cancelled': return 'Cancelled';
      default: return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <FileQuestion className="w-4 h-4" />;
      case 'sent': case 'pending_responses': return <Send className="w-4 h-4" />;
      case 'responses_received': return <CheckCircle className="w-4 h-4" />;
      case 'closed': return <Clock className="w-4 h-4" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request for Quotations</h1>
          <p className="text-sm text-gray-500">Request and manage supplier quotations</p>
        </div>
        <button
          onClick={() => setShowNewRFQ(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" /> New RFQ
        </button>
      </div>

      {/* Stats */}
      <div className="flex-shrink-0 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total RFQs</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.sent}</div>
          <div className="text-sm text-gray-500">Sent</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.responsesReceived}</div>
          <div className="text-sm text-gray-500">Responses Received</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">{stats.closed}</div>
          <div className="text-sm text-gray-500">Closed</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search RFQs by number or medication..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as RFQStatus | 'all')}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="pending_responses">Awaiting Responses</option>
          <option value="responses_received">Responses Received</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">RFQ Number</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Deadline</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Suppliers</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responses</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredRFQs.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                  <FileQuestion className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No RFQs found</p>
                  <p className="text-sm mt-1">Create a new RFQ to request quotations from suppliers</p>
                </td>
              </tr>
            ) : (
              filteredRFQs.map((rfq: RFQ) => (
                <tr key={rfq.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedRFQ(rfq); setShowDetailPanel(true); }}>
                  <td className="px-4 py-3 font-medium text-blue-600">{rfq.rfqNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{rfq.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(rfq.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(rfq.deadline).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{rfq.items?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{rfq.vendors?.length || 0}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{rfq.vendors?.filter((v: any) => v.hasResponded).length || 0}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(rfq.status)}`}>
                      {getStatusIcon(rfq.status)}
                      {getStatusLabel(rfq.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedRFQ(rfq); setShowDetailPanel(true); }} className="p-1 text-gray-400 hover:text-blue-600" title="View">
                        <Eye className="w-4 h-4" />
                      </button>
                      {rfq.status === 'draft' && (
                        <button onClick={(e) => { e.stopPropagation(); sendMutation.mutate(rfq.id); }} className="p-1 text-gray-400 hover:text-green-600" title="Send to Suppliers">
                          <Send className="w-4 h-4" />
                        </button>
                      )}
                      {(rfq.status === 'sent' || rfq.status === 'pending_responses' || rfq.status === 'responses_received') && (
                        <button onClick={(e) => { e.stopPropagation(); closeMutation.mutate(rfq.id); }} className="p-1 text-gray-400 hover:text-purple-600" title="Close">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Panel */}
      {showDetailPanel && selectedRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-lg font-semibold">{selectedRFQ.rfqNumber}</h2>
                <p className="text-sm text-gray-500">{selectedRFQ.title}</p>
              </div>
              <button onClick={() => setShowDetailPanel(false)} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedRFQ.status)}`}>
                    {getStatusLabel(selectedRFQ.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Deadline</p>
                  <p className="text-sm font-medium">{new Date(selectedRFQ.deadline).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Created By</p>
                  <p className="text-sm font-medium">{selectedRFQ.createdBy?.fullName || 'N/A'}</p>
                </div>
              </div>

              {selectedRFQ.notes && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm bg-gray-50 p-2 rounded">{selectedRFQ.notes}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Package className="w-4 h-4" /> Items ({selectedRFQ.items?.length || 0})</h3>
                <div className="bg-gray-50 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Unit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {selectedRFQ.items?.map((item: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{item.itemName}</td>
                          <td className="px-3 py-2 text-gray-500">{item.itemCode}</td>
                          <td className="px-3 py-2 text-right font-medium">{item.quantity}</td>
                          <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Building2 className="w-4 h-4" /> Vendors ({selectedRFQ.vendors?.length || 0})</h3>
                <div className="space-y-2">
                  {selectedRFQ.vendors?.map((v: any) => (
                    <div key={v.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium">{v.supplier?.name || 'Unknown'}</p>
                        <p className="text-xs text-gray-500">{v.supplier?.email || ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${v.hasResponded ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {v.hasResponded ? 'Responded' : 'Awaiting'}
                      </span>
                    </div>
                  ))}
                  {(!selectedRFQ.vendors || selectedRFQ.vendors.length === 0) && (
                    <p className="text-sm text-gray-400 text-center py-2">No vendors assigned</p>
                  )}
                </div>
              </div>

              {selectedRFQ.quotations && selectedRFQ.quotations.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Quotations ({selectedRFQ.quotations.length})</h3>
                  <div className="space-y-2">
                    {selectedRFQ.quotations.map((q: any) => (
                      <div key={q.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{q.quotationNumber}</p>
                            <p className="text-xs text-gray-500">{q.supplier?.name} • {q.deliveryDays} days delivery</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">UGX {Number(q.totalAmount).toLocaleString()}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${q.status === 'selected' ? 'bg-green-100 text-green-700' : q.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {q.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* New RFQ Modal */}
      {showNewRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <h2 className="text-lg font-semibold">New Request for Quotation</h2>
              <button onClick={resetModal} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RFQ Title</label>
                <input
                  type="text"
                  value={rfqTitle}
                  onChange={(e) => setRfqTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Q1 2026 Antibiotics Restock"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Response Deadline</label>
                <input
                  type="date"
                  value={rfqDeadline}
                  onChange={(e) => setRfqDeadline(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Item Search & Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Items</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Search items by name or code..."
                  />
                </div>
                {itemSearch.length >= 2 && searchResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-20 relative">
                    {searchResults.map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => handleAddItem(item)}
                        disabled={selectedItems.some(si => si.itemCode === (item.code || item.id))}
                        className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <span>{item.name} <span className="text-gray-400">({item.code})</span></span>
                        {selectedItems.some(si => si.itemCode === (item.code || item.id)) && (
                          <span className="text-xs text-green-600">Added</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {itemSearch.length >= 2 && searchResults.length === 0 && (
                  <p className="mt-1 text-sm text-gray-400">No items found for "{itemSearch}"</p>
                )}
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 ? (
                <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <p className="text-xs font-medium text-gray-500 uppercase">Selected Items ({selectedItems.length})</p>
                  {selectedItems.map((item) => (
                    <div key={item.itemCode} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.itemName}</p>
                        <p className="text-xs text-gray-400">{item.itemCode}</p>
                      </div>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleUpdateItemQty(item.itemCode, Number(e.target.value))}
                        min={1}
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                        title="Quantity"
                      />
                      <span className="text-xs text-gray-500">{item.unit}</span>
                      <button onClick={() => handleRemoveItem(item.itemCode)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-gray-400">
                  <Package className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  No items added. Search above to add items.
                </div>
              )}

              {/* Supplier Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Suppliers <span className="text-gray-400 font-normal">(min. 3 for competitive bidding)</span>
                </label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {suppliers.map((sup: any) => (
                    <label key={sup.id} className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-colors ${selectedSupplierIds.has(sup.id) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                      <input
                        type="checkbox"
                        checked={selectedSupplierIds.has(sup.id)}
                        onChange={() => handleToggleSupplier(sup.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{sup.name}</p>
                        <p className="text-xs text-gray-500">{sup.email || 'No email'} • {sup.type || 'general'}</p>
                      </div>
                    </label>
                  ))}
                  {suppliers.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-2">No active suppliers found. Add suppliers first.</p>
                  )}
                </div>
                {selectedSupplierIds.size > 0 && selectedSupplierIds.size < 3 && (
                  <p className="mt-1 text-xs text-amber-600">⚠ {3 - selectedSupplierIds.size} more supplier(s) needed for competitive bidding</p>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes / Special Instructions</label>
                <textarea
                  value={rfqNotes}
                  onChange={(e) => setRfqNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Add any special requirements or instructions..."
                />
              </div>

              {createMutation.error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {(createMutation.error as any)?.response?.data?.message || 'Failed to create RFQ'}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t flex-shrink-0">
              <button onClick={resetModal} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button
                onClick={() => handleSubmit(true)}
                disabled={createMutation.isPending}
                className="px-4 py-2 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Save as Draft
              </button>
              <button
                onClick={() => handleSubmit(false)}
                disabled={createMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <Send className="w-4 h-4" /> Send to Suppliers
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
