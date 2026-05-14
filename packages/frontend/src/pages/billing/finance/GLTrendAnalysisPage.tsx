import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';
import api from '../../../services/api';
import { toCsv, downloadBlob } from '../../reports/_reportUtils';

interface TrendLine {
  period: string;
  periodId: string;
  debitAmount: number;
  creditAmount: number;
  netAmount: number;
  balance: number;
}

interface AccountTrend {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  trends: TrendLine[];
  minBalance: number;
  maxBalance: number;
  averageBalance: number;
  changePercent: number;
}

interface ChartPoint {
  period: string;
  balance: number;
}

const GLTrendAnalysisPage: React.FC = () => {
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [startPeriod, setStartPeriod] = useState<string>('2024-01');
  const [endPeriod, setEndPeriod] = useState<string>('2024-12');
  const [chartData, setChartData] = useState<ChartPoint[]>([]);

  const { data: trendData, isLoading } = useQuery({
    queryKey: ['gl-trends', selectedAccount, startPeriod, endPeriod],
    queryFn: async () => {
      if (!selectedAccount) return null;
      const response = await api.get(
        `/finance/analytics/account-trends/${selectedAccount}`,
        {
          params: { startPeriod, endPeriod },
        },
      );
      return response.data.data as AccountTrend;
    },
    enabled: !!selectedAccount,
  });

  useEffect(() => {
    if (trendData) {
      setChartData(
        trendData.trends.map((t) => ({
          period: t.period,
          balance: t.balance,
        })),
      );
    }
  }, [trendData]);

  const handleExport = () => {
    if (!trendData) return;
    const rows: Array<Array<unknown>> = [
      ['GL Trend Analysis'],
      ['Account', `${trendData.accountCode} – ${trendData.accountName}`],
      ['Generated', new Date().toLocaleString()],
      [],
      ['Period', 'Debit', 'Credit', 'Net', 'Balance'],
      ...trendData.trends.map((t) => [
        t.period,
        t.debitAmount.toFixed(2),
        t.creditAmount.toFixed(2),
        t.netAmount.toFixed(2),
        t.balance.toFixed(2),
      ]),
    ];
    downloadBlob(
      `trend-${trendData.accountCode}-${Date.now()}.csv`,
      'text/csv;charset=utf-8',
      '\ufeff' + toCsv(rows),
    );
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">GL Trend Analysis</h1>
          <p className="text-gray-600 mt-2">
            Multi-period trend analysis and account balance progression
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Code
              </label>
              <input
                type="text"
                placeholder="Enter account code or ID"
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Period
              </label>
              <input
                type="month"
                value={startPeriod}
                onChange={(e) => setStartPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Period
              </label>
              <input
                type="month"
                value={endPeriod}
                onChange={(e) => setEndPeriod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={!trendData || isLoading}
            className="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Summary Stats */}
        {trendData && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Account</p>
              <p className="text-lg font-semibold text-gray-900">
                {trendData.accountCode}
              </p>
              <p className="text-xs text-gray-500 mt-1">{trendData.accountName}</p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Current Balance</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(
                  trendData.trends[trendData.trends.length - 1]?.balance || 0,
                )}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Avg Balance</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatCurrency(trendData.averageBalance)}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-4">
              <p className="text-sm text-gray-600">Change</p>
              <div className="flex items-center mt-1">
                {trendData.changePercent > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-500 mr-2" />
                )}
                <p
                  className={`text-lg font-semibold ${
                    trendData.changePercent > 0
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {trendData.changePercent > 0 ? '+' : ''}
                  {trendData.changePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Simple Text-Based Trend Table */}
        {trendData && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Period
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Debits
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Credits
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Net
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Balance
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                          Loading trends...
                        </div>
                      </td>
                    </tr>
                  ) : trendData.trends.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-4 text-center text-gray-500"
                      >
                        No trend data available
                      </td>
                    </tr>
                  ) : (
                    trendData.trends.map((trend, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {trend.period}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {formatCurrency(trend.debitAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {formatCurrency(trend.creditAmount)}
                        </td>
                        <td
                          className={`px-6 py-4 text-sm text-right font-medium ${
                            trend.netAmount > 0
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {formatCurrency(trend.netAmount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                          {formatCurrency(trend.balance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedAccount && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              Enter an account code to view trend analysis
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GLTrendAnalysisPage;
