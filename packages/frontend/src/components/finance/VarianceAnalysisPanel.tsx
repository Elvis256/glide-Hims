import React, { useState, useEffect } from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import api from '../../services/api';

const formatPercent = (value: number, decimals: number = 2): string => `${value.toFixed(decimals)}%`;

interface VarianceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  expectedAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  isSignificant: boolean;
}

interface VarianceAnalysisPanelProps {
  fiscalPeriodId: string;
}

export default function VarianceAnalysisPanel({
  fiscalPeriodId,
}: VarianceAnalysisPanelProps) {
  const [variances, setVariances] = useState<VarianceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filterSignificant, setFilterSignificant] = useState(true);

  useEffect(() => {
    loadVariances();
  }, [fiscalPeriodId]);

  const loadVariances = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await api.get(`/finance/trial-balance/variances`, {
        params: { fiscalPeriodId },
      });

      setVariances(response.data.data || []);
    } catch (err: any) {
      setError('Failed to load variance analysis');
      console.error('Error loading variances:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredVariances = filterSignificant
    ? variances.filter((v) => v.isSignificant)
    : variances;

  const totalVariance = filteredVariances.reduce((sum, v) => sum + Math.abs(v.variance), 0);
  const significantCount = variances.filter((v) => v.isSignificant).length;

  const sortedVariances = [...filteredVariances].sort((a, b) =>
    Math.abs(b.variance) - Math.abs(a.variance)
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="bg-gray-50 border-b px-6 py-4 flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold">Variance Analysis</h3>
          <p className="text-sm text-gray-600 mt-1">
            Identify differences between expected and actual GL balances
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-orange-600">{significantCount}</p>
          <p className="text-sm text-gray-600">Significant variances</p>
        </div>
      </div>

      <div className="p-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="significant-only"
            checked={filterSignificant}
            onChange={(e) => setFilterSignificant(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="significant-only" className="text-sm font-medium cursor-pointer">
            Show significant variances only (&gt;5% or &gt;$1,000)
          </label>
        </div>

        {sortedVariances.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900">
                  Total {filterSignificant ? 'Significant ' : ''}Variance: {formatCurrency(totalVariance)}
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  {sortedVariances.length} account{sortedVariances.length !== 1 ? 's' : ''} with variances
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border border-gray-300 border-t-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Loading variance analysis...</p>
          </div>
        ) : sortedVariances.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-2 text-green-600" />
            <p className="font-medium">No {filterSignificant ? 'significant ' : ''}variances found</p>
            <p className="text-sm mt-1">
              {filterSignificant ? 'All accounts within acceptable variance limits.' : 'All accounts match expected balances.'}
            </p>
          </div>
        ) : (
          <div className="border rounded-lg overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">Account</th>
                  <th className="px-4 py-2 text-right font-semibold">Expected</th>
                  <th className="px-4 py-2 text-right font-semibold">Actual</th>
                  <th className="px-4 py-2 text-right font-semibold">Variance</th>
                  <th className="px-4 py-2 text-right font-semibold">Variance %</th>
                  <th className="px-4 py-2 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedVariances.map((variance) => (
                  <tr key={variance.accountId} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div>
                        <p className="font-mono font-medium">{variance.accountCode}</p>
                        <p className="text-xs text-gray-600">{variance.accountName}</p>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatCurrency(variance.expectedAmount)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      {formatCurrency(variance.actualAmount)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <span
                        className={`font-mono font-medium ${
                          variance.variance >= 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {variance.variance >= 0 ? '+' : ''}
                        {formatCurrency(variance.variance)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {variance.variance >= 0 ? (
                          <TrendingUp className="w-4 h-4 text-red-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-green-600" />
                        )}
                        <span
                          className={`font-mono font-medium ${
                            variance.variance >= 0 ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {formatPercent(variance.variancePercent)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      {variance.isSignificant ? (
                        <span className="inline-block px-2 py-1 text-xs bg-red-100 text-red-700 rounded font-medium">
                          <span className="flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            Significant
                          </span>
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded font-medium">
                          Minor
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {sortedVariances.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm text-amber-800">
            <p className="font-medium mb-1">How to interpret variances:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Positive variance: Actual amount exceeds expected</li>
              <li>Negative variance: Actual amount is below expected</li>
              <li>Investigate significant variances (&gt;5% or &gt;$1,000)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
