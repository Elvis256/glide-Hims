import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Download,
  Calendar,
  TrendingUp,
  TrendingDown,
  UserPlus,
  UserCheck,
  Clock,
  MapPin,
} from 'lucide-react';

interface PatientStats {
  totalPatients: number;
  newThisMonth: number;
  newThisWeek: number;
  newToday: number;
  activePatients: number;
  inactivePatients: number;
  avgAge: number;
  genderDistribution: { male: number; female: number; other: number };
  ageGroups: { label: string; count: number; percentage: number }[];
  registrationTrend: { month: string; count: number }[];
  topLocations: { location: string; count: number }[];
  bloodGroupDistribution: { group: string; count: number }[];
}

// Mock data
const mockStats: PatientStats = {
  totalPatients: 12847,
  newThisMonth: 342,
  newThisWeek: 78,
  newToday: 12,
  activePatients: 8542,
  inactivePatients: 4305,
  avgAge: 34,
  genderDistribution: { male: 5823, female: 6892, other: 132 },
  ageGroups: [
    { label: '0-5 years', count: 1542, percentage: 12 },
    { label: '6-17 years', count: 1928, percentage: 15 },
    { label: '18-35 years', count: 4112, percentage: 32 },
    { label: '36-55 years', count: 3212, percentage: 25 },
    { label: '56-70 years', count: 1542, percentage: 12 },
    { label: '70+ years', count: 511, percentage: 4 },
  ],
  registrationTrend: [
    { month: 'Aug', count: 285 },
    { month: 'Sep', count: 312 },
    { month: 'Oct', count: 298 },
    { month: 'Nov', count: 325 },
    { month: 'Dec', count: 356 },
    { month: 'Jan', count: 342 },
  ],
  topLocations: [
    { location: 'Kampala', count: 4523 },
    { location: 'Gulu', count: 2134 },
    { location: 'Lira', count: 1856 },
    { location: 'Jinja', count: 1245 },
    { location: 'Mbale', count: 987 },
  ],
  bloodGroupDistribution: [
    { group: 'O+', count: 4856 },
    { group: 'A+', count: 3245 },
    { group: 'B+', count: 2567 },
    { group: 'AB+', count: 856 },
    { group: 'O-', count: 523 },
    { group: 'A-', count: 412 },
    { group: 'B-', count: 298 },
    { group: 'AB-', count: 90 },
  ],
};

export default function PatientStatisticsPage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState('month');

  const data = mockStats;
  const maxTrend = Math.max(...data.registrationTrend.map(t => t.count));

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
          <div className="flex border rounded overflow-hidden">
            {['week', 'month', 'year'].map((range) => (
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
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-6 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-900">{data.totalPatients.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Total Patients</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{data.newThisMonth}</p>
          <p className="text-xs text-gray-500">This Month</p>
          <p className="text-xs text-green-600 flex items-center justify-center gap-1 mt-1">
            <TrendingUp className="w-3 h-3" />
            +8%
          </p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{data.newThisWeek}</p>
          <p className="text-xs text-gray-500">This Week</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">{data.newToday}</p>
          <p className="text-xs text-gray-500">Today</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{data.activePatients.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Active</p>
        </div>
        <div className="card p-3 text-center">
          <p className="text-2xl font-bold text-gray-400">{data.inactivePatients.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Inactive</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Registration Trend */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Registration Trend</h2>
          <div className="flex-1 flex items-end gap-2 min-h-0 pb-6">
            {data.registrationTrend.map((item, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <span className="text-xs text-gray-600 mb-1">{item.count}</span>
                <div
                  className="w-full bg-blue-500 rounded-t transition-all"
                  style={{ height: `${(item.count / maxTrend) * 100}px` }}
                />
                <span className="text-xs text-gray-500 mt-2">{item.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Gender Distribution */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Gender Distribution</h2>
          <div className="flex-1 flex flex-col justify-center space-y-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-4 mb-3">
                <div>
                  <p className="text-2xl font-bold text-blue-600">{data.genderDistribution.male.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Male</p>
                </div>
                <div className="w-px h-12 bg-gray-200" />
                <div>
                  <p className="text-2xl font-bold text-pink-600">{data.genderDistribution.female.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Female</p>
                </div>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="h-3 bg-gradient-to-r from-blue-500 to-pink-500"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-blue-600">{Math.round(data.genderDistribution.male / data.totalPatients * 100)}%</span>
                <span className="text-pink-600">{Math.round(data.genderDistribution.female / data.totalPatients * 100)}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Age Groups */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Age Distribution</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {data.ageGroups.map((group, idx) => (
              <div key={idx}>
                <div className="flex justify-between text-xs mb-1">
                  <span>{group.label}</span>
                  <span className="font-medium">{group.percentage}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${group.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t mt-3 flex-shrink-0">
            <p className="text-center text-sm">
              Average Age: <span className="font-bold text-blue-600">{data.avgAge} years</span>
            </p>
          </div>
        </div>

        {/* Top Locations */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
            <MapPin className="w-4 h-4 text-red-600" />
            Top Locations
          </h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {data.topLocations.map((loc, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-medium">
                    {idx + 1}
                  </span>
                  <span className="font-medium">{loc.location}</span>
                </div>
                <span className="text-gray-600">{loc.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Blood Groups */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Blood Group Distribution</h2>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-2">
              {data.bloodGroupDistribution.map((bg, idx) => (
                <div key={idx} className="text-center p-2 bg-red-50 rounded-lg">
                  <p className="text-lg font-bold text-red-600">🩸 {bg.group}</p>
                  <p className="text-xs text-gray-600">{bg.count.toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
