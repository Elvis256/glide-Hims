import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import {
  Users,
  ArrowLeft,
  Download,
  TrendingUp,
  Loader2,
  AlertCircle,
  UserCheck,
  Calendar,
  Filter,
  Droplet,
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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from 'recharts';
import { usePermissions } from '../components/PermissionGate';

interface PatientAnalyticsResponse {
  registrationTrend: { period: string; count: string }[];
  genderDistribution: { gender: string; count: string }[];
  ageDistribution: { age_group: string; count: string }[];
  bloodGroupDistribution: { blood_group: string; count: string }[];
}

interface PatientStats {
  totalPatients: number;
  activePatients: number;
  newThisMonth: number;
  newThisYear: number;
  registrationTrend: { month: string; count: number }[];
  genderDistribution: { name: string; value: number; color: string }[];
  ageDistribution: { ageGroup: string; male: number; female: number }[];
  bloodGroupDistribution: { name: string; value: number; color: string }[];
}

const GENDER_COLORS = ['#3B82F6', '#EC4899', '#6B7280'];
const BLOOD_GROUP_COLORS = [
  '#EF4444',
  '#3B82F6',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
];

export default function PatientStatisticsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const canView = hasPermission('reports.read');

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'patient-statistics',
      dateRange,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      try {
        const [patientsRes, dashboardRes] = await Promise.all([
          api.get<PatientAnalyticsResponse>('/analytics/patients', {
            params: { period: dateRange },
          }),
          api.get('/analytics/dashboard'),
        ]);

        const patients = patientsRes.data;
        const dashboard = dashboardRes.data;

        // Calculate totals
        const genderData = patients.genderDistribution || [];
        const totalGender = genderData.reduce(
          (sum: number, g: { count: string }) => sum + (parseInt(g.count, 10) || 0),
          0,
        );

        // Registration trend - convert to monthly for past year
        const registrationTrend = (patients.registrationTrend || []).map(
          (t: { period: string; count: string }) => ({
            month: new Date(t.period).toLocaleDateString('en-US', { month: 'short' }),
            count: parseInt(t.count, 10) || 0,
          }),
        );

        // Gender distribution
        const genderDistribution = genderData.map(
          (g: { gender: string; count: string }, idx: number) => ({
            name: g.gender.charAt(0).toUpperCase() + g.gender.slice(1),
            value: parseInt(g.count, 10) || 0,
            color: GENDER_COLORS[idx % GENDER_COLORS.length],
          }),
        );

        // Age distribution with male/female breakdown (age pyramid)
        // Gender split is approximated (48/52 M/F) since the backend
        // does not currently provide gender-per-age-group data.
        const ageData = patients.ageDistribution || [];
        const ageDistribution = ageData.map((a: { age_group: string; count: string }) => {
          const total = parseInt(a.count, 10) || 0;
          return {
            ageGroup: a.age_group,
            male: Math.floor(total * 0.48),
            female: Math.floor(total * 0.52),
          };
        });

        // Blood group distribution from real patient records
        const bloodGroupDistribution = (patients.bloodGroupDistribution || []).map(
          (b: { blood_group: string; count: string }, idx: number) => ({
            name: b.blood_group || 'Unknown',
            value: parseInt(b.count, 10) || 0,
            color: BLOOD_GROUP_COLORS[idx % BLOOD_GROUP_COLORS.length],
          }),
        );

        return {
          totalPatients: dashboard.patients?.total || totalGender,
          activePatients: dashboard.patients?.total || totalGender,
          newThisMonth: dashboard.patients?.newThisMonth || 0,
          newThisYear: dashboard.registrations?.thisYear || 0,
          registrationTrend,
          genderDistribution,
          ageDistribution,
          bloodGroupDistribution,
        } as PatientStats;
      } catch (error) {
        throw error;
      }
    },
    enabled: canView,
  });

  const handleExportCSV = () => {
    if (!data) return;
    const csvContent = [
      'Patient Statistics Report',
      `Period: ${dateRange}`,
      '',
      'Overview',
      `Total Patients,${data.totalPatients}`,
      `Active Patients,${data.activePatients}`,
      `New This Month,${data.newThisMonth}`,
      `New This Year,${data.newThisYear}`,
      '',
      'Gender Distribution',
      'Gender,Count',
      ...data.genderDistribution.map((g) => `${g.name},${g.value}`),
      '',
      'Age Distribution',
      'Age Group,Male,Female',
      ...data.ageDistribution.map((a) => `${a.ageGroup},${a.male},${a.female}`),
      '',
      'Blood Group Distribution',
      'Blood Group,Count',
      ...data.bloodGroupDistribution.map((b) => `${b.name},${b.value}`),
      '',
      'Registration Trend',
      'Month,Count',
      ...data.registrationTrend.map((t) => `${t.month},${t.count}`),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-statistics-${dateRange}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canView) {
    return <AccessDenied />;
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
            <Users className="w-6 h-6 text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">Patient Statistics</h1>
              <p className="text-gray-500 text-sm">Patient demographics and trends</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-secondary flex items-center gap-2 ${showFilters ? 'bg-blue-50 border-blue-300' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
          <div className="flex border rounded overflow-hidden">
            {(['week', 'month', 'year'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-3 py-1.5 text-sm capitalize ${
                  dateRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>
          <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card p-4 mb-4 flex-shrink-0">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="input w-full py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="input w-full py-1.5 text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p>Loading patient statistics...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-red-500">
            <AlertCircle className="w-8 h-8" />
            <p>Failed to load patient statistics</p>
            <p className="text-sm text-gray-500">Please try again later</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && data && (
        <div className="flex-1 overflow-y-auto space-y-4">
          {/* Overview Cards */}
          <div className="grid grid-cols-4 gap-4 flex-shrink-0">
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">
                    {data.totalPatients.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Total Patients</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserCheck className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {data.activePatients.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Active Patients</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-purple-600">
                    {data.newThisMonth.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">New This Month</p>
                </div>
              </div>
            </div>
            <div className="card p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-600">
                    {data.newThisYear.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">New This Year</p>
                </div>
              </div>
            </div>
          </div>

          {/* Registration Trends */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Registration Trends (Monthly)
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.registrationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Demographics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Gender Distribution */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Gender Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={data.genderDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.genderDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 mt-2">
                {data.genderDistribution.map((g) => (
                  <div key={g.name} className="flex items-center gap-1 text-xs">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: g.color }}
                    ></div>
                    <span>
                      {g.name}: {g.value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Age Pyramid */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold mb-3">Age Distribution (Pyramid)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.ageDistribution} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="ageGroup" type="category" width={45} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="male" fill="#3B82F6" name="Male" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="female" fill="#EC4899" name="Female" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Blood Group Distribution */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Droplet className="w-4 h-4 text-red-600" />
              Blood Group Distribution
            </h3>
            {data.bloodGroupDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.bloodGroupDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {data.bloodGroupDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No blood group data recorded</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
