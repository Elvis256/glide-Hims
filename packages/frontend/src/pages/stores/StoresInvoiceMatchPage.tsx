import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  FileText,
  CheckCircle,
  AlertTriangle,
  Building2,
  Filter,
  Eye,
  ChevronRight,
  XCircle,
  Link,
  DollarSign,
  Package,
  Calculator,
  AlertCircle,
  Check,
  Loader2,
  Flag,
  ThumbsUp,
  Clock,
} from 'lucide-react';
import {
  invoiceMatchingService,
  type InvoiceMatch,
  type InvoiceMatchStatus,
  type InvoiceMatchItem,
} from '../../services/invoice-matching';
import { formatCurrency } from '../../lib/currency';
import { useFacilityId } from '../../lib/facility';

type MatchStatusFilter = InvoiceMatchStatus | 'all';

const statusConfig: Record<InvoiceMatchStatus, { color: string; bg: string; icon: React.ReactNode; label: string }> = {
  pending: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock className="w-3.5 h-3.5" />, label: 'Pending' },
  matched: { color: 'text-green-600', bg: 'bg-green-100', icon: <CheckCircle className="w-3.5 h-3.5" />, label: 'Matched' },
  mismatch: { color: 'text-red-600', bg: 'bg-red-100', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Mismatch' },
  flagged: { color: 'text-orange-600', bg: 'bg-orange-100', icon: <Flag className="w-3.5 h-3.5" />, label: 'Flagged' },
  approved: { color: 'text-blue-600', bg: 'bg-blue-100', icon: <ThumbsUp className="w-3.5 h-3.5" />, label: 'Approved' },
  paid: { color: 'text-purple-600', bg: 'bg-purple-100', icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Paid' },
};

export default function StoresInvoiceMatchPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<MatchStatusFilter>('all');
  const [selectedMatch, setSelectedMatch] = useState<InvoiceMatch | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [flagReason, setFlagReason] = useState('');
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);

  // Fetch invoice matches
  const { data: invoiceMatches = [], isLoading, error } = useQuery({
    queryKey: ['stores-invoice-matches', facilityId, statusFilter],
    queryFn: () => invoiceMatchingService.list(facilityId, statusFilter === 'all' ? undefined : statusFilter),
    enabled: !!facilityId,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['stores-invoice-match-stats', facilityId],
    queryFn: () => invoiceMatchingService.getStats(facilityId),
    enabled: !!facilityId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => invoiceMatchingService.approve(id, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-invoice-matches'] });
      queryClient.invalidateQueries({ queryKey: ['stores-invoice-match-stats'] });
      setShowApproveModal(false);
      setApprovalNotes('');
      setSelectedMatch(null);
    },
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => invoiceMatchingService.flag(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stores-invoice-matches'] });
      queryClient.invalidateQueries({ queryKey: ['stores-invoice-match-stats'] });
      setShowFlagModal(false);
      setFlagReason('');
    },
  });

  // Filtered matches
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

  // Summary stats
  const summaryStats = useMemo(() => ({
    pending: stats?.pending || 0,
    matched: stats?.matched || 0,
    mismatch: (stats?.mismatch || 0) + (stats?.flagged || 0),
    approved: stats?.approved || 0,
    totalVariance: stats?.totalVarianceAmount || 0,
  }), [stats]);

  const getItemVarianceColor = (item: InvoiceMatchItem) => {
    if (item.varianceType === 'none' || item.varianceType === 'accepted') return 'text-green-600';
    return 'text-red-600';
  };

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
        <p className="text-red-600">Failed to load invoice matches</p>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoice Matching</h1>
          <p className="text-gray-600">3-way matching: PO, GRN, Invoice for Accounts Payable</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
            <Calculator className="w-4 h-4" />
            Auto-Match All
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <Clock className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-gray-700">{summaryStats.pending}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Matched</p>
              <p className="text-2xl font-bold text-green-600">{summaryStats.matched}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Discrepancies</p>
              <p className="text-2xl font-bold text-red-600">{summaryStats.mismatch}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <ThumbsUp className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-blue-600">{summaryStats.approved}</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Variance</p>
              <p className="text-2xl font-bold text-orange-600">
                {formatCurrency(summaryStats.totalVariance)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        {/* Invoice List */}
        <div className="flex-1 flex flex-col">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by invoice, PO, match number, or supplier..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-gray-500" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as MatchStatusFilter)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="matched">Matched</option>
                  <option value="mismatch">Mismatch</option>
                  <option value="flagged">Flagged</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {/* Invoice Table */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Documents</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Supplier</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Invoice Amt</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Variance</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMatches.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-12 text-center">
                        <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500 font-medium">No invoices to match</p>
                        <p className="text-gray-400 text-sm mt-1">Invoice matching records will appear here</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMatches.map((match) => (
                      <tr
                        key={match.id}
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedMatch?.id === match.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => setSelectedMatch(match)}
                      >
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-900">{match.invoiceNumber}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(match.invoiceDate).toLocaleDateString()}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {match.purchaseOrder?.orderNumber || 'N/A'}
                            </span>
                            <Link className="w-3 h-3 text-gray-400" />
                            <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                              {match.grn?.grnNumber || 'N/A'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-400" />
                            <span className="text-gray-900">
                              {match.purchaseOrder?.supplier?.name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {formatCurrency(match.invoiceAmount)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`font-medium ${
                            match.amountVariance === 0 
                              ? 'text-green-600' 
                              : 'text-red-600'
                          }`}>
                            {match.amountVariance === 0 
                              ? 'None' 
                              : formatCurrency(match.amountVariance)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium w-fit ${statusConfig[match.status].bg} ${statusConfig[match.status].color}`}>
                            {statusConfig[match.status].icon}
                            {statusConfig[match.status].label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button 
                              className="p-1.5 hover:bg-gray-100 rounded text-gray-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMatch(match);
                              }}
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {match.status === 'matched' && (
                              <button 
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMatch(match);
                                  setShowApproveModal(true);
                                }}
                                disabled={approveMutation.isPending}
                              >
                                Approve
                              </button>
                            )}
                            {(match.status === 'pending' || match.status === 'mismatch') && (
                              <button 
                                className="p-1.5 hover:bg-orange-100 rounded text-orange-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMatch(match);
                                  setShowFlagModal(true);
                                }}
                              >
                                <Flag className="w-4 h-4" />
                              </button>
                            )}
                            <button className="p-1.5 hover:bg-gray-100 rounded">
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

        {/* Detail Panel */}
        {selectedMatch && (
          <div className="w-96 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">{selectedMatch.matchNumber}</h2>
                <button 
                  onClick={() => setSelectedMatch(null)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <XCircle className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                Invoice: {selectedMatch.invoiceNumber}
              </p>
              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mt-2 ${statusConfig[selectedMatch.status].bg} ${statusConfig[selectedMatch.status].color}`}>
                {statusConfig[selectedMatch.status].icon}
                {statusConfig[selectedMatch.status].label}
              </span>
            </div>

            {/* Three-way match visual */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">3-Way Match</h3>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 text-center p-3 bg-blue-50 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-blue-900">
                    {selectedMatch.purchaseOrder?.orderNumber || 'N/A'}
                  </p>
                  <p className="text-xs text-blue-600">PO</p>
                  <p className="text-xs font-medium mt-1">{formatCurrency(selectedMatch.poAmount)}</p>
                </div>
                <div className="flex flex-col items-center">
                  <Check className="w-4 h-4 text-green-500" />
                  <div className="w-4 h-0.5 bg-gray-300" />
                </div>
                <div className="flex-1 text-center p-3 bg-green-50 rounded-lg">
                  <Package className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-green-900">
                    {selectedMatch.grn?.grnNumber || 'N/A'}
                  </p>
                  <p className="text-xs text-green-600">GRN</p>
                  <p className="text-xs font-medium mt-1">{formatCurrency(selectedMatch.grnAmount)}</p>
                </div>
                <div className="flex flex-col items-center">
                  <Check className="w-4 h-4 text-green-500" />
                  <div className="w-4 h-0.5 bg-gray-300" />
                </div>
                <div className="flex-1 text-center p-3 bg-purple-50 rounded-lg">
                  <DollarSign className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-xs font-medium text-purple-900">{selectedMatch.invoiceNumber}</p>
                  <p className="text-xs text-purple-600">Invoice</p>
                  <p className="text-xs font-medium mt-1">{formatCurrency(selectedMatch.invoiceAmount)}</p>
                </div>
              </div>
              {selectedMatch.amountVariance !== 0 && (
                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded-lg text-center">
                  <p className="text-xs text-red-600">
                    Total Variance: <span className="font-bold">{formatCurrency(selectedMatch.amountVariance)}</span>
                  </p>
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="flex-1 overflow-auto p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Line Items ({selectedMatch.items.length})</h3>
              <div className="space-y-3">
                {selectedMatch.items.map((item) => (
                  <div key={item.id} className="p-3 border border-gray-200 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 text-sm">{item.itemName}</span>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        item.varianceType === 'none' || item.varianceType === 'accepted'
                          ? 'bg-green-100 text-green-700'
                          : item.varianceType === 'quantity'
                          ? 'bg-orange-100 text-orange-700'
                          : item.varianceType === 'price'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.varianceType === 'none' ? 'Match' : 
                         item.varianceType === 'accepted' ? 'Accepted' :
                         item.varianceType === 'quantity' ? 'Qty Variance' :
                         item.varianceType === 'price' ? 'Price Variance' : 'Both'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-gray-500">PO</p>
                        <p className="font-medium">{item.poQuantity} × {formatCurrency(item.poUnitPrice)}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">GRN</p>
                        <p className={`font-medium ${item.grnQuantity !== item.poQuantity ? 'text-orange-600' : ''}`}>
                          {item.grnQuantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Invoice</p>
                        <p className={`font-medium ${item.invoiceUnitPrice !== item.poUnitPrice ? 'text-orange-600' : ''}`}>
                          {item.invoiceQuantity} × {formatCurrency(item.invoiceUnitPrice)}
                        </p>
                      </div>
                    </div>
                    {(item.quantityVariance !== 0 || item.priceVariance !== 0) && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        {item.quantityVariance !== 0 && (
                          <p className="text-xs text-orange-600">
                            Qty variance: {item.quantityVariance > 0 ? '+' : ''}{item.quantityVariance}
                          </p>
                        )}
                        {item.priceVariance !== 0 && (
                          <p className="text-xs text-orange-600">
                            Price variance: {formatCurrency(item.priceVariance)}
                          </p>
                        )}
                        {item.totalVariance !== 0 && (
                          <p className={`text-xs font-medium ${getItemVarianceColor(item)}`}>
                            Total variance: {formatCurrency(item.totalVariance)}
                          </p>
                        )}
                      </div>
                    )}
                    {item.notes && (
                      <p className="text-xs text-gray-500 mt-2 italic">{item.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                {selectedMatch.status === 'matched' && (
                  <>
                    <button 
                      className="flex-1 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center justify-center gap-2"
                      onClick={() => setShowApproveModal(true)}
                      disabled={approveMutation.isPending}
                    >
                      <ThumbsUp className="w-4 h-4" />
                      Approve
                    </button>
                    <button 
                      className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 text-sm"
                      onClick={() => setShowFlagModal(true)}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </>
                )}
                {selectedMatch.status === 'mismatch' && (
                  <>
                    <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                      Resolve Discrepancy
                    </button>
                    <button 
                      className="px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50 text-sm"
                      onClick={() => setShowFlagModal(true)}
                    >
                      <Flag className="w-4 h-4" />
                    </button>
                  </>
                )}
                {selectedMatch.status === 'pending' && (
                  <button className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
                    Start Matching
                  </button>
                )}
                {selectedMatch.status === 'approved' && (
                  <div className="flex-1 py-2 text-center text-sm text-green-600 bg-green-50 rounded-lg">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    Approved for Payment
                  </div>
                )}
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
              <h2 className="text-lg font-semibold">Approve Invoice Match</h2>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Match Number</span>
                  <span className="font-mono font-medium">{selectedMatch.matchNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Invoice</span>
                  <span className="font-medium">{selectedMatch.invoiceNumber}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Supplier</span>
                  <span className="font-medium">{selectedMatch.purchaseOrder?.supplier?.name || 'N/A'}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Amount</span>
                  <span className="text-xl font-bold">{formatCurrency(selectedMatch.invoiceAmount)}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Approval Notes (Optional)</label>
                <textarea
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="Add any notes for this approval..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  rows={3}
                />
              </div>
              
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <CheckCircle className="w-5 h-5" />
                <span>3-way match verified. Ready for payment processing.</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setApprovalNotes('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                onClick={() => approveMutation.mutate({ id: selectedMatch.id, notes: approvalNotes || undefined })}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ThumbsUp className="w-4 h-4" />
                )}
                Approve
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
              <h2 className="text-lg font-semibold">Flag Invoice for Review</h2>
            </div>
            <div className="p-6">
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Invoice</span>
                  <span className="font-mono font-medium">{selectedMatch.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount</span>
                  <span className="font-bold">{formatCurrency(selectedMatch.invoiceAmount)}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Flagging *</label>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Describe why this invoice needs review..."
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                  rows={3}
                  required
                />
              </div>
              
              <div className="flex items-center gap-2 text-sm text-orange-600 bg-orange-50 p-3 rounded-lg">
                <AlertCircle className="w-5 h-5" />
                <span>Flagged invoices will be escalated for manager review.</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowFlagModal(false);
                  setFlagReason('');
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
                onClick={() => flagMutation.mutate({ id: selectedMatch.id, reason: flagReason })}
                disabled={flagMutation.isPending || !flagReason.trim()}
              >
                {flagMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
                Flag Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
