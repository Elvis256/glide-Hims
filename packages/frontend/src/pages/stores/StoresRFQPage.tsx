import React, { useState, useMemo, useEffect, useRef } from 'react';
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
  ChevronRight,
  Users,
  Calendar,
  Loader2,
  X,
  XCircle,
  Minus,
  Package,
} from 'lucide-react';
import { rfqService, type RFQ, type RFQStatus, type CreateRFQDto, type CreateRFQItemDto } from '../../services/rfq';
import inventoryService, { type InventoryItem } from '../../services/inventory';
import { formatCurrency } from '../../lib/currency';
import { asList } from '../../utils/unwrapResponse';

type DisplayStatus = 'Draft' | 'Sent' | 'Pending' | 'Received' | 'Closed' | 'Cancelled';

// Map API status to display status
const mapRFQStatus = (status: RFQStatus): DisplayStatus => {
  switch (status) {
    case 'draft': return 'Draft';
    case 'sent': return 'Sent';
    case 'pending_responses': return 'Pending';
    case 'responses_received': return 'Received';
    case 'closed': return 'Closed';
    case 'cancelled': return 'Cancelled';
    default: return 'Draft';
  }
};

// Map display status back to API status
const mapToApiStatus = (status: DisplayStatus | 'All'): RFQStatus | undefined => {
  switch (status) {
    case 'Draft': return 'draft';
    case 'Sent': return 'sent';
    case 'Pending': return 'pending_responses';
    case 'Received': return 'responses_received';
    case 'Closed': return 'closed';
    case 'Cancelled': return 'cancelled';
    default: return undefined;
  }
};

export default function StoresRFQPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | 'All'>('All');
  const [showNewRFQ, setShowNewRFQ] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);

  // Form state for new RFQ
  const [newRFQForm, setNewRFQForm] = useState({
    title: '',
    deadline: '',
    notes: '',
    instructions: '',
  });

  // Item search state for RFQ items
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('');
  const [rfqItems, setRfqItems] = useState<(CreateRFQItemDto & { id?: string })[]>([]);
  const [showItemResults, setShowItemResults] = useState(false);
  const itemSearchRef = useRef<HTMLDivElement>(null);

  // Debounce item search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedItemSearch(itemSearchTerm), 300);
    return () => clearTimeout(timer);
  }, [itemSearchTerm]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (itemSearchRef.current && !itemSearchRef.current.contains(e.target as Node)) {
        setShowItemResults(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Fetch inventory items for search
  const { data: itemSearchResults, isLoading: isSearchingItems } = useQuery({
    queryKey: ['inventory-items-search', debouncedItemSearch],
    queryFn: () => inventoryService.items.list({ search: debouncedItemSearch, limit: 20, status: 'active' }),
    enabled: debouncedItemSearch.length >= 2 && showNewRFQ,
    staleTime: 30000,
  });

  const inventoryItems = useMemo(() => asList<InventoryItem>(itemSearchResults), [itemSearchResults]);

  const handleAddItem = (item: InventoryItem) => {
    const existing = rfqItems.find(ri => ri.itemCode === item.code);
    if (existing) {
      setRfqItems(prev => prev.map(ri =>
        ri.itemCode === item.code ? { ...ri, quantity: ri.quantity + 1 } : ri
      ));
    } else {
      setRfqItems(prev => [...prev, {
        id: item.id,
        itemCode: item.code,
        itemName: item.name,
        quantity: 1,
        unit: item.unit || 'unit',
        specifications: '',
      }]);
    }
    setItemSearchTerm('');
    setShowItemResults(false);
  };

  const handleUpdateItemQty = (itemCode: string, quantity: number) => {
    if (quantity <= 0) {
      setRfqItems(prev => prev.filter(ri => ri.itemCode !== itemCode));
    } else {
      setRfqItems(prev => prev.map(ri =>
        ri.itemCode === itemCode ? { ...ri, quantity } : ri
      ));
    }
  };

  const handleRemoveItem = (itemCode: string) => {
    setRfqItems(prev => prev.filter(ri => ri.itemCode !== itemCode));
  };

  const handleUpdateItemSpec = (itemCode: string, specifications: string) => {
    setRfqItems(prev => prev.map(ri =>
      ri.itemCode === itemCode ? { ...ri, specifications } : ri
    ));
  };

  // Fetch RFQs from API - using empty facilityId to get all (backend should handle this)
  const { data: rfqs = [], isLoading, error } = useQuery({
    queryKey: ['rfqs', statusFilter],
    queryFn: () => rfqService.list('', mapToApiStatus(statusFilter)),
  });

  // Send RFQ mutation
  const sendMutation = useMutation({
    mutationFn: (id: string) => rfqService.send(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rfqs'] }),
  });

  // Close RFQ mutation
  const closeMutation = useMutation({
    mutationFn: (id: string) => rfqService.close(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rfqs'] }),
  });

  // Create RFQ mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateRFQDto) => rfqService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setShowNewRFQ(false);
      setNewRFQForm({ title: '', deadline: '', notes: '', instructions: '' });
      setRfqItems([]);
      setItemSearchTerm('');
    },
  });

  // Filter RFQs based on search
  const filteredRFQs = useMemo(() => {
    return rfqs.filter((rfq) => {
      const matchesSearch =
        rfq.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfq.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfq.items.some((item) => item.itemName.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesSearch;
    });
  }, [rfqs, searchTerm]);

  // Statistics
  const stats = useMemo(() => ({
    total: rfqs.length,
    draft: rfqs.filter(r => r.status === 'draft').length,
    pending: rfqs.filter(r => r.status === 'pending_responses' || r.status === 'sent').length,
    received: rfqs.filter(r => r.status === 'responses_received').length,
  }), [rfqs]);

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
        <p className="text-red-600">Failed to load RFQs</p>
      </div>
    );
  }

  const getStatusColor = (status: DisplayStatus) => {
    switch (status) {
      case 'Draft': return 'bg-gray-100 text-gray-700';
      case 'Sent': return 'bg-blue-100 text-blue-700';
      case 'Pending': return 'bg-yellow-100 text-yellow-700';
      case 'Received': return 'bg-green-100 text-green-700';
      case 'Closed': return 'bg-purple-100 text-purple-700';
      case 'Cancelled': return 'bg-red-100 text-red-700';
    }
  };

  const getStatusIcon = (status: DisplayStatus) => {
    switch (status) {
      case 'Draft': return <FileText className="w-4 h-4" />;
      case 'Sent': return <Send className="w-4 h-4" />;
      case 'Pending': return <Clock className="w-4 h-4" />;
      case 'Received': return <CheckCircle className="w-4 h-4" />;
      case 'Closed': return <CheckCircle className="w-4 h-4" />;
      case 'Cancelled': return <XCircle className="w-4 h-4" />;
    }
  };

  const handleCreateRFQ = (sendAfterCreate = false) => {
    if (!newRFQForm.title || !newRFQForm.deadline) return;
    createMutation.mutate({
      title: newRFQForm.title,
      facilityId: '',
      deadline: newRFQForm.deadline,
      notes: newRFQForm.notes,
      instructions: newRFQForm.instructions,
      items: rfqItems.map(({ id, ...rest }) => rest),
    });
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Request for Quotations</h1>
          <p className="text-gray-600">Create and manage RFQs for store supplies</p>
        </div>
        <button
          onClick={() => setShowNewRFQ(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New RFQ
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
              <p className="text-sm text-gray-600">Total RFQs</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <FileText className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-700">{stats.draft}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Responses Received</p>
              <p className="text-2xl font-bold text-green-600">{stats.received}</p>
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
                  placeholder="Search by RFQ number, title, or item..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as DisplayStatus | 'All')}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="All">All Status</option>
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Pending">Pending Responses</option>
                  <option value="Received">Responses Received</option>
                  <option value="Closed">Closed</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          </div>

          {/* RFQs Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">RFQ Number</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Items</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Vendors</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Deadline</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Quotations</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredRFQs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No RFQs found</p>
                        <p className="text-gray-400 text-sm mt-1">Create a new RFQ to get started</p>
                      </td>
                    </tr>
                  ) : (
                    filteredRFQs.map((rfq) => {
                      const displayStatus = mapRFQStatus(rfq.status);
                      const totalEstValue = rfq.quotations.reduce((sum, q) => sum + q.totalAmount, 0);
                      const respondedVendors = rfq.vendors.filter(v => v.hasResponded).length;
                      return (
                        <tr
                          key={rfq.id}
                          className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                            selectedRFQ?.id === rfq.id ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => setSelectedRFQ(rfq)}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-900">{rfq.rfqNumber}</p>
                              <p className="text-sm text-gray-500">{rfq.createdBy?.fullName || 'Unknown'}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{rfq.title}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-gray-100 rounded-full text-sm">
                              {rfq.items.length} items
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Users className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">{rfq.vendors.length}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-4 h-4 text-gray-400" />
                              <span className="text-sm text-gray-700">
                                {new Date(rfq.deadline).toLocaleDateString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <span className="text-sm font-medium text-gray-900">
                                {rfq.quotations.length} received
                              </span>
                              {rfq.quotations.length > 0 && (
                                <p className="text-xs text-gray-500">
                                  {formatCurrency(totalEstValue / rfq.quotations.length)} avg
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${getStatusColor(displayStatus)}`}>
                              {getStatusIcon(displayStatus)}
                              {displayStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {rfq.status === 'draft' && (
                                <>
                                  <button 
                                    className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      sendMutation.mutate(rfq.id);
                                    }}
                                    disabled={sendMutation.isPending}
                                    title="Send to vendors"
                                  >
                                    {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                  </button>
                                  <button 
                                    className="p-1.5 hover:bg-red-100 rounded text-red-600"
                                    title="Delete RFQ"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                              {(rfq.status === 'sent' || rfq.status === 'pending_responses' || rfq.status === 'responses_received') && (
                                <button 
                                  className="p-1.5 hover:bg-purple-100 rounded text-purple-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    closeMutation.mutate(rfq.id);
                                  }}
                                  disabled={closeMutation.isPending}
                                  title="Close RFQ"
                                >
                                  {closeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
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
        </div>

        {/* RFQ Details Panel */}
        {selectedRFQ && (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-blue-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h2 className="font-semibold text-gray-900">{selectedRFQ.rfqNumber}</h2>
                </div>
                <button 
                  onClick={() => setSelectedRFQ(null)}
                  className="p-1 hover:bg-blue-100 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{selectedRFQ.title}</p>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Items ({selectedRFQ.items.length})</h3>
                <div className="space-y-2">
                  {selectedRFQ.items.map((item) => (
                    <div key={item.id} className="p-2 border border-gray-200 rounded-lg">
                      <p className="font-medium text-gray-900 text-sm">{item.itemName}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Code: {item.itemCode}</span>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-gray-500">Qty: {item.quantity} {item.unit}</span>
                      </div>
                    </div>
                  ))}
                  {selectedRFQ.items.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No items added</p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Invited Vendors ({selectedRFQ.vendors.length})</h3>
                <div className="space-y-2">
                  {selectedRFQ.vendors.map((vendor) => (
                    <div key={vendor.id} className="p-2 border border-gray-200 rounded-lg flex items-center justify-between">
                      <span className="text-sm text-gray-900">{vendor.supplier?.name || 'Unknown Vendor'}</span>
                      {vendor.hasResponded ? (
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded-full">Responded</span>
                      ) : (
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Pending</span>
                      )}
                    </div>
                  ))}
                  {selectedRFQ.vendors.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No vendors invited</p>
                  )}
                </div>
              </div>

              {selectedRFQ.quotations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Quotations ({selectedRFQ.quotations.length})</h3>
                  <div className="space-y-2">
                    {selectedRFQ.quotations.map((quotation) => (
                      <div key={quotation.id} className="p-2 border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900">{quotation.supplier?.name}</span>
                          <span className="text-sm font-bold text-blue-600">{formatCurrency(quotation.totalAmount)}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Delivery: {quotation.deliveryDays} days</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            quotation.status === 'selected' ? 'bg-green-100 text-green-700' :
                            quotation.status === 'rejected' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {quotation.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200">
              <button className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium">
                View Full Details
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New RFQ Modal */}
      {showNewRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold">New Request for Quotation</h2>
              <button
                onClick={() => setShowNewRFQ(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                  <input
                    type="text"
                    placeholder="e.g., Office Supplies Q4 2024"
                    value={newRFQForm.title}
                    onChange={(e) => setNewRFQForm(prev => ({ ...prev, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deadline *</label>
                  <input
                    type="date"
                    value={newRFQForm.deadline}
                    onChange={(e) => setNewRFQForm(prev => ({ ...prev, deadline: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div ref={itemSearchRef}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Add Items</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search items by name or code..."
                      value={itemSearchTerm}
                      onChange={(e) => {
                        setItemSearchTerm(e.target.value);
                        setShowItemResults(true);
                      }}
                      onFocus={() => { if (itemSearchTerm.length >= 2) setShowItemResults(true); }}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                    {isSearchingItems && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500 animate-spin" />
                    )}
                    {/* Search Results Dropdown */}
                    {showItemResults && debouncedItemSearch.length >= 2 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {isSearchingItems ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />Searching...
                          </div>
                        ) : inventoryItems.length === 0 ? (
                          <div className="p-3 text-center text-gray-500 text-sm">
                            No items found for "{debouncedItemSearch}"
                          </div>
                        ) : (
                          inventoryItems.map((item) => {
                            const alreadyAdded = rfqItems.some(ri => ri.itemCode === item.code);
                            return (
                              <button
                                key={item.id}
                                onClick={() => handleAddItem(item)}
                                className={`w-full flex items-center justify-between p-2.5 hover:bg-blue-50 text-left border-b last:border-b-0 transition-colors ${
                                  alreadyAdded ? 'bg-blue-50' : ''
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{item.name}</p>
                                    <p className="text-xs text-gray-500">{item.code} • {item.unit || 'unit'}</p>
                                  </div>
                                </div>
                                {alreadyAdded ? (
                                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">Added</span>
                                ) : (
                                  <Plus className="w-4 h-4 text-blue-500" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {/* Added Items List */}
                <div className="border border-gray-200 rounded-lg">
                  {rfqItems.length === 0 ? (
                    <div className="p-4">
                      <p className="text-sm text-gray-500 text-center">No items added yet. Search and add items above.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {rfqItems.map((item, idx) => (
                        <div key={item.itemCode} className="p-3 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-400 font-mono">#{idx + 1}</span>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{item.itemName}</p>
                                <p className="text-xs text-gray-500">{item.itemCode}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleRemoveItem(item.itemCode)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <label className="text-xs text-gray-500">Qty:</label>
                              <div className="flex items-center border rounded overflow-hidden">
                                <button
                                  onClick={() => handleUpdateItemQty(item.itemCode, item.quantity - 1)}
                                  className="px-2 py-1 text-gray-500 hover:bg-gray-100 text-xs"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleUpdateItemQty(item.itemCode, Number(e.target.value) || 1)}
                                  className="w-14 text-center text-sm border-x py-1"
                                  min={1}
                                />
                                <button
                                  onClick={() => handleUpdateItemQty(item.itemCode, item.quantity + 1)}
                                  className="px-2 py-1 text-gray-500 hover:bg-gray-100 text-xs"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-xs text-gray-400 ml-1">{item.unit}</span>
                            </div>
                            <div className="flex-1">
                              <input
                                type="text"
                                placeholder="Specifications (optional)"
                                value={item.specifications || ''}
                                onChange={(e) => handleUpdateItemSpec(item.itemCode, e.target.value)}
                                className="w-full px-2 py-1 text-xs border rounded focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                      <div className="p-2 bg-gray-50 text-xs text-gray-500 text-right">
                        {rfqItems.length} item{rfqItems.length !== 1 ? 's' : ''} • {rfqItems.reduce((s, i) => s + i.quantity, 0)} total units
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Instructions for Vendors</label>
                  <textarea
                    placeholder="Add any special instructions for vendors..."
                    value={newRFQForm.instructions}
                    onChange={(e) => setNewRFQForm(prev => ({ ...prev, instructions: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    placeholder="Add any internal notes..."
                    value={newRFQForm.notes}
                    onChange={(e) => setNewRFQForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows={2}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowNewRFQ(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleCreateRFQ(false)}
                disabled={createMutation.isPending || !newRFQForm.title || !newRFQForm.deadline || rfqItems.length === 0}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Save as Draft'}
              </button>
              <button 
                onClick={() => handleCreateRFQ(true)}
                disabled={createMutation.isPending || !newRFQForm.title || !newRFQForm.deadline || rfqItems.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Create & Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
