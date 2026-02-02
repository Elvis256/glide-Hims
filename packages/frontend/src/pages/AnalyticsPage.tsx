import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { formatCurrency } from '../lib/currency';
import {
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Activity,
  Bed,
  Clock,
  AlertTriangle,
  RefreshCw,
  Calendar,
  FileText,
  Stethoscope,
  Building,
} from 'lucide-react';

interface DashboardKPIs {
  patients: { total: number; newToday: number; newThisMonth: number };
  encounters: { today: number; thisMonth: number };
  revenue: { today: number; thisMonth: number; thisYear: number };
  collections: { thisMonth: number };
  outstanding: number;
  admissions: { active: number };
  emergencies: { today: number };
}

interface PatientAnalytics {
  registrationTrend: Array<{ period: string; count: number }>;
  genderDistribution: Array<{ gender: string; count: number }>;
  ageDistribution: Array<{ age_group: string; count: number }>;
}

interface ClinicalAnalytics {
  encounterTrend: Array<{ period: string; encounter_type: string; count: number }>;
  topDiagnoses: Array<{ diagnosis: string; count: number }>;
  encountersByType: Array<{ encounter_type: string; count: number }>;
}

interface FinancialAnalytics {
  revenueTrend: Array<{ period: string; revenue: number; invoice_count: number }>;
  revenueByDepartment: Array<{ department: string; revenue: number }>;
  paymentMethods: Array<{ payment_method: string; total: number; count: number }>;
  outstandingByAge: Array<{ age_bucket: string; outstanding: number }>;
}

interface OperationalAnalytics {
  bedOccupancy: Array<{ ward: string; occupied: number; total: number; occupancy_rate: number }>;
  labTAT: { avg_tat_hours: number; total_tests: number; completed_tests: number };
  avgLengthOfStay: number | null;
  emergencyMetrics: Array<{ triage_level: string; count: number }>;
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'patients' | 'clinical' | 'financial' | 'operational'>('dashboard');
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [patientData, setPatientData] = useState<PatientAnalytics | null>(null);
  const [clinicalData, setClinicalData] = useState<ClinicalAnalytics | null>(null);
  const [financialData, setFinancialData] = useState<FinancialAnalytics | null>(null);
  const [operationalData, setOperationalData] = useState<OperationalAnalytics | null>(null);

  useEffect(() => {
    loadData();
  }, [activeTab, period]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'dashboard') {
        const response = await api.get('/analytics/dashboard');
        setKpis(response.data);
      } else if (activeTab === 'patients') {
        const response = await api.get(`/analytics/patients?period=${period}`);
        setPatientData(response.data);
      } else if (activeTab === 'clinical') {
        const response = await api.get(`/analytics/clinical?period=${period}`);
        setClinicalData(response.data);
      } else if (activeTab === 'financial') {
        const response = await api.get(`/analytics/financial?period=${period}`);
        setFinancialData(response.data);
      } else if (activeTab === 'operational') {
        const response = await api.get('/analytics/operational');
        setOperationalData(response.data);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
    setLoading(false);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-UG').format(num);
  };

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Total Patients</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(kpis?.patients.total || 0)}</p>
              <p className="text-xs text-green-600 mt-1">+{kpis?.patients.newThisMonth || 0} this month</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-full">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Encounters Today</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(kpis?.encounters.today || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{formatNumber(kpis?.encounters.thisMonth || 0)} this month</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Revenue Today</p>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(kpis?.revenue.today || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{formatCurrency(kpis?.revenue.thisMonth || 0)} this month</p>
            </div>
            <div className="bg-purple-100 p-3 rounded-full">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Outstanding Balance</p>
              <p className="text-2xl font-bold text-orange-600">{formatCurrency(kpis?.outstanding || 0)}</p>
              <p className="text-xs text-gray-500 mt-1">Unpaid invoices</p>
            </div>
            <div className="bg-orange-100 p-3 rounded-full">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Active Admissions</p>
              <p className="text-3xl font-bold text-blue-600">{kpis?.admissions.active || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Currently admitted patients</p>
            </div>
            <Bed className="h-10 w-10 text-blue-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Emergency Cases Today</p>
              <p className="text-3xl font-bold text-red-600">{kpis?.emergencies.today || 0}</p>
              <p className="text-xs text-gray-500 mt-2">Emergency department visits</p>
            </div>
            <AlertTriangle className="h-10 w-10 text-red-200" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Collections This Month</p>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(kpis?.collections.thisMonth || 0)}</p>
              <p className="text-xs text-gray-500 mt-2">Payments received</p>
            </div>
            <TrendingUp className="h-10 w-10 text-green-200" />
          </div>
        </div>
      </div>

      {/* Year-to-date Revenue */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100">Year-to-Date Revenue</p>
            <p className="text-4xl font-bold mt-2">{formatCurrency(kpis?.revenue.thisYear || 0)}</p>
            <p className="text-blue-100 mt-2 text-sm">Total revenue generated in {new Date().getFullYear()}</p>
          </div>
          <BarChart3 className="h-16 w-16 text-blue-300" />
        </div>
      </div>
    </div>
  );

  const renderPatientAnalytics = () => (
    <div className="space-y-6">
      {/* Gender Distribution */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Patient Demographics</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Gender */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Gender Distribution</h4>
            <div className="space-y-2">
              {patientData?.genderDistribution.map((item) => (
                <div key={item.gender} className="flex items-center justify-between">
                  <span className="text-gray-700 capitalize">{item.gender || 'Unknown'}</span>
                  <span className="font-semibold">{formatNumber(parseInt(item.count as any))}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Age Groups */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-3">Age Distribution</h4>
            <div className="space-y-2">
              {patientData?.ageDistribution.map((item) => (
                <div key={item.age_group} className="flex items-center justify-between">
                  <span className="text-gray-700">{item.age_group} years</span>
                  <span className="font-semibold">{formatNumber(parseInt(item.count as any))}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Registration Trend */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Registration Trend</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-gray-500">Period</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">New Patients</th>
              </tr>
            </thead>
            <tbody>
              {patientData?.registrationTrend.slice(-10).map((item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 text-sm text-gray-700">
                    {new Date(item.period).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-sm text-right font-medium">{item.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderClinicalAnalytics = () => (
    <div className="space-y-6">
      {/* Encounters by Type */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Encounters by Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {clinicalData?.encountersByType.map((item) => (
            <div key={item.encounter_type} className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{formatNumber(parseInt(item.count as any))}</p>
              <p className="text-sm text-gray-500 capitalize">{item.encounter_type?.replace('_', ' ')}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Top Diagnoses */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 10 Diagnoses</h3>
        <div className="space-y-3">
          {clinicalData?.topDiagnoses.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-1 rounded">
                  #{idx + 1}
                </span>
                <span className="text-gray-700">{item.diagnosis}</span>
              </div>
              <span className="font-semibold text-gray-900">{formatNumber(parseInt(item.count as any))}</span>
            </div>
          ))}
          {(!clinicalData?.topDiagnoses || clinicalData.topDiagnoses.length === 0) && (
            <p className="text-gray-500 text-center py-4">No diagnosis data available</p>
          )}
        </div>
      </div>
    </div>
  );

  const renderFinancialAnalytics = () => (
    <div className="space-y-6">
      {/* Revenue by Department */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Department</h3>
        <div className="space-y-3">
          {financialData?.revenueByDepartment.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-gray-400" />
                <span className="text-gray-700">{item.department}</span>
              </div>
              <span className="font-semibold text-green-600">{formatCurrency(parseFloat(item.revenue as any))}</span>
            </div>
          ))}
          {(!financialData?.revenueByDepartment || financialData.revenueByDepartment.length === 0) && (
            <p className="text-gray-500 text-center py-4">No revenue data available</p>
          )}
        </div>
      </div>

      {/* Payment Methods */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Payment Methods</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {financialData?.paymentMethods.map((item) => (
            <div key={item.payment_method} className="bg-gray-50 rounded-lg p-4">
              <p className="text-lg font-bold text-purple-600">{formatCurrency(parseFloat(item.total as any))}</p>
              <p className="text-sm text-gray-500 capitalize">{item.payment_method?.replace('_', ' ')}</p>
              <p className="text-xs text-gray-400">{item.count} transactions</p>
            </div>
          ))}
        </div>
      </div>

      {/* Outstanding by Age */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Outstanding by Age</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {financialData?.outstandingByAge.map((item) => (
            <div key={item.age_bucket} className="bg-orange-50 rounded-lg p-4">
              <p className="text-lg font-bold text-orange-600">{formatCurrency(parseFloat(item.outstanding as any))}</p>
              <p className="text-sm text-gray-500">{item.age_bucket}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderOperationalAnalytics = () => (
    <div className="space-y-6">
      {/* Bed Occupancy */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bed Occupancy by Ward</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-gray-500">Ward</th>
                <th className="text-center py-2 text-sm font-medium text-gray-500">Occupied</th>
                <th className="text-center py-2 text-sm font-medium text-gray-500">Total</th>
                <th className="text-right py-2 text-sm font-medium text-gray-500">Occupancy Rate</th>
              </tr>
            </thead>
            <tbody>
              {operationalData?.bedOccupancy.map((item, idx) => (
                <tr key={idx} className="border-b">
                  <td className="py-2 text-sm text-gray-700">{item.ward}</td>
                  <td className="py-2 text-sm text-center">{item.occupied}</td>
                  <td className="py-2 text-sm text-center">{item.total}</td>
                  <td className="py-2 text-sm text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      parseFloat(item.occupancy_rate as any) >= 90 ? 'bg-red-100 text-red-800' :
                      parseFloat(item.occupancy_rate as any) >= 70 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {item.occupancy_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!operationalData?.bedOccupancy || operationalData.bedOccupancy.length === 0) && (
            <p className="text-gray-500 text-center py-4">No bed data available</p>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <h4 className="font-medium text-gray-900">Lab Turnaround Time</h4>
          </div>
          <p className="text-3xl font-bold text-blue-600">
            {operationalData?.labTAT?.avg_tat_hours?.toFixed(1) || '-'} hrs
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {operationalData?.labTAT?.completed_tests || 0} / {operationalData?.labTAT?.total_tests || 0} completed
          </p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <Bed className="h-5 w-5 text-green-600" />
            <h4 className="font-medium text-gray-900">Avg Length of Stay</h4>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {operationalData?.avgLengthOfStay?.toFixed(1) || '-'} days
          </p>
          <p className="text-sm text-gray-500 mt-1">Last 90 days</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <h4 className="font-medium text-gray-900">Emergency Cases</h4>
          </div>
          <div className="space-y-1">
            {operationalData?.emergencyMetrics.map((item) => (
              <div key={item.triage_level} className="flex justify-between text-sm">
                <span className="text-gray-600 capitalize">{item.triage_level}</span>
                <span className="font-medium">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Analytics & Reports</h1>
            <p className="text-sm text-gray-500">Hospital performance insights and KPIs</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {activeTab !== 'dashboard' && activeTab !== 'operational' && (
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as any)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last 7 Days</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
          )}
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'patients', label: 'Patients', icon: Users },
            { id: 'clinical', label: 'Clinical', icon: Stethoscope },
            { id: 'financial', label: 'Financial', icon: DollarSign },
            { id: 'operational', label: 'Operational', icon: Activity },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && renderDashboard()}
          {activeTab === 'patients' && renderPatientAnalytics()}
          {activeTab === 'clinical' && renderClinicalAnalytics()}
          {activeTab === 'financial' && renderFinancialAnalytics()}
          {activeTab === 'operational' && renderOperationalAnalytics()}
        </>
      )}
    </div>
  );
}
