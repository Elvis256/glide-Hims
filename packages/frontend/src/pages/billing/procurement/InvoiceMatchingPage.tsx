import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Eye,
  DollarSign,
  Calendar,
  Building2,
  FileText,
  Package,
  Link2,
  ThumbsUp,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CreditCard,
  ArrowRight,
  Flag,
  Loader2,
} from 'lucide-react';
import { invoiceMatchingService, type InvoiceMatch, type InvoiceMatchStatus as MatchStatusType, type CreateInvoiceMatchDto } from '../../../services/invoice-matching';
import { procurementService, type GoodsReceipt } from '../../../services/procurement';
import { useAuthStore } from '../../../store/auth';
import { CategoryContextBanner } from '../../../components/procurement/CategoryContextBanner';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const fmtUGX = (n: number) =>
  `UGX ${Number(n || 0).toLocaleString('en-UG', { maximumFractionDigits: 0 })}`;

type MatchStatus = 'pending' | 'matched' | 'mismatch' | 'approved' | 'flagged' | 'paid';

const statusConfig: Record<MatchStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  matched: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3 h-3" />, label: 'Matched' },
  mismatch: { color: 'text-red-600', bg: 'bg-red-100', icon: <AlertTriangle className="w-3 h-3" />, label: 'Mismatch' },
  approved: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <ThumbsUp className="w-3 h-3" />, label: 'Approved' },
  flagged: { color: 'text-orange-600', bg: 'bg-orange-100', icon: <Flag className="w-3 h-3" />, label: 'Flagged' },
  paid: { color: 'text-purple-600', bg: 'bg-purple-100', icon: <CreditCard className="w-3 h-3" />, label: 'Paid' },
};

export default function InvoiceMatchingPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatus | 'all'>('all');
  const [selectedMatch, setSelectedMatch] = useState<InvoiceMatch | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveNotes, setApproveNotes] = useState('');
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flagReason, setFlagReason] = useState('');
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

  // Create-match modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createGrnId, setCreateGrnId] = useState('');
  const [createInvoiceNumber, setCreateInvoiceNumber] = useState('');
  const [createInvoiceDate, setCreateInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [createDueDate, setCreateDueDate] = useState('');
  const [createInvoiceAmount, setCreateInvoiceAmount] = useState<number>(0);
  const [createItemLines, setCreateItemLines] = useState<
    Array<{ itemId: string; itemName: string; poQty: number; poPrice: number; grnQty: number; invoiceQty: number; invoicePrice: number }>
  >([]);

  // Fetch invoice matches
  const { data: invoiceMatches = [], isLoading } = useQuery({
    queryKey: ['invoice-matches', facilityId, statusFilter],
    queryFn: () => invoiceMatchingService.list(facilityId, statusFilter === 'all' ? undefined : statusFilter as MatchStatusType),
    enabled: !!facilityId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['invoice-matches-stats', facilityId],
    queryFn: () => invoiceMatchingService.getStats(facilityId),
    enabled: !!facilityId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => invoiceMatchingService.approve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-matches'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-matches-stats'] });
      setShowApproveModal(false);
      toast.success('Invoice approved for payment');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to approve invoice'),
  });

  // Mark-as-paid mutation
  const markAsPaidMutation = useMutation({
    mutationFn: (id: string) => invoiceMatchingService.markAsPaid(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-matches'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-matches-stats'] });
      toast.success('Invoice marked as paid');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to mark as paid'),
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => invoiceMatchingService.flag(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-matches'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-matches-stats'] });
      setShowFlagModal(false);
      setFlagReason('');
      toast.success('Invoice flagged for follow-up');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to flag invoice'),
  });

  // GRNs eligible for invoice matching (approved/posted, linked to a PO)
  const { data: eligibleGRNs = [], isLoading: grnsLoading } = useQuery<GoodsReceipt[]>({
    queryKey: ['grns-for-match', facilityId],
    queryFn: async () => {
      const [approved, posted] = await Promise.all([
        procurementService.goodsReceipts.list({ facilityId, status: 'approved' as any }),
        procurementService.goodsReceipts.list({ facilityId, status: 'posted' as any }),
      ]);
      const all = [...(approved || []), ...(posted || [])];
      const seen = new Set<string>();
      return all.filter((g) => {
        if (seen.has(g.id) || !g.purchaseOrderId) return false;
        seen.add(g.id);
        return true;
      });
    },
    enabled: !!facilityId && showCreateModal,
  });

  // Full PO details (for unit prices) once a GRN is picked
  const selectedGrnObj = useMemo(
    () => eligibleGRNs.find((g) => g.id === createGrnId) || null,
    [eligibleGRNs, createGrnId],
  );

  const { data: linkedPO } = useQuery({
    queryKey: ['po-for-match', selectedGrnObj?.purchaseOrderId],
    queryFn: () => procurementService.purchaseOrders.getById(selectedGrnObj!.purchaseOrderId!),
    enabled: !!selectedGrnObj?.purchaseOrderId,
  });

  // When PO loads, populate item lines (PO qty/price + GRN qty)
  React.useEffect(() => {
    if (!linkedPO || !selectedGrnObj) {
      setCreateItemLines([]);
      return;
    }
    const grnByItem = new Map(
      (selectedGrnObj.items || []).map((g) => [g.itemId, g]),
    );
    const lines = (linkedPO.items || []).map((p) => {
      const grnLine = grnByItem.get(p.itemId);
      const grnQty = Number(grnLine?.quantityReceived || 0);
      const poPrice = Number(p.unitPrice || 0);
      return {
        itemId: p.itemId,
        itemName: p.itemName,
        poQty: Number(p.quantityOrdered || 0),
        poPrice,
        grnQty,
        invoiceQty: grnQty,
        invoicePrice: poPrice,
      };
    });
    setCreateItemLines(lines);
    const total = lines.reduce((s, l) => s + l.invoiceQty * l.invoicePrice, 0);
    setCreateInvoiceAmount(Math.round(total));
  }, [linkedPO, selectedGrnObj]);

  // Recompute total whenever the user edits an invoice qty / price
  React.useEffect(() => {
    if (createItemLines.length === 0) return;
    const total = createItemLines.reduce((s, l) => s + l.invoiceQty * l.invoicePrice, 0);
    setCreateInvoiceAmount(Math.round(total));
  }, [createItemLines]);

  const createMatchMutation = useMutation({
    mutationFn: (dto: CreateInvoiceMatchDto) => invoiceMatchingService.create(dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-matches'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-matches-stats'] });
      setShowCreateModal(false);
      setCreateGrnId('');
      setCreateInvoiceNumber('');
      setCreateDueDate('');
      setCreateInvoiceAmount(0);
      setCreateItemLines([]);
      toast.success('Invoice match created');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to create invoice match');
    },
  });

  const submitCreateMatch = () => {
    if (!facilityId || !createGrnId || !selectedGrnObj?.purchaseOrderId) {
      toast.error('Pick a GRN first');
      return;
    }
    if (!createInvoiceNumber.trim()) {
      toast.error('Invoice number is required');
      return;
    }
    if (createItemLines.length === 0) {
      toast.error('No items to match');
      return;
    }
    createMatchMutation.mutate({
      facilityId,
      purchaseOrderId: selectedGrnObj.purchaseOrderId,
      grnId: createGrnId,
      invoiceNumber: createInvoiceNumber.trim(),
      invoiceDate: createInvoiceDate,
      dueDate: createDueDate || undefined,
      invoiceAmount: createInvoiceAmount,
      items: createItemLines.map((l) => ({
        itemId: l.itemId,
        itemName: l.itemName,
        poQty: l.poQty,
        poPrice: l.poPrice,
        grnQty: l.grnQty,
        invoiceQty: l.invoiceQty,
        invoicePrice: l.invoicePrice,
      })),
    });
  };

  const filteredMatches = useMemo(() => {
    return invoiceMatches.filter((match) => {
      const matchesSearch =
        match.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        match.matchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (match.purchaseOrder?.orderNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (match.purchaseOrder?.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [invoiceMatches, searchTerm]);

  const summaryStats = useMemo(() => {
    return {
      pending: stats?.pending || 0,
      mismatches: (stats?.mismatch || 0) + (stats?.flagged || 0),
      totalVariance: stats?.totalVarianceAmount || 0,
      approved: stats?.approved || 0,
    };
  }, [stats]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      <CategoryContextBanner />
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 rounded-lg">
              <FileCheck className="w-6 h-6 text-violet-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Invoice Matching</h1>
              <p className="text-sm text-gray-500">3-way matching: PO, GRN, Invoice</p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            <Plus className="w-4 h-4" />
            New Match
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending Review</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats?.pending || 0}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Discrepancies</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{(stats?.mismatch || 0) + (stats?.flagged || 0)}</p>
          </div>
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Total Invoice Value</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmtUGX(stats?.totalVarianceAmount || 0)}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Approved for Payment</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{stats?.approved || 0}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search invoices, vendors, PO numbers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['all', 'pending', 'matched', 'mismatch', 'flagged', 'approved'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Match List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredMatches.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <FileCheck className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Invoices to Match</h3>
              <p className="text-sm text-gray-500">Invoice matching records will appear here</p>
            </div>
          ) : (
          <div className="space-y-3">
            {filteredMatches.map((match) => {
              const hasQtyMismatch = match.items.some((item) => item.quantityVariance !== 0);
              const hasPriceMismatch = match.items.some((item) => item.priceVariance !== 0);
              
              return (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className={`bg-white rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedMatch?.id === match.id ? 'ring-2 ring-violet-500 border-violet-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="font-mono text-sm font-medium text-violet-600">{match.invoiceNumber}</span>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig[match.status].bg} ${statusConfig[match.status].color}`}
                        >
                          {statusConfig[match.status].icon}
                          {match.status}
                        </span>
                        {hasQtyMismatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                            <Package className="w-3 h-3" />
                            Qty Mismatch
                          </span>
                        )}
                        {hasPriceMismatch && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-600">
                            <DollarSign className="w-3 h-3" />
                            Price Variance
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <Building2 className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-900">{match.purchaseOrder?.supplier?.name || 'Unknown Vendor'}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{match.vendorInvoiceRef || ''}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {match.purchaseOrder?.orderNumber || ''}
                        </span>
                        {match.grn?.grnNumber && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {match.grn.grnNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {match.invoiceDate}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        ${match.invoiceAmount.toLocaleString()}
                      </div>
                      {match.amountVariance !== 0 && (
                        <p className={`text-sm ${match.amountVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {match.amountVariance > 0 ? '+' : ''}${match.amountVariance.toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3-Way Match Summary */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">PO Amount</p>
                        <p className="font-medium">${match.poAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">GRN Amount</p>
                        <p className={`font-medium ${match.grnAmount === 0 ? 'text-gray-400' : ''}`}>
                          {match.grnAmount === 0 ? 'Not Received' : `$${match.grnAmount.toLocaleString()}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Invoice Amount</p>
                        <p className="font-medium">${match.invoiceAmount.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Match Indicator */}
                    <div className="flex items-center justify-center mt-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.poAmount === match.grnAmount || match.grnAmount === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">PO↔GRN</span>
                      </div>
                      <div className="w-8 h-px bg-gray-200 mx-2" />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.grnAmount === match.invoiceAmount ? 'bg-green-500' : match.grnAmount === 0 ? 'bg-gray-300' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">GRN↔Invoice</span>
                      </div>
                      <div className="w-8 h-px bg-gray-200 mx-2" />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.poAmount === match.invoiceAmount ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">PO↔Invoice</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedMatch && (
          <div className="w-[450px] border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Matching Details</h2>
              <button onClick={() => setSelectedMatch(null)} className="p-1 hover:bg-gray-200 rounded">
                <XCircle className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Invoice Number</p>
                  <p className="font-mono font-bold text-violet-600">{selectedMatch.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor Invoice</p>
                  <p className="font-mono text-sm">{selectedMatch.vendorInvoiceRef || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
                <p className="font-medium">{selectedMatch.purchaseOrder?.supplier?.name || 'Unknown Vendor'}</p>
              </div>

              {/* Document Links */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Linked Documents</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-600">{selectedMatch.purchaseOrder?.orderNumber || ''}</span>
                  </div>
                  {selectedMatch.grn?.grnNumber ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Package className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600">{selectedMatch.grn.grnNumber}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-sm text-gray-400">
                      <Package className="w-4 h-4" />
                      <span>No GRN</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Invoice Date</p>
                  <p className="text-sm">{selectedMatch.invoiceDate}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Payment Date</p>
                  <p className="text-sm font-medium">
                    {selectedMatch.paymentDate || '-'}
                  </p>
                </div>
              </div>

              {/* Item Comparison */}
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer mb-2"
                  onClick={() => setExpandedItems(expandedItems === 'items' ? null : 'items')}
                >
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Item-Level Comparison</p>
                  {expandedItems === 'items' ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
                <div className={`space-y-2 ${expandedItems !== 'items' ? 'max-h-64 overflow-hidden' : ''}`}>
                  {selectedMatch.items.map((item) => (
                    <div key={item.id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-medium text-sm">{item.itemName}</span>
                        <div className="flex gap-1">
                          {item.quantityVariance !== 0 && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">Qty</span>
                          )}
                          {item.priceVariance !== 0 && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">Price</span>
                          )}
                          {item.quantityVariance === 0 && item.priceVariance === 0 && (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                        </div>
                      </div>
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="text-left font-normal pb-1"></th>
                            <th className="text-right font-normal pb-1">PO</th>
                            <th className="text-right font-normal pb-1">GRN</th>
                            <th className="text-right font-normal pb-1">Invoice</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td className="text-gray-500">Qty</td>
                            <td className="text-right">{item.poQuantity}</td>
                            <td className={`text-right ${item.grnQuantity !== item.poQuantity ? 'text-red-600 font-medium' : ''}`}>
                              {item.grnQuantity}
                            </td>
                            <td className={`text-right ${item.invoiceQuantity !== item.grnQuantity ? 'text-red-600 font-medium' : ''}`}>
                              {item.invoiceQuantity}
                            </td>
                          </tr>
                          <tr>
                            <td className="text-gray-500">Price</td>
                            <td className="text-right">${item.poUnitPrice.toFixed(2)}</td>
                            <td className="text-right">-</td>
                            <td className={`text-right ${item.invoiceUnitPrice !== item.poUnitPrice ? 'text-orange-600 font-medium' : ''}`}>
                              ${item.invoiceUnitPrice.toFixed(2)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="grid grid-cols-3 gap-4 text-center mb-3">
                  <div>
                    <p className="text-xs text-gray-500">PO Total</p>
                    <p className="font-medium">${selectedMatch.poAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">GRN Total</p>
                    <p className="font-medium">
                      {selectedMatch.grnAmount === 0 ? '-' : `$${selectedMatch.grnAmount.toLocaleString()}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Total</p>
                    <p className="font-bold text-lg">${selectedMatch.invoiceAmount.toLocaleString()}</p>
                  </div>
                </div>
                {selectedMatch.amountVariance !== 0 && (
                  <div className={`text-center pt-2 border-t ${selectedMatch.amountVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span className="text-sm">Variance: </span>
                    <span className="font-bold">
                      {selectedMatch.amountVariance > 0 ? '+' : ''}${selectedMatch.amountVariance.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Info */}
              {selectedMatch.paymentReference && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Payment Reference</span>
                  </div>
                  <p className="text-green-800 font-medium mt-1">{selectedMatch.paymentReference}</p>
                </div>
              )}

              {/* Notes */}
              {selectedMatch.approvalNotes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
                    {selectedMatch.approvalNotes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedMatch.status === 'matched' && (
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve for Payment
                  </button>
                )}
                {(selectedMatch.status === 'mismatch' || selectedMatch.status === 'flagged') && (
                  <>
                    <button
                      onClick={() => setShowApproveModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
                    >
                      <Eye className="w-4 h-4" />
                      Review Discrepancies
                    </button>
                    {selectedMatch.status === 'mismatch' && (
                      <button
                        onClick={() => setShowFlagModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50"
                      >
                        <Flag className="w-4 h-4" />
                        Flag for Follow-up
                      </button>
                    )}
                  </>
                )}
                {selectedMatch.status === 'pending' && !selectedMatch.grn?.grnNumber && (
                  <button
                    disabled
                    title="Re-create the match against a GRN"
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-400 rounded-lg cursor-not-allowed"
                  >
                    <Link2 className="w-4 h-4" />
                    Link GRN (recreate match)
                  </button>
                )}
                {selectedMatch.status === 'approved' && (
                  <button
                    onClick={() => {
                      if (confirm(`Mark invoice ${selectedMatch.invoiceNumber} as PAID? This cannot be undone.`)) {
                        markAsPaidMutation.mutate(selectedMatch.id);
                      }
                    }}
                    disabled={markAsPaidMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" />
                    {markAsPaidMutation.isPending ? 'Marking…' : 'Mark as Paid'}
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

      {/* Approve Modal */}
      {showApproveModal && selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Approve Invoice for Payment</h2>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Invoice</span>
                  <span className="font-mono font-medium">{selectedMatch.invoiceNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Vendor</span>
                  <span className="font-medium">{selectedMatch.purchaseOrder?.supplier?.name || 'Unknown Vendor'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Amount</span>
                  <span className="text-xl font-bold">{fmtUGX(selectedMatch.invoiceAmount)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Approval Notes (optional)</label>
                <textarea
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  rows={3}
                  placeholder="Any notes for the finance team..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>3-way match verified. Ready for payment processing.</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowApproveModal(false); setApproveNotes(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  approveMutation.mutate({
                    id: selectedMatch.id,
                    notes: approveNotes.trim() || undefined,
                  })
                }
                disabled={approveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <ArrowRight className="w-4 h-4" />
                {approveMutation.isPending ? 'Approving…' : 'Approve for Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flag Modal */}
      {showFlagModal && selectedMatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">Flag Invoice for Follow-up</h2>
              <p className="text-sm text-gray-500 mt-1">Invoice {selectedMatch.invoiceNumber}</p>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                rows={4}
                placeholder="Describe the discrepancy or reason for flagging..."
                className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => { setShowFlagModal(false); setFlagReason(''); }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => flagMutation.mutate({ id: selectedMatch.id, reason: flagReason.trim() })}
                disabled={flagMutation.isPending || !flagReason.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                <Flag className="w-4 h-4" />
                {flagMutation.isPending ? 'Flagging…' : 'Flag Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Match Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Create Invoice Match</h2>
                <p className="text-sm text-gray-500">Match a vendor invoice to a posted GRN + PO</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goods Received Note <span className="text-red-500">*</span>
                </label>
                <select
                  value={createGrnId}
                  onChange={(e) => setCreateGrnId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="">
                    {grnsLoading ? 'Loading GRNs…' : `Select GRN (${eligibleGRNs.length} available)`}
                  </option>
                  {eligibleGRNs.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.grnNumber} — PO {g.purchaseOrder?.orderNumber || ''} — {g.supplier?.name || ''} ({g.status})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Only approved or posted GRNs linked to a PO are listed.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor Invoice # <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={createInvoiceNumber}
                    onChange={(e) => setCreateInvoiceNumber(e.target.value)}
                    placeholder="INV-12345"
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    value={createInvoiceDate}
                    onChange={(e) => setCreateInvoiceDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={createDueDate}
                    onChange={(e) => setCreateDueDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>

              {createItemLines.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Line Items</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                        <tr>
                          <th className="text-left px-3 py-2">Item</th>
                          <th className="text-right px-3 py-2">PO Qty</th>
                          <th className="text-right px-3 py-2">GRN Qty</th>
                          <th className="text-right px-3 py-2">PO Price</th>
                          <th className="text-right px-3 py-2">Inv Qty</th>
                          <th className="text-right px-3 py-2">Inv Price</th>
                          <th className="text-right px-3 py-2">Line Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {createItemLines.map((line, idx) => (
                          <tr key={line.itemId}>
                            <td className="px-3 py-2">{line.itemName}</td>
                            <td className="px-3 py-2 text-right">{line.poQty}</td>
                            <td className="px-3 py-2 text-right">{line.grnQty}</td>
                            <td className="px-3 py-2 text-right">{fmtUGX(line.poPrice)}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.invoiceQty}
                                onChange={(e) => {
                                  const v = Number(e.target.value) || 0;
                                  setCreateItemLines((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, invoiceQty: v } : l)),
                                  );
                                }}
                                className="w-20 px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={line.invoicePrice}
                                onChange={(e) => {
                                  const v = Number(e.target.value) || 0;
                                  setCreateItemLines((prev) =>
                                    prev.map((l, i) => (i === idx ? { ...l, invoicePrice: v } : l)),
                                  );
                                }}
                                className="w-24 px-2 py-1 border rounded text-right"
                              />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              {fmtUGX(line.invoiceQty * line.invoicePrice)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-gray-50">
                        <tr>
                          <td colSpan={6} className="px-3 py-2 text-right font-semibold">Total Invoice Amount</td>
                          <td className="px-3 py-2 text-right font-bold text-violet-700">{fmtUGX(createInvoiceAmount)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitCreateMatch}
                disabled={createMatchMutation.isPending || !createGrnId || !createInvoiceNumber.trim() || createItemLines.length === 0}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMatchMutation.isPending ? 'Creating…' : 'Create Match'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
