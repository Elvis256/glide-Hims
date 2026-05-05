import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity,
  RefreshCw,
} from 'lucide-react';
import api from '../../services/api';

interface EncumbranceData {
  pendingGRNCount: number;
  pendingGRNAmount: number;
  activeEncumbrances: number;
  totalEncumbered: number;
  unmatchedPOCount: number;
  unmatchedPOAmount: number;
  status: string;
}

interface ReconciliationData {
  period: string;
  departmentId: string;
  totalPOAmount: number;
  totalGRNAmount: number;
  totalEncumbered: number;
  totalActual: number;
  variance: number;
  grnCount: number;
  poCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

const ProcurementGLIntegrationPage: React.FC = () => {
  const [period, setPeriod] = useState<{ startDate: string; endDate: string }>({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Fetch GL Integration Summary
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ['gl-integration-summary'],
    queryFn: async () => {
      const response = await api.get('/procurement/gl-integration/summary');
      return response.data as EncumbranceData;
    },
  });

  // Fetch Reconciliation Report
  const { data: reconciliation, refetch: refetchReconciliation } = useQuery({
    queryKey: ['reconciliation-report', period],
    queryFn: async () => {
      const response = await api.get('/procurement/reconciliation/report', {
        params: {
          startDate: period.startDate,
          endDate: period.endDate,
        },
      });
      return response.data as ReconciliationData;
    },
  });

  const handleRefresh = async () => {
    await Promise.all([refetchSummary(), refetchReconciliation()]);
  };

  const variancePercentage = reconciliation?.totalPOAmount
    ? ((reconciliation.variance / reconciliation.totalPOAmount) * 100).toFixed(2)
    : 0;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Finance-Procurement Integration
            </h1>
            <p className="text-gray-600 mt-2">
              GL posting, budget encumbrance, and three-way match status
            </p>
          </div>
          <button
            onClick={handleRefresh}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
        </div>

        {/* Period Selector */}
        <div className="mb-6 grid grid-cols-2 gap-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={period.startDate}
              onChange={(e) => setPeriod({ ...period, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              End Date
            </label>
            <input
              type="date"
              value={period.endDate}
              onChange={(e) => setPeriod({ ...period, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Pending GRNs */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-amber-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-gray-600">Pending GRNs</h3>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {summary?.pendingGRNCount || 0}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ${(summary?.pendingGRNAmount || 0).toFixed(2)}
            </p>
          </div>

          {/* Active Encumbrances */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-gray-600">Encumbrances</h3>
              <BarChart3 className="w-5 h-5 text-blue-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {summary?.activeEncumbrances || 0}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ${(summary?.totalEncumbered || 0).toFixed(2)}
            </p>
          </div>

          {/* Unmatched POs */}
          <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-red-500">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-gray-600">Unmatched POs</h3>
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {summary?.unmatchedPOCount || 0}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ${(summary?.unmatchedPOAmount || 0).toFixed(2)}
            </p>
          </div>

          {/* Variance */}
          <div
            className={`bg-white rounded-lg shadow-sm p-6 border-l-4 ${
              (reconciliation?.variance || 0) < 100 ? 'border-green-500' : 'border-red-500'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-sm font-semibold text-gray-600">Period Variance</h3>
              <TrendingUp
                className={`w-5 h-5 ${
                  (reconciliation?.variance || 0) < 100 ? 'text-green-500' : 'text-red-500'
                }`}
              />
            </div>
            <div className="text-3xl font-bold text-gray-900">
              ${Math.abs(reconciliation?.variance || 0).toFixed(2)}
            </div>
            <p className="text-xs text-gray-500 mt-2">{variancePercentage}% of PO amount</p>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Encumbrance Status Widget */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Encumbrance Status</h2>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Budget Encumbered</span>
                  <span className="text-lg font-bold text-blue-600">
                    ${(summary?.totalEncumbered || 0).toFixed(2)}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{
                      width: `${Math.min(100, ((summary?.totalEncumbered || 0) / 1000000) * 100)}%`,
                    }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-700">Active POs</span>
                  <span className="text-lg font-bold text-gray-900">
                    {summary?.activeEncumbrances || 0}
                  </span>
                </div>
                <p className="text-xs text-gray-500">
                  Average: ${((summary?.totalEncumbered || 0) / Math.max(1, summary?.activeEncumbrances || 1)).toFixed(2)}
                  per PO
                </p>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Status:</span> Operational
                </p>
              </div>
            </div>
          </div>

          {/* Reconciliation Status Widget */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Reconciliation Status</h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Matched</p>
                    <p className="text-xs text-gray-500">POs with GRNs</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {reconciliation?.matchedCount || 0}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Unmatched</p>
                    <p className="text-xs text-gray-500">Need reconciliation</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-amber-600">
                  {reconciliation?.unmatchedCount || 0}
                </span>
              </div>

              <div className="pt-2 border-t border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Match Rate:</span>{' '}
                  {reconciliation?.poCount
                    ? (
                        ((reconciliation.matchedCount || 0) / reconciliation.poCount) *
                        100
                      ).toFixed(1)
                    : 0}
                  %
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reconciliation Report */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Period Reconciliation</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total PO Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(reconciliation?.totalPOAmount || 0).toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Total GRN Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                ${(reconciliation?.totalGRNAmount || 0).toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Variance</p>
              <p
                className={`text-2xl font-bold ${
                  (reconciliation?.variance || 0) < 100 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                ${Math.abs(reconciliation?.variance || 0).toFixed(2)}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">PO Count</p>
              <p className="text-2xl font-bold text-gray-900">
                {reconciliation?.poCount || 0}
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">Status:</span> {reconciliation?.grnCount || 0} GRNs
              received, {reconciliation?.unmatchedCount || 0} POs awaiting receipt
            </p>
          </div>
        </div>

        {/* GL Posting Queue */}
        <div className="mt-6 bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">GL Posting Queue</h2>

          <div className="space-y-3">
            {summary?.pendingGRNCount ? (
              <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Activity className="w-5 h-5 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Pending GL Posts</p>
                    <p className="text-xs text-gray-500">GRNs ready for GL posting</p>
                  </div>
                </div>
                <span className="px-4 py-2 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
                  {summary.pendingGRNCount} pending
                </span>
              </div>
            ) : (
              <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">GL Posting Current</p>
                    <p className="text-xs text-gray-500">All GRNs posted to GL</p>
                  </div>
                </div>
                <span className="px-4 py-2 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  All current
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcurementGLIntegrationPage;
