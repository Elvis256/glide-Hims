import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/currency';
import {
  Activity,
  Users,
  Stethoscope,
  FlaskConical,
  Pill,
  CreditCard,
  Bed,
  CalendarCheck,
  TrendingUp,
  Clock,
  UserPlus,
  ClipboardList,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Loader2,
  DollarSign,
  Scan,
  Baby,
  Siren,
  HeartPulse,
  BarChart3,
} from 'lucide-react';
import api from '../services/api';

interface DashboardStats {
  patients: { total: number; today: number };
  encounters: { total: number; waiting: number; inProgress: number; completed: number };
  lab: { pending: number; completed: number };
  pharmacy: { pending: number; dispensed: number };
  billing: { todayRevenue: number; pendingPayments: number };
  beds: { total: number; occupied: number; available: number };
}

const quickLinks = [
  { name: 'Register Patient', href: '/patients/new', icon: UserPlus, color: 'bg-blue-500' },
  { name: 'New Visit', href: '/encounters/new', icon: Stethoscope, color: 'bg-green-500' },
  { name: 'Lab Queue', href: '/lab/queue', icon: FlaskConical, color: 'bg-purple-500' },
  { name: 'Pharmacy', href: '/pharmacy/queue', icon: Pill, color: 'bg-orange-500' },
  { name: 'Chronic Care', href: '/chronic-care/dashboard', icon: HeartPulse, color: 'bg-rose-500' },
  { name: 'Billing', href: '/billing/invoices', icon: CreditCard, color: 'bg-teal-500' },
  { name: 'Reports', href: '/reports', icon: BarChart3, color: 'bg-indigo-500' },
  { name: 'Emergency', href: '/emergency/queue', icon: Siren, color: 'bg-red-500' },
];

const modules = [
  { name: 'Registration', href: '/patients', icon: Users, description: 'Patient management & registration', color: 'border-blue-200 hover:border-blue-400' },
  { name: 'OPD / Encounters', href: '/encounters', icon: Stethoscope, description: 'Outpatient visits & consultations', color: 'border-green-200 hover:border-green-400' },
  { name: 'Laboratory', href: '/lab/queue', icon: FlaskConical, description: 'Lab orders & results', color: 'border-purple-200 hover:border-purple-400' },
  { name: 'Pharmacy', href: '/pharmacy/dispense', icon: Pill, description: 'Dispensing & stock management', color: 'border-orange-200 hover:border-orange-400' },
  { name: 'Radiology', href: '/radiology/queue', icon: Scan, description: 'Imaging orders & reports', color: 'border-cyan-200 hover:border-cyan-400' },
  { name: 'IPD / Wards', href: '/ipd/admissions', icon: Bed, description: 'Inpatient management', color: 'border-indigo-200 hover:border-indigo-400' },
  { name: 'Chronic Care', href: '/chronic-care/dashboard', icon: HeartPulse, description: 'Chronic disease management & reminders', color: 'border-rose-200 hover:border-rose-400' },
  { name: 'Billing & Finance', href: '/billing/invoices', icon: CreditCard, description: 'Invoices & payments', color: 'border-teal-200 hover:border-teal-400' },
  { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, description: 'Insights, statistics & analytics', color: 'border-amber-200 hover:border-amber-400' },
];

export default function DashboardPage() {
  // Fetch dashboard statistics from multiple endpoints
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [patientsRes, encountersRes, analyticsRes, pharmacyRes, labRes] = await Promise.all([
        api.get('/patients?limit=1').catch(() => ({ data: { total: 0 } })),
        api.get('/encounters/stats/today').catch(() => ({ data: { total: 0, waiting: 0, inProgress: 0, completed: 0 } })),
        api.get('/analytics/dashboard').catch(() => ({ data: null })),
        api.get('/pharmacy/queue/stats').catch(() => ({ data: { pending: 0, dispensed: 0 } })),
        api.get('/lab/queue/stats').catch(() => ({ data: { pending: 0, completed: 0 } })),
      ]);
      
      const analytics = analyticsRes.data;
      
      return {
        patients: { 
          total: analytics?.patients?.total || patientsRes.data?.meta?.total || patientsRes.data?.total || 0, 
          today: analytics?.patients?.newToday || 0 
        },
        encounters: encountersRes.data || { total: 0, waiting: 0, inProgress: 0, completed: 0 },
        lab: { 
          pending: labRes.data?.pending || 0, 
          completed: labRes.data?.completed || 0 
        },
        pharmacy: { 
          pending: pharmacyRes.data?.pending || 0, 
          dispensed: pharmacyRes.data?.dispensed || 0 
        },
        billing: { 
          todayRevenue: analytics?.revenue?.today || 0, 
          pendingPayments: analytics?.outstanding || 0 
        },
        beds: { 
          total: analytics?.admissions?.total || 0, 
          occupied: analytics?.admissions?.active || 0, 
          available: (analytics?.admissions?.total || 0) - (analytics?.admissions?.active || 0)
        },
      } as DashboardStats;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome to Glide-HIMS • {new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : isError ? (
          <div className="col-span-full bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-700">Failed to load dashboard statistics. Please refresh the page.</p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.patients.total || 0}</p>
                  <p className="text-xs text-gray-500">Total Patients</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.encounters.waiting || 0}</p>
                  <p className="text-xs text-gray-500">Waiting</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Stethoscope className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.encounters.inProgress || 0}</p>
                  <p className="text-xs text-gray-500">In Consultation</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.encounters.completed || 0}</p>
                  <p className="text-xs text-gray-500">Completed Today</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Bed className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.beds.available || 0}</p>
                  <p className="text-xs text-gray-500">Beds Available</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-teal-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-teal-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats?.encounters.total || 0}</p>
                  <p className="text-xs text-gray-500">Today's Visits</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.name}
              to={link.href}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-md transition-all group"
            >
              <div className={`p-3 rounded-xl ${link.color} text-white group-hover:scale-110 transition-transform`}>
                <link.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-gray-700 text-center">{link.name}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Modules Grid */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => (
            <Link
              key={module.name}
              to={module.href}
              className={`bg-white rounded-xl border-2 ${module.color} p-5 shadow-sm hover:shadow-md transition-all group`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                  <module.icon className="w-6 h-6 text-gray-700" />
                </div>
                <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mt-4">{module.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{module.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Activity & Alerts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
            <Link to="/encounters" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserPlus className="w-4 h-4 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">New patient registered</p>
                <p className="text-xs text-gray-500">Registration desk • Just now</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Stethoscope className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Consultation completed</p>
                <p className="text-xs text-gray-500">OPD Room 3 • 5 mins ago</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="p-2 bg-purple-100 rounded-lg">
                <FlaskConical className="w-4 h-4 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Lab results ready</p>
                <p className="text-xs text-gray-500">Laboratory • 10 mins ago</p>
              </div>
            </div>
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
            <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">3 new</span>
          </div>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Critical lab result</p>
                <p className="text-xs text-red-600">Patient MRN-00123 requires immediate attention</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">Low stock alert</p>
                <p className="text-xs text-yellow-600">Paracetamol 500mg below reorder level</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <ClipboardList className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">Pending approvals</p>
                <p className="text-xs text-blue-600">5 lab results awaiting validation</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
