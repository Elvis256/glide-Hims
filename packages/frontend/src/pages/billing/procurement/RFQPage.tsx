import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileQuestion,
  Plus,
  Search,
  Filter,
  Eye,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  Building2,
  Package,
  Users,
  MessageSquare,
  AlertCircle,
  ChevronDown,
  ExternalLink,
  Mail,
  FileText,
  Loader2,
} from 'lucide-react';
import { rfqService, type RFQ, type RFQStatus as RFQStatusType, type CreateRFQDto } from '../../../services/rfq';
import { useAuthStore } from '../../../store/auth';

type RFQStatus = 'draft' | 'sent' | 'pending_responses' | 'responses_received' | 'closed' | 'cancelled';

const statusConfig: Record<RFQStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <FileText className="w-3 h-3" />, label: 'Draft' },
  sent: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <Send className="w-3 h-3" />, label: 'Sent' },
  pending_responses: { color: 'text-yellow-600', bg: 'bg-yellow-100', icon: <Clock className="w-3 h-3" />, label: 'Pending Responses' },
  responses_received: { color: 'text-green-600', bg: 'bg-green-100', icon: <MessageSquare className="w-3 h-3" />, label: 'Responses Received' },
  closed: { color: 'text-purple-600', bg: 'bg-purple-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Closed' },
  cancelled: { color: 'text-red-600', bg: 'bg-red-100', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

const availableVendors = [
  { id: 'v1', name: 'MedSupply Co', category: 'Medical', rating: 4.5 },
  { id: 'v2', name: 'HealthCare Distributors', category: 'Medical', rating: 4.2 },
  { id: 'v3', name: 'PharmaCare Ltd', category: 'Pharmacy', rating: 4.0 },
  { id: 'v4', name: 'Lab Essentials Inc', category: 'Laboratory', rating: 4.8 },
  { id: 'v5', name: 'Scientific Supplies', category: 'Laboratory', rating: 4.3 },
  { id: 'v6', name: 'Tech Solutions', category: 'IT', rating: 4.6 },
  { id: 'v7', name: 'Office Pro', category: 'Office', rating: 4.1 },
];

export default function RFQPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RFQStatus | 'all'>('all');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);

  // Fetch RFQs
  const { data: rfqs = [], isLoading, error } = useQuery({
    queryKey: ['rfqs', facilityId, statusFilter],
    queryFn: () => rfqService.list(facilityId, statusFilter === 'all' ? undefined : statusFilter as RFQStatusType),
    enabled: !!facilityId,
  });

  // Create RFQ mutation
  const createRFQMutation = useMutation({
    mutationFn: (data: CreateRFQDto) => rfqService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setShowCreateModal(false);
    },
  });

  // Send RFQ mutation
  const sendRFQMutation = useMutation({
    mutationFn: (id: string) => rfqService.send(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
    },
  });

  const filteredRFQs = useMemo(() => {
    return rfqs.filter((rfq) => {
      const matchesSearch =
        rfq.rfqNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        rfq.title.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [rfqs, searchTerm]);

  const getDaysUntilDeadline = (deadline: string) => {
    const diff = new Date(deadline).getTime() - new Date().getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <FileQuestion className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Request for Quotations</h1>
              <p className="text-sm text-gray-500">Create and manage RFQs for procurement</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create RFQ
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search RFQs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as RFQStatus | 'all')}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="pending_responses">Pending Responses</option>
              <option value="responses_received">Responses Received</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* RFQ List */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
            </div>
          ) : filteredRFQs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileQuestion className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No RFQs</h3>
              <p className="text-sm text-gray-500 mb-4">Create an RFQ from an approved requisition</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                <Plus className="w-4 h-4" />
                Create RFQ
              </button>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredRFQs.map((rfq) => {
              const daysLeft = getDaysUntilDeadline(rfq.deadline);
              const isOverdue = daysLeft < 0 && rfq.status !== 'Closed';
              
              return (
                <div
                  key={rfq.id}
                  onClick={() => setSelectedRFQ(rfq)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedRFQ?.id === rfq.id ? 'ring-2 ring-purple-500 border-purple-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm text-gray-500">{rfq.rfqNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[rfq.status]?.bg || 'bg-gray-100'} ${statusConfig[rfq.status]?.color || 'text-gray-600'}`}
                        >
                          {statusConfig[rfq.status]?.icon}
                          {statusConfig[rfq.status]?.label || rfq.status}
                        </span>
                        {isOverdue && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            Overdue
                          </span>
                        )}
                      </div>
                      <h3 className="font-medium text-gray-900 mb-1">{rfq.title}</h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        {rfq.purchaseRequest && (
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5" />
                            {rfq.purchaseRequest.requestNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Package className="w-3.5 h-3.5" />
                          {rfq.items?.length || 0} items
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5" />
                          {rfq.vendors?.length || 0} vendors
                        </span>
                        <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500' : daysLeft <= 2 ? 'text-yellow-500' : ''}`}>
                          <Calendar className="w-3.5 h-3.5" />
                          {rfq.status === 'closed' ? 'Closed' : isOverdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        {rfq.quotations?.length || 0}/{rfq.vendors?.length || 0}
                      </div>
                      <p className="text-xs text-gray-500">Responses</p>
                    </div>
                  </div>
                  
                  {rfq.quotations && rfq.quotations.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-gray-600">Received Quotations:</span>
                        {rfq.quotations.map((q) => (
                          <span key={q.id} className="px-2 py-1 bg-green-50 text-green-700 text-xs rounded-full">
                            {q.supplier?.name || 'Vendor'}: ${q.totalAmount.toLocaleString()}
                          </span>
                        ))}
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
        {selectedRFQ && (
          <div className="w-[420px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">RFQ Details</h2>
                <button onClick={() => setSelectedRFQ(null)} className="p-1 hover:bg-gray-200 rounded">
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">RFQ Number</p>
                  <p className="font-mono font-medium">{selectedRFQ.rfqNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Requisition</p>
                  <p className="font-mono text-sm text-purple-600">{selectedRFQ.purchaseRequest?.requestNumber || 'N/A'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Title</p>
                <p className="font-medium">{selectedRFQ.title}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Created</p>
                  <p className="text-sm">{new Date(selectedRFQ.createdAt).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Deadline</p>
                  <p className="text-sm font-medium text-purple-600">{new Date(selectedRFQ.deadline).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Items */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items & Specifications</p>
                <div className="space-y-2">
                  {selectedRFQ.items?.map((item) => (
                    <div key={item.id} className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-sm">{item.itemName}</span>
                        <span className="text-sm text-gray-600">{item.quantity} {item.unit}</span>
                      </div>
                      <p className="text-xs text-gray-500">{item.specifications}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vendors */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Selected Vendors</p>
                <div className="space-y-2">
                  {selectedRFQ.vendors?.map((vendor) => (
                    <div key={vendor.id} className="flex items-center justify-between bg-gray-50 p-2 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="text-sm">{vendor.supplier?.name || 'Vendor'}</span>
                      </div>
                      {vendor.hasResponded ? (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Responded
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-yellow-600">
                          <Clock className="w-3.5 h-3.5" />
                          Pending
                        </span>
                      )}
                    </div>
                  ))}
                  {(!selectedRFQ.vendors || selectedRFQ.vendors.length === 0) && (
                    <p className="text-sm text-gray-400 italic">No vendors selected yet</p>
                  )}
                </div>
              </div>

              {/* Received Quotations */}
              {selectedRFQ.quotations && selectedRFQ.quotations.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Received Quotations</p>
                  <div className="space-y-2">
                    {selectedRFQ.quotations.map((quote) => (
                      <div key={quote.id} className="bg-green-50 p-3 rounded-lg border border-green-200">
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-medium text-sm">{quote.supplier?.name || 'Vendor'}</span>
                          <span className="text-lg font-bold text-green-700">${quote.totalAmount.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                          <span>Delivery: {quote.deliveryDays} days</span>
                          <span>Valid until: {new Date(quote.validUntil).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedRFQ.status === 'draft' && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                      <Users className="w-4 h-4" />
                      Select Vendors
                    </button>
                    <button 
                      onClick={() => sendRFQMutation.mutate(selectedRFQ.id)}
                      disabled={sendRFQMutation.isPending}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {sendRFQMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send to Vendors
                    </button>
                  </>
                )}
                {selectedRFQ.quotations && selectedRFQ.quotations.length >= 2 && selectedRFQ.status !== 'closed' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                    <ExternalLink className="w-4 h-4" />
                    Compare Quotations
                  </button>
                )}
                {selectedRFQ.status === 'pending_responses' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50">
                    <Mail className="w-4 h-4" />
                    Send Reminder
                  </button>
                )}
                <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
                  <Eye className="w-4 h-4" />
                  View Full Details
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create RFQ from Requisition</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Approved Requisition</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500">
                  <option>Select a requisition</option>
                  <option>REQ-2024-001 - Medical Supplies Q1</option>
                  <option>REQ-2024-005 - Cleaning Supplies</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Response Deadline</label>
                <input
                  type="date"
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Vendors</label>
                <div className="border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                  {availableVendors.map((vendor) => (
                    <label key={vendor.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedVendors.includes(vendor.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedVendors([...selectedVendors, vendor.id]);
                          } else {
                            setSelectedVendors(selectedVendors.filter((id) => id !== vendor.id));
                          }
                        }}
                        className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{vendor.name}</p>
                        <p className="text-xs text-gray-500">{vendor.category}</p>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-500">
                        <span className="text-sm">★ {vendor.rating}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{selectedVendors.length} vendors selected</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Instructions</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Special requirements, delivery instructions, etc."
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700">
                Save as Draft
              </button>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Create & Send RFQ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
