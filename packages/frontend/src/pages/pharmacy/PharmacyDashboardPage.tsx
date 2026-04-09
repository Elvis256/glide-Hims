import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  Clock,
  DollarSign,
  Package,
  Pill,
  ShieldAlert,
  TrendingUp,
  Users,
  FileText,
  Loader2,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { pharmacyService } from '../../services/pharmacy';
import type { DashboardKPIs } from '../../services/pharmacy';
import { formatCurrency } from '../../lib/currency';
import { useBusinessConfig } from '../../hooks/useBusinessConfig';

function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function getAlertBadgeClass(count: number): string {
  if (count === 0) return 'bg-green-100 text-green-700';
  if (count <= 5) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-5 flex items-start gap-4">
      <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-gray-500 truncate">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function QuickAction({
  label,
  icon,
  to,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  to?: string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  return (
    <button
      className="flex items-center gap-2 px-4 py-2.5 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700 shadow-sm"
      onClick={() => { if (to) navigate(to); else onClick?.(); }}
    >
      {icon}
      {label}
      <ArrowRight className="w-3.5 h-3.5 ml-auto text-gray-400" />
    </button>
  );
}

export default function PharmacyDashboardPage() {
  const { hasPermission } = usePermissions();
  const bizConfig = useBusinessConfig();

  const hospitalName = (() => {
    try {
      const stored = localStorage.getItem('glide_hospital_settings');
      if (stored) return JSON.parse(stored).name || '';
    } catch { /* use default */ }
    return '';
  })();

  const { data: kpis, isLoading, error, dataUpdatedAt } = useQuery<DashboardKPIs>({
    queryKey: ['pharmacy-dashboard-kpis'],
    queryFn: () => pharmacyService.dashboard.getKPIs(),
    refetchInterval: 30_000,
  });

  if (!hasPermission('pharmacy.read')) {
    return <AccessDenied />;
  }

  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString() : null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Activity className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {hospitalName ? `${hospitalName}` : 'Pharmacy Dashboard'}
            </h1>
            <p className="text-sm text-gray-500">{bizConfig.tagline} — Real-time operational overview</p>
          </div>
        </div>
        {lastUpdated && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <RefreshCw className="w-3 h-3" />
            Updated {lastUpdated}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center p-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-500">Loading dashboard...</span>
        </div>
      )}

      {error && (
        <div className="flex items-center justify-center p-16 text-red-500">
          <AlertTriangle className="w-6 h-6 mr-2" />
          Failed to load dashboard KPIs
        </div>
      )}

      {kpis && (
        <div className="space-y-6">
          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPICard
              title="Queue Size"
              value={kpis.queue.pendingCount}
              subtitle={kpis.queue.avgWaitMinutes != null ? `~${formatWaitTime(kpis.queue.avgWaitMinutes)} avg wait` : undefined}
              icon={<Users className="w-6 h-6 text-blue-600" />}
              color="bg-blue-100"
            />
            <KPICard
              title="Low Stock Alerts"
              value={kpis.stockAlerts.lowStockCount + kpis.stockAlerts.outOfStockCount}
              subtitle={`${kpis.stockAlerts.expiringSoonCount} expiring soon`}
              icon={<AlertTriangle className="w-6 h-6 text-amber-600" />}
              color="bg-amber-100"
            />
            <KPICard
              title="Today's Revenue"
              value={formatCurrency(kpis.revenue.todayTotal)}
              subtitle={`Month: ${formatCurrency(kpis.revenue.monthTotal)}`}
              icon={<DollarSign className="w-6 h-6 text-green-600" />}
              color="bg-green-100"
            />
            <KPICard
              title="Dispensed Today"
              value={kpis.dispensing.totalDispensedToday}
              subtitle={kpis.dispensing.controlledSubstancesToday > 0
                ? `${kpis.dispensing.controlledSubstancesToday} controlled`
                : undefined
              }
              icon={<Pill className="w-6 h-6 text-purple-600" />}
              color="bg-purple-100"
            />
          </div>

          {/* Additional stat badges */}
          <div className="flex flex-wrap gap-3">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getAlertBadgeClass(kpis.stockAlerts.outOfStockCount)}`}>
              <Package className="w-3.5 h-3.5" />
              {kpis.stockAlerts.outOfStockCount} out of stock
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getAlertBadgeClass(kpis.stockAlerts.expiringSoonCount)}`}>
              <Clock className="w-3.5 h-3.5" />
              {kpis.stockAlerts.expiringSoonCount} expiring soon
            </span>
            {kpis.dispensing.controlledSubstancesToday > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                <ShieldAlert className="w-3.5 h-3.5" />
                {kpis.dispensing.controlledSubstancesToday} controlled substances
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <TrendingUp className="w-3.5 h-3.5" />
              Avg transaction: {formatCurrency(kpis.revenue.avgTransactionValue)}
            </span>
          </div>

          {/* Quick Actions Row */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <QuickAction
                label="Go to Queue"
                icon={<Users className="w-4 h-4 text-blue-500" />}
                to="/pharmacy/queue"
              />
              <QuickAction
                label="View Alerts"
                icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
                to="/pharmacy/expiry/alerts"
              />
              <QuickAction
                label="New Sale"
                icon={<DollarSign className="w-4 h-4 text-green-500" />}
                to="/pharmacy/retail"
              />
              <QuickAction
                label="DUR Reports"
                icon={<FileText className="w-4 h-4 text-purple-500" />}
                to="/pharmacy/analytics"
              />
            </div>
          </div>

          {/* Recent Activity Table */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Recent Activity</h2>
            {kpis.recentActivity.length > 0 ? (
              <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {kpis.recentActivity.map(activity => (
                      <tr key={activity.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-900">{activity.reference}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 text-xs rounded-full ${
                            activity.type === 'sale' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {activity.type}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-sm text-gray-600">{activity.description}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-sm">{formatCurrency(activity.amount)}</td>
                        <td className="px-4 py-2.5 text-right text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 bg-white rounded-lg border text-gray-400">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No recent activity</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
