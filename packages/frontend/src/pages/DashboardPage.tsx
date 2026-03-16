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
import { useAuthStore } from '../store/auth';

interface DashboardStats {
  patients: { total: number; today: number };
  encounters: { total: number; waiting: number; inProgress: number; completed: number };
  lab: { pending: number; completed: number };
  pharmacy: { pending: number; dispensed: number };
  billing: { todayRevenue: number; pendingPayments: number };
  beds: { total: number; occupied: number; available: number };
}

const quickLinks = [
  { name: 'Register Patient', href: '/patients/new', icon: UserPlus, color: 'bg-blue-500', permissions: ['patients.create'] },
  { name: 'New Visit', href: '/encounters/new', icon: Stethoscope, color: 'bg-green-500', permissions: ['encounters.create'] },
  { name: 'Lab Queue', href: '/lab/queue', icon: FlaskConical, color: 'bg-purple-500', permissions: ['lab.read'] },
  { name: 'Pharmacy', href: '/pharmacy/queue', icon: Pill, color: 'bg-orange-500', permissions: ['pharmacy.read'] },
  { name: 'Chronic Care', href: '/chronic-care/dashboard', icon: HeartPulse, color: 'bg-rose-500', permissions: ['chronic.read'] },
  { name: 'Billing', href: '/billing/invoices', icon: CreditCard, color: 'bg-teal-500', permissions: ['billing.read'] },
  { name: 'Reports', href: '/reports', icon: BarChart3, color: 'bg-indigo-500', permissions: ['reports.read'] },
  { name: 'Emergency', href: '/emergency/queue', icon: Siren, color: 'bg-red-500', permissions: ['emergency.read'] },
];

const modules = [
  { name: 'Registration', href: '/patients', icon: Users, description: 'Patient management & registration', color: 'border-blue-200 hover:border-blue-400', permissions: ['patients.read'] },
  { name: 'OPD / Encounters', href: '/encounters', icon: Stethoscope, description: 'Outpatient visits & consultations', color: 'border-green-200 hover:border-green-400', permissions: ['encounters.read'] },
  { name: 'Laboratory', href: '/lab/queue', icon: FlaskConical, description: 'Lab orders & results', color: 'border-purple-200 hover:border-purple-400', permissions: ['lab.read'] },
  { name: 'Pharmacy', href: '/pharmacy/dispense', icon: Pill, description: 'Dispensing & stock management', color: 'border-orange-200 hover:border-orange-400', permissions: ['pharmacy.read'] },
  { name: 'Radiology', href: '/radiology/queue', icon: Scan, description: 'Imaging orders & reports', color: 'border-cyan-200 hover:border-cyan-400', permissions: ['radiology.read'] },
  { name: 'IPD / Wards', href: '/ipd/admissions', icon: Bed, description: 'Inpatient management', color: 'border-indigo-200 hover:border-indigo-400', permissions: ['ipd.read'] },
  { name: 'Chronic Care', href: '/chronic-care/dashboard', icon: HeartPulse, description: 'Chronic disease management & reminders', color: 'border-rose-200 hover:border-rose-400', permissions: ['chronic.read'] },
  { name: 'Billing & Finance', href: '/billing/invoices', icon: CreditCard, description: 'Invoices & payments', color: 'border-teal-200 hover:border-teal-400', permissions: ['billing.read'] },
  { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, description: 'Insights, statistics & analytics', color: 'border-amber-200 hover:border-amber-400', permissions: ['reports.read', 'analytics.read'] },
];

export default function DashboardPage() {
  const { hasAnyPermission } = useAuthStore();

  // Filter quick links and modules by user permissions
  const visibleQuickLinks = quickLinks.filter(link => hasAnyPermission(link.permissions));
  const visibleModules = modules.filter(mod => hasAnyPermission(mod.permissions));

  // Determine which data to fetch based on permissions
  const canReadPatients = hasAnyPermission(['patients.read']);
  const canReadEncounters = hasAnyPermission(['encounters.read']);
  const canReadAnalytics = hasAnyPermission(['analytics.read']);
  const canReadPharmacy = hasAnyPermission(['pharmacy.read']);
  const canReadLab = hasAnyPermission(['lab.read']);
  const canReadBilling = hasAnyPermission(['billing.read']);
  const canReadIPD = hasAnyPermission(['ipd.read']);

  // Fetch dashboard statistics — only for modules user can access
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const promises: Record<string, Promise<any>> = {};

      if (canReadPatients) {
        promises.patients = api.get('/patients?limit=1').catch(() => ({ data: { total: 0 } }));
      }
      if (canReadEncounters) {
        promises.encounters = api.get('/encounters/stats/today').catch(() => ({ data: { total: 0, waiting: 0, inProgress: 0, completed: 0 } }));
      }
      if (canReadAnalytics) {
        promises.analytics = api.get('/analytics/dashboard').catch(() => ({ data: null }));
      }
      if (canReadPharmacy) {
        promises.pharmacy = api.get('/pharmacy/queue/stats').catch(() => ({ data: { pending: 0, dispensed: 0 } }));
      }
      if (canReadLab) {
        promises.lab = api.get('/lab/queue/stats').catch(() => ({ data: { pending: 0, completed: 0 } }));
      }

      const keys = Object.keys(promises);
      const results = await Promise.all(Object.values(promises));
      const resolved: Record<string, any> = {};
      keys.forEach((k, i) => { resolved[k] = results[i]; });

      const analytics = resolved.analytics?.data;

      return {
        patients: {
          total: analytics?.patients?.total || resolved.patients?.data?.meta?.total || resolved.patients?.data?.total || 0,
          today: analytics?.patients?.newToday || 0
        },
        encounters: resolved.encounters?.data || { total: 0, waiting: 0, inProgress: 0, completed: 0 },
        lab: {
          pending: resolved.lab?.data?.pending || 0,
          completed: resolved.lab?.data?.completed || 0
        },
        pharmacy: {
          pending: resolved.pharmacy?.data?.pending || 0,
          dispensed: resolved.pharmacy?.data?.dispensed || 0
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

  // Fetch recent activity (only if user has analytics permission)
  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard-recent-activity'],
    queryFn: async () => {
      const response = await api.get('/analytics/recent-activity?limit=5').catch(() => ({ data: [] }));
      return response.data || [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: canReadAnalytics,
  });

  // Fetch alerts (only if user has analytics permission)
  const { data: alerts } = useQuery({
    queryKey: ['dashboard-alerts'],
    queryFn: async () => {
      const response = await api.get('/analytics/alerts').catch(() => ({ data: [] }));
      return response.data || [];
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled: canReadAnalytics,
  });

  const getActivityIcon = (iconName: string) => {
    switch (iconName) {
      case 'user-plus': return <UserPlus className="w-4 h-4 text-green-600" />;
      case 'stethoscope': return <Stethoscope className="w-4 h-4 text-blue-600" />;
      case 'flask': return <FlaskConical className="w-4 h-4 text-purple-600" />;
      case 'credit-card': return <CreditCard className="w-4 h-4 text-teal-600" />;
      default: return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const getActivityBgColor = (iconName: string) => {
    switch (iconName) {
      case 'user-plus': return 'bg-green-100';
      case 'stethoscope': return 'bg-blue-100';
      case 'flask': return 'bg-purple-100';
      case 'credit-card': return 'bg-teal-100';
      default: return 'bg-gray-100';
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return then.toLocaleDateString();
  };

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

      {/* Quick Stats — only show cards the user has permissions for */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
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
            {canReadPatients && (
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
            )}

            {canReadEncounters && (
            <>
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
            </>
            )}

            {canReadIPD && (
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
            )}

            {canReadEncounters && (
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
            )}
          </>
        )}
      </div>

      {/* Quick Actions — only show links the user has permissions for */}
      {visibleQuickLinks.length > 0 && (
      <div className="bg-white rounded-xl border shadow-sm p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {visibleQuickLinks.map((link) => (
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
      )}

      {/* Modules Grid — only show modules the user has permissions for */}
      {visibleModules.length > 0 && (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleModules.map((module) => (
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
      )}

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
            {recentActivity && recentActivity.length > 0 ? (
              recentActivity.map((activity: any, index: number) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className={`p-2 ${getActivityBgColor(activity.icon)} rounded-lg`}>
                    {getActivityIcon(activity.icon)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.description} • {formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                No recent activity
              </div>
            )}
          </div>
        </div>

        {/* Alerts & Notifications */}
        <div className="bg-white rounded-xl border shadow-sm p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
            {alerts && alerts.length > 0 && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">{alerts.length} new</span>
            )}
          </div>
          <div className="space-y-3">
            {alerts && alerts.length > 0 ? (
              alerts.map((alert: any, index: number) => {
                const bgColor = alert.type === 'critical' ? 'bg-red-50 border-red-100' : 
                               alert.type === 'warning' ? 'bg-yellow-50 border-yellow-100' : 
                               'bg-blue-50 border-blue-100';
                const iconColor = alert.type === 'critical' ? 'text-red-500' : 
                                 alert.type === 'warning' ? 'text-yellow-500' : 
                                 'text-blue-500';
                const titleColor = alert.type === 'critical' ? 'text-red-800' : 
                                  alert.type === 'warning' ? 'text-yellow-800' : 
                                  'text-blue-800';
                const descColor = alert.type === 'critical' ? 'text-red-600' : 
                                 alert.type === 'warning' ? 'text-yellow-600' : 
                                 'text-blue-600';
                
                return (
                  <div key={index} className={`flex items-start gap-3 p-3 ${bgColor} rounded-lg border`}>
                    {alert.type === 'info' ? (
                      <ClipboardList className={`w-5 h-5 ${iconColor} mt-0.5`} />
                    ) : (
                      <AlertCircle className={`w-5 h-5 ${iconColor} mt-0.5`} />
                    )}
                    <div>
                      <p className={`text-sm font-medium ${titleColor}`}>{alert.title}</p>
                      <p className={`text-xs ${descColor}`}>{alert.description}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-4 text-gray-500 text-sm">
                No alerts at this time
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
