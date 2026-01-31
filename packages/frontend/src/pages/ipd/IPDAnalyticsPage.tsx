import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Bed,
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
  Loader2,
} from 'lucide-react';
import { formatCurrency } from '../../lib/currency';
import api from '../../services/api';

interface IpdStats {
  activeAdmissions: number;
  todayAdmissions: number;
  todayDischarges: number;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  overallOccupancyRate: number;
  wardOccupancy: {
    id: string;
    name: string;
    type: string;
    totalBeds: number;
    occupiedBeds: number;
    availableBeds: number;
    occupancyRate: number;
  }[];
}

export default function IPDAnalyticsPage() {
  const [dateRange, setDateRange] = useState('month');

  // Fetch real stats from API
  const { data: stats, isLoading, refetch } = useQuery({
    queryKey: ['ipd-analytics-stats'],
    queryFn: async () => {
      const res = await api.get('/ipd/stats');
      return res.data as IpdStats;
    },
  });

  const formatCurrencyValue = (amount: number) => {
    if (amount >= 1000000) {
      return formatCurrency(amount, { compact: true });
    }
    return formatCurrency(amount);
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (value < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-gray-500" />;
  };

  const getTrendColor = (value: number, inverse = false) => {
    if (inverse) {
      if (value > 0) return 'text-red-600';
      if (value < 0) return 'text-green-600';
    } else {
      if (value > 0) return 'text-green-600';
      if (value < 0) return 'text-red-600';
    }
    return 'text-gray-600';
  };

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-violet-600" />
      </div>
    );
  }

  const wardOccupancy = stats?.wardOccupancy || [];

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
          <button 
            onClick={() => refetch()}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
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
              {getTrendIcon(5.2)}
              <span className={getTrendColor(5.2)}>+5.2%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.overallOccupancyRate || 0}%</p>
          <p className="text-sm text-gray-500">Bed Occupancy Rate</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              {getTrendIcon(-0.5)}
              <span className={getTrendColor(-0.5, true)}>-0.5 days</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.activeAdmissions || 0}</p>
          <p className="text-sm text-gray-500">Active Inpatients</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-600">Today</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.todayAdmissions || 0}</p>
          <p className="text-sm text-gray-500">Admissions Today</p>
        </div>

        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-gray-600">Today</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats?.todayDischarges || 0}</p>
          <p className="text-sm text-gray-500">Discharges Today</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Left Column */}
        <div className="col-span-2 flex flex-col gap-6 overflow-auto">
          {/* Bed Summary */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-gray-900">Bed Summary</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-600">{stats?.totalBeds || 0}</p>
                <p className="text-sm text-gray-600">Total Beds</p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-red-600">{stats?.occupiedBeds || 0}</p>
                <p className="text-sm text-gray-600">Occupied</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-600">{stats?.availableBeds || 0}</p>
                <p className="text-sm text-gray-600">Available</p>
              </div>
            </div>
          </div>

          {/* Ward Occupancy */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Ward Occupancy & Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-medium text-gray-600">Ward</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Type</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Beds</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-600">Occupancy</th>
                  </tr>
                </thead>
                <tbody>
                  {wardOccupancy.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-500">
                        No ward data available
                      </td>
                    </tr>
                  ) : (
                    wardOccupancy.map((ward) => (
                      <tr key={ward.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-gray-500" />
                            <span className="font-medium">{ward.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="px-2 py-1 bg-violet-100 text-violet-700 rounded text-xs font-medium capitalize">
                            {ward.type}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-green-600">{ward.occupiedBeds}</span>
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
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6 overflow-auto">
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
                  <span className="text-sm font-medium text-gray-700">Total Beds</span>
                </div>
                <span className="text-sm font-semibold text-violet-600">{stats?.totalBeds || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Bed className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Available Beds</span>
                </div>
                <span className="text-sm font-semibold text-green-600">{stats?.availableBeds || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-red-600" />
                  <span className="text-sm font-medium text-gray-700">Occupied Beds</span>
                </div>
                <span className="text-sm font-semibold text-red-600">{stats?.occupiedBeds || 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Occupancy Rate</span>
                </div>
                <span className="text-sm font-semibold text-blue-600">{stats?.overallOccupancyRate || 0}%</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm font-medium text-gray-700">Active Inpatients</span>
                </div>
                <span className="text-sm font-semibold text-yellow-600">{stats?.activeAdmissions || 0} patients</span>
              </div>
            </div>
          </div>

          {/* Ward Count */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600" />
              Wards Overview
            </h3>
            <div className="space-y-4">
              {wardOccupancy.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  <p className="text-sm">No ward data available</p>
                </div>
              ) : (
                wardOccupancy.map((ward, index) => {
                  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-yellow-500', 'bg-orange-500', 'bg-pink-500'];
                  return (
                    <div key={ward.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{ward.name}</span>
                        <span className="text-sm font-semibold">{ward.occupiedBeds}/{ward.totalBeds}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${colors[index % colors.length]}`}
                          style={{ width: `${ward.occupancyRate}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
