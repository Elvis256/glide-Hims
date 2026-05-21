import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
  Trash2,
  Ban,
} from 'lucide-react';
import { rfqService, type RFQ, type RFQStatus as RFQStatusType, type CreateRFQDto } from '../../../services/rfq';
import { useAuthStore } from '../../../store/auth';
import { CategoryContextBanner } from '../../../components/procurement/CategoryContextBanner';
import api from '../../../services/api';

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
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<RFQStatus | 'all'>('all');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVendors, setSelectedVendors] = useState<string[]>([]);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [vendorPickIds, setVendorPickIds] = useState<string[]>([]);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Full RFQ payload for the details modal (vendors, quotations, approvals…)
  const { data: rfqDetails, isLoading: detailsLoading } = useQuery({
    queryKey: ['rfq-detail', selectedRFQ?.id],
    queryFn: () => rfqService.getById(selectedRFQ!.id),
    enabled: !!selectedRFQ && showDetailsModal,
  });

  const cancelRfqMutation = useMutation({
    mutationFn: (id: string) => rfqService.cancel(id),
    onSuccess: () => {
      toast.success('RFQ cancelled');
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      queryClient.invalidateQueries({ queryKey: ['rfq-detail'] });
      setShowDetailsModal(false);
      setSelectedRFQ(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to cancel RFQ');
    },
  });

  const deleteRfqMutation = useMutation({
    mutationFn: (id: string) => rfqService.remove(id),
    onSuccess: () => {
      toast.success('RFQ deleted');
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setShowDetailsModal(false);
      setSelectedRFQ(null);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to delete RFQ');
    },
  });

  // Fetch RFQs
  const { data: rfqs = [], isLoading, error } = useQuery({
    queryKey: ['rfqs', facilityId, statusFilter],
    queryFn: () => rfqService.list(facilityId, statusFilter === 'all' ? undefined : statusFilter as RFQStatusType),
    enabled: !!facilityId,
  });

  // Real suppliers (replaces the hard-coded availableVendors stub)
  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers-active', facilityId],
    queryFn: async () => {
      const res = await api.get('/suppliers/active', { params: { facilityId } });
      const list = res.data?.data ?? res.data ?? [];
      return Array.isArray(list) ? list : [];
    },
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
      toast.success('RFQ sent to vendors');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to send RFQ');
    },
  });

  // Add vendors mutation
  const addVendorsMutation = useMutation({
    mutationFn: ({ rfqId, vendorIds }: { rfqId: string; vendorIds: string[] }) =>
      rfqService.addVendors(rfqId, vendorIds),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      setSelectedRFQ(updated);
      setShowVendorModal(false);
      toast.success('Vendors added to RFQ');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to add vendors');
    },
  });

  const openVendorModal = () => {
    const already = (selectedRFQ?.vendors || [])
      .map((v: any) => v.supplierId || v.supplier?.id)
      .filter(Boolean) as string[];
    setVendorPickIds(already);
    setShowVendorModal(true);
  };

  // ── Record Quotation modal ─────────────────────────────
  type QuoteLine = { rfqItemId: string; itemName: string; quantity: number; unit: string; unitPrice: number; deliveryDays?: number; inStock: boolean; notes?: string };
  const [showQuoteModal, setShowQuoteModal] = useState(false);
  const [quoteSupplierId, setQuoteSupplierId] = useState('');
  const [quoteNumber, setQuoteNumber] = useState('');
  const [quoteValidUntil, setQuoteValidUntil] = useState('');
  const [quoteDeliveryDays, setQuoteDeliveryDays] = useState(7);
  const [quotePaymentTerms, setQuotePaymentTerms] = useState('');
  const [quoteWarranty, setQuoteWarranty] = useState('');
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);

  const openQuoteModal = () => {
    if (!selectedRFQ) return;
    const lines: QuoteLine[] = (selectedRFQ.items || []).map((it: any) => ({
      rfqItemId: it.id,
      itemName: it.itemName || it.name || it.itemCode,
      quantity: Number(it.quantity ?? 0),
      unit: it.unit || '',
      unitPrice: 0,
      deliveryDays: undefined,
      inStock: true,
    }));
    setQuoteLines(lines);
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + 30);
    setQuoteValidUntil(validUntil.toISOString().slice(0, 10));
    setQuoteDeliveryDays(7);
    setQuotePaymentTerms('');
    setQuoteWarranty('');
    setQuoteNotes('');
    setQuoteSupplierId('');
    setQuoteNumber(`QT-${selectedRFQ.rfqNumber}-${Date.now().toString().slice(-6)}`);
    setShowQuoteModal(true);
  };

  const quoteTotal = useMemo(
    () => quoteLines.reduce((sum, l) => sum + Number(l.unitPrice || 0) * Number(l.quantity || 0), 0),
    [quoteLines],
  );

  const receiveQuoteMutation = useMutation({
    mutationFn: () => {
      if (!selectedRFQ || !quoteSupplierId) throw new Error('Select a vendor');
      if (quoteLines.some((l) => Number(l.unitPrice) <= 0)) {
        throw new Error('Every line item needs a unit price greater than 0');
      }
      return rfqService.quotations.receive({
        rfqId: selectedRFQ.id,
        supplierId: quoteSupplierId,
        quotationNumber: quoteNumber,
        totalAmount: quoteTotal,
        deliveryDays: quoteDeliveryDays,
        paymentTerms: quotePaymentTerms || undefined,
        warranty: quoteWarranty || undefined,
        validUntil: new Date(quoteValidUntil).toISOString(),
        notes: quoteNotes || undefined,
        items: quoteLines.map((l) => ({
          rfqItemId: l.rfqItemId,
          unitPrice: Number(l.unitPrice),
          totalPrice: Number(l.unitPrice) * Number(l.quantity),
          deliveryDays: l.deliveryDays ?? undefined,
          inStock: l.inStock,
          notes: l.notes || undefined,
        })),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rfqs'] });
      toast.success('Quotation recorded');
      setShowQuoteModal(false);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to record quotation');
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
      <CategoryContextBanner />
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
              const isOverdue = daysLeft < 0 && rfq.status !== 'closed';
              
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
                    <button
                      onClick={openVendorModal}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                    >
                      <Users className="w-4 h-4" />
                      Select Vendors{selectedRFQ.vendors?.length ? ` (${selectedRFQ.vendors.length})` : ''}
                    </button>
                    <button 
                      onClick={() => sendRFQMutation.mutate(selectedRFQ.id)}
                      disabled={sendRFQMutation.isPending || (selectedRFQ.vendors?.length || 0) < 3}
                      title={(selectedRFQ.vendors?.length || 0) < 3 ? 'Need at least 3 vendors for competitive bidding' : ''}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendRFQMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      Send to Vendors
                    </button>
                  </>
                )}
                {(selectedRFQ.status === 'sent' ||
                  selectedRFQ.status === 'pending_responses' ||
                  selectedRFQ.status === 'responses_received') && (
                  <button
                    onClick={openQuoteModal}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Record Quotation
                  </button>
                )}
                {selectedRFQ.quotations && selectedRFQ.quotations.length >= 2 && selectedRFQ.status !== 'closed' && (
                  <button
                    onClick={() => navigate(`/procurement/quotes/compare?rfqId=${selectedRFQ.id}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Compare Quotations
                  </button>
                )}
                {selectedRFQ.status === 'pending_responses' && (
                  <button
                    onClick={() => toast.info('Reminder sent to vendors')}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-purple-300 text-purple-600 rounded-lg hover:bg-purple-50"
                  >
                    <Mail className="w-4 h-4" />
                    Send Reminder
                  </button>
                )}
                <button
                  onClick={() => setShowDetailsModal(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
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
                Close
              </button>
              <button
                disabled
                title="Use 'Convert to RFQ' from an approved requisition instead"
                className="px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
              >
                Save as Draft
              </button>
              <button
                disabled
                title="Use 'Convert to RFQ' from an approved requisition instead"
                className="px-4 py-2 bg-purple-300 text-white rounded-lg cursor-not-allowed"
              >
                Create & Send RFQ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select Vendors Modal */}
      {showVendorModal && selectedRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Select Vendors for {selectedRFQ.rfqNumber}</h2>
              <button onClick={() => setShowVendorModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-3 overflow-y-auto flex-1">
              <p className="text-xs text-gray-500">
                At least 3 vendors are required for competitive bidding. {vendorPickIds.length} selected.
              </p>
              {suppliers.length === 0 ? (
                <p className="text-sm italic text-gray-400">No active suppliers found for this facility.</p>
              ) : (
                <div className="border rounded-lg divide-y">
                  {suppliers.map((s: any) => {
                    const checked = vendorPickIds.includes(s.id);
                    return (
                      <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            setVendorPickIds((prev) =>
                              e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id),
                            );
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm">{s.name}</p>
                          <p className="text-xs text-gray-500">
                            {s.code} · {s.type || 'general'} · {s.email || s.phone || '—'}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowVendorModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  addVendorsMutation.mutate({ rfqId: selectedRFQ.id, vendorIds: vendorPickIds })
                }
                disabled={addVendorsMutation.isPending || vendorPickIds.length === 0}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {addVendorsMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  'Save Vendors'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Record Quotation Modal */}
      {showQuoteModal && selectedRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h2 className="text-lg font-semibold">Record Quotation for {selectedRFQ.rfqNumber}</h2>
              <button onClick={() => setShowQuoteModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Vendor *</label>
                  <select
                    value={quoteSupplierId}
                    onChange={(e) => setQuoteSupplierId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">— Select vendor —</option>
                    {(selectedRFQ.vendors || []).map((v: any) => (
                      <option key={v.id} value={v.supplierId || v.supplier?.id} disabled={v.hasResponded}>
                        {v.supplier?.name || v.supplierId}
                        {v.hasResponded ? ' (already quoted)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Quotation Number *</label>
                  <input
                    value={quoteNumber}
                    onChange={(e) => setQuoteNumber(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Valid Until *</label>
                  <input
                    type="date"
                    value={quoteValidUntil}
                    onChange={(e) => setQuoteValidUntil(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Delivery (days) *</label>
                  <input
                    type="number"
                    min={0}
                    value={quoteDeliveryDays}
                    onChange={(e) => setQuoteDeliveryDays(Number(e.target.value))}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Payment Terms</label>
                  <input
                    value={quotePaymentTerms}
                    onChange={(e) => setQuotePaymentTerms(e.target.value)}
                    placeholder="e.g. Net 30"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Warranty</label>
                  <input
                    value={quoteWarranty}
                    onChange={(e) => setQuoteWarranty(e.target.value)}
                    placeholder="e.g. 12 months"
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-700 mb-2">Line Items</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Unit Price</th>
                        <th className="px-3 py-2 text-right">Line Total</th>
                        <th className="px-3 py-2 text-center">In Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quoteLines.map((line, idx) => (
                        <tr key={line.rfqItemId} className="border-t">
                          <td className="px-3 py-2">
                            {line.itemName}
                            <span className="text-xs text-gray-500"> ({line.unit})</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              value={line.unitPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setQuoteLines((prev) => prev.map((l, i) => (i === idx ? { ...l, unitPrice: val } : l)));
                              }}
                              className="w-28 px-2 py-1 border rounded text-right tabular-nums"
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {(Number(line.unitPrice || 0) * Number(line.quantity || 0)).toLocaleString()}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={line.inStock}
                              onChange={(e) =>
                                setQuoteLines((prev) =>
                                  prev.map((l, i) => (i === idx ? { ...l, inStock: e.target.checked } : l)),
                                )
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 font-medium">
                      <tr>
                        <td colSpan={3} className="px-3 py-2 text-right">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">{quoteTotal.toLocaleString()}</td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={quoteNotes}
                  onChange={(e) => setQuoteNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowQuoteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => receiveQuoteMutation.mutate()}
                disabled={receiveQuoteMutation.isPending || !quoteSupplierId || quoteTotal <= 0}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {receiveQuoteMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : (
                  'Save Quotation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* RFQ Full Details Modal */}
      {showDetailsModal && selectedRFQ && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">RFQ {selectedRFQ.rfqNumber}</h2>
                <p className="text-xs text-gray-500">{selectedRFQ.title}</p>
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              {detailsLoading && (
                <div className="flex items-center justify-center py-8 text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading details…
                </div>
              )}
              {!detailsLoading && (() => {
                const r: any = rfqDetails || selectedRFQ;
                const items: any[] = r.items || [];
                const vendors: any[] = r.vendors || [];
                const quotations: any[] = r.quotations || [];
                return (
                  <>
                    {/* Header summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-gray-500">Status</div>
                        <div className="font-medium capitalize">{r.status}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Requisition</div>
                        <div className="font-medium">{r.purchaseRequest?.requestNumber || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Created</div>
                        <div className="font-medium">{r.createdAt ? new Date(r.createdAt).toLocaleString() : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Deadline</div>
                        <div className="font-medium">{r.deadline ? new Date(r.deadline).toLocaleDateString() : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Created By</div>
                        <div className="font-medium">{r.createdBy?.fullName || r.createdBy?.username || '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Sent Date</div>
                        <div className="font-medium">{r.sentDate ? new Date(r.sentDate).toLocaleDateString() : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Closed Date</div>
                        <div className="font-medium">{r.closedDate ? new Date(r.closedDate).toLocaleDateString() : '—'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Responses</div>
                        <div className="font-medium">{quotations.length}/{vendors.length}</div>
                      </div>
                    </div>

                    {(r.notes || r.instructions) && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        {r.notes && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Notes</div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap">{r.notes}</div>
                          </div>
                        )}
                        {r.instructions && (
                          <div>
                            <div className="text-xs font-medium text-gray-500 mb-1">Instructions</div>
                            <div className="p-3 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap">{r.instructions}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Items */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Items ({items.length})
                      </h3>
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-600">
                            <tr>
                              <th className="px-3 py-2 text-left">Code</th>
                              <th className="px-3 py-2 text-left">Item</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                              <th className="px-3 py-2 text-left">Unit</th>
                              <th className="px-3 py-2 text-left">Specifications</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.length === 0 && (
                              <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400">No items</td></tr>
                            )}
                            {items.map((it: any) => (
                              <tr key={it.id} className="border-t">
                                <td className="px-3 py-2 font-mono text-xs">{it.itemCode}</td>
                                <td className="px-3 py-2">{it.itemName}</td>
                                <td className="px-3 py-2 text-right">{it.quantity}</td>
                                <td className="px-3 py-2">{it.unit || '—'}</td>
                                <td className="px-3 py-2 text-xs text-gray-600">{it.specifications || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Vendors */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <Users className="w-4 h-4" /> Selected Vendors ({vendors.length})
                      </h3>
                      {vendors.length === 0 ? (
                        <div className="text-sm text-gray-400 p-3 border rounded-lg bg-gray-50">
                          No vendors selected.
                        </div>
                      ) : (
                        <div className="border rounded-lg overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-xs text-gray-600">
                              <tr>
                                <th className="px-3 py-2 text-left">Vendor</th>
                                <th className="px-3 py-2 text-left">Email</th>
                                <th className="px-3 py-2 text-left">Phone</th>
                                <th className="px-3 py-2 text-left">Sent</th>
                                <th className="px-3 py-2 text-left">Responded</th>
                              </tr>
                            </thead>
                            <tbody>
                              {vendors.map((v: any) => (
                                <tr key={v.id} className="border-t">
                                  <td className="px-3 py-2 font-medium">{v.supplier?.name || v.supplierId}</td>
                                  <td className="px-3 py-2">{v.supplier?.email || '—'}</td>
                                  <td className="px-3 py-2">{v.supplier?.phone || '—'}</td>
                                  <td className="px-3 py-2 text-xs">{v.sentDate ? new Date(v.sentDate).toLocaleDateString() : '—'}</td>
                                  <td className="px-3 py-2 text-xs">{v.responseDate ? new Date(v.responseDate).toLocaleDateString() : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Quotations */}
                    <div>
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Received Quotations ({quotations.length})
                      </h3>
                      {quotations.length === 0 ? (
                        <div className="text-sm text-gray-400 p-3 border rounded-lg bg-gray-50">
                          No quotations received yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {quotations.map((q: any) => (
                            <div key={q.id} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="font-medium text-sm">{q.supplier?.name || q.supplierId}</div>
                                  <div className="text-xs text-gray-500">
                                    {q.quotationNumber} · {q.submittedDate ? new Date(q.submittedDate).toLocaleDateString() : '—'}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="font-semibold">{Number(q.totalAmount || 0).toLocaleString()}</div>
                                  <span className={`inline-block px-2 py-0.5 rounded text-xs ${
                                    q.status === 'selected' ? 'bg-green-100 text-green-700' :
                                    q.status === 'approved' ? 'bg-blue-100 text-blue-700' :
                                    q.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                    'bg-gray-100 text-gray-700'
                                  }`}>{q.status}</span>
                                </div>
                              </div>
                              {q.items?.length > 0 && (
                                <table className="w-full text-xs mt-2">
                                  <thead className="text-gray-500">
                                    <tr>
                                      <th className="text-left py-1">Item</th>
                                      <th className="text-right py-1">Qty</th>
                                      <th className="text-right py-1">Unit Price</th>
                                      <th className="text-right py-1">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {q.items.map((qi: any) => (
                                      <tr key={qi.id} className="border-t">
                                        <td className="py-1">{qi.itemName || qi.itemCode}</td>
                                        <td className="py-1 text-right">{qi.quantity}</td>
                                        <td className="py-1 text-right">{Number(qi.unitPrice || 0).toLocaleString()}</td>
                                        <td className="py-1 text-right">{Number(qi.totalPrice || 0).toLocaleString()}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              {q.approvals?.length > 0 && (
                                <div className="mt-2 pt-2 border-t text-xs text-gray-600">
                                  <div className="font-medium mb-1">Approvals</div>
                                  {q.approvals.map((a: any) => (
                                    <div key={a.id} className="flex justify-between">
                                      <span>{a.level} — {a.approver?.fullName || a.approverId || '—'}</span>
                                      <span className={
                                        a.status === 'approved' ? 'text-green-600' :
                                        a.status === 'rejected' ? 'text-red-600' : 'text-gray-500'
                                      }>{a.status}{a.approvedDate ? ` · ${new Date(a.approvedDate).toLocaleDateString()}` : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
            <div className="px-6 py-3 border-t bg-gray-50 flex justify-between gap-2">
              <div className="flex gap-2">
                {(() => {
                  const r: any = rfqDetails || selectedRFQ;
                  const status = r?.status;
                  const hasQuotations = (r?.quotations || []).length > 0;
                  const canCancel = status && status !== 'closed' && status !== 'cancelled';
                  const canDelete = (status === 'draft' || status === 'cancelled') && !hasQuotations;
                  return (
                    <>
                      {canCancel && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Cancel ${r.rfqNumber}? Vendors will no longer be able to respond.`)) {
                              cancelRfqMutation.mutate(r.id);
                            }
                          }}
                          disabled={cancelRfqMutation.isPending}
                          className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Ban className="w-4 h-4" /> Cancel RFQ
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            if (window.confirm(`Permanently delete ${r.rfqNumber}? This cannot be undone.`)) {
                              deleteRfqMutation.mutate(r.id);
                            }
                          }}
                          disabled={deleteRfqMutation.isPending}
                          className="px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" /> Delete
                        </button>
                      )}
                    </>
                  );
                })()}
              </div>
              <button
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
