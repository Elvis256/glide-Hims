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

const mockDailyStats: DailyStats[] = [
  { date: 'Mon', tests: 145, revenue: 14500, avgTurnaround: 2.3 },
  { date: 'Tue', tests: 168, revenue: 16800, avgTurnaround: 2.1 },
  { date: 'Wed', tests: 152, revenue: 15200, avgTurnaround: 2.4 },
  { date: 'Thu', tests: 189, revenue: 18900, avgTurnaround: 2.0 },
  { date: 'Fri', tests: 175, revenue: 17500, avgTurnaround: 2.2 },
  { date: 'Sat', tests: 98, revenue: 9800, avgTurnaround: 1.8 },
  { date: 'Sun', tests: 45, revenue: 4500, avgTurnaround: 1.5 },
];

const mockTestCategories: TestCategory[] = [
  { name: 'Hematology', count: 245, revenue: 12250, color: 'bg-red-500' },
  { name: 'Chemistry', count: 312, revenue: 31200, color: 'bg-blue-500' },
  { name: 'Microbiology', count: 89, revenue: 13350, color: 'bg-green-500' },
  { name: 'Immunology', count: 156, revenue: 23400, color: 'bg-purple-500' },
  { name: 'Urinalysis', count: 178, revenue: 8900, color: 'bg-yellow-500' },
  { name: 'Endocrine', count: 92, revenue: 18400, color: 'bg-pink-500' },
];

const mockTopTests = [
  { name: 'CBC', count: 189, percentage: 18 },
  { name: 'BMP', count: 156, percentage: 15 },
  { name: 'Lipid Panel', count: 134, percentage: 13 },
  { name: 'TSH', count: 112, percentage: 11 },
  { name: 'Urinalysis', count: 98, percentage: 9 },
  { name: 'HbA1c', count: 87, percentage: 8 },
  { name: 'Liver Panel', count: 76, percentage: 7 },
  { name: 'PT/INR', count: 65, percentage: 6 },
];

const mockStaffProductivity: StaffMember[] = [
  { name: 'Sarah Johnson', testsCompleted: 156, avgTime: '32 min', efficiency: 94 },
  { name: 'Mike Chen', testsCompleted: 142, avgTime: '35 min', efficiency: 89 },
  { name: 'Anna Williams', testsCompleted: 138, avgTime: '38 min', efficiency: 85 },
  { name: 'John Davis', testsCompleted: 128, avgTime: '40 min', efficiency: 82 },
  { name: 'Lisa Brown', testsCompleted: 118, avgTime: '42 min', efficiency: 78 },
];

export default function LabAnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const [dailyStats] = useState<DailyStats[]>(mockDailyStats);
  const [testCategories] = useState<TestCategory[]>(mockTestCategories);

  const summaryStats = useMemo(() => {
    const totalTests = dailyStats.reduce((acc, d) => acc + d.tests, 0);
    const totalRevenue = dailyStats.reduce((acc, d) => acc + d.revenue, 0);
    const avgTurnaround = dailyStats.reduce((acc, d) => acc + d.avgTurnaround, 0) / dailyStats.length;
    const pendingTests = 47;
    const completedToday = dailyStats[dailyStats.length - 3]?.tests || 0;

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
            {mockTopTests.map((test, idx) => (
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
                {mockStaffProductivity.map((staff) => (
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
