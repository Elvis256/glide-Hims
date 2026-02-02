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
import { useAuthStore } from '../../../store/auth';

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
  const [expandedItems, setExpandedItems] = useState<string | null>(null);

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
      setShowApproveModal(false);
    },
  });

  // Flag mutation
  const flagMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => invoiceMatchingService.flag(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-matches'] });
    },
  });

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
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-yellow-600 mb-1">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Pending Review</span>
            </div>
            <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-red-600 mb-1">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Discrepancies</span>
            </div>
            <p className="text-2xl font-bold text-red-700">{stats.mismatches}</p>
          </div>
          <div className="bg-gray-50 border rounded-lg p-3">
            <div className="flex items-center gap-2 text-gray-600 mb-1">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Total Invoice Value</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">${stats.totalValue.toLocaleString()}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Approved for Payment</span>
            </div>
            <p className="text-2xl font-bold text-green-700">${stats.approvedValue.toLocaleString()}</p>
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
              {(['All', 'Pending', 'Matched', 'Mismatch', 'Flagged', 'Approved'] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    statusFilter === status
                      ? 'bg-violet-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {status}
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
              const hasQtyMismatch = match.items.some((item) => !item.qtyMatch);
              const hasPriceMismatch = match.items.some((item) => !item.priceMatch);
              
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
                        <span className="font-medium text-gray-900">{match.vendor}</span>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-gray-500">{match.vendorInvoiceNo}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3.5 h-3.5" />
                          {match.poNumber}
                        </span>
                        {match.grnNumber && (
                          <span className="flex items-center gap-1">
                            <Package className="w-3.5 h-3.5" />
                            {match.grnNumber}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {match.invoiceDate}
                        </span>
                        <span className={`flex items-center gap-1 ${getDueDaysClass(match.dueDate)}`}>
                          <Clock className="w-3.5 h-3.5" />
                          Due: {match.dueDate}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-900">
                        ${match.invoiceTotal.toLocaleString()}
                      </div>
                      {match.variance !== 0 && (
                        <p className={`text-sm ${match.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {match.variance > 0 ? '+' : ''}${match.variance.toLocaleString()} ({match.variancePercent.toFixed(1)}%)
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 3-Way Match Summary */}
                  <div className="mt-3 pt-3 border-t">
                    <div className="grid grid-cols-3 gap-4 text-center text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">PO Amount</p>
                        <p className="font-medium">${match.poTotal.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">GRN Amount</p>
                        <p className={`font-medium ${match.grnTotal === 0 ? 'text-gray-400' : ''}`}>
                          {match.grnTotal === 0 ? 'Not Received' : `$${match.grnTotal.toLocaleString()}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Invoice Amount</p>
                        <p className="font-medium">${match.invoiceTotal.toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {/* Match Indicator */}
                    <div className="flex items-center justify-center mt-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.poTotal === match.grnTotal || match.grnTotal === 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">PO↔GRN</span>
                      </div>
                      <div className="w-8 h-px bg-gray-200 mx-2" />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.grnTotal === match.invoiceTotal ? 'bg-green-500' : match.grnTotal === 0 ? 'bg-gray-300' : 'bg-red-500'}`} />
                        <span className="text-xs text-gray-500">GRN↔Invoice</span>
                      </div>
                      <div className="w-8 h-px bg-gray-200 mx-2" />
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${match.poTotal === match.invoiceTotal ? 'bg-green-500' : 'bg-red-500'}`} />
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
                  <p className="font-mono text-sm">{selectedMatch.vendorInvoiceNo}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Vendor</p>
                <p className="font-medium">{selectedMatch.vendor}</p>
              </div>

              {/* Document Links */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Linked Documents</p>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-sm">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <span className="text-blue-600">{selectedMatch.poNumber}</span>
                  </div>
                  {selectedMatch.grnNumber ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Package className="w-4 h-4 text-emerald-500" />
                      <span className="text-emerald-600">{selectedMatch.grnNumber}</span>
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
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Due Date</p>
                  <p className={`text-sm font-medium ${getDueDaysClass(selectedMatch.dueDate)}`}>
                    {selectedMatch.dueDate}
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
                        <span className="font-medium text-sm">{item.name}</span>
                        <div className="flex gap-1">
                          {!item.qtyMatch && (
                            <span className="px-1.5 py-0.5 bg-red-100 text-red-600 text-xs rounded">Qty</span>
                          )}
                          {!item.priceMatch && (
                            <span className="px-1.5 py-0.5 bg-orange-100 text-orange-600 text-xs rounded">Price</span>
                          )}
                          {item.qtyMatch && item.priceMatch && (
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
                            <td className="text-right">{item.poQty}</td>
                            <td className={`text-right ${item.grnQty !== item.poQty ? 'text-red-600 font-medium' : ''}`}>
                              {item.grnQty}
                            </td>
                            <td className={`text-right ${item.invoiceQty !== item.grnQty ? 'text-red-600 font-medium' : ''}`}>
                              {item.invoiceQty}
                            </td>
                          </tr>
                          <tr>
                            <td className="text-gray-500">Price</td>
                            <td className="text-right">${item.poPrice.toFixed(2)}</td>
                            <td className="text-right">-</td>
                            <td className={`text-right ${item.invoicePrice !== item.poPrice ? 'text-orange-600 font-medium' : ''}`}>
                              ${item.invoicePrice.toFixed(2)}
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
                    <p className="font-medium">${selectedMatch.poTotal.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">GRN Total</p>
                    <p className="font-medium">
                      {selectedMatch.grnTotal === 0 ? '-' : `$${selectedMatch.grnTotal.toLocaleString()}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Invoice Total</p>
                    <p className="font-bold text-lg">${selectedMatch.invoiceTotal.toLocaleString()}</p>
                  </div>
                </div>
                {selectedMatch.variance !== 0 && (
                  <div className={`text-center pt-2 border-t ${selectedMatch.variance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    <span className="text-sm">Variance: </span>
                    <span className="font-bold">
                      {selectedMatch.variance > 0 ? '+' : ''}${selectedMatch.variance.toLocaleString()} ({selectedMatch.variancePercent.toFixed(1)}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Payment Info */}
              {selectedMatch.paymentScheduled && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 text-green-700">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-sm font-medium">Payment Scheduled</span>
                  </div>
                  <p className="text-green-800 font-medium mt-1">{selectedMatch.paymentScheduled}</p>
                </div>
              )}

              {/* Notes */}
              {selectedMatch.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                  <p className="text-sm text-gray-700 bg-yellow-50 border border-yellow-200 p-2 rounded">
                    {selectedMatch.notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 space-y-2">
                {selectedMatch.status === 'Matched' && (
                  <button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                  >
                    <ThumbsUp className="w-4 h-4" />
                    Approve for Payment
                  </button>
                )}
                {(selectedMatch.status === 'Mismatch' || selectedMatch.status === 'Flagged') && (
                  <>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700">
                      <Eye className="w-4 h-4" />
                      Review Discrepancies
                    </button>
                    <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-orange-300 text-orange-600 rounded-lg hover:bg-orange-50">
                      <Flag className="w-4 h-4" />
                      Flag for Follow-up
                    </button>
                  </>
                )}
                {selectedMatch.status === 'Pending' && !selectedMatch.grnNumber && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                    <Link2 className="w-4 h-4" />
                    Link GRN
                  </button>
                )}
                {selectedMatch.status === 'Approved' && (
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    <CreditCard className="w-4 h-4" />
                    Schedule Payment
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
                  <span className="font-medium">{selectedMatch.vendor}</span>
                </div>
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-gray-600">Amount</span>
                  <span className="text-xl font-bold">${selectedMatch.invoiceTotal.toLocaleString()}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date</label>
                <input
                  type="date"
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
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                <ArrowRight className="w-4 h-4" />
                Approve & Schedule
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
