import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  BarChart3,
  Clock,
  Users,
  TrendingUp,
  TrendingDown,
  Calendar,
  ArrowUp,
  ArrowDown,
  Activity,
  Download,
  FileSpreadsheet,
  FileText,
  Lightbulb,
  Award,
  Zap,
  UserX,
  Timer,
  Star,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { queueService } from '../services/queue';
import AccessDenied from '../components/AccessDenied';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ComposedChart,
  Area,
} from 'recharts';
import { usePermissions } from '../components/PermissionGate';
import { format, subDays, startOfWeek, startOfMonth, endOfWeek, endOfMonth } from 'date-fns';



export default function QueueAnalyticsPage() {
  const { hasAnyPermission } = usePermissions();
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [customStartDate, setCustomStartDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const canView = hasAnyPermission(['reports.read', 'analytics.read']);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['queue-analytics-stats', dateRange],
    queryFn: () => queueService.getStats(),
  });

  const kpiData = useMemo(() => {
    if (!stats) return { totalPatients: 0, prevTotalPatients: 0, avgWaitTime: 0, prevAvgWaitTime: 0, avgServiceTime: 0, noShowRate: 0, prevNoShowRate: 0, peakHour: '-', noShows: 0 };
    return {
      totalPatients: stats.total || 0,
      prevTotalPatients: 0,
      avgWaitTime: stats.averageWaitMinutes || 0,
      prevAvgWaitTime: 0,
      avgServiceTime: stats.averageServiceMinutes || 0,
      noShowRate: stats.total > 0 ? ((stats.noShow || 0) / stats.total) * 100 : 0,
      prevNoShowRate: 0,
      peakHour: '-',
      noShows: stats.noShow || 0,
    };
  }, [stats]);

  const getDateRangeLabel = () => {
    switch (dateRange) {
      case 'today':
        return format(new Date(), 'MMM d, yyyy');
      case 'week':
        return `${format(startOfWeek(new Date()), 'MMM d')} - ${format(endOfWeek(new Date()), 'MMM d, yyyy')}`;
      case 'month':
        return format(new Date(), 'MMMM yyyy');
      case 'custom':
        return `${format(new Date(customStartDate), 'MMM d')} - ${format(new Date(customEndDate), 'MMM d, yyyy')}`;
    }
  };

  const getWaitTimeColor = (wait: number) => {
    if (wait <= 15) return 'text-green-600';
    if (wait <= 30) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDeptPerformanceColor = (avgWait: number) => {
    if (avgWait <= 15) return 'bg-green-100 text-green-700';
    if (avgWait <= 25) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const handleExportPDF = () => {
    setShowExportMenu(false);
    toast.success('PDF report generated', { description: 'Download will start shortly' });
    // Mock PDF generation
    const content = `Queue Analytics Report\n${getDateRangeLabel()}\n\nTotal Patients: ${kpiData.totalPatients}\nAvg Wait Time: ${kpiData.avgWaitTime} min\nNo-Show Rate: ${kpiData.noShowRate.toFixed(1)}%`;
    const blob = new Blob([content], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-analytics-${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    setShowExportMenu(false);
    toast.success('Excel export started', { description: 'Download will start shortly' });
    // Generate CSV for Excel
    const csvRows = [
      'Queue Analytics Report',
      `Date Range,${getDateRangeLabel()}`,
      '',
      'KPI Summary',
      `Total Patients,${kpiData.totalPatients}`,
      `Avg Wait Time,${kpiData.avgWaitTime} min`,
      `Avg Service Time,${kpiData.avgServiceTime} min`,
      `No-Show Rate,${kpiData.noShowRate.toFixed(1)}%`,
      `Peak Hour,${kpiData.peakHour}`,
    ];
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-analytics-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return <AccessDenied />;
  }

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /><p className="mt-2 text-gray-500">Loading analytics...</p></div>;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Queue Analytics</h1>
            <p className="text-gray-500 text-sm">{getDateRangeLabel()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Date Range Selector */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['today', 'week', 'month'] as const).map((range) => (
              <button
                key={range}
                onClick={() => { setDateRange(range); setShowCustomPicker(false); }}
                className={`px-3 py-1.5 rounded text-sm font-medium capitalize transition-colors ${
                  dateRange === range
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
            <button
              onClick={() => { setDateRange('custom'); setShowCustomPicker(!showCustomPicker); }}
              className={`px-3 py-1.5 rounded text-sm font-medium flex items-center gap-1 transition-colors ${
                dateRange === 'custom'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              Custom
            </button>
          </div>

          {/* Custom Date Picker */}
          {showCustomPicker && dateRange === 'custom' && (
            <div className="flex items-center gap-2 bg-white border rounded-lg p-2 shadow-sm">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="input py-1 text-sm"
              />
              <span className="text-gray-400">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="input py-1 text-sm"
              />
            </div>
          )}

          {/* Export Menu */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
              <ChevronDown className="w-4 h-4" />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                <button
                  onClick={handleExportPDF}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4 text-red-500" />
                  PDF Report
                </button>
                <button
                  onClick={handleExportExcel}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  Excel Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-5 gap-3 flex-shrink-0">
          {/* Total Patients */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Patients Served</p>
                <p className="text-2xl font-bold text-gray-900">{kpiData.totalPatients.toLocaleString()}</p>
              </div>
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              kpiData.totalPatients > kpiData.prevTotalPatients ? 'text-green-600' : 'text-red-600'
            }`}>
              {kpiData.totalPatients > kpiData.prevTotalPatients ? (
                <ArrowUp className="w-3 h-3" />
              ) : (
                <ArrowDown className="w-3 h-3" />
              )}
              <span>
                {Math.abs(Math.round(((kpiData.totalPatients - kpiData.prevTotalPatients) / kpiData.prevTotalPatients) * 100))}% vs prev
              </span>
            </div>
          </div>

          {/* Avg Wait Time */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Avg Wait Time</p>
                <p className={`text-2xl font-bold ${getWaitTimeColor(kpiData.avgWaitTime)}`}>
                  {kpiData.avgWaitTime} min
                </p>
              </div>
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-5 h-5 text-yellow-600" />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              kpiData.avgWaitTime < kpiData.prevAvgWaitTime ? 'text-green-600' : 'text-red-600'
            }`}>
              {kpiData.avgWaitTime < kpiData.prevAvgWaitTime ? (
                <>
                  <TrendingDown className="w-3 h-3" />
                  <span>{Math.abs(kpiData.avgWaitTime - kpiData.prevAvgWaitTime)} min decrease</span>
                </>
              ) : (
                <>
                  <TrendingUp className="w-3 h-3" />
                  <span>{Math.abs(kpiData.avgWaitTime - kpiData.prevAvgWaitTime)} min increase</span>
                </>
              )}
            </div>
          </div>

          {/* Avg Service Time */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Avg Service Time</p>
                <p className="text-2xl font-bold text-gray-900">{kpiData.avgServiceTime} min</p>
              </div>
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <Timer className="w-5 h-5 text-green-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <Activity className="w-3 h-3" />
              <span>On target</span>
            </div>
          </div>

          {/* No-Show Rate */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">No-Show Rate</p>
                <p className="text-2xl font-bold text-red-600">{kpiData.noShowRate.toFixed(1)}%</p>
              </div>
              <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
            </div>
            <div className={`flex items-center gap-1 mt-2 text-xs ${
              kpiData.noShowRate < kpiData.prevNoShowRate ? 'text-green-600' : 'text-red-600'
            }`}>
              {kpiData.noShowRate < kpiData.prevNoShowRate ? (
                <ArrowDown className="w-3 h-3" />
              ) : (
                <ArrowUp className="w-3 h-3" />
              )}
              <span>{Math.abs(kpiData.noShowRate - kpiData.prevNoShowRate).toFixed(1)}% vs prev</span>
            </div>
          </div>

          {/* Peak Hour */}
          <div className="card p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Peak Hour</p>
                <p className="text-2xl font-bold text-purple-600">{kpiData.peakHour}</p>
              </div>
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Zap className="w-5 h-5 text-purple-600" />
              </div>
            </div>
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
              <span>32 patients at peak</span>
            </div>
          </div>
        </div>

        {/* Charts Row 1: Wait Time Distribution & Hourly Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Wait Time Distribution Histogram */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              Wait Time Distribution
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip 
                  formatter={(value: number | undefined) => [`${value ?? 0} patients`, 'Count']}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="count" name="Patients" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hourly Trends Chart */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              Hourly Trends
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} label={{ value: 'Patients', angle: -90, position: 'insideLeft', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} label={{ value: 'Wait (min)', angle: 90, position: 'insideRight', fontSize: 10 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="patients" name="Patients" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avgWait" name="Avg Wait" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B' }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Department Performance Table */}
        <div className="card p-4">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Department Performance
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Patients Served</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Wait</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Avg Service</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Satisfaction</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {[].map((dept: any) => (
                  <tr key={dept.name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{dept.name}</td>
                    <td className="px-4 py-3 text-right">{dept.patients}</td>
                    <td className={`px-4 py-3 text-right font-medium ${getWaitTimeColor(dept.avgWait)}`}>
                      {dept.avgWait} min
                    </td>
                    <td className="px-4 py-3 text-right">{dept.avgService} min</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Star className="w-3 h-3 text-yellow-500 fill-current" />
                        <span>{dept.satisfaction}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDeptPerformanceColor(dept.avgWait)}`}>
                        {dept.avgWait <= 15 ? 'Good' : dept.avgWait <= 25 ? 'Fair' : 'Needs Attention'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Charts Row 2: Service Point Utilization & Day-of-Week Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Service Point Utilization */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-600" />
              Service Point Utilization
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={[]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="utilization" name="Active" stackId="a" fill="#22C55E" radius={[0, 0, 0, 0]} />
                <Bar dataKey="idle" name="Idle" stackId="a" fill="#E5E7EB" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Day-of-Week Analysis */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              Day-of-Week Analysis
            </h2>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={[]}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="patients" name="Patients" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="avgWait" name="Avg Wait (min)" stroke="#F97316" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Staff Leaderboard & Recommendations Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Staff Leaderboard */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Award className="w-4 h-4 text-yellow-600" />
              Staff Leaderboard
            </h2>
            <div className="space-y-2">
              {[].map((staff: any) => (
                <div key={staff.name} className={`flex items-center justify-between p-3 rounded-lg ${
                  staff.rank === 1 ? 'bg-yellow-50 border border-yellow-200' :
                  staff.rank === 2 ? 'bg-gray-50 border border-gray-200' :
                  staff.rank === 3 ? 'bg-orange-50 border border-orange-200' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      staff.rank === 1 ? 'bg-yellow-500 text-white' :
                      staff.rank === 2 ? 'bg-gray-400 text-white' :
                      staff.rank === 3 ? 'bg-orange-400 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {staff.rank}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{staff.name}</p>
                      <p className="text-xs text-gray-500">{staff.avgService} min avg service</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-blue-600">{staff.patients}</p>
                    <p className="text-xs text-gray-500">patients</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Recommendations Panel */}
          <div className="card p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-500" />
              AI Recommendations
            </h2>
            <div className="space-y-2">
              {[].map((rec: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                  rec.priority === 'high' ? 'bg-red-50 border-red-500' :
                  rec.priority === 'medium' ? 'bg-yellow-50 border-yellow-500' :
                  'bg-blue-50 border-blue-500'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-700">{rec.message}</p>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-700' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
