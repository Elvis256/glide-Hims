import React, { useState, useMemo } from 'react';
import { getApiErrorMessage } from '../../../services/api';
import { toast } from 'sonner';
import { useDialogA11y } from '../../../hooks/useDialogA11y';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  User,
  Building2,
  DollarSign,
  Calendar,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import { rfqService, type QuotationApproval, type ApprovalLevel as ApprovalLevelType } from '../../../services/rfq';
import { useAuthStore } from '../../../store/auth';
import { formatCurrency } from '../../../lib/currency';

const formatDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '—');

/** quotation_approvals.level is the ApprovalLevel enum — the API filters on
 *  these exact values, so the UI must speak them rather than role nicknames. */
const levelConfig: Record<ApprovalLevelType, { order: number; icon: React.ReactNode; label: string }> = {
  approval_1: { order: 1, icon: <User className="w-4 h-4" />, label: 'Level 1' },
  approval_2: { order: 2, icon: <DollarSign className="w-4 h-4" />, label: 'Level 2' },
  approval_3: { order: 3, icon: <Building2 className="w-4 h-4" />, label: 'Level 3' },
};

const APPROVAL_LEVELS: ApprovalLevelType[] = ['approval_1', 'approval_2', 'approval_3'];

/** vendor_quotation_items — pricing only; decimals arrive as strings. */
interface QuotationLine {
  id: string;
  rfqItemId: string;
  unitPrice: number | string;
  totalPrice: number | string;
  deliveryDays?: number;
  inStock?: boolean;
  notes?: string;
}

/** rfq_items — carries what was actually asked for. */
interface RfqLine {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  unit: string;
  specifications?: string;
}

/**
 * What GET /rfq/approvals/pending actually returns: the approval row plus
 * quotation → supplier, quotation → rfq → rfq.items, and quotation.items.
 * Everything shown must come from here — the approval row itself carries no
 * amount, priority, budget or requester.
 */
interface ExtendedQuotationApproval extends QuotationApproval {
  quotation?: {
    quotationNumber?: string;
    totalAmount?: number | string;
    deliveryDays?: number;
    paymentTerms?: string;
    validUntil?: string;
    receivedDate?: string;
    supplier?: { name: string };
    items?: QuotationLine[];
    rfq?: { rfqNumber?: string; title?: string; deadline?: string; items?: RfqLine[] };
  };
}


export default function ApproveQuotationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<ApprovalLevelType | 'all'>('all');
  const [selectedApproval, setSelectedApproval] = useState<ExtendedQuotationApproval | null>(null);
  const [showActionModal, setShowActionModal] = useState<'approve' | 'reject' | null>(null);
  const [comments, setComments] = useState('');

  // Escape closes these, Tab stays within them, and focus returns to
  // whatever opened them.
  const showActionModalDialogRef = useDialogA11y<HTMLDivElement>({
    open: !!showActionModal,
    onClose: () => setShowActionModal(null),
  });

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading } = useQuery({
    queryKey: ['pending-approvals', facilityId, levelFilter],
    queryFn: () => rfqService.approvals.getPending(facilityId, levelFilter === 'all' ? undefined : levelFilter),
    enabled: !!facilityId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) => rfqService.approvals.approve(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success('Quotation approved');
      setShowActionModal(null);
      setSelectedApproval(null);
      setComments('');
    },
    // Quotation approval refuses when the approver is not next in the chain,
    // or has already acted. Without this the modal just closed as though it
    // had worked.
    onError: (err: any) =>
      toast.error(getApiErrorMessage(err, 'Failed to approve quotation')),
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) => rfqService.approvals.reject(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      toast.success('Quotation rejected');
      setShowActionModal(null);
      setSelectedApproval(null);
      setComments('');
    },
    onError: (err: any) =>
      toast.error(getApiErrorMessage(err, 'Failed to reject quotation')),
  });

  const filteredApprovals = useMemo(() => {
    return (pendingApprovals as ExtendedQuotationApproval[]).filter((approval) => {
      const matchesSearch =
        (approval.quotation?.quotationNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (approval.quotation?.supplier?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (approval.quotation?.rfq?.title || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [pendingApprovals, searchTerm]);

  const handleAction = (action: 'approve' | 'reject') => {
    setShowActionModal(action);
  };

  const submitAction = () => {
    if (!selectedApproval) return;
    if (showActionModal === 'approve') {
      approveMutation.mutate({ id: selectedApproval.id, comments });
    } else if (showActionModal === 'reject') {
      rejectMutation.mutate({ id: selectedApproval.id, comments });
    }
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-100 rounded-lg">
              <ClipboardCheck className="w-6 h-6 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Approve Quotations</h1>
              <p className="text-sm text-gray-500">Review and approve vendor quotations</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-500">Pending:</span>
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                {filteredApprovals.length}
              </span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search approvals..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <div className="flex gap-1">
              {(['all', ...APPROVAL_LEVELS] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    levelFilter === level
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level === 'all' ? 'All' : levelConfig[level].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Approval List */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredApprovals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <ClipboardCheck className="w-16 h-16 mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Pending Approvals</h3>
              <p className="text-sm text-gray-500">Quotations awaiting approval will appear here</p>
            </div>
          ) : (
          <div className="space-y-4">
            {filteredApprovals.map((approval) => {
              const quote = approval.quotation;
              return (
                <div
                  key={approval.id}
                  className={`bg-white rounded-lg border overflow-hidden ${
                    selectedApproval?.id === approval.id ? 'ring-2 ring-teal-500' : ''
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedApproval(approval)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="font-mono text-sm text-gray-500">{quote?.rfq?.rfqNumber}</span>
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                            <Clock className="w-3 h-3" />
                            {levelConfig[approval.level]?.label || approval.level} Review
                          </span>
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">{quote?.rfq?.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {quote?.quotationNumber}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {formatDate(quote?.receivedDate)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          {formatCurrency(Number(quote?.totalAmount ?? 0))}
                        </div>
                        <p className="text-xs font-medium text-teal-600 mt-1">
                          {quote?.supplier?.name || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {quote?.deliveryDays ?? 0} days delivery
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">{quote?.paymentTerms || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">Valid to {formatDate(quote?.validUntil)}</span>
                      </div>
                    </div>

                  </div>

                  {/* Action Buttons */}
                  {selectedApproval?.id === approval.id && (
                    <div className="px-4 py-3 bg-gray-50 border-t flex items-center justify-between">
                      <button className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800">
                        <Eye className="w-4 h-4" />
                        View Full Details
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAction('reject')}
                          className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleAction('approve')}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          Approve
                        </button>
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
        {selectedApproval && (
          <div className="w-96 border-l bg-white overflow-y-auto flex-shrink-0">
            <div className="p-4 border-b bg-gray-50">
              <h2 className="font-semibold text-gray-900">Quotation Details</h2>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Selected Vendor</p>
                <p className="font-medium text-lg text-teal-600">
                  {selectedApproval.quotation?.supplier?.name || '—'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Amount</p>
                  <p className="font-bold text-xl">
                    {formatCurrency(Number(selectedApproval.quotation?.totalAmount ?? 0))}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Quotation No.</p>
                  <p className="font-medium">{selectedApproval.quotation?.quotationNumber || '—'}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2">
                  {(() => {
                    const quotationItems = selectedApproval.quotation?.items || [];
                    const rfqItems = selectedApproval.quotation?.rfq?.items || [];
                    if (quotationItems.length === 0) {
                      return (
                        <p className="text-sm italic text-gray-400">No items.</p>
                      );
                    }
                    return quotationItems.map((item, idx) => {
                      const rfqItem = rfqItems.find((ri) => ri.id === item.rfqItemId);
                      const name = rfqItem?.itemName || rfqItem?.itemCode || '—';
                      const qty = Number(rfqItem?.quantity ?? 0);
                      const unit = rfqItem?.unit || '';
                      const unitPrice = Number(item.unitPrice ?? 0);
                      const lineTotal = Number(item.totalPrice ?? qty * unitPrice);
                      return (
                        <div
                          key={item.id || idx}
                          className="flex justify-between text-sm bg-gray-50 p-2 rounded"
                        >
                          <span>{name}</span>
                          <span className="text-gray-600 tabular-nums">
                            {qty} {unit} × {formatCurrency(unitPrice)} ={' '}
                            <strong>{formatCurrency(lineTotal)}</strong>
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Approval Workflow</p>
                <div className="space-y-2">
                  {APPROVAL_LEVELS.map((level) => {
                    const isCurrent = selectedApproval.level === level;
                    return (
                      <div
                        key={level}
                        className={`flex items-center gap-3 p-2 rounded ${
                          isCurrent ? 'bg-teal-50 border border-teal-200' : ''
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-full ${
                            isCurrent ? 'bg-teal-100 text-teal-600' : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {levelConfig[level].icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{levelConfig[level].label}</p>
                        </div>
                        {isCurrent && (
                          <span className="text-xs text-teal-600 font-medium">Awaiting this level</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Modal */}
      {showActionModal && selectedApproval && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          role="dialog"
          aria-modal="true"
          ref={showActionModalDialogRef}
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h2 className="text-lg font-semibold">
                {showActionModal === 'approve' ? 'Approve Quotation' : 'Reject Quotation'}
              </h2>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  {showActionModal === 'approve'
                    ? 'You are about to approve this quotation for:'
                    : 'You are about to reject this quotation for:'}
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="font-medium">{selectedApproval.quotation?.rfq?.title}</p>
                  <p className="text-sm text-gray-500">{selectedApproval.quotation?.supplier?.name}</p>
                  <p className="text-lg font-bold mt-1">
                    {formatCurrency(Number(selectedApproval.quotation?.totalAmount ?? 0))}
                  </p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Comments {showActionModal === 'reject' && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                  rows={3}
                  placeholder={
                    showActionModal === 'approve'
                      ? 'Optional comments...'
                      : 'Please provide a reason for rejection...'
                  }
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowActionModal(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={submitAction}
                disabled={showActionModal === 'reject' && !comments.trim()}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                  showActionModal === 'approve'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } ${showActionModal === 'reject' && !comments.trim() ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {showActionModal === 'approve' ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirm Approval
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
