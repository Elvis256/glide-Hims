import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Bed,
  Calendar,
  Clock,
  DollarSign,
  Users,
  Activity,
  Heart,
  Syringe,
  Building2,
  ArrowUp,
  ArrowDown,
  Minus,
  Filter,
  Download,
  RefreshCw,
} from 'lucide-react';

interface WardStats {
  name: string;
  totalBeds: number;
  occupied: number;
  available: number;
  occupancyRate: number;
  avgLOS: number;
  revenue: number;
}

interface MonthlyTrend {
  month: string;
  admissions: number;
  discharges: number;
  avgLOS: number;
  revenue: number;
}

interface SurgeryStats {
  procedure: string;
  count: number;
  successRate: number;
  avgDuration: number;
}

interface MortalityData {
  ward: string;
  deaths: number;
  admissions: number;
  rate: number;
}

const mockWardStats: WardStats[] = [];

const mockMonthlyTrends: MonthlyTrend[] = [];

const mockSurgeryStats: SurgeryStats[] = [];

const mockMortalityData: MortalityData[] = [];

export default function IPDAnalyticsPage() {
  const [dateRange, setDateRange] = useState('month');
  const [selectedWard, setSelectedWard] = useState<string>('All');

  const overallStats = useMemo(() => {
    if (mockWardStats.length === 0 || mockMonthlyTrends.length === 0) {
      return {
        occupancyRate: 0,
        avgLOS: '0.0',
        totalAdmissions: 0,
        admissionChange: '0.0',
        totalDischarges: 0,
        dischargeChange: '0.0',
        totalRevenue: 0,
        revenueChange: '0.0',
      };
    }
    const totalBeds = mockWardStats.reduce((sum, w) => sum + w.totalBeds, 0);
    const totalOccupied = mockWardStats.reduce((sum, w) => sum + w.occupied, 0);
    const totalRevenue = mockWardStats.reduce((sum, w) => sum + w.revenue, 0);
    const avgLOS = mockWardStats.reduce((sum, w) => sum + w.avgLOS, 0) / mockWardStats.length;
    const latestMonth = mockMonthlyTrends[mockMonthlyTrends.length - 1];
    const previousMonth = mockMonthlyTrends[mockMonthlyTrends.length - 2];

    return {
      occupancyRate: Math.round((totalOccupied / totalBeds) * 100),
      avgLOS: avgLOS.toFixed(1),
      totalAdmissions: latestMonth.admissions,
      admissionChange: previousMonth ? ((latestMonth.admissions - previousMonth.admissions) / previousMonth.admissions * 100).toFixed(1) : '0.0',
      totalDischarges: latestMonth.discharges,
      dischargeChange: previousMonth ? ((latestMonth.discharges - previousMonth.discharges) / previousMonth.discharges * 100).toFixed(1) : '0.0',
      totalRevenue,
      revenueChange: previousMonth ? ((latestMonth.revenue - previousMonth.revenue) / previousMonth.revenue * 100).toFixed(1) : '0.0',
    };
  }, []);

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `KES ${(amount / 1000000).toFixed(1)}M`;
    }
    return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(amount);
  };

  const getTrendIcon = (value: string) => {
    const num = parseFloat(value);
    if (num > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (num < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (value: string, inverse = false) => {
    const num = parseFloat(value);
    if (inverse) {
      if (num > 0) return 'text-red-600';
      if (num < 0) return 'text-green-600';
    } else {
      if (num > 0) return 'text-green-600';
      if (num < 0) return 'text-red-600';
    }
    return 'text-gray-600';
  };

  const maxMonthlyAdmissions = mockMonthlyTrends.length > 0 ? Math.max(...mockMonthlyTrends.map((t) => t.admissions)) : 0;
  const maxMonthlyDischarges = mockMonthlyTrends.length > 0 ? Math.max(...mockMonthlyTrends.map((t) => t.discharges)) : 0;
  const maxValue = Math.max(maxMonthlyAdmissions, maxMonthlyDischarges, 1);

  const maxSurgeryCount = mockSurgeryStats.length > 0 ? Math.max(...mockSurgeryStats.map((s) => s.count)) : 1;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-100 rounded-lg">
            <BarChart3 className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">IPD Analytics</h1>
            <p className="text-sm text-gray-500">Inpatient department performance insights</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-500" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="quarter">Last 3 Months</option>
              <option value="year">Last Year</option>
            </select>
          </div>
          <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-5 h-5 text-gray-600" />
          </button>
          <button className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium">
            <Download className="w-4 h-4 inline mr-2" />
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Bed className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon('5.2')}
              <span className={getTrendColor('5.2')}>+5.2%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{overallStats.occupancyRate}%</p>
          <p className="text-sm text-gray-500">Bed Occupancy Rate</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon('-0.5')}
              <span className={getTrendColor('-0.5', true)}>-0.5 days</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{overallStats.avgLOS}</p>
          <p className="text-sm text-gray-500">Average Length of Stay (days)</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon(overallStats.admissionChange)}
              <span className={getTrendColor(overallStats.admissionChange)}>{overallStats.admissionChange}%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{overallStats.totalAdmissions}</p>
          <p className="text-sm text-gray-500">Monthly Admissions</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon(overallStats.revenueChange)}
              <span className={getTrendColor(overallStats.revenueChange)}>{overallStats.revenueChange}%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{formatCurrency(overallStats.totalRevenue)}</p>
          <p className="text-sm text-gray-500">Total Revenue</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column */}
        <div className="col-span-2 flex flex-col gap-6 overflow-auto">
          {/* Admissions/Discharges Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Admissions & Discharges Trend</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-violet-500" />
                  Admissions
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500" />
                  Discharges
                </span>
              </div>
            </div>
            <div className="flex items-end gap-4 h-48">
              {mockMonthlyTrends.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                  <BarChart3 className="w-12 h-12 text-gray-300 mb-2" />
                  <p className="text-sm">No trend data available</p>
                </div>
              ) : (
              mockMonthlyTrends.map((trend) => (
                <div key={trend.month} className="flex-1 flex flex-col items-center gap-2">
                  <div className="flex gap-1 w-full items-end h-40">
                    <div
                      className="flex-1 bg-violet-500 rounded-t"
                      style={{ height: `${(trend.admissions / maxValue) * 100}%` }}
                      title={`Admissions: ${trend.admissions}`}
                    />
                    <div
                      className="flex-1 bg-emerald-500 rounded-t"
                      style={{ height: `${(trend.discharges / maxValue) * 100}%` }}
                      title={`Discharges: ${trend.discharges}`}
                    />
                  </div>
                  <span className="text-sm text-gray-500">{trend.month}</span>
                </div>
              ))
              )}
            </div>
          </div>

          {/* Ward Occupancy */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Ward Occupancy & Performance</h3>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-violet-500"
              >
                <option value="All">All Wards</option>
                {mockWardStats.map((w) => (
                  <option key={w.name} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Ward</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Beds</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Occupancy</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Avg LOS</th>
                    <th className="text-right py-3 px-4 font-medium text-gray-600">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {mockWardStats.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        No ward data available
                      </td>
                    </tr>
                  ) : (
                  mockWardStats.map((ward) => (
                    <tr key={ward.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-gray-500" />
                          <span className="font-medium">{ward.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="text-green-600">{ward.occupied}</span>
                        <span className="text-gray-400"> / </span>
                        <span>{ward.totalBeds}</span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${ward.occupancyRate >= 80 ? 'bg-red-500' : ward.occupancyRate >= 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                              style={{ width: `${ward.occupancyRate}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium w-12">{ward.occupancyRate}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center font-medium">{ward.avgLOS} days</td>
                      <td className="py-3 px-4 text-right font-medium">{formatCurrency(ward.revenue)}</td>
                    </tr>
                  ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Surgery Statistics */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Syringe className="w-5 h-5 text-violet-600" />
                Surgery Statistics
              </h3>
            </div>
            <div className="space-y-4">
              {mockSurgeryStats.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <Syringe className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm">No surgery statistics available</p>
                </div>
              ) : (
              mockSurgeryStats.map((surgery) => (
                <div key={surgery.procedure} className="flex items-center gap-4">
                  <div className="w-40 font-medium text-gray-900 truncate">{surgery.procedure}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-4">
                        <div
                          className="bg-violet-500 h-4 rounded-full flex items-center justify-end pr-2"
                          style={{ width: `${(surgery.count / maxSurgeryCount) * 100}%` }}
                        >
                          <span className="text-xs text-white font-medium">{surgery.count}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="w-24 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${surgery.successRate >= 98 ? 'bg-green-100 text-green-700' : surgery.successRate >= 95 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                      {surgery.successRate}% success
                    </span>
                  </div>
                  <div className="w-20 text-right text-sm text-gray-500">
                    {surgery.avgDuration} min
                  </div>
                </div>
              ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6 overflow-auto">
          {/* Revenue by Ward */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Revenue by Ward
            </h3>
            <div className="space-y-4">
              {mockWardStats.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  <p className="text-sm">No revenue data available</p>
                </div>
              ) : (
              mockWardStats
                .sort((a, b) => b.revenue - a.revenue)
                .map((ward, index) => {
                  const maxRevenue = mockWardStats[0]?.revenue || 1;
                  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-yellow-500', 'bg-orange-500', 'bg-pink-500'];
                  return (
                    <div key={ward.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{ward.name}</span>
                        <span className="text-sm font-semibold">{formatCurrency(ward.revenue)}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colors[index % colors.length]}`}
                          style={{ width: `${(ward.revenue / maxRevenue) * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Mortality Rates */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Heart className="w-5 h-5 text-red-500" />
              Mortality Rates by Ward
            </h3>
            <div className="space-y-3">
              {mockMortalityData.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  <p className="text-sm">No mortality data available</p>
                </div>
              ) : (
              mockMortalityData.map((data) => (
                <div key={data.ward} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{data.ward}</p>
                    <p className="text-sm text-gray-500">{data.deaths} / {data.admissions} cases</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.rate < 1 ? 'bg-green-100 text-green-700' : data.rate < 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                    {data.rate}%
                  </span>
                </div>
              ))
              )}
            </div>
            {mockMortalityData.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Hospital-wide rate:</strong>{' '}
                {(mockMortalityData.reduce((sum, d) => sum + d.deaths, 0) / mockMortalityData.reduce((sum, d) => sum + d.admissions, 0) * 100).toFixed(2)}%
              </p>
            </div>
            )}
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-600" />
              Quick Insights
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-violet-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-violet-600" />
                  <span className="text-sm font-medium text-gray-700">Busiest Ward</span>
                </div>
                <span className="text-sm font-semibold text-violet-600">--</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Shortest Avg Stay</span>
                </div>
                <span className="text-sm font-semibold text-green-600">--</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-gray-700">Highest Revenue</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600">--</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Syringe className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Top Surgery</span>
                </div>
                <span className="text-sm font-semibold text-blue-600">--</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-700">Total Inpatients</span>
                </div>
                <span className="text-sm font-semibold text-yellow-600">0 patients</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
