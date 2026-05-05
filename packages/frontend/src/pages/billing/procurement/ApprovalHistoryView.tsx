import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../services/api';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  MessageSquare,
  User,
  Loader2,
} from 'lucide-react';
import { formatCurrency, CURRENCY_SYMBOL } from '../../../lib/currency';

interface HistoryItem {
  level: number;
  requiredRole: string;
  status: 'pending' | 'approved' | 'rejected';
  approver: { id: string; fullName: string } | null;
  approvedBy: { id: string; fullName: string } | null;
  approvedAt: string | null;
  comments: string | null;
}

interface ApprovalHistoryProps {
  documentId: string;
  documentType: 'PR' | 'PO';
  documentNumber?: string;
}

export default function ApprovalHistoryView({ documentId, documentType, documentNumber }: ApprovalHistoryProps) {
  const [expandedLevels, setExpandedLevels] = useState<number[]>([]);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['approvals:history', documentType, documentId],
    queryFn: async () => {
      const res = await api.get(`/procurement/approvals/history/${documentType}/${documentId}`);
      return res.data.data || [];
    },
    enabled: !!documentId,
    staleTime: 60000,
  });

  const toggleExpanded = (level: number) => {
    setExpandedLevels((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const getRoleLabel = (role: string): string => {
    const labels: Record<string, string> = {
      manager: 'Manager',
      finance_officer: 'Finance Officer',
      director: 'Director',
      cfo: 'CFO',
    };
    return labels[role] || role;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
    };
    return classes[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (date: string | null): string => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      {documentNumber && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">{documentNumber}</h2>
          <p className="text-sm text-gray-600">{documentType} Approval Workflow</p>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-1">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No approval history found</div>
        ) : (
          history.map((item: HistoryItem, index: number) => {
            const isExpanded = expandedLevels.includes(item.level);
            return (
              <div key={item.level}>
                {/* Timeline Item Header */}
                <button
                  onClick={() => toggleExpanded(item.level)}
                  className="w-full px-4 py-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4 flex-1 text-left">
                    {/* Status Icon */}
                    <div className="flex-shrink-0">{getStatusIcon(item.status)}</div>

                    {/* Level & Role */}
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900">Level {item.level}</p>
                      <p className="text-sm text-gray-600">{getRoleLabel(item.requiredRole)}</p>
                    </div>

                    {/* Status Badge */}
                    <div>
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(item.status)}`}
                      >
                        {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Expand/Collapse Icon */}
                  <div className="flex-shrink-0 ml-4">
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-2 ml-6 space-y-3 pb-4">
                    {/* Assigned Approver */}
                    {item.approver && (
                      <div className="flex items-start gap-3 text-sm">
                        <User className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-gray-600">Assigned to</p>
                          <p className="font-semibold text-gray-900">{item.approver.fullName}</p>
                        </div>
                      </div>
                    )}

                    {/* Approved/Rejected By */}
                    {item.approvedBy && (
                      <div className="flex items-start gap-3 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-gray-600">
                            {item.status === 'approved' ? 'Approved by' : 'Rejected by'}
                          </p>
                          <p className="font-semibold text-gray-900">{item.approvedBy.fullName}</p>
                        </div>
                      </div>
                    )}

                    {/* Approved At */}
                    {item.approvedAt && (
                      <div className="flex items-start gap-3 text-sm">
                        <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-gray-600">
                            {item.status === 'approved' ? 'Approved on' : 'Rejected on'}
                          </p>
                          <p className="font-semibold text-gray-900">{formatDate(item.approvedAt)}</p>
                        </div>
                      </div>
                    )}

                    {/* Comments */}
                    {item.comments && (
                      <div className="flex items-start gap-3 text-sm">
                        <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                        <div>
                          <p className="text-gray-600">Comments</p>
                          <p className="font-semibold text-gray-900 mt-1 bg-gray-50 p-2 rounded border border-gray-200">
                            {item.comments}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* No Additional Info */}
                    {!item.approvedBy && !item.comments && (
                      <div className="text-sm text-gray-500 italic">
                        {item.status === 'pending' ? 'Awaiting approval...' : 'No additional information'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
