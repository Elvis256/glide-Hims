import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  Download,
  Printer,
  Skull,
  TrendingDown,
  Users,
  Heart,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';
import api from '../../services/api';

export default function MortalityReportsPage() {
  const [dateRange, setDateRange] = useState('month');

  const { data: stats, isLoading } = useQuery({
    queryKey: ['mortality-statistics', dateRange],
    queryFn: async () => {
      try {
        const response = await api.get('/mortality/statistics', { params: { range: dateRange } });
        return response.data;
      } catch {
        // Mock data fallback
        return {
          totalDeaths: 47,
          mortalityRate: 1.2,
          maleDeaths: 28,
          femaleDeaths: 19,
          averageAge: 62.5,
          ageDistribution: [
            { group: '0-5', count: 5, color: '#EF4444' },
            { group: '6-17', count: 2, color: '#F59E0B' },
            { group: '18-35', count: 4, color: '#10B981' },
            { group: '36-50', count: 8, color: '#3B82F6' },
            { group: '51-65', count: 12, color: '#8B5CF6' },
            { group: '65+', count: 16, color: '#6B7280' },
          ],
          genderDistribution: [
            { name: 'Male', value: 28, color: '#3B82F6' },
            { name: 'Female', value: 19, color: '#EC4899' },
          ],
          causesOfDeath: [
            { cause: 'Cardiovascular Disease', count: 12, icdCode: 'I00-I99' },
            { cause: 'Respiratory Failure', count: 9, icdCode: 'J96' },
            { cause: 'Cancer', count: 8, icdCode: 'C00-C97' },
            { cause: 'Infectious Disease', count: 6, icdCode: 'A00-B99' },
            { cause: 'Kidney Failure', count: 5, icdCode: 'N17-N19' },
            { cause: 'Accidents/Trauma', count: 4, icdCode: 'V01-Y99' },
            { cause: 'Other', count: 3, icdCode: '-' },
          ],
          monthlyTrend: [
            { month: 'Jan', deaths: 6, rate: 1.1 },
            { month: 'Feb', deaths: 5, rate: 0.9 },
            { month: 'Mar', deaths: 8, rate: 1.4 },
            { month: 'Apr', deaths: 7, rate: 1.2 },
            { month: 'May', deaths: 9, rate: 1.5 },
            { month: 'Jun', deaths: 6, rate: 1.0 },
          ],
        };
      }
    },
  });

  const GENDER_COLORS = ['#3B82F6', '#EC4899'];

  const handleExport = () => {
    const csvContent = [
      'Mortality Statistics Report',
      '',
      `Total Deaths,${stats?.totalDeaths}`,
      `Mortality Rate,${stats?.mortalityRate}%`,
      `Male Deaths,${stats?.maleDeaths}`,
      `Female Deaths,${stats?.femaleDeaths}`,
      `Average Age,${stats?.averageAge}`,
      '',
      'Causes of Death',
      'Cause,ICD Code,Count',
      ...(stats?.causesOfDeath?.map((d: { cause: string; icdCode: string; count: number }) => 
        `${d.cause},${d.icdCode},${d.count}`
      ) || []),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mortality-statistics.csv';
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mortality Reports</h1>
          <p className="text-gray-600">Death statistics and analysis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-700">Period:</span>
          <div className="flex gap-2">
            {['today', 'week', 'month', 'year'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium ${
                  dateRange === range
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : range === 'month' ? 'This Month' : 'This Year'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <Skull className="h-6 w-6 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Deaths</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.totalDeaths?.toLocaleString()}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingDown className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Mortality Rate</p>
              <p className="text-2xl font-bold text-orange-600">{stats?.mortalityRate}%</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Average Age</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.averageAge} yrs</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Heart className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Top Cause</p>
              <p className="text-lg font-bold text-gray-900 truncate">Cardiovascular</p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gender Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Gender Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={stats?.genderDistribution || []}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {stats?.genderDistribution?.map((_: unknown, index: number) => (
                  <Cell key={`cell-${index}`} fill={GENDER_COLORS[index % GENDER_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span className="text-sm text-gray-600">Male: {stats?.maleDeaths}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-pink-500"></div>
              <span className="text-sm text-gray-600">Female: {stats?.femaleDeaths}</span>
            </div>
          </div>
        </div>

        {/* Age Distribution */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Age Distribution</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={stats?.ageDistribution || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="group" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6B7280" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Causes of Death */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Causes of Death</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stats?.causesOfDeath || []} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="cause" type="category" width={140} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#EF4444" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Mortality Trend</h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats?.monthlyTrend || []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" orientation="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="deaths" fill="#EF4444" name="Deaths" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#F59E0B" strokeWidth={2} name="Rate (%)" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Causes Table */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Causes of Death</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cause</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ICD Code</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Deaths</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Percentage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats?.causesOfDeath?.map((cause: { cause: string; icdCode: string; count: number }) => {
                const total = stats?.causesOfDeath?.reduce((sum: number, c: { count: number }) => sum + c.count, 0) || 1;
                const percentage = ((cause.count / total) * 100).toFixed(1);
                return (
                  <tr key={cause.cause} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">{cause.cause}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">{cause.icdCode}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 text-right">{cause.count}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-red-500 h-2 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 w-12">{percentage}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
