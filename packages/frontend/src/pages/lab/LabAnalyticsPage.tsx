import { usePermissions } from '../../components/PermissionGate';
import AccessDenied from '../../components/AccessDenied';
import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  Users,
  FlaskConical,
  CheckCircle,
  AlertCircle,
  Calendar,
  ArrowUp,
  ArrowDown,
  Activity,
  Timer,
} from 'lucide-react';

interface DailyStats {
  date: string;
  tests: number;
  revenue: number;
  avgTurnaround: number;
}

interface TestCategory {
  name: string;
  count: number;
  revenue: number;
  color: string;
}

interface StaffMember {
  name: string;
  testsCompleted: number;
  avgTime: string;
  efficiency: number;
}

const topTests: { name: string; count: number; percentage: number }[] = [
  { name: 'Complete Blood Count (CBC)', count: 245, percentage: 22 },
  { name: 'Urinalysis', count: 198, percentage: 18 },
  { name: 'Blood Glucose', count: 156, percentage: 14 },
  { name: 'Lipid Panel', count: 134, percentage: 12 },
  { name: 'Liver Function Tests', count: 98, percentage: 9 },
  { name: 'Kidney Function Tests', count: 87, percentage: 8 },
  { name: 'Thyroid Panel', count: 76, percentage: 7 },
  { name: 'HbA1c', count: 65, percentage: 6 },
];

const staffProductivity: StaffMember[] = [
  { name: 'Tech. Sarah Nambi', testsCompleted: 156, avgTime: '18 min', efficiency: 95 },
  { name: 'Tech. John Okello', testsCompleted: 142, avgTime: '22 min', efficiency: 88 },
  { name: 'Tech. Mary Achieng', testsCompleted: 138, avgTime: '20 min', efficiency: 91 },
  { name: 'Tech. Peter Mukasa', testsCompleted: 124, avgTime: '25 min', efficiency: 82 },
];

// Generate sample daily stats for the past 7 days
const generateDailyStats = (): DailyStats[] => {
  const stats: DailyStats[] = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    stats.push({
      date: date.toISOString().split('T')[0],
      tests: Math.floor(Math.random() * 80) + 60,
      revenue: Math.floor(Math.random() * 2000000) + 1500000,
      avgTurnaround: Math.floor(Math.random() * 15) + 20,
    });
  }
  return stats;
};

const defaultTestCategories: TestCategory[] = [
  { name: 'Hematology', count: 312, revenue: 4680000, color: 'bg-red-500' },
  { name: 'Chemistry', count: 287, revenue: 5740000, color: 'bg-blue-500' },
  { name: 'Microbiology', count: 156, revenue: 3900000, color: 'bg-green-500' },
  { name: 'Immunology', count: 98, revenue: 2940000, color: 'bg-purple-500' },
  { name: 'Urinalysis', count: 198, revenue: 1980000, color: 'bg-yellow-500' },
];

export default function LabAnalyticsPage() {
  const { hasPermission } = usePermissions();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [dailyStats] = useState<DailyStats[]>(generateDailyStats());
  const [testCategories] = useState<TestCategory[]>(defaultTestCategories);

  if (!hasPermission('lab.read')) {
    return <AccessDenied />;
  }

  const summaryStats = useMemo(() => {
    const totalTests = dailyStats.reduce((acc, d) => acc + d.tests, 0);
    const totalRevenue = dailyStats.reduce((acc, d) => acc + d.revenue, 0);
    const avgTurnaround = dailyStats.length > 0 ? dailyStats.reduce((acc, d) => acc + d.avgTurnaround, 0) / dailyStats.length : 0;
    const pendingTests = 0;
    const completedToday = 0;

    return { totalTests, totalRevenue, avgTurnaround, pendingTests, completedToday };
  }, [dailyStats]);

  const maxDailyTests = Math.max(...dailyStats.map((d) => d.tests));
  const totalCategoryTests = testCategories.reduce((acc, c) => acc + c.count, 0);

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
            <span className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUp className="w-4 h-4" /> 12%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{summaryStats.totalTests}</p>
          <p className="text-sm text-gray-500">Total Tests ({timeRange})</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 p-1.5 bg-green-100 text-green-600 rounded-lg" />
            <span className="flex items-center gap-1 text-sm text-green-600">
              <ArrowUp className="w-4 h-4" /> 8%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900">${summaryStats.totalRevenue.toLocaleString()}</p>
          <p className="text-sm text-gray-500">Revenue ({timeRange})</p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <Clock className="w-8 h-8 p-1.5 bg-purple-100 text-purple-600 rounded-lg" />
            <span className="flex items-center gap-1 text-sm text-green-600">
              <ArrowDown className="w-4 h-4" /> 5%
            </span>
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
                    {day.tests} tests • ${day.revenue}
                  </div>
                </div>
                <p className="text-sm font-medium text-gray-700 mt-2">{day.date}</p>
                <p className="text-xs text-gray-500">{day.tests}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Revenue by Category</h3>
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
                  <span className="text-gray-900 font-medium">${category.revenue.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${category.color} rounded-full`}
                    style={{ width: `${(category.count / totalCategoryTests) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{category.count} tests</p>
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
                  strokeDasharray={`${(summaryStats.completedToday / (summaryStats.completedToday + summaryStats.pendingTests)) * 377} 377`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-2xl font-bold text-gray-900">
                  {Math.round((summaryStats.completedToday / (summaryStats.completedToday + summaryStats.pendingTests)) * 100)}%
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
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Tests</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Avg Time</th>
                  <th className="px-2 py-2 text-left font-medium text-gray-600">Efficiency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffProductivity.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-2 py-8 text-center text-gray-500">No staff data</td>
                  </tr>
                )}
                {staffProductivity.map((staff) => (
                  <tr key={staff.name}>
                    <td className="px-2 py-2 font-medium text-gray-700">{staff.name}</td>
                    <td className="px-2 py-2">{staff.testsCompleted}</td>
                    <td className="px-2 py-2 flex items-center gap-1">
                      <Timer className="w-3 h-3 text-gray-400" />
                      {staff.avgTime}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              staff.efficiency >= 90 ? 'bg-green-500' :
                              staff.efficiency >= 80 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${staff.efficiency}%` }}
                          />
                        </div>
                        <span className="text-gray-600">{staff.efficiency}%</span>
                      </div>
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
