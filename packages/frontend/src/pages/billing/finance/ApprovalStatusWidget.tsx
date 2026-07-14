import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { api } from '../../../services/api';

interface ApprovalStatus {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

const DEFAULT_APPROVALS: ApprovalStatus = { pending: 0, approved: 0, rejected: 0, total: 0 };

export const ApprovalStatusWidget: React.FC = () => {
  const { data: status = DEFAULT_APPROVALS, isLoading: loading } = useQuery<ApprovalStatus>({
    queryKey: ['finance', 'approval-status'],
    queryFn: async () => {
      const { data } = await api.get('/finance/approvals/status/summary');
      return {
        pending: data?.pendingCount || 0,
        approved: data?.approvedCount || 0,
        rejected: data?.rejectedCount || 0,
        total:
          (data?.pendingCount || 0) +
          (data?.approvedCount || 0) +
          (data?.rejectedCount || 0),
      };
    },
    staleTime: 60_000,
  });

  const pendingPercentage = status.total > 0 ? (status.pending / status.total) * 100 : 0;
  const approvedPercentage = status.total > 0 ? (status.approved / status.total) * 100 : 0;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-lg font-semibold mb-4">Approval Status</h3>
      
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-4 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                Pending
              </span>
              <span className="font-semibold">{status.pending}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${pendingPercentage}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Approved
              </span>
              <span className="font-semibold">{status.approved}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${approvedPercentage}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                Rejected
              </span>
              <span className="font-semibold">{status.rejected}</span>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-200 mt-4">
            <p className="text-sm text-gray-600">
              Total: <span className="font-semibold">{status.total}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
