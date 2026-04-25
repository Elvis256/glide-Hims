import { useQuery } from '@tanstack/react-query';
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
} from 'recharts';
import {
  Users,
  UserCheck,
  UserPlus,
  Activity,
  TrendingUp,
  Clock,
  Calendar,
  CalendarDays,
} from 'lucide-react';
import api from '../../services/api';

interface AdminDashboardData {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
  };
  patientStats: {
    totalPatients: number;
    newPatientsThisMonth: number;
    newPatientsLastMonth: number;
  };
  moduleUsage: { module: string; count: number }[];
  recentActivity: {
    totalActionsToday: number;
    totalActionsThisWeek: number;
    totalActionsThisMonth: number;
  };
  userActivityTrend: { date: string; logins: number; actions: number }[];
  topUsers: {
    username: string;
    fullName: string;
    actionCount: number;
    lastLogin: string | null;
  }[];
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  const classes = colorMap[color] || colorMap.blue;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-lg ${classes}`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold text-gray-900">
            {value.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function AdminAnalyticsDashboardPage() {
  const { data, isLoading, error } = useQuery<AdminDashboardData>({
    queryKey: ['admin-analytics'],
    queryFn: () =>
      api.get('/analytics/admin-dashboard').then((r) => r.data?.data || r.data),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-700 rounded-lg p-4">
          Failed to load analytics data. Please try again later.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          System-wide usage and activity overview
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={data.userStats.totalUsers}
          color="blue"
        />
        <StatCard
          icon={UserCheck}
          label="Active Users (30d)"
          value={data.userStats.activeUsers}
          color="green"
        />
        <StatCard
          icon={Activity}
          label="Total Patients"
          value={data.patientStats.totalPatients}
          color="purple"
        />
        <StatCard
          icon={UserPlus}
          label="New Patients This Month"
          value={data.patientStats.newPatientsThisMonth}
          color="orange"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Activity Trend */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            User Activity Trend (30 Days)
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.userActivityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDate}
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis fontSize={12} tick={{ fill: '#6b7280' }} />
                <Tooltip
                  labelFormatter={(label) => formatShortDate(label as string)}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="logins"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Logins"
                />
                <Line
                  type="monotone"
                  dataKey="actions"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={false}
                  name="Actions"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Module Usage */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-600" />
            Module Usage
          </h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.moduleUsage.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" fontSize={12} tick={{ fill: '#6b7280' }} />
                <YAxis
                  dataKey="module"
                  type="category"
                  width={120}
                  fontSize={12}
                  tick={{ fill: '#6b7280' }}
                />
                <Tooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Actions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Activity Summary + Top Users */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Summary */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Activity Summary
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Today</p>
              <p className="text-xl font-bold text-gray-900">
                {data.recentActivity.totalActionsToday.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-green-50 text-green-600">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">This Week</p>
              <p className="text-xl font-bold text-gray-900">
                {data.recentActivity.totalActionsThisWeek.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="p-2 rounded-lg bg-purple-50 text-purple-600">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">This Month</p>
              <p className="text-xl font-bold text-gray-900">
                {data.recentActivity.totalActionsThisMonth.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Top Users Table */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Top 10 Active Users
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    User
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Actions
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Last Login
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.topUsers.map((user, i) => (
                  <tr
                    key={user.username}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {user.fullName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.username}
                      </div>
                    </td>
                    <td className="text-right px-4 py-3 font-semibold text-gray-900">
                      {user.actionCount.toLocaleString()}
                    </td>
                    <td className="text-right px-4 py-3 text-gray-500">
                      {formatDate(user.lastLogin)}
                    </td>
                  </tr>
                ))}
                {data.topUsers.length === 0 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="px-4 py-8 text-center text-gray-400"
                    >
                      No user activity data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
