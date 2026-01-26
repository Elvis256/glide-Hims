import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  Activity,
  Users,
  Monitor,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Target,
} from 'lucide-react';

interface ModalityStats {
  name: string;
  studies: number;
  revenue: number;
  avgTurnaround: number;
  change: number;
}

interface RadiologistStats {
  name: string;
  studiesReported: number;
  avgTurnaround: string;
  accuracy: number;
  criticalAlerts: number;
}

interface EquipmentStats {
  name: string;
  type: string;
  utilization: number;
  studiesPerformed: number;
  downtime: number;
}

const modalityStats: ModalityStats[] = [
  { name: 'X-Ray', studies: 458, revenue: 1850000, avgTurnaround: 25, change: 12 },
  { name: 'CT', studies: 234, revenue: 4680000, avgTurnaround: 45, change: 8 },
  { name: 'MRI', studies: 156, revenue: 6240000, avgTurnaround: 90, change: -3 },
  { name: 'Ultrasound', studies: 312, revenue: 1560000, avgTurnaround: 35, change: 15 },
];

const radiologistStats: RadiologistStats[] = [
  { name: 'Dr. David Kimani', studiesReported: 156, avgTurnaround: '28 min', accuracy: 98.5, criticalAlerts: 12 },
  { name: 'Dr. Jane Njeri', studiesReported: 142, avgTurnaround: '32 min', accuracy: 97.8, criticalAlerts: 8 },
  { name: 'Dr. Peter Omondi', studiesReported: 128, avgTurnaround: '35 min', accuracy: 99.1, criticalAlerts: 15 },
  { name: 'Dr. Mary Achieng', studiesReported: 134, avgTurnaround: '30 min', accuracy: 98.2, criticalAlerts: 10 },
];

const equipmentStats: EquipmentStats[] = [
  { name: 'X-Ray Unit A', type: 'X-Ray', utilization: 85, studiesPerformed: 245, downtime: 2 },
  { name: 'X-Ray Unit B', type: 'X-Ray', utilization: 78, studiesPerformed: 213, downtime: 5 },
  { name: 'CT Scanner 1', type: 'CT', utilization: 92, studiesPerformed: 234, downtime: 1 },
  { name: 'MRI 1.5T', type: 'MRI', utilization: 88, studiesPerformed: 156, downtime: 3 },
  { name: 'Ultrasound Unit 1', type: 'Ultrasound', utilization: 72, studiesPerformed: 168, downtime: 0 },
  { name: 'Ultrasound Unit 2', type: 'Ultrasound', utilization: 68, studiesPerformed: 144, downtime: 1 },
];

const weeklyTrends = [
  { day: 'Mon', studies: 165, revenue: 2100000 },
  { day: 'Tue', studies: 178, revenue: 2350000 },
  { day: 'Wed', studies: 192, revenue: 2580000 },
  { day: 'Thu', studies: 185, revenue: 2420000 },
  { day: 'Fri', studies: 198, revenue: 2680000 },
  { day: 'Sat', studies: 145, revenue: 1850000 },
  { day: 'Sun', studies: 97, revenue: 1200000 },
];

export default function RadiologyAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'quarter'>('week');

  const summaryStats = useMemo(() => {
    const totalStudies = modalityStats.reduce((sum, m) => sum + m.studies, 0);
    const totalRevenue = modalityStats.reduce((sum, m) => sum + m.revenue, 0);
    const avgTurnaround = Math.round(modalityStats.reduce((sum, m) => sum + m.avgTurnaround, 0) / modalityStats.length);
    const avgUtilization = Math.round(equipmentStats.reduce((sum, e) => sum + e.utilization, 0) / equipmentStats.length);
    return { totalStudies, totalRevenue, avgTurnaround, avgUtilization };
  }, []);

  const formatCurrency = (amount: number) => {
    return `KES ${(amount / 1000).toFixed(0)}K`;
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'bg-red-500';
    if (utilization >= 75) return 'bg-green-500';
    if (utilization >= 50) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col p-6 bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Radiology Analytics</h1>
          <p className="text-gray-600">Performance metrics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as 'week' | 'month' | 'quarter')}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4" />
              +12%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.totalStudies}</p>
          <p className="text-sm text-gray-600">Total Studies</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4" />
              +8%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{formatCurrency(summaryStats.totalRevenue)}</p>
          <p className="text-sm text-gray-600">Total Revenue</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
              <ArrowDownRight className="w-4 h-4" />
              -5%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.avgTurnaround} min</p>
          <p className="text-sm text-gray-600">Avg Turnaround</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Monitor className="w-5 h-5 text-purple-600" />
            </div>
            <span className="flex items-center gap-1 text-green-600 text-sm font-medium">
              <ArrowUpRight className="w-4 h-4" />
              +3%
            </span>
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-3">{summaryStats.avgUtilization}%</p>
          <p className="text-sm text-gray-600">Equipment Utilization</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-3 gap-6 overflow-hidden">
        {/* Studies by Modality */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Studies by Modality
            </h2>
          </div>
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-4">
              {modalityStats.map((modality) => (
                <div key={modality.name} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-900">{modality.name}</span>
                    <span className={`flex items-center gap-1 text-sm ${modality.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {modality.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      {modality.change >= 0 ? '+' : ''}{modality.change}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{modality.studies} studies</span>
                    <span className="text-gray-600">{formatCurrency(modality.revenue)}</span>
                  </div>
                  <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${(modality.studies / 500) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Revenue by Study Type */}
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 mb-3">Revenue Distribution</h3>
              <div className="space-y-2">
                {modalityStats.map((modality) => {
                  const percentage = (modality.revenue / summaryStats.totalRevenue) * 100;
                  return (
                    <div key={modality.name} className="flex items-center gap-3">
                      <span className="text-sm text-gray-600 w-20">{modality.name}</span>
                      <div className="flex-1 h-6 bg-gray-200 rounded overflow-hidden">
                        <div
                          className="h-full bg-green-500 flex items-center justify-end px-2"
                          style={{ width: `${percentage}%` }}
                        >
                          <span className="text-xs text-white font-medium">{percentage.toFixed(0)}%</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Equipment Utilization & Radiologist Productivity */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Equipment Utilization */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="w-5 h-5 text-yellow-600" />
                Equipment Utilization
              </h2>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-3">
                {equipmentStats.map((equipment) => (
                  <div key={equipment.name} className="flex items-center gap-3">
                    <div className="w-28 truncate">
                      <p className="text-sm font-medium text-gray-900 truncate">{equipment.name}</p>
                      <p className="text-xs text-gray-500">{equipment.type}</p>
                    </div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getUtilizationColor(equipment.utilization)} transition-all`}
                          style={{ width: `${equipment.utilization}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-12 text-right">
                      {equipment.utilization}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Turnaround Time */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-blue-600" />
              Turnaround Time by Modality
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {modalityStats.map((modality) => (
                <div key={modality.name} className="p-3 bg-gray-50 rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{modality.avgTurnaround}</p>
                  <p className="text-xs text-gray-500">min avg</p>
                  <p className="text-sm font-medium text-gray-700 mt-1">{modality.name}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Radiologist Productivity & Trends */}
        <div className="flex flex-col gap-6 overflow-hidden">
          {/* Radiologist Productivity */}
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                Radiologist Productivity
              </h2>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                  <tr>
                    <th className="px-4 py-2 text-left">Radiologist</th>
                    <th className="px-4 py-2 text-center">Studies</th>
                    <th className="px-4 py-2 text-center">TAT</th>
                    <th className="px-4 py-2 text-center">Accuracy</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {radiologistStats.map((radiologist) => (
                    <tr key={radiologist.name} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium text-gray-900">{radiologist.name}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-medium text-gray-900">{radiologist.studiesReported}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm text-gray-600">{radiologist.avgTurnaround}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                          <Target className="w-3 h-3" />
                          {radiologist.accuracy}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Weekly Trends */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Weekly Comparison
            </h2>
            <div className="flex items-end justify-between h-24 gap-1">
              {weeklyTrends.map((day) => {
                const heightPercent = (day.studies / 200) * 100;
                return (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer"
                      style={{ height: `${heightPercent}%` }}
                      title={`${day.studies} studies - ${formatCurrency(day.revenue)}`}
                    />
                    <span className="text-xs text-gray-500">{day.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-gray-900">1,160</p>
                <p className="text-xs text-gray-500">Weekly Studies</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">{formatCurrency(15180000)}</p>
                <p className="text-xs text-gray-500">Weekly Revenue</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
