import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ClipboardCheck,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  MessageSquare,
  User,
  Building2,
  DollarSign,
  Calendar,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  History,
  ThumbsUp,
  ThumbsDown,
  Scale,
  Loader2,
} from 'lucide-react';
import { rfqService, type QuotationApproval, type ApprovalLevel as ApprovalLevelType } from '../../../services/rfq';
import { useAuthStore } from '../../../store/auth';

type ApprovalStatus = 'pending' | 'approved' | 'rejected';
type ApprovalLevel = 'manager' | 'finance' | 'director';

const levelConfig: Record<ApprovalLevel, { order: number; icon: React.ReactNode; label: string }> = {
  manager: { order: 1, icon: <User className="w-4 h-4" />, label: 'Manager' },
  finance: { order: 2, icon: <DollarSign className="w-4 h-4" />, label: 'Finance' },
  director: { order: 3, icon: <Building2 className="w-4 h-4" />, label: 'Director' },
};

const priorityConfig: Record<string, { color: string; bg: string }> = {
  Normal: { color: 'text-gray-600', bg: 'bg-gray-100' },
  High: { color: 'text-orange-600', bg: 'bg-orange-100' },
  Urgent: { color: 'text-red-600', bg: 'bg-red-100' },
};

// Extended type for UI display
interface ExtendedQuotationApproval extends QuotationApproval {
  title?: string;
  selectedVendor?: string;
  totalAmount?: number;
  originalBudget?: number;
  approvalHistory?: { level: string; status: string; approvedBy?: string; approvedAt?: string; date?: string; approver?: { fullName: string }; comments?: string }[];
  currentLevel?: string;
  items?: any[];
  comparisonSummary?: { vendorsCompared: number; savings: number; deliveryDays: number; paymentTerms: string };
  quotation?: { quotationNumber?: string; supplier?: { name: string }; rfq?: { title: string } };
  rfqNumber?: string;
  priority?: string;
  department?: string;
  requester?: string;
  submittedDate?: string;
}

export default function ApproveQuotationsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const facilityId = user?.facilityId || '';

  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<ApprovalLevel | 'all'>('all');
  const [selectedApproval, setSelectedApproval] = useState<ExtendedQuotationApproval | null>(null);
  const [showActionModal, setShowActionModal] = useState<'approve' | 'reject' | null>(null);
  const [comments, setComments] = useState('');

  // Fetch pending approvals
  const { data: pendingApprovals = [], isLoading } = useQuery({
    queryKey: ['pending-approvals', facilityId, levelFilter],
    queryFn: () => rfqService.approvals.getPending(facilityId, levelFilter === 'all' ? undefined : levelFilter as ApprovalLevelType),
    enabled: !!facilityId,
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments?: string }) => rfqService.approvals.approve(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setShowActionModal(null);
      setSelectedApproval(null);
      setComments('');
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ id, comments }: { id: string; comments: string }) => rfqService.approvals.reject(id, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-approvals'] });
      setShowActionModal(null);
      setSelectedApproval(null);
      setComments('');
    },
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

  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);

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
              {(['all', 'manager', 'finance', 'director'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setLevelFilter(level)}
                  className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    levelFilter === level
                      ? 'bg-teal-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {level.charAt(0).toUpperCase() + level.slice(1)}
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
              const isOverBudget = (approval.totalAmount || 0) > (approval.originalBudget || 0);
              
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
                          <span className="font-mono text-sm text-gray-500">{approval.rfqNumber}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${priorityConfig[approval.priority || 'Normal']?.bg || 'bg-gray-100'} ${priorityConfig[approval.priority || 'Normal']?.color || 'text-gray-600'}`}
                          >
                            {approval.priority || 'Normal'}
                          </span>
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-700">
                            <Clock className="w-3 h-3" />
                            {approval.currentLevel} Review
                          </span>
                          {isOverBudget && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600">
                              <AlertTriangle className="w-3 h-3" />
                              Over Budget
                            </span>
                          )}
                        </div>
                        <h3 className="font-medium text-gray-900 mb-1">{approval.title}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5" />
                            {approval.department}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {approval.requester}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {approval.submittedDate}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-gray-900">
                          ${(approval.totalAmount || 0).toLocaleString()}
                        </div>
                        <p className="text-xs text-gray-500">
                          Budget: ${(approval.originalBudget || 0).toLocaleString()}
                        </p>
                        <p className="text-xs font-medium text-teal-600 mt-1">
                          {approval.selectedVendor || 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Comparison Summary */}
                    <div className="mt-3 pt-3 border-t grid grid-cols-4 gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <Scale className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {approval.comparisonSummary?.vendorsCompared || 0} vendors compared
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-green-500" />
                        <span className="text-green-600">
                          ${approval.comparisonSummary?.savings || 0} savings
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">
                          {approval.comparisonSummary?.deliveryDays || 0} days delivery
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-600">
                          {approval.comparisonSummary?.paymentTerms || 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* Approval History Accordion */}
                    {(approval.approvalHistory?.length || 0) > 0 && (
                      <div className="mt-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedHistory(expandedHistory === approval.id ? null : approval.id);
                          }}
                          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                        >
                          {expandedHistory === approval.id ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                          <History className="w-4 h-4" />
                          Approval History ({(approval as ExtendedQuotationApproval).approvalHistory?.length || 0})
                        </button>
                        {expandedHistory === approval.id && (
                          <div className="mt-2 pl-5 space-y-2">
                            {((approval as ExtendedQuotationApproval).approvalHistory || []).map((record: any, idx: number) => (
                              <div key={idx} className="flex items-start gap-3 text-sm">
                                <div
                                  className={`p-1 rounded-full ${
                                    record.status === 'Approved'
                                      ? 'bg-green-100 text-green-600'
                                      : 'bg-red-100 text-red-600'
                                  }`}
                                >
                                  {record.status === 'Approved' ? (
                                    <CheckCircle className="w-3 h-3" />
                                  ) : (
                                    <XCircle className="w-3 h-3" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-gray-900">
                                    <span className="font-medium">{record.approver?.fullName || record.approvedBy || 'Unknown'}</span>
                                    <span className="text-gray-500"> ({record.level})</span>
                                  </p>
                                  {record.comments && (
                                    <p className="text-gray-500 text-xs">{record.comments}</p>
                                  )}
                                  <p className="text-gray-400 text-xs">{record.date || record.approvedAt}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                <p className="font-medium text-lg text-teal-600">{selectedApproval.selectedVendor}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Amount</p>
                  <p className="font-bold text-xl">${(selectedApproval.totalAmount || 0).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Budget</p>
                  <p className="font-medium">${(selectedApproval.originalBudget || 0).toLocaleString()}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2">
                  {(selectedApproval.items || []).map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                      <span>{item.name}</span>
                      <span className="text-gray-600">
                        {item.quantity} × ${item.unitPrice}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Approval Workflow</p>
                <div className="space-y-2">
                  {(['manager', 'finance', 'director'] as ApprovalLevel[]).map((level) => {
                    const record = selectedApproval.approvalHistory?.find((r: any) => r.level === level);
                    const isCurrent = selectedApproval.currentLevel === level;
                    const isPending = !record && !isCurrent;
                    
                    return (
                      <div
                        key={level}
                        className={`flex items-center gap-3 p-2 rounded ${
                          isCurrent ? 'bg-teal-50 border border-teal-200' : ''
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-full ${
                            record?.status === 'Approved'
                              ? 'bg-green-100 text-green-600'
                              : record?.status === 'Rejected'
                                ? 'bg-red-100 text-red-600'
                                : isCurrent
                                  ? 'bg-teal-100 text-teal-600'
                                  : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {levelConfig[level].icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-sm">{level}</p>
                          {record && (
                            <p className="text-xs text-gray-500">{record.approver?.fullName || record.approvedBy || ''}</p>
                          )}
                        </div>
                        {record?.status === 'Approved' && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                        {record?.status === 'Rejected' && (
                          <XCircle className="w-5 h-5 text-red-500" />
                        )}
                        {isCurrent && (
                          <span className="text-xs text-teal-600 font-medium">Current</span>
                        )}
                        {isPending && (
                          <span className="text-xs text-gray-400">Pending</span>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                  <p className="font-medium">{selectedApproval.title}</p>
                  <p className="text-sm text-gray-500">{selectedApproval.selectedVendor}</p>
                  <p className="text-lg font-bold mt-1">
                    ${(selectedApproval.totalAmount || 0).toLocaleString()}
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
