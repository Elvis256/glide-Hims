import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Clock,
  Users,
  CheckCircle,
  Loader2,
  AlertCircle,
  Download,
  TrendingUp,
  Zap,
  AlertTriangle,
  Star,
  Calendar,
} from 'lucide-react';
import AccessDenied from '../components/AccessDenied';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { queueService } from '../services/queue';
import { usePermissions } from '../components/PermissionGate';

interface QueuePerformanceData {
  avgWaitTime: number;
  avgServiceTime: number;
  patientsServed: number;
  peakHour: string;
  waiting: number;
  inService: number;
  completed: number;
  waitTimeTrend: { time: string; waitTime: number }[];
  departmentComparison: { department: string; avgWait: number; avgService: number }[];
  bottleneckAnalysis: { stage: string; duration: number; percentage: number }[];
  staffEfficiency: {
    name: string;
    avgServiceTime: number;
    patientsServed: number;
    satisfaction: number;
  }[];
  satisfactionScore: number | null;
  byServicePoint: Record<string, { waiting: number; inService: number }>;
}

export default function QueuePerformancePage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const canView = hasPermission('reports.read');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['queue-performance', startDate, endDate],
    queryFn: async () => {
      const stats = await queueService.getStats();
      return {
        avgWaitTime: stats.averageWaitMinutes || 0,
        avgServiceTime: stats.averageServiceMinutes || 0,
        patientsServed: stats.completed || 0,
        peakHour: '-',
        waiting: stats.waiting || 0,
        inService: stats.inService || 0,
        completed: stats.completed || 0,
        waitTimeTrend: [],
        departmentComparison: [],
        bottleneckAnalysis: [],
        staffEfficiency: [],
        satisfactionScore: null,
        byServicePoint: {},
      } as QueuePerformanceData;
    },
    enabled: canView,
  });

  const handleExportCSV = () => {
    if (!data) return;
    const csvContent = [
      'Queue Performance Report',
      `Date: ${startDate} to ${endDate}`,
      '',
      'KPIs',
      `Average Wait Time,${data.avgWaitTime} minutes`,
      `Average Service Time,${data.avgServiceTime} minutes`,
      `Patients Served,${data.patientsServed}`,
      `Peak Hour,${data.peakHour}`,
      `Patient Satisfaction,${data.satisfactionScore}/5`,
      '',
      'Wait Time Trend',
      'Time,Wait (min)',
      ...data.waitTimeTrend.map((t) => `${t.time},${t.waitTime}`),
      '',
      'Department Comparison',
      'Department,Avg Wait (min),Avg Service (min)',
      ...data.departmentComparison.map((d) => `${d.department},${d.avgWait},${d.avgService}`),
      '',
      'Bottleneck Analysis',
      'Stage,Duration (min),% of Total',
      ...data.bottleneckAnalysis.map((b) => `${b.stage},${b.duration},${b.percentage}%`),
      '',
      'Staff Efficiency',
      'Name,Avg Service Time,Patients Served,Satisfaction',
      ...data.staffEfficiency.map(
        (s) => `${s.name},${s.avgServiceTime},${s.patientsServed},${s.satisfaction}`,
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `queue-performance-${startDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getWaitTimeColor = (wait: number) => {
    if (wait <= 10) return 'text-green-600';
    if (wait <= 20) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!canView) {
    return <AccessDenied />;
  }

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-2">Error Loading Data</p>
          <p className="text-gray-500 text-sm">Failed to load queue performance data</p>
          <button onClick={() => refetch()} className="mt-4 btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Queue Performance</h1>
              <p className="text-gray-500 text-sm">Wait times and service efficiency</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="input py-1.5 text-sm"
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="input py-1.5 text-sm"
          />
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Main Content */}
      {data && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-5 gap-4 flex-shrink-0">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className={`text-2xl font-bold ${getWaitTimeColor(data.avgWaitTime)}`}>
                    {data.avgWaitTime}m
                  </p>
                  <p className="text-xs text-gray-500">Avg Wait Time</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Zap className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">{data.avgServiceTime}m</p>
                  <p className="text-xs text-gray-500">Avg Service Time</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{data.patientsServed}</p>
                  <p className="text-xs text-gray-500">Patients Served</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-orange-600">
                    {data.peakHour.split(' - ')[0]}
                  </p>
                  <p className="text-xs text-gray-500">Peak Hour</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Star className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {data.satisfactionScore ? `${data.satisfactionScore}/5` : 'N/A'}
                  </p>
                  <p className="text-xs text-gray-500">Satisfaction</p>
                </div>
              </div>
            </div>
          </div>

          {/* Current Status Row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 bg-yellow-50 border-yellow-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-yellow-600">{data.waiting}</p>
                  <p className="text-sm text-yellow-700">Currently Waiting</p>
                </div>
                <Users className="w-8 h-8 text-yellow-400" />
              </div>
            </div>
            <div className="card p-4 bg-blue-50 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-blue-600">{data.inService}</p>
                  <p className="text-sm text-blue-700">In Service</p>
                </div>
                <Activity className="w-8 h-8 text-blue-400" />
              </div>
            </div>
            <div className="card p-4 bg-green-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-green-600">{data.completed}</p>
                  <p className="text-sm text-green-700">Completed Today</p>
                </div>
                <CheckCircle className="w-8 h-8 text-green-400" />
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Wait Time Trends */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Wait Time Trends (Today)
              </h3>
              {data.waitTimeTrend.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={data.waitTimeTrend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} unit="m" />
                    <Tooltip formatter={(value: number | undefined) => [`${value ?? 0} min`, 'Wait Time']} />
                    <Line
                      type="monotone"
                      dataKey="waitTime"
                      stroke="#3B82F6"
                      strokeWidth={2}
                      dot={{ fill: '#3B82F6' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
                  No data available
                </div>
              )}
            </div>

            {/* Department Comparison */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-600" />
                Department Comparison
              </h3>
              {data.departmentComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.departmentComparison} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="m" />
                    <YAxis dataKey="department" type="category" width={80} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="avgWait" name="Avg Wait" fill="#F59E0B" radius={[0, 4, 4, 0]} />
                    <Bar
                      dataKey="avgService"
                      name="Avg Service"
                      fill="#3B82F6"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[220px] text-gray-400 text-sm">
                  No data available
                </div>
              )}
            </div>
          </div>

          {/* Bottleneck Analysis and Staff Efficiency */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Bottleneck Analysis */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                Bottleneck Analysis (Longest Wait Stages)
              </h3>
              <div className="space-y-3">
                {data.bottleneckAnalysis.length > 0 ? (
                  data.bottleneckAnalysis.slice(0, 5).map((b, idx) => (
                  <div key={b.stage}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                            idx === 0
                              ? 'bg-red-100 text-red-700'
                              : idx === 1
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium">{b.stage}</span>
                      </div>
                      <span
                        className={`text-sm font-bold ${
                          b.duration > 20
                            ? 'text-red-600'
                            : b.duration > 10
                              ? 'text-orange-600'
                              : 'text-green-600'
                        }`}
                      >
                        {b.duration}m
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          b.duration > 20
                            ? 'bg-red-500'
                            : b.duration > 10
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(b.percentage * 2, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">No data available</p>
                )}
              </div>
            </div>

            {/* Staff Efficiency */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Users className="w-4 h-4 text-green-600" />
                Staff Efficiency
              </h3>
              <div className="overflow-x-auto">
                {data.staffEfficiency.length > 0 ? (
                  <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                        Staff
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Avg Time
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Served
                      </th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                        Rating
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {data.staffEfficiency.map((s) => (
                      <tr key={s.name} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium">{s.name}</td>
                        <td className="px-3 py-2 text-right">{s.avgServiceTime}m</td>
                        <td className="px-3 py-2 text-right font-medium text-blue-600">
                          {s.patientsServed}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                            <span className="text-yellow-600">{s.satisfaction}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                ) : (
                  <p className="text-gray-400 text-sm text-center py-4">No data available</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
