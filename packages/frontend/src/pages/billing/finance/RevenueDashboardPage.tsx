import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Download,
  RefreshCw,
} from 'lucide-react';
import { formatCurrency } from '../../../lib/currency';
import api from '../../../services/api';

interface RevenueItem {
  code: string;
  description: string;
  amount: number;
}

interface ExpenseItem {
  code: string;
  description: string;
  amount: number;
}

interface RevenueExpenseSummary {
  period: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  revenueItems: RevenueItem[];
  expenseItems: ExpenseItem[];
  revenueCount: number;
  expenseCount: number;
}

interface CostCenterBreakdown {
  costCenterId: string;
  costCenterName: string;
  departmentName?: string;
  totalRevenue: number;
  totalExpense: number;
  netIncome: number;
  percentOfTotal: number;
}

const RevenueDashboardPage: React.FC = () => {
  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7),
  );

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['revenue-expense-summary', period],
    queryFn: async () => {
      const response = await api.get(`/finance/revenue-expense/${period}`);
      return response.data.data as RevenueExpenseSummary;
    },
  });

  const { data: ccBreakdown, isLoading: ccLoading } = useQuery({
    queryKey: ['revenue-by-cc', period],
    queryFn: async () => {
      const response = await api.get(
        `/finance/revenue-expense/by-cost-center/${period}`,
      );
      return response.data.data as CostCenterBreakdown[];
    },
  });

  const handleExport = () => {
    if (!summary) return;

    let csv = 'Revenue & Expense Summary\n';
    csv += `Period,${period}\n`;
    csv += `Total Revenue,${summary.totalRevenue}\n`;
    csv += `Total Expense,${summary.totalExpense}\n`;
    csv += `Net Income,${summary.netIncome}\n\n`;

    csv += 'Revenue Items\n';
    csv += 'Code,Description,Amount\n';
    summary.revenueItems.forEach((item) => {
      csv += `${item.code},"${item.description}",${item.amount}\n`;
    });

    csv += '\nExpense Items\n';
    csv += 'Code,Description,Amount\n';
    summary.expenseItems.forEach((item) => {
      csv += `${item.code},"${item.description}",${item.amount}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-dashboard-${period}-${Date.now()}.csv`;
    a.click();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Revenue Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Revenue and expense analysis by cost center and account type
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
              disabled={!summary || summaryLoading}
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">
                    {formatCurrency(summary.totalRevenue)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {summary.revenueCount} revenue accounts
                  </p>
                </div>
                <DollarSign className="w-12 h-12 text-green-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Expense</p>
                  <p className="text-2xl font-bold text-red-600 mt-2">
                    {formatCurrency(summary.totalExpense)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {summary.expenseCount} expense accounts
                  </p>
                </div>
                <BarChart3 className="w-12 h-12 text-red-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Net Income</p>
                  <p
                    className={`text-2xl font-bold mt-2 ${
                      summary.netIncome > 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(summary.netIncome)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {summary.netIncome > 0 ? 'Profit' : 'Loss'}
                  </p>
                </div>
                <TrendingUp className="w-12 h-12 text-blue-500 opacity-20" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div>
                <p className="text-sm text-gray-600">Margin</p>
                <p className="text-2xl font-bold text-blue-600 mt-2">
                  {summary.totalRevenue > 0
                    ? (
                        ((summary.netIncome / summary.totalRevenue) * 100).toFixed(
                          1,
                        ) + '%'
                      )
                    : 'N/A'}
                </p>
                <p className="text-xs text-gray-500 mt-2">Profit margin</p>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Items */}
        {summary && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Top Revenue Accounts
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {summaryLoading ? (
                  <div className="p-6 text-center">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : summary.revenueItems.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No revenue items found
                  </div>
                ) : (
                  summary.revenueItems
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.code}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.description}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-green-600">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">
                  Top Expense Accounts
                </h2>
              </div>
              <div className="divide-y divide-gray-200">
                {summaryLoading ? (
                  <div className="p-6 text-center">
                    <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : summary.expenseItems.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    No expense items found
                  </div>
                ) : (
                  summary.expenseItems
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 10)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {item.code}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.description}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-red-600">
                          {formatCurrency(item.amount)}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Cost Center Breakdown */}
        {ccBreakdown && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                Revenue by Cost Center
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Cost Center
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Expense
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      Net
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">
                      % of Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {ccLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto" />
                      </td>
                    </tr>
                  ) : ccBreakdown.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                        No cost center data available
                      </td>
                    </tr>
                  ) : (
                    ccBreakdown.map((cc) => (
                      <tr key={cc.costCenterId} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {cc.costCenterName}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-green-600 font-medium">
                          {formatCurrency(cc.totalRevenue)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-red-600 font-medium">
                          {formatCurrency(cc.totalExpense)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-gray-900">
                          {formatCurrency(cc.netIncome)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">
                          {cc.percentOfTotal.toFixed(2)}%
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RevenueDashboardPage;
