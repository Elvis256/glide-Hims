import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
  Users,
  Monitor,
  Calendar,
  ArrowUpRight,
  Zap,
  Target,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import { radiologyService } from '../../services/radiology';
import { useFacilityId } from '../../lib/facility';

interface ModalityStats {
  name: string;
  studies: number;
  revenue: number;
  avgTurnaround: number;
  change: number;
}

interface RadiologistStats {
  name: string;
  studiesReported: number;
  avgTurnaround: string;
  accuracy: number;
  criticalAlerts: number;
}

interface EquipmentStats {
  name: string;
  type: string;
  utilization: number;
  studiesPerformed: number;
  downtime: number;
}

export default function RadiologyAnalyticsPage() {
  const { hasPermission } = usePermissions();
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');
  const facilityId = useFacilityId();

  const getPeriodDates = () => {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0];
    const daysMap: Record<string, number> = { week: 7, month: 30, quarter: 90 };
    const daysInPeriod = daysMap[selectedPeriod] ?? 7;
    const startDate = new Date(now.getTime() - daysInPeriod * 86400000).toISOString().split('T')[0];
    return { startDate, endDate, daysInPeriod };
  };

  if (!hasPermission('radiology.analytics')) {
    return <AccessDenied />;
  }

  // Fetch radiology orders for analytics, filtered by selected period
  const { data: ordersData, isLoading, isError } = useQuery({
    queryKey: ['radiology-orders', facilityId, selectedPeriod],
    queryFn: async () => {
      const allOrders = await radiologyService.orders.list(facilityId);
      const { startDate } = getPeriodDates();
      const start = new Date(startDate);
      return allOrders.filter(o => new Date(o.createdAt) >= start);
    },
    staleTime: 30000,
  });

  // Fetch TAT stats from API
  const { data: tatStatsData } = useQuery({
    queryKey: ['radiology-tat', facilityId, selectedPeriod],
    queryFn: async () => {
      try {
        const { startDate, endDate } = getPeriodDates();
        return await radiologyService.dashboard.getTurnaroundStats(facilityId, startDate, endDate);
      } catch { return []; }
    },
    staleTime: 30000,
  });

  // Fetch modalities
  const { data: modalitiesData } = useQuery({
    queryKey: ['radiology-modalities', facilityId],
    queryFn: () => radiologyService.modalities.list(facilityId),
    staleTime: 60000,
  });

  const orders = ordersData || [];
  const modalities = modalitiesData || [];
  // tatStatsData provides server-computed TAT for supplementary display
  void tatStatsData;

  // Calculate stats from real data
  const modalityStats: ModalityStats[] = useMemo(() => {
    if (orders.length === 0) return [];

    const statsByModality: Record<string, { studies: number; turnaroundTotal: number; turnaroundCount: number }> = {};

    orders.forEach(order => {
      const modalityName = typeof order.modality === 'string' ? order.modality : order.modality?.name || 'Unknown';
      if (!statsByModality[modalityName]) {
        statsByModality[modalityName] = { studies: 0, turnaroundTotal: 0, turnaroundCount: 0 };
      }
      statsByModality[modalityName].studies += 1;
      const completedTime = order.completedAt || order.performedAt;
      if (completedTime) {
        const tat = (new Date(completedTime).getTime() - new Date(order.createdAt).getTime()) / 60000;
        if (tat > 0) {
          statsByModality[modalityName].turnaroundTotal += tat;
          statsByModality[modalityName].turnaroundCount += 1;
        }
      }
    });

    return Object.entries(statsByModality).map(([name, stats]) => ({
      name,
      studies: stats.studies,
      revenue: 0,
      avgTurnaround: stats.turnaroundCount > 0 ? Math.round(stats.turnaroundTotal / stats.turnaroundCount) : 0,
      change: 0,
    }));
  }, [orders]);

  const equipmentStats: EquipmentStats[] = useMemo(() => {
    const { daysInPeriod } = getPeriodDates();
    const workingMinutes = daysInPeriod * 8 * 60;
    const ordersByModality: Record<string, number> = {};
    orders.forEach(order => {
      const name = typeof order.modality === 'string' ? order.modality : order.modality?.name || 'Unknown';
      ordersByModality[name] = (ordersByModality[name] || 0) + 1;
    });
    return modalities.map(modality => {
      const studiesCount = ordersByModality[modality.name] || 0;
      const utilization = workingMinutes > 0
        ? Math.min(Math.round((studiesCount * 30 / workingMinutes) * 100), 100)
        : 0;
      return {
        name: modality.name || 'Unknown',
        type: modality.modalityType || 'Unknown',
        utilization,
        studiesPerformed: studiesCount,
        downtime: 0,
      };
    });
  }, [modalities, orders, selectedPeriod]);

  const radiologistStats: RadiologistStats[] = useMemo(() => {
    if (orders.length === 0) return [];

    const statsByRadiologist: Record<string, { studies: number; tatTotal: number; tatCount: number }> = {};

    orders.forEach(order => {
      const name = order.assignedTo || 'Unassigned';
      if (!statsByRadiologist[name]) statsByRadiologist[name] = { studies: 0, tatTotal: 0, tatCount: 0 };
      statsByRadiologist[name].studies += 1;
      const completedTime = order.completedAt || order.performedAt;
      if (completedTime) {
        const tat = (new Date(completedTime).getTime() - new Date(order.createdAt).getTime()) / 60000;
        if (tat > 0) { statsByRadiologist[name].tatTotal += tat; statsByRadiologist[name].tatCount += 1; }
      }
    });

    return Object.entries(statsByRadiologist)
      .filter(([name]) => name !== 'Unassigned')
      .map(([name, stats]) => ({
        name,
        studiesReported: stats.studies,
        avgTurnaround: stats.tatCount > 0 ? `${Math.round(stats.tatTotal / stats.tatCount)} min` : '-',
        accuracy: 0,
        criticalAlerts: 0,
      }));
  }, [orders]);

  const summaryStats = useMemo(() => {
    const totalStudies = orders.length;
    // Calculate average TAT from orders with completion timestamps
    const tats = orders
      .map(o => {
        const ct = o.completedAt || o.performedAt;
        return ct ? (new Date(ct).getTime() - new Date(o.createdAt).getTime()) / 60000 : null;
      })
      .filter((t): t is number => t !== null && t > 0);
    const avgTurnaround = tats.length > 0 ? Math.round(tats.reduce((a, b) => a + b, 0) / tats.length) : 0;
    const avgUtilization = equipmentStats.length > 0
      ? Math.round(equipmentStats.reduce((a, b) => a + b.utilization, 0) / equipmentStats.length)
      : 0;
    return { totalStudies, totalRevenue: 0, avgTurnaround, avgUtilization };
  }, [orders, equipmentStats]);

  const studyVolumeByDay = useMemo(() => {
    const dayMap: Record<string, number> = {};
    orders.forEach(o => {
      const date = o.createdAt.split('T')[0];
      dayMap[date] = (dayMap[date] || 0) + 1;
    });
    return Object.entries(dayMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count,
      }));
  }, [orders]);

  const criticalCount = useMemo(() =>
    orders.filter(o => o.result?.isCritical === true).length,
  [orders]);

  const criticalFindingsRate = useMemo(() =>
    orders.length > 0 ? Math.round((criticalCount / orders.length) * 1000) / 10 : 0,
  [criticalCount, orders.length]);

  const modalityHeatMap = useMemo(() => {
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const modalityNames = [...new Set(
      orders.map(o => typeof o.modality === 'string' ? o.modality : o.modality?.name || 'Unknown')
    )].slice(0, 5);
    const counts: Record<string, Record<number, number>> = {};
    modalityNames.forEach(m => { counts[m] = {}; });
    orders.forEach(o => {
      const name = typeof o.modality === 'string' ? o.modality : o.modality?.name || 'Unknown';
      if (!counts[name]) return;
      const dow = new Date(o.createdAt).getDay();
      counts[name][dow] = (counts[name][dow] || 0) + 1;
    });
    const maxCount = Math.max(
      ...modalityNames.flatMap(m => Object.values(counts[m])),
      1
    );
    return { modalityNames, dayLabels, counts, maxCount };
  }, [orders]);

  const formatCurrencyCompact = (amount: number) => {
    return formatCurrency(amount, { compact: true });
  };

  const getHeatColor = (count: number, maxCount: number) => {
    if (count === 0) return 'bg-gray-100';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'bg-blue-100';
    if (ratio < 0.5) return 'bg-blue-300';
    if (ratio < 0.75) return 'bg-blue-500';
    return 'bg-blue-700';
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'bg-red-500';
    if (utilization >= 75) return 'bg-green-500';
    if (utilization >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-red-600">
          <AlertCircle className="w-8 h-8" />
          <p>Failed to load analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radiology Analytics</h1>
          <p className="text-gray-600">Performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month' | 'quarter')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.totalStudies}</p>
          <p className="text-sm text-gray-600">Total Studies</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.totalRevenue > 0 ? formatCurrencyCompact(summaryStats.totalRevenue) : 'N/A'}</p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.avgTurnaround > 0 ? `${summaryStats.avgTurnaround} min` : '-'}</p>
          <p className="text-sm text-gray-600">Avg Turnaround</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Monitor className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.avgUtilization > 0 ? `${summaryStats.avgUtilization}%` : '-'}</p>
          <p className="text-sm text-gray-600">Equipment Utilization</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className={`p-2 rounded-lg ${criticalFindingsRate > 10 ? 'bg-red-100' : criticalFindingsRate > 5 ? 'bg-amber-100' : 'bg-green-100'}`}>
              <AlertCircle className={`w-5 h-5 ${criticalFindingsRate > 10 ? 'text-red-600' : criticalFindingsRate > 5 ? 'text-amber-600' : 'text-green-600'}`} />
            </div>
          </div>
          <p className={`text-2xl font-bold mt-3 ${criticalFindingsRate > 10 ? 'text-red-600' : criticalFindingsRate > 5 ? 'text-amber-600' : 'text-gray-900'}`}>
            {orders.length > 0 ? `${criticalFindingsRate}%` : '-'}
          </p>
          <p className="text-sm text-gray-600">Critical Findings ({criticalCount})</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Studies by Modality */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Studies by Modality
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            {modalityStats.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-gray-500">
                <p className="text-sm">No modality data available</p>
              </div>
            ) : (
            <div className="space-y-4">
              {modalityStats.map((modality) => (
                <div key={modality.name} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{modality.name}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{modality.studies} studies</span>
                    <span className="text-gray-600">{modality.revenue > 0 ? formatCurrencyCompact(modality.revenue) : '-'}</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${Math.min((modality.studies / Math.max(summaryStats.totalStudies, 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            )}

            {/* Revenue by Study Type */}
            {modalityStats.length > 0 && summaryStats.totalRevenue > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Revenue Distribution</h3>
              <div className="space-y-2">
                {modalityStats.map((modality) => {
                  const percentage = summaryStats.totalRevenue > 0 ? (modality.revenue / summaryStats.totalRevenue) * 100 : 0;
                  return (
                    <div key={modality.name} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-20">{modality.name}</span>
                      <div className="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 flex items-center justify-end px-2"
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="text-xs text-white font-medium">{percentage.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            )}

            {/* Modality Utilization Heat Map */}
            {modalityHeatMap.modalityNames.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Usage by Day of Week</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left text-gray-500 font-medium pb-1 pr-2 w-20">Modality</th>
                      {modalityHeatMap.dayLabels.map(d => (
                        <th key={d} className="text-center text-gray-500 font-medium pb-1 px-1">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {modalityHeatMap.modalityNames.map(name => (
                      <tr key={name}>
                        <td className="text-gray-700 font-medium pr-2 py-1 truncate max-w-[5rem]">{name}</td>
                        {Array.from({ length: 7 }, (_, i) => {
                          const count = modalityHeatMap.counts[name][i] || 0;
                          return (
                            <td key={i} className="px-1 py-1 text-center">
                              <div
                                title={`${count} studies`}
                                className={`w-6 h-6 rounded mx-auto flex items-center justify-center text-xs font-medium ${getHeatColor(count, modalityHeatMap.maxCount)} ${count > 0 && count / modalityHeatMap.maxCount >= 0.5 ? 'text-white' : 'text-gray-700'}`}
                              >
                                {count > 0 ? count : ''}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-1">Darker = more studies</p>
              </div>
            </div>
            )}
          </div>
        </div>

        {/* Equipment Utilization & Radiologist Productivity */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Equipment Utilization */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Equipment Utilization
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {equipmentStats.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p className="text-sm">No equipment data available</p>
                </div>
              ) : (
              <div className="space-y-3">
                {equipmentStats.map((equipment) => (
                  <div key={equipment.name} className="flex items-center gap-3">
                    <div className="w-28 truncate">
                      <p className="text-sm font-medium text-gray-900 truncate">{equipment.name}</p>
                      <p className="text-xs text-gray-500">{equipment.type}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getUtilizationColor(equipment.utilization)} transition-all`}
                          style={{ width: `${equipment.utilization}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {equipment.utilization > 0 ? `${equipment.utilization}%` : '-'}
                    </span>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>

          {/* Turnaround Time */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              Turnaround Time by Modality
            </h2>
            {modalityStats.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-500">
                <p className="text-sm">No data available</p>
              </div>
            ) : (
            <div className="grid grid-cols-2 gap-3">
              {modalityStats.map((modality) => (
                <div key={modality.name} className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{modality.avgTurnaround > 0 ? modality.avgTurnaround : '-'}</p>
                  <p className="text-xs text-gray-500">min avg</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{modality.name}</p>
                </div>
              ))}
            </div>
            )}
          </div>
        </div>

        {/* Radiologist Productivity & Trends */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Radiologist Productivity */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Radiologist Productivity
              </h2>
            </div>
            <div className="flex-1 overflow-auto">
              {radiologistStats.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 p-4">
                  <p className="text-sm">No radiologist data available</p>
                </div>
              ) : (
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Radiologist</th>
                    <th className="px-4 py-2 text-center">Studies</th>
                    <th className="px-4 py-2 text-center">TAT</th>
                    <th className="px-4 py-2 text-center">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {radiologistStats.map((radiologist) => (
                    <tr key={radiologist.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{radiologist.name}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-gray-900">{radiologist.studiesReported}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">{radiologist.avgTurnaround}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {radiologist.accuracy > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          <Target className="w-3 h-3" />
                          {radiologist.accuracy}%
                        </span>
                        ) : (
                        <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              )}
            </div>
          </div>

          {/* Study Volume Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Study Volume Trend
            </h2>
            {studyVolumeByDay.length === 0 ? (
              <div className="flex items-center justify-center h-20 text-gray-500">
                <p className="text-sm">No data available</p>
              </div>
            ) : (
              <>
                <div className="flex items-end gap-1 h-20">
                  {(() => {
                    const maxVol = Math.max(...studyVolumeByDay.map(d => d.count), 1);
                    return studyVolumeByDay.map((d) => (
                      <div key={d.date} className="flex-1 flex flex-col items-center group relative">
                        <div
                          className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors"
                          style={{ height: `${(d.count / maxVol) * 72}px` }}
                        />
                        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                          {d.date}: {d.count}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>{studyVolumeByDay[0]?.date}</span>
                  <span>{studyVolumeByDay[studyVolumeByDay.length - 1]?.date}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
