import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { labService } from '../../services/lab';
import { providersService } from '../../services/providers';
import { useFacilityId } from '../../lib/facility';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Users,
  FlaskConical,
  CheckCircle,
  AlertCircle,
  Calendar,
  ArrowUp,
  ArrowDown,
  Activity,
  Timer,
  Loader2,
  XCircle,
  PieChart,
} from 'lucide-react';

interface DailyStats {
  date: string;
  tests: number;
  avgTurnaroundMinutes: number;
}

interface TestCategory {
  name: string;
  count: number;
  color: string;
}

const CATEGORY_COLORS = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-orange-500'];

const daysMap: Record<'day' | 'week' | 'month', number> = { day: 1, week: 7, month: 30 };

export default function LabAnalyticsPage() {
  const { hasPermission } = usePermissions();
  const facilityId = useFacilityId();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

  const days = daysMap[timeRange];

  const { data: turnaroundData = [], isLoading: loadingTurnaround } = useQuery({
    queryKey: ['lab-turnaround', facilityId, days],
    queryFn: () => labService.dashboard.getTurnaroundStats(facilityId, days),
    enabled: !!facilityId,
  });

  const { data: queueStats } = useQuery({
    queryKey: ['lab-queue', facilityId],
    queryFn: () => labService.dashboard.getQueue(facilityId),
    enabled: !!facilityId,
  });

  const { data: completedOrders = [] } = useQuery({
    queryKey: ['lab-orders-completed', facilityId],
    queryFn: () => labService.orders.list({ facilityId, status: 'completed' }),
    enabled: !!facilityId,
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers', facilityId],
    queryFn: () => providersService.list({ facilityId }),
    enabled: !!facilityId,
  });

  const { data: rejectedSamplesData } = useQuery({
    queryKey: ['lab-samples-rejected', facilityId],
    queryFn: () => labService.samples.list({ facilityId, status: 'rejected' }),
    enabled: !!facilityId,
  });

  const { data: allSamplesData } = useQuery({
    queryKey: ['lab-samples-all', facilityId],
    queryFn: () => labService.samples.list({ facilityId }),
    enabled: !!facilityId,
  });

  const dailyStats: DailyStats[] = useMemo(() =>
    turnaroundData.map((d) => ({
      date: d.date,
      tests: d.count,
      avgTurnaroundMinutes: d.avgMinutes,
    })),
  [turnaroundData]);

  const summaryStats = useMemo(() => {
    const totalTests = dailyStats.reduce((acc, d) => acc + d.tests, 0);
    const avgTurnaroundMinutes = dailyStats.length > 0
      ? dailyStats.reduce((acc, d) => acc + d.avgTurnaroundMinutes, 0) / dailyStats.length
      : 0;
    const avgTurnaround = avgTurnaroundMinutes / 60;
    const pendingTests = queueStats
      ? (queueStats.pendingCollection || 0) + (queueStats.pendingProcessing || 0) + (queueStats.inProgress || 0)
      : 0;
    const completedToday = queueStats?.completedToday || 0;
    return { totalTests, avgTurnaround, pendingTests, completedToday };
  }, [dailyStats, queueStats]);

  const topTests = useMemo(() => {
    const counts: Record<string, number> = {};
    completedOrders.forEach((order) => {
      order.tests?.forEach((test) => {
        const name = test.testName || test.name || 'Unknown';
        counts[name] = (counts[name] || 0) + 1;
      });
    });
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 8);
    const maxCount = sorted[0]?.[1] || 1;
    return sorted.map(([name, count]) => ({
      name,
      count,
      percentage: Math.round((count / maxCount) * 100),
    }));
  }, [completedOrders]);

  const testCategories: TestCategory[] = useMemo(() => {
    const counts: Record<string, number> = {};
    completedOrders.forEach((order) => {
      order.tests?.forEach((test) => {
        const category = test.category || 'Other';
        counts[category] = (counts[category] || 0) + 1;
      });
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([name, count], idx) => ({ name, count, color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length] }));
  }, [completedOrders]);

  const staffList = useMemo(() =>
    providers.filter((p) => p.status === 'active').slice(0, 6),
  [providers]);

  const rejectionRate = useMemo(() => {
    const total = allSamplesData?.total || 0;
    const rejected = rejectedSamplesData?.total || 0;
    return total > 0 ? Math.round((rejected / total) * 1000) / 10 : 0;
  }, [allSamplesData, rejectedSamplesData]);

  const categoryTAT = useMemo(() => {
    const TARGET_MAP: Record<string, number> = { stat: 30, urgent: 60, routine: 120 };
    const stats: Record<string, { total: number; count: number }> = {};
    completedOrders.forEach((order) => {
      if (!order.completedAt) return;
      const tat = (new Date(order.completedAt).getTime() - new Date(order.createdAt).getTime()) / 60000;
      if (tat <= 0) return;
      order.tests?.forEach((test) => {
        const cat = test.category || 'Other';
        if (!stats[cat]) stats[cat] = { total: 0, count: 0 };
        stats[cat].total += tat;
        stats[cat].count += 1;
      });
    });
    return Object.entries(stats)
      .map(([category, { total, count }]) => {
        const avgMinutes = Math.round(total / count);
        const target = TARGET_MAP[category.toLowerCase()] ?? 120;
        return { category, avgMinutes, target, onTarget: avgMinutes <= target };
      })
      .sort((a, b) => b.avgMinutes - a.avgMinutes);
  }, [completedOrders]);

  const priorityBreakdown = useMemo(() => {
    const counts = { routine: 0, urgent: 0, stat: 0 };
    completedOrders.forEach((order) => {
      const p = (order.priority || 'routine') as keyof typeof counts;
      if (p in counts) counts[p]++;
    });
    const total = completedOrders.length || 1;
    return [
      { label: 'Routine', count: counts.routine, color: 'bg-blue-500', textColor: 'text-blue-600', pct: Math.round((counts.routine / total) * 100) },
      { label: 'Urgent', count: counts.urgent, color: 'bg-amber-500', textColor: 'text-amber-600', pct: Math.round((counts.urgent / total) * 100) },
      { label: 'Stat', count: counts.stat, color: 'bg-red-500', textColor: 'text-red-600', pct: Math.round((counts.stat / total) * 100) },
    ];
  }, [completedOrders]);

  const maxDailyTests = dailyStats.length > 0 ? Math.max(...dailyStats.map((d) => d.tests), 1) : 1;
  const totalCategoryTests = testCategories.reduce((acc, c) => acc + c.count, 0) || 1;
  const safeTotal = summaryStats.completedToday + summaryStats.pendingTests || 1;
  const maxCategoryTAT = categoryTAT.length > 0 ? Math.max(...categoryTAT.map((c) => Math.max(c.avgMinutes, c.target)), 1) : 1;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Lab Analytics</h1>
            <p className="text-sm text-gray-500">Performance metrics and insights</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
            {(['day', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-cyan-600 text-white'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range.charAt(0).toUpperCase() + range.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <FlaskConical className="w-8 h-8 p-1.5 bg-blue-100 text-blue-600 rounded-lg" />
            {loadingTurnaround && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryStats.totalTests}</p>
          <p className="text-sm text-gray-500">Total Tests ({timeRange})</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 p-1.5 bg-purple-100 text-purple-600 rounded-lg" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryStats.avgTurnaround.toFixed(1)}h</p>
          <p className="text-sm text-gray-500">Avg Turnaround</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="w-8 h-8 p-1.5 bg-amber-100 text-amber-600 rounded-lg" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryStats.pendingTests}</p>
          <p className="text-sm text-gray-500">Pending Tests</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="w-8 h-8 p-1.5 bg-teal-100 text-teal-600 rounded-lg" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryStats.completedToday}</p>
          <p className="text-sm text-gray-500">Completed Today</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <XCircle className="w-8 h-8 p-1.5 bg-red-100 text-red-600 rounded-lg" />
          </div>
          <p className={`text-2xl font-bold ${rejectionRate > 5 ? 'text-red-600' : rejectionRate > 2 ? 'text-amber-600' : 'text-gray-900'}`}>
            {rejectionRate}%
          </p>
          <p className="text-sm text-gray-500">Sample Rejection Rate</p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-3 gap-4 overflow-hidden">
        <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tests Per Day</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Activity className="w-4 h-4" />
              This Week
            </div>
          </div>
          <div className="flex-1 flex items-end gap-3">
            {dailyStats.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No data available</p>
                </div>
              </div>
            )}
            {dailyStats.map((day) => (
              <div key={day.date} className="flex-1 flex flex-col items-center">
                <div className="w-full relative group">
                  <div
                    className="w-full bg-cyan-500 rounded-t transition-all hover:bg-cyan-600"
                    style={{ height: `${(day.tests / maxDailyTests) * 200}px` }}
                  />
                  <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {day.tests} tests • {day.avgTurnaroundMinutes.toFixed(0)} min avg
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700 mt-2">{day.date}</p>
                <p className="text-xs text-gray-500">{day.tests}</p>
              </div>
            ))}
          </div>
          {categoryTAT.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Timer className="w-4 h-4 text-purple-500" />
                Avg Turnaround by Category
                <span className="text-xs text-gray-400 font-normal ml-1">| = target</span>
              </h4>
              <div className="space-y-2">
                {categoryTAT.map(({ category, avgMinutes, target, onTarget }) => (
                  <div key={category} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-20 truncate">{category}</span>
                    <div className="flex-1 relative h-4 bg-gray-100 rounded overflow-hidden">
                      <div
                        className={`h-full rounded transition-all ${onTarget ? 'bg-green-400' : 'bg-red-400'}`}
                        style={{ width: `${(avgMinutes / maxCategoryTAT) * 100}%` }}
                      />
                      <div
                        className="absolute top-0 h-full w-0.5 bg-gray-500 opacity-60"
                        style={{ left: `${(target / maxCategoryTAT) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs font-medium w-20 text-right ${onTarget ? 'text-green-600' : 'text-red-500'}`}>
                      {avgMinutes}m / {target}m
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Tests by Category</h3>
          </div>
          <div className="flex-1 overflow-auto space-y-3">
            {testCategories.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-500 py-8">
                <p>No categories</p>
              </div>
            )}
            {testCategories.map((category) => (
              <div key={category.name}>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{category.name}</span>
                  <span className="text-gray-900 font-medium">{category.count} tests</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${category.color} rounded-full`}
                    style={{ width: `${(category.count / totalCategoryTests) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Top Ordered Tests</h3>
            <TrendingUp className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 overflow-auto space-y-2">
            {topTests.length === 0 && (
              <div className="flex-1 flex items-center justify-center text-gray-500 py-8">
                <p>No data</p>
              </div>
            )}
            {topTests.map((test, idx) => (
              <div key={test.name} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                  idx < 3 ? 'bg-cyan-100 text-cyan-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {idx + 1}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">{test.name}</p>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-cyan-500 rounded-full"
                      style={{ width: `${test.percentage * 5}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm text-gray-500">{test.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Pending vs Completed</h3>
          </div>
          <div className="flex-1 flex items-center justify-center">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="80" cy="80" r="60" fill="none" stroke="#e5e7eb" strokeWidth="20" />
                <circle
                  cx="80" cy="80" r="60" fill="none" stroke="#06b6d4" strokeWidth="20"
                  strokeDasharray={`${(summaryStats.completedToday / safeTotal) * 377} 377`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((summaryStats.completedToday / safeTotal) * 100)}%
                </p>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
            </div>
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-cyan-500 rounded" />
              <span className="text-sm text-gray-600">Completed ({summaryStats.completedToday})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-200 rounded" />
              <span className="text-sm text-gray-600">Pending ({summaryStats.pendingTests})</span>
            </div>
          </div>
          {completedOrders.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <h4 className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                <PieChart className="w-3.5 h-3.5 text-gray-500" />
                Priority Breakdown
              </h4>
              <div className="space-y-1.5">
                {priorityBreakdown.map(({ label, count, color, textColor, pct }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-xs text-gray-600 w-12">{label}</span>
                    <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-xs font-medium w-16 text-right ${textColor}`}>{count} ({pct}%)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Staff Productivity</h3>
            <Users className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Name</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Role</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffList.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-2 py-8 text-center text-gray-500">No staff data</td>
                  </tr>
                )}
                {staffList.map((staff) => (
                  <tr key={staff.id}>
                    <td className="px-2 py-2 font-medium text-gray-700">{staff.fullName}</td>
                    <td className="px-2 py-2 text-gray-500 capitalize">{staff.providerType}</td>
                    <td className="px-2 py-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        staff.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>{staff.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
