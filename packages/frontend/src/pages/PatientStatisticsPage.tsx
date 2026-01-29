import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import {
  Users,
  ArrowLeft,
  Download,
  TrendingUp,
  MapPin,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface PatientAnalyticsResponse {
  registrationTrend: { period: string; count: string }[];
  genderDistribution: { gender: string; count: string }[];
  ageDistribution: { age_group: string; count: string }[];
}

export default function PatientStatisticsPage() {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<'week' | 'month' | 'year'>('month');

  const { data, isLoading, error } = useQuery({
    queryKey: ['patient-analytics', dateRange],
    queryFn: async () => {
      const response = await api.get<PatientAnalyticsResponse>(`/analytics/patients?period=${dateRange}`);
      return response.data;
    },
  });

  const registrationTrend = data?.registrationTrend ?? [];
  const genderDistribution = data?.genderDistribution ?? [];
  const ageDistribution = data?.ageDistribution ?? [];

  const maxTrend = registrationTrend.length > 0 
    ? Math.max(...registrationTrend.map(t => parseInt(t.count, 10) || 0))
    : 1;

  const totalGender = genderDistribution.reduce((sum, g) => sum + (parseInt(g.count, 10) || 0), 0);
  const maleCount = genderDistribution.find(g => g.gender === 'male');
  const femaleCount = genderDistribution.find(g => g.gender === 'female');
  const maleValue = parseInt(maleCount?.count ?? '0', 10);
  const femaleValue = parseInt(femaleCount?.count ?? '0', 10);

  const totalAge = ageDistribution.reduce((sum, a) => sum + (parseInt(a.count, 10) || 0), 0);

  const formatPeriod = (period: string) => {
    const date = new Date(period);
    if (isNaN(date.getTime())) return period;
    if (dateRange === 'year') {
      return date.toLocaleDateString('en-US', { month: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

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
          <button className="btn-secondary flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

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

      {/* Empty State */}
      {!isLoading && !error && registrationTrend.length === 0 && genderDistribution.length === 0 && ageDistribution.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-gray-500">
            <Users className="w-12 h-12 text-gray-300" />
            <p className="text-lg font-medium">No patient data available</p>
            <p className="text-sm">Patient statistics will appear here once data is available</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!isLoading && !error && (registrationTrend.length > 0 || genderDistribution.length > 0 || ageDistribution.length > 0) && (
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
          {/* Registration Trend */}
          <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              Registration Trend
            </h2>
            {registrationTrend.length > 0 ? (
              <div className="flex-1 flex items-end gap-2 min-h-0 pb-6">
                {registrationTrend.map((item, idx) => {
                  const count = parseInt(item.count, 10) || 0;
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center">
                      <span className="text-xs text-gray-600 mb-1">{count}</span>
                      <div
                        className="w-full bg-blue-500 rounded-t transition-all"
                        style={{ height: `${(count / maxTrend) * 100}px`, minHeight: count > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs text-gray-500 mt-2">{formatPeriod(item.period)}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No registration data
              </div>
            )}
          </div>

          {/* Gender Distribution */}
          <div className="card p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Gender Distribution</h2>
            {genderDistribution.length > 0 ? (
              <div className="flex-1 flex flex-col justify-center space-y-3">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-4 mb-3">
                    <div>
                      <p className="text-2xl font-bold text-blue-600">{maleValue.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">Male</p>
                    </div>
                    <div className="w-px h-12 bg-gray-200" />
                    <div>
                      <p className="text-2xl font-bold text-pink-600">{femaleValue.toLocaleString()}</p>
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
                    <span className="text-blue-600">{totalGender > 0 ? Math.round(maleValue / totalGender * 100) : 0}%</span>
                    <span className="text-pink-600">{totalGender > 0 ? Math.round(femaleValue / totalGender * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No gender data
              </div>
            )}
          </div>

          {/* Age Groups */}
          <div className="card p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Age Distribution</h2>
            {ageDistribution.length > 0 ? (
              <div className="flex-1 overflow-y-auto space-y-2">
                {ageDistribution.map((group, idx) => {
                  const count = parseInt(group.count, 10) || 0;
                  const percentage = totalAge > 0 ? Math.round((count / totalAge) * 100) : 0;
                  return (
                    <div key={idx}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{group.age_group}</span>
                        <span className="font-medium">{percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No age data
              </div>
            )}
          </div>

          {/* Additional Info Panel */}
          <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2 flex-shrink-0">
              <MapPin className="w-4 h-4 text-blue-600" />
              Summary
            </h2>
            <div className="flex-1 flex items-center justify-center">
              <div className="grid grid-cols-3 gap-6 text-center">
                <div>
                  <p className="text-3xl font-bold text-gray-900">{totalGender.toLocaleString()}</p>
                  <p className="text-sm text-gray-500">Total Patients</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-blue-600">
                    {registrationTrend.reduce((sum, t) => sum + (parseInt(t.count, 10) || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">New This Period</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-green-600">{ageDistribution.length}</p>
                  <p className="text-sm text-gray-500">Age Groups</p>
                </div>
              </div>
            </div>
          </div>

          {/* Gender Breakdown */}
          <div className="lg:col-span-2 card p-4 flex flex-col min-h-0">
            <h2 className="text-sm font-semibold mb-3 flex-shrink-0">Gender Breakdown</h2>
            {genderDistribution.length > 0 ? (
              <div className="flex-1 overflow-y-auto">
                <div className="grid grid-cols-3 gap-2">
                  {genderDistribution.map((g, idx) => {
                    const count = parseInt(g.count, 10) || 0;
                    return (
                      <div key={idx} className="text-center p-3 bg-gray-50 rounded-lg">
                        <p className="text-lg font-bold text-gray-700 capitalize">{g.gender}</p>
                        <p className="text-sm text-gray-600">{count.toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                No gender breakdown available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
