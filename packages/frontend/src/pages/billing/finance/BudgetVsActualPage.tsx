import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';
import api from '../../../services/api';
import { toCsv, downloadBlob } from '../../reports/_reportUtils';

interface BudgetVarianceItem {
  accountId: string;
  accountCode: string;
  accountName: string;
  budgetedAmount: number;
  actualAmount: number;
  absoluteVariance: number;
  percentVariance: number;
  status: 'under' | 'over' | 'on-target';
  severity: 'low' | 'medium' | 'high';
}

interface BudgetVarianceSummary {
  period: string;
  totalBudget: number;
  totalActual: number;
  totalVariance: number;
  percentVariance: number;
  itemCount: number;
  underBudgetCount: number;
  overBudgetCount: number;
  onTargetCount: number;
}

interface CostCenterBudgetAnalysis {
  costCenterId: string;
  costCenterName: string;
  budgetedAmount: number;
  actualAmount: number;
  variance: number;
  percentVariance: number;
  remainingBudget: number;
  burnRate: number;
}

const BudgetVsActualPage: React.FC = () => {
  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7),
  );
  const [filterType, setFilterType] = useState<'all' | 'over' | 'under'>(
    'all',
  );

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['budget-variance-summary', period],
    queryFn: async () => {
      const response = await api.get(`/finance/budget-variance/${period}`);
      return response.data.data as BudgetVarianceSummary;
    },
  });

  const { data: variances, isLoading: variancesLoading } = useQuery({
    queryKey: ['budget-variances', period],
    queryFn: async () => {
      const response = await api.get(`/finance/budget-variance/detailed/${period}`);
      return response.data.data as BudgetVarianceItem[];
    },
  });

  const { data: ccBreakdown } = useQuery({
    queryKey: ['budget-by-cc', period],
    queryFn: async () => {
      const response = await api.get(
        `/finance/budget-variance/by-cost-center/${period}`,
      );
      return response.data.data as CostCenterBudgetAnalysis[];
    },
  });

  const filteredVariances = variances?.filter((v) => {
    if (filterType === 'all') return true;
    return v.status === filterType;
  }) || [];

  const handleExport = () => {
    if (!variances) return;

    const rows: Array<Array<unknown>> = [
      ['Budget vs Actual'],
      ['Period', period],
      ['Generated', new Date().toLocaleString()],
      [],
      [
        'Account Code',
        'Account Name',
        'Budgeted',
        'Actual',
        'Variance',
        'Variance %',
        'Status',
        'Severity',
      ],
      ...variances.map((v) => [
        v.accountCode,
        v.accountName,
        v.budgetedAmount.toFixed(2),
        v.actualAmount.toFixed(2),
        v.absoluteVariance.toFixed(2),
        v.percentVariance.toFixed(2),
        v.status,
        v.severity,
      ]),
    ];
    downloadBlob(
      `budget-variance-${period}-${Date.now()}.csv`,
      'text/csv;charset=utf-8',
      '\ufeff' + toCsv(rows),
    );
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-green-100 text-green-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'over':
        return 'text-red-600';
      case 'under':
        return 'text-green-600';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Budget vs Actual Analysis
            </h1>
            <p className="text-gray-600 mt-2">
              Variance analysis showing budget vs actual spending
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={handleExport}
              disabled={!variances || variancesLoading}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Total Budget</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(summary.totalBudget)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {summary.itemCount} accounts
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Total Actual</p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(summary.totalActual)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {((summary.totalActual / summary.totalBudget) * 100).toFixed(1)}% of
                budget
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <p className="text-sm text-gray-600">Total Variance</p>
              <p
                className={`text-2xl font-bold mt-2 ${
                  summary.totalVariance > 0
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {formatCurrency(summary.totalVariance)}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                {summary.totalVariance > 0 ? 'Under' : 'Over'} budget
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-green-600 font-semibold">
                    Under Budget
                  </p>
                  <p className="text-lg font-bold text-green-600 mt-1">
                    {summary.underBudgetCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-600 font-semibold">
                    On Target
                  </p>
                  <p className="text-lg font-bold text-gray-600 mt-1">
                    {summary.onTargetCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-red-600 font-semibold">
                    Over Budget
                  </p>
                  <p className="text-lg font-bold text-red-600 mt-1">
                    {summary.overBudgetCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterType === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            All Accounts ({variances?.length || 0})
          </button>
          <button
            onClick={() => setFilterType('over')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterType === 'over'
                ? 'bg-red-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Over Budget ({summary?.overBudgetCount || 0})
          </button>
          <button
            onClick={() => setFilterType('under')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              filterType === 'under'
                ? 'bg-green-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300'
            }`}
          >
            Under Budget ({summary?.underBudgetCount || 0})
          </button>
        </div>

        {/* Variance Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Account
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Budget
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Actual
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    Variance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                    %
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Severity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {variancesLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center">
                      <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                    </td>
                  </tr>
                ) : filteredVariances.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No variances found
                    </td>
                  </tr>
                ) : (
                  filteredVariances.map((v) => (
                    <tr key={v.accountId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {v.accountCode}
                          </p>
                          <p className="text-xs text-gray-500">
                            {v.accountName}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {formatCurrency(v.budgetedAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {formatCurrency(v.actualAmount)}
                      </td>
                      <td
                        className={`px-6 py-4 text-sm text-right font-medium ${getStatusColor(
                          v.status,
                        )}`}
                      >
                        {formatCurrency(v.absoluteVariance)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right text-gray-600">
                        {v.percentVariance > 0 ? '+' : ''}
                        {v.percentVariance.toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold ${getSeverityColor(
                            v.severity,
                          )}`}
                        >
                          {v.severity}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cost Center Breakdown */}
        {ccBreakdown && ccBreakdown.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Budget by Cost Center
              </h2>
            </div>
            <div className="grid grid-cols-1 gap-4 p-6">
              {ccBreakdown.map((cc) => (
                <div
                  key={cc.costCenterId}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {cc.costCenterName}
                      </p>
                      <p className="text-xs text-gray-500">
                        Burn rate: {cc.burnRate.toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatCurrency(cc.remainingBudget)} remaining
                      </p>
                    </div>
                  </div>

                  {/* Simple progress bar */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        cc.burnRate > 100
                          ? 'bg-red-500'
                          : cc.burnRate > 80
                            ? 'bg-yellow-500'
                            : 'bg-green-500'
                      }`}
                      style={{
                        width: `${Math.min(cc.burnRate, 100)}%`,
                      }}
                    />
                  </div>

                  <div className="flex justify-between mt-3 text-xs text-gray-600">
                    <span>
                      Budget: {formatCurrency(cc.budgetedAmount)}
                    </span>
                    <span>
                      Spent: {formatCurrency(cc.actualAmount)}
                    </span>
                    <span>
                      Variance: {formatCurrency(cc.variance)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BudgetVsActualPage;
