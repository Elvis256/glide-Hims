import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import api from '../../services/api';

interface ReconciliationStatus {
  accountId: string;
  accountCode: string;
  accountName: string;
  totalAmount: number;
  reconciledAmount: number;
  unmatchedAmount: number;
  percentageReconciled: number;
  lastReconciledAt?: Date;
}

interface ReconciliationStatusWidgetProps {
  fiscalPeriodId: string;
}

export default function ReconciliationStatusWidget({
  fiscalPeriodId,
}: ReconciliationStatusWidgetProps) {
  const [reconciliationStatus, setReconciliationStatus] = useState<ReconciliationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [overallProgress, setOverallProgress] = useState(0);

  useEffect(() => {
    loadReconciliationStatus();
  }, [fiscalPeriodId]);

  const loadReconciliationStatus = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/finance/trial-balance/reconciliation`, {
        params: { fiscalPeriodId },
      });

      const statuses = response.data.data;
      setReconciliationStatus(statuses);

      if (statuses.length > 0) {
        const avgProgress =
          statuses.reduce((sum: number, status: any) => sum + status.percentageReconciled, 0) /
          statuses.length;
        setOverallProgress(Math.round(avgProgress));
      }
    } catch (err: any) {
      setError('Failed to load reconciliation status');
      console.error('Error loading reconciliation status:', err);
    } finally {
      setLoading(false);
    }
  };

  const pendingAccounts = reconciliationStatus.filter((status) => status.percentageReconciled < 100);
  const reconciledAccounts = reconciliationStatus.filter(
    (status) => status.percentageReconciled === 100
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="bg-gray-50 border-b px-6 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Reconciliation Status</h3>
          <p className="text-sm text-gray-600 mt-1">
            Account reconciliation progress for this period
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-blue-600">{overallProgress}%</p>
          <p className="text-sm text-gray-600">Complete</p>
        </div>
      </div>

      <div className="p-6 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="font-medium text-sm">Overall Progress</p>
            <p className="text-sm text-gray-600">
              {reconciledAccounts.length} of {reconciliationStatus.length} accounts reconciled
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Reconciled</p>
                <p className="text-2xl font-bold text-green-600">{reconciledAccounts.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <div>
                <p className="text-sm text-gray-600">Pending</p>
                <p className="text-2xl font-bold text-yellow-600">{pendingAccounts.length}</p>
              </div>
            </div>
          </div>
        </div>

        {reconciledAccounts.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-3 text-green-700">Reconciled Accounts</h4>
            <div className="space-y-2">
              {reconciledAccounts.slice(0, 5).map((account) => (
                <div
                  key={account.accountId}
                  className="flex items-center justify-between p-2 bg-green-50 rounded text-sm"
                >
                  <div>
                    <p className="font-mono font-medium">{account.accountCode}</p>
                    <p className="text-xs text-gray-600">{account.accountName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    <span className="text-green-600 font-medium">100%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {pendingAccounts.length > 0 && (
          <div>
            <h4 className="font-medium text-sm mb-3 text-yellow-700">Pending Reconciliation</h4>
            <div className="space-y-3">
              {pendingAccounts.slice(0, 5).map((account) => (
                <div key={account.accountId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-mono font-medium">{account.accountCode}</p>
                      <p className="text-xs text-gray-600">{account.accountName}</p>
                    </div>
                    <span className="text-xs font-medium text-gray-600">
                      {account.percentageReconciled}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-yellow-500 h-full transition-all"
                      style={{ width: `${account.percentageReconciled}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border border-gray-300 border-t-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Loading...</p>
          </div>
        )}
      </div>
    </div>
  );
}
