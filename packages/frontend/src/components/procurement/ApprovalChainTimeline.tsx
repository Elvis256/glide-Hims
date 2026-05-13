import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, Loader2, Users, XCircle } from 'lucide-react';
import {
  ResolvedApprovalChainRow,
  getPurchaseOrderApprovalChain,
  getPurchaseRequestApprovalChain,
} from '../../services/orgApproval';

interface Props {
  documentId: string;
  documentType: 'PR' | 'PO';
}

const STATUS_STYLES: Record<ResolvedApprovalChainRow['status'], { icon: any; classes: string; label: string }> = {
  pending: { icon: Clock, classes: 'bg-amber-100 text-amber-800', label: 'Pending' },
  approved: { icon: CheckCircle2, classes: 'bg-green-100 text-green-800', label: 'Approved' },
  rejected: { icon: XCircle, classes: 'bg-red-100 text-red-800', label: 'Rejected' },
};

export function ApprovalChainTimeline({ documentId, documentType }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['approval-chain', documentType, documentId],
    queryFn: async () =>
      documentType === 'PO'
        ? getPurchaseOrderApprovalChain(documentId)
        : getPurchaseRequestApprovalChain(documentId),
    enabled: !!documentId,
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 py-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading approval chain…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-sm text-red-700 py-2">Failed to load approval chain.</div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-sm text-gray-600 py-2">
        No approval chain has been created yet.
      </div>
    );
  }

  return (
    <ol className="space-y-3">
      {data.map((row) => {
        const style = STATUS_STYLES[row.status];
        const Icon = style.icon;
        return (
          <li key={row.id} className="flex items-start gap-3">
            <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 text-gray-800 text-sm font-semibold flex-shrink-0">
              {row.approvalLevel}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-gray-900">
                  {row.groupId ? (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-4 w-4 text-blue-700" /> {row.groupName || 'Group'}
                    </span>
                  ) : (
                    row.approverName || (
                      <span className="italic text-gray-600">
                        Any user with role &ldquo;{row.requiredRole}&rdquo;
                      </span>
                    )
                  )}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${style.classes}`}
                >
                  <Icon className="h-3 w-3" />
                  {style.label}
                </span>
              </div>
              <div className="text-xs text-gray-600 capitalize mt-0.5">{row.requiredRole}</div>
              {row.status !== 'pending' && (
                <div className="text-xs text-gray-700 mt-1">
                  {row.approvedByName ? `By ${row.approvedByName}` : ''}
                  {row.approvedAt && (
                    <span className="text-gray-500">
                      {' '}
                      · {new Date(row.approvedAt).toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              {row.comments && (
                <div className="text-xs text-gray-700 mt-1 italic">&ldquo;{row.comments}&rdquo;</div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default ApprovalChainTimeline;
