import { useState } from 'react';
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
} from 'lucide-react';

interface DailyStats {
  hour: string;
  patients: number;
  avgWait: number;
}

// Mock analytics data
const hourlyData: DailyStats[] = [
  { hour: '08:00', patients: 12, avgWait: 8 },
  { hour: '09:00', patients: 24, avgWait: 15 },
  { hour: '10:00', patients: 32, avgWait: 22 },
  { hour: '11:00', patients: 28, avgWait: 18 },
  { hour: '12:00', patients: 15, avgWait: 10 },
  { hour: '13:00', patients: 18, avgWait: 12 },
  { hour: '14:00', patients: 30, avgWait: 20 },
  { hour: '15:00', patients: 25, avgWait: 16 },
  { hour: '16:00', patients: 18, avgWait: 12 },
  { hour: '17:00', patients: 10, avgWait: 8 },
];

const departmentStats = [
  { name: 'General OPD', patients: 85, avgWait: 18, change: 5 },
  { name: 'Pediatrics', patients: 42, avgWait: 12, change: -3 },
  { name: 'Cardiology', patients: 28, avgWait: 25, change: 8 },
  { name: 'Gynecology', patients: 35, avgWait: 15, change: 2 },
  { name: 'Orthopedics', patients: 22, avgWait: 20, change: -5 },
];

const staffPerformance = [
  { name: 'Dr. Sarah Nambi', patients: 32, avgService: 12, satisfaction: 4.8 },
  { name: 'Dr. James Okello', patients: 28, avgService: 15, satisfaction: 4.6 },
  { name: 'Dr. Francis Olweny', patients: 18, avgService: 20, satisfaction: 4.9 },
  { name: 'Dr. Mary Apio', patients: 24, avgService: 10, satisfaction: 4.7 },
];

export default function QueueAnalyticsPage() {
  const [dateRange, setDateRange] = useState('today');

  const maxPatients = Math.max(...hourlyData.map(d => d.patients));

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Queue Analytics</h1>
            <p className="text-gray-500 text-sm">Queue performance and insights</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['today', 'week', 'month'].map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1.5 rounded text-sm font-medium capitalize ${
                dateRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {range === 'today' ? 'Today' : range === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">212</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
            <ArrowUp className="w-3 h-3" />
            <span>12% from yesterday</span>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Avg Wait Time</p>
              <p className="text-2xl font-bold text-gray-900">16 min</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
            <ArrowUp className="w-3 h-3" />
            <span>3 min increase</span>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">No-Shows</p>
              <p className="text-2xl font-bold text-gray-900">8</p>
            </div>
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
            <ArrowDown className="w-3 h-3" />
            <span>2 less than avg</span>
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Avg Service</p>
              <p className="text-2xl font-bold text-gray-900">14 min</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
            <span>On target</span>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0 overflow-hidden">
        {/* Hourly Distribution Chart */}
        <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Hourly Patient Flow</h2>
          <div className="flex-1 flex items-end gap-1 min-h-0">
            {hourlyData.map((data, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col items-center gap-1 mb-2">
                  <span className="text-xs text-gray-600">{data.patients}</span>
                  <div
                    className="w-full bg-blue-500 rounded-t transition-all"
                    style={{ height: `${(data.patients / maxPatients) * 120}px` }}
                  />
                </div>
                <span className="text-xs text-gray-500">{data.hour}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Department Performance */}
        <div className="card p-4 flex flex-col min-h-0">
          <h2 className="text-sm font-semibold mb-3 flex-shrink-0">By Department</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {departmentStats.map((dept, idx) => (
              <div key={idx} className="p-2 bg-gray-50 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{dept.name}</span>
                  <span className={`text-xs flex items-center gap-0.5 ${
                    dept.change > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {dept.change > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                    {Math.abs(dept.change)}%
                  </span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{dept.patients} patients</span>
                  <span>{dept.avgWait} min avg</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full"
                    style={{ width: `${(dept.patients / 100) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Performance */}
        <div className="lg:col-span-3 card p-4">
          <h2 className="text-sm font-semibold mb-3">Staff Performance</h2>
          <div className="grid grid-cols-4 gap-4">
            {staffPerformance.map((staff, idx) => (
              <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                <p className="font-medium text-gray-900 text-sm">{staff.name}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-blue-600">{staff.patients}</p>
                    <p className="text-xs text-gray-500">Patients</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-yellow-600">{staff.avgService}m</p>
                    <p className="text-xs text-gray-500">Avg Time</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-green-600">⭐ {staff.satisfaction}</p>
                    <p className="text-xs text-gray-500">Rating</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
