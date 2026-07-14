import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  RefreshCw,
  Download,
  FileText,
  Activity,
  Shield,
} from 'lucide-react';
import api from '../../../services/api';
import { KPICardWidget } from './KPICardWidget';
import { ApprovalStatusWidget } from './ApprovalStatusWidget';
import { ComplianceStatusWidget } from './ComplianceStatusWidget';
import { PerformanceMetricsWidget } from './PerformanceMetricsWidget';
import { toast } from 'sonner';

interface DashboardMetrics {
  glBalance?: {
    totalDebits: number;
    totalCredits: number;
    difference: number;
    isBalanced: boolean;
  };
  revenue?: {
    month: number;
    ytd: number;
    vs_budget: number;
  };
  expenses?: {
    month: number;
    ytd: number;
    vs_budget: number;
  };
  approvals?: {
    pending: number;
    approved: number;
    rejected: number;
  };
  compliance?: {
    score: number;
    status: string;
    violations: number;
  };
  performance?: {
    health: number;
    indexScore: number;
    fragmentation: number;
  };
}

const FinanceDashboard: React.FC = () => {
  const [period, setPeriod] = useState<string>(
    new Date().toISOString().substring(0, 7),
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch GL Balance
  const { data: glBalance, refetch: refetchGLBalance } = useQuery({
    queryKey: ['gl-balance', period],
    queryFn: async () => {
      const response = await api.get('/finance/integrity/gl-balance');
      return response.data.data;
    },
  });

  // Fetch Revenue/Expense Summary
  const { data: revenue, refetch: refetchRevenue } = useQuery({
    queryKey: ['revenue-summary', period],
    queryFn: async () => {
      const response = await api.get('/finance/revenue/summary', {
        params: { period },
      });
      return response.data.data;
    },
  });

  // Fetch Compliance Status
  const { data: compliance, refetch: refetchCompliance } = useQuery({
    queryKey: ['compliance-status'],
    queryFn: async () => {
      const response = await api.get('/finance/compliance/status/STANDARD');
      return response.data.data;
    },
  });

  // Fetch Performance Metrics
  const { data: performance, refetch: refetchPerformance } = useQuery({
    queryKey: ['performance-metrics'],
    queryFn: async () => {
      const response = await api.get('/finance/performance/metrics');
      return response.data.data;
    },
  });

  // Fetch Approval Status
  const { data: approvals, refetch: refetchApprovals } = useQuery({
    queryKey: ['approval-status'],
    queryFn: async () => {
      const response = await api.get('/finance/approvals/status');
      return response.data.data;
    },
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      refetchGLBalance(),
      refetchRevenue(),
      refetchCompliance(),
      refetchPerformance(),
      refetchApprovals(),
    ]);
    setIsRefreshing(false);
  };

  const handleExportPDF = () => {
    toast.error('PDF export functionality coming soon');
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">
              Finance Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Real-time GL metrics, compliance status, and system performance
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              <RefreshCw
                className={`w-4 h-4 mr-2 ${
                  isRefreshing ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Period Selector */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Period
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="w-full md:w-48 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KPICardWidget
            title="GL Balance"
            value={`$${glBalance?.totalDebits?.toFixed(0) || '0'}`}
            icon={<BarChart3 className="w-6 h-6" />}
            color="blue"
            loading={!glBalance}
          />
          <KPICardWidget
            title="Revenue"
            value={`$${revenue?.totalRevenue?.toFixed(0) || '0'}`}
            trend={revenue?.variancePercent}
            icon={<TrendingUp className="w-6 h-6" />}
            color="green"
            loading={!revenue}
          />
          <KPICardWidget
            title="Compliance Score"
            value={compliance?.percentCompliance || 0}
            unit="%"
            icon={<Shield className="w-6 h-6" />}
            color={
              (compliance?.percentCompliance || 0) >= 95 ? 'green' : 'amber'
            }
            loading={!compliance}
          />
          <KPICardWidget
            title="Performance Health"
            value={performance?.overallHealthScore || 0}
            unit="%"
            icon={<Zap className="w-6 h-6" />}
            color={
              (performance?.overallHealthScore || 0) >= 80 ? 'green' : 'amber'
            }
            loading={!performance}
          />
        </div>

        {/* Three Column Layout with Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <ApprovalStatusWidget />
          <ComplianceStatusWidget />
          <PerformanceMetricsWidget />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Quick Actions
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
              <FileText className="w-5 h-5 text-blue-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900">
                Cleanup Report
              </p>
              <p className="text-xs text-gray-500 mt-1">
                View cleanup operations
              </p>
            </button>

            <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
              <Shield className="w-5 h-5 text-purple-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900">
                Compliance Report
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Generate audit compliance
              </p>
            </button>

            <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
              <Activity className="w-5 h-5 text-orange-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900">
                Performance Metrics
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Database health details
              </p>
            </button>

            <button className="p-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-left">
              <AlertCircle className="w-5 h-5 text-red-600 mb-2" />
              <p className="text-sm font-semibold text-gray-900">
                Integrity Check
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Verify data consistency
              </p>
            </button>
          </div>
        </div>

        {/* Recommendations */}
        {performance?.recommendations && performance.recommendations.length > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-4">
              Optimization Recommendations
            </h3>
            <ul className="space-y-2">
              {performance.recommendations.map((rec: string, idx: number) => (
                <li key={idx} className="text-sm text-yellow-800 flex items-start gap-2">
                  <span className="text-yellow-600 font-bold mt-1">•</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default FinanceDashboard;
