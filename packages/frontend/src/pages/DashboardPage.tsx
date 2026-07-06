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
  Eye,
  Glasses,
  Package,
  ShoppingCart,
  Smile,
  Scissors,
  type LucideIcon,
} from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../store/auth';
import PharmacyDashboardPage from './pharmacy/PharmacyDashboardPage';
import DentalDashboardPage from './dental/DentalDashboardPage';
import OpticalDashboardPage from './optical/OpticalDashboardPage';

interface DashboardStats {
  patients: { total: number; today: number };
  encounters: { total: number; waiting: number; inProgress: number; completed: number };
  lab: { pending: number; completed: number };
  pharmacy: { pending: number; dispensed: number };
  billing: { todayRevenue: number; pendingPayments: number };
  beds: { total: number; occupied: number; available: number };
}

interface QuickLink {
  name: string;
  href: string;
  icon: LucideIcon;
  color: string;
  permissions: string[];
  moduleCode?: string;
}

interface ModuleCard {
  name: string;
  href: string;
  icon: LucideIcon;
  description: string;
  color: string;
  permissions: string[];
  moduleCode?: string;
}

interface StatCard {
  label: string;
  value: number;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
  moduleCode?: string;
}

// ─── Business-type configurations ───
const businessConfig: Record<string, {
  welcomeText: string;
  entityName: string; // "Patients", "Customers", "Clients"
  quickLinks: QuickLink[];
  modules: ModuleCard[];
}> = {
  pharmacy: {
    welcomeText: 'Pharmacy Management',
    entityName: 'Customers',
    quickLinks: [
      { name: 'All Customers', href: '/patients', icon: Users, color: 'bg-cyan-500', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'New Customer', href: '/patients/new', icon: UserPlus, color: 'bg-blue-500', permissions: ['patients.create'], moduleCode: 'registration' },
      { name: 'POS Sale', href: '/pos', icon: ShoppingCart, color: 'bg-emerald-500', permissions: ['billing.read'], moduleCode: 'pos' },
      { name: 'Dispense', href: '/pharmacy/dispense', icon: Pill, color: 'bg-orange-500', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
      { name: 'Stock', href: '/pharmacy/stock', icon: Package, color: 'bg-purple-500', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
      { name: 'Billing', href: '/billing/invoices', icon: CreditCard, color: 'bg-teal-500', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports', href: '/reports', icon: BarChart3, color: 'bg-indigo-500', permissions: ['reports.read'], moduleCode: 'reports' },
      { name: 'Expiry Alerts', href: '/pharmacy/expiry', icon: AlertCircle, color: 'bg-red-500', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
    ],
    modules: [
      { name: 'Customer Registration', href: '/patients', icon: Users, description: 'Customer profiles & history', color: 'border-blue-200 hover:border-blue-400', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'Dispensing', href: '/pharmacy/dispense', icon: Pill, description: 'Prescription dispensing & verification', color: 'border-orange-200 hover:border-orange-400', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
      { name: 'Point of Sale', href: '/pos', icon: ShoppingCart, description: 'Retail sales & transactions', color: 'border-emerald-200 hover:border-emerald-400', permissions: ['billing.read'], moduleCode: 'pos' },
      { name: 'Stock Management', href: '/pharmacy/stock', icon: Package, description: 'Inventory, reorder & expiry tracking', color: 'border-purple-200 hover:border-purple-400', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
      { name: 'Billing & Payments', href: '/billing/invoices', icon: CreditCard, description: 'Invoices, receipts & payments', color: 'border-teal-200 hover:border-teal-400', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Procurement', href: '/pharmacy/procurement', icon: ClipboardList, description: 'Purchase orders & supplier management', color: 'border-yellow-200 hover:border-yellow-400', permissions: ['inventory.read'], moduleCode: 'stores' },
      { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, description: 'Sales, stock & financial reports', color: 'border-amber-200 hover:border-amber-400', permissions: ['reports.read'], moduleCode: 'reports' },
      { name: 'Controlled Substances', href: '/pharmacy/controlled-substances', icon: AlertCircle, description: 'Controlled drug register & compliance', color: 'border-red-200 hover:border-red-400', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
    ],
  },

  dental: {
    welcomeText: 'Dental Practice Management',
    entityName: 'Patients',
    quickLinks: [
      { name: 'All Patients', href: '/patients', icon: Users, color: 'bg-cyan-500', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'Register Patient', href: '/patients/new', icon: UserPlus, color: 'bg-blue-500', permissions: ['patients.create'], moduleCode: 'registration' },
      { name: 'Dental Chart', href: '/dental/chart', icon: Smile, color: 'bg-pink-500', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Procedures', href: '/dental/procedures', icon: Scissors, color: 'bg-purple-500', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Treatment Plans', href: '/dental/treatment-plans', icon: ClipboardList, color: 'bg-green-500', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Billing', href: '/billing/invoices', icon: CreditCard, color: 'bg-teal-500', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports', href: '/reports', icon: BarChart3, color: 'bg-indigo-500', permissions: ['reports.read'], moduleCode: 'reports' },
      { name: 'Lab Orders', href: '/dental/lab-orders', icon: FlaskConical, color: 'bg-orange-500', permissions: ['lab.read'], moduleCode: 'dental_charting' },
    ],
    modules: [
      { name: 'Patient Registration', href: '/patients', icon: Users, description: 'Patient profiles & dental history', color: 'border-blue-200 hover:border-blue-400', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'Dental Charting', href: '/dental/chart', icon: Smile, description: 'Interactive tooth charts & conditions', color: 'border-pink-200 hover:border-pink-400', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Procedures', href: '/dental/procedures', icon: Scissors, description: 'Dental procedures & treatments', color: 'border-purple-200 hover:border-purple-400', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Treatment Plans', href: '/dental/treatment-plans', icon: ClipboardList, description: 'Multi-visit treatment planning', color: 'border-green-200 hover:border-green-400', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Dental Imaging', href: '/dental/imaging', icon: Scan, description: 'X-rays, OPG & imaging records', color: 'border-cyan-200 hover:border-cyan-400', permissions: ['encounters.read'], moduleCode: 'dental_charting' },
      { name: 'Dental Lab', href: '/dental/lab-orders', icon: FlaskConical, description: 'Crown, bridge & prosthetics lab orders', color: 'border-orange-200 hover:border-orange-400', permissions: ['lab.read'], moduleCode: 'dental_charting' },
      { name: 'Billing & Insurance', href: '/billing/invoices', icon: CreditCard, description: 'Invoices, insurance claims & payments', color: 'border-teal-200 hover:border-teal-400', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, description: 'Practice analytics & performance', color: 'border-amber-200 hover:border-amber-400', permissions: ['reports.read'], moduleCode: 'reports' },
    ],
  },

  optical: {
    welcomeText: 'Optical Center Management',
    entityName: 'Clients',
    quickLinks: [
      { name: 'All Clients', href: '/patients', icon: Users, color: 'bg-cyan-500', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'New Client', href: '/patients/new', icon: UserPlus, color: 'bg-blue-500', permissions: ['patients.create'], moduleCode: 'registration' },
      { name: 'Eye Exam', href: '/optical/exams', icon: Eye, color: 'bg-violet-500', permissions: ['encounters.read'], moduleCode: 'optical_exams' },
      { name: 'Prescriptions', href: '/optical/prescriptions', icon: ClipboardList, color: 'bg-green-500', permissions: ['encounters.read'], moduleCode: 'optical_exams' },
      { name: 'POS Sale', href: '/pos', icon: ShoppingCart, color: 'bg-emerald-500', permissions: ['billing.read'], moduleCode: 'pos' },
      { name: 'Frame Stock', href: '/optical/frames', icon: Glasses, color: 'bg-pink-500', permissions: ['inventory.read'], moduleCode: 'stores' },
      { name: 'Billing', href: '/billing/invoices', icon: CreditCard, color: 'bg-teal-500', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports', href: '/reports', icon: BarChart3, color: 'bg-indigo-500', permissions: ['reports.read'], moduleCode: 'reports' },
    ],
    modules: [
      { name: 'Client Registration', href: '/patients', icon: Users, description: 'Client profiles & visit history', color: 'border-blue-200 hover:border-blue-400', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'Eye Examinations', href: '/optical/exams', icon: Eye, description: 'Comprehensive eye exams & refraction', color: 'border-violet-200 hover:border-violet-400', permissions: ['encounters.read'], moduleCode: 'optical_exams' },
      { name: 'Optical Prescriptions', href: '/optical/prescriptions', icon: ClipboardList, description: 'Spectacle & contact lens Rx', color: 'border-green-200 hover:border-green-400', permissions: ['encounters.read'], moduleCode: 'optical_exams' },
      { name: 'Spectacle Orders', href: '/optical/orders', icon: Glasses, description: 'Frame selection & lens cutting orders', color: 'border-pink-200 hover:border-pink-400', permissions: ['inventory.read'], moduleCode: 'optical_exams' },
      { name: 'Point of Sale', href: '/pos', icon: ShoppingCart, description: 'Retail sales & transactions', color: 'border-emerald-200 hover:border-emerald-400', permissions: ['billing.read'], moduleCode: 'pos' },
      { name: 'Frame & Lens Inventory', href: '/optical/frames', icon: Package, description: 'Frame catalog & lens stock management', color: 'border-purple-200 hover:border-purple-400', permissions: ['inventory.read'], moduleCode: 'stores' },
      { name: 'Billing & Insurance', href: '/billing/invoices', icon: CreditCard, description: 'Invoices, insurance & payments', color: 'border-teal-200 hover:border-teal-400', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, description: 'Business analytics & performance', color: 'border-amber-200 hover:border-amber-400', permissions: ['reports.read'], moduleCode: 'reports' },
    ],
  },

  hospital: {
    welcomeText: 'Hospital Management',
    entityName: 'Patients',
    quickLinks: [
      { name: 'All Patients', href: '/patients', icon: Users, color: 'bg-cyan-500', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'Register Patient', href: '/patients/new', icon: UserPlus, color: 'bg-blue-500', permissions: ['patients.create'], moduleCode: 'registration' },
      { name: 'New Visit', href: '/encounters/new', icon: Stethoscope, color: 'bg-green-500', permissions: ['encounters.create'], moduleCode: 'doctors' },
      { name: 'Lab Queue', href: '/lab/queue', icon: FlaskConical, color: 'bg-purple-500', permissions: ['lab.read'], moduleCode: 'diagnostics' },
      { name: 'Pharmacy', href: '/pharmacy/queue', icon: Pill, color: 'bg-orange-500', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
      { name: 'Billing', href: '/billing/invoices', icon: CreditCard, color: 'bg-teal-500', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports', href: '/reports', icon: BarChart3, color: 'bg-indigo-500', permissions: ['reports.read'], moduleCode: 'reports' },
      { name: 'Emergency', href: '/emergency/queue', icon: Siren, color: 'bg-red-500', permissions: ['emergency.read'], moduleCode: 'emergency' },
    ],
    modules: [
      { name: 'Registration', href: '/patients', icon: Users, description: 'Patient management & registration', color: 'border-blue-200 hover:border-blue-400', permissions: ['patients.read'], moduleCode: 'registration' },
      { name: 'OPD / Encounters', href: '/encounters', icon: Stethoscope, description: 'Outpatient visits & consultations', color: 'border-green-200 hover:border-green-400', permissions: ['encounters.read'], moduleCode: 'doctors' },
      { name: 'Laboratory', href: '/lab/queue', icon: FlaskConical, description: 'Lab orders & results', color: 'border-purple-200 hover:border-purple-400', permissions: ['lab.read'], moduleCode: 'diagnostics' },
      { name: 'Pharmacy', href: '/pharmacy/dispense', icon: Pill, description: 'Dispensing & stock management', color: 'border-orange-200 hover:border-orange-400', permissions: ['pharmacy.read'], moduleCode: 'pharmacy' },
      { name: 'Radiology', href: '/radiology/queue', icon: Scan, description: 'Imaging orders & reports', color: 'border-cyan-200 hover:border-cyan-400', permissions: ['radiology.read'], moduleCode: 'diagnostics' },
      { name: 'IPD / Wards', href: '/ipd/admissions', icon: Bed, description: 'Inpatient management', color: 'border-indigo-200 hover:border-indigo-400', permissions: ['ipd.read'], moduleCode: 'ipd' },
      { name: 'Billing & Finance', href: '/billing/invoices', icon: CreditCard, description: 'Invoices & payments', color: 'border-teal-200 hover:border-teal-400', permissions: ['billing.read'], moduleCode: 'billing' },
      { name: 'Reports & Analytics', href: '/reports', icon: BarChart3, description: 'Insights, statistics & analytics', color: 'border-amber-200 hover:border-amber-400', permissions: ['reports.read'], moduleCode: 'reports' },
    ],
  },
};

// Default fallback = hospital
const getBusinessConfig = (businessType?: string) => {
  if (businessType && businessConfig[businessType]) return businessConfig[businessType];
  return businessConfig.hospital;
};

export default function DashboardPage() {
  const { hasAnyPermission } = useAuthStore();
  const user = useAuthStore((state) => state.user);
  const userModules = user?.accessibleModules;
  const biz = getBusinessConfig(user?.businessType);

  // Phase 1: Route non-hospital business types to their native dashboards
  if (user?.businessType === 'pharmacy') return <PharmacyDashboardPage />;
  if (user?.businessType === 'dental') return <DentalDashboardPage />;
  if (user?.businessType === 'optical') return <OpticalDashboardPage />;

  const hasModuleAccess = (moduleCode?: string) => {
    if (!moduleCode) return true;
    if (!userModules || userModules.length === 0) return true;
    return userModules.includes(moduleCode);
  };

  const visibleQuickLinks = biz.quickLinks.filter(link => hasModuleAccess(link.moduleCode) && hasAnyPermission(link.permissions));
  const visibleModules = biz.modules.filter(mod => hasModuleAccess(mod.moduleCode) && hasAnyPermission(mod.permissions));

  // Determine which data to fetch based on permissions AND module access
  const canReadPatients = hasModuleAccess('registration') && hasAnyPermission(['patients.read']);
  const canReadEncounters = hasModuleAccess('doctors') && hasAnyPermission(['encounters.read']);
  const canReadAnalytics = hasAnyPermission(['analytics.read']);
  const canReadPharmacy = hasModuleAccess('pharmacy') && hasAnyPermission(['pharmacy.read']);
  const canReadLab = hasModuleAccess('diagnostics') && hasAnyPermission(['lab.read']);
  const canReadBilling = hasModuleAccess('billing') && hasAnyPermission(['billing.read']);
  const canReadIPD = hasModuleAccess('ipd') && hasAnyPermission(['ipd.read']);

  // Fetch dashboard statistics — only for modules user can access
  const { data: stats, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const promises: Record<string, Promise<any>> = {};

      if (canReadPatients) {
        promises.patients = api.get('/patients?limit=1').catch(() => ({ data: { total: 0 } }));
      }
      if (canReadEncounters) {
        promises.encounters = api.get('/encounters/stats/today').catch(() => ({ data: { total: 0, waiting: 0, inProgress: 0, completed: 0, bouncedEncounters: 0, totalBounces: 0, bounceRate: 0 } }));
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
        encounters: resolved.encounters?.data || { total: 0, waiting: 0, inProgress: 0, completed: 0, bouncedEncounters: 0, totalBounces: 0, bounceRate: 0 },
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

  // Phase 4: Read tenant name for branding
  const hospitalName = (() => {
    try {
      const stored = localStorage.getItem('glide_hospital_settings');
      if (stored) return JSON.parse(stored).name || '';
    } catch { /* use default */ }
    return '';
  })();

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-[calc(100vh-120px)]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {hospitalName || 'Dashboard'}
          </h1>
          <p className="text-gray-500 mt-1">
            {biz.welcomeText} • {new Date().toLocaleDateString('en-UG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-4 h-4" />
          <span>Last updated: {new Date().toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Quick Stats — business-type-specific KPIs */}
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
            {/* Pharmacy-specific stats */}
            {user?.businessType === 'pharmacy' && (
              <>
                {canReadPatients && (
                  <StatCardComponent label={`Total ${biz.entityName}`} value={stats?.patients.total || 0} icon={Users} bgColor="bg-blue-100" iconColor="text-blue-600" />
                )}
                {canReadPharmacy && (
                  <>
                    <StatCardComponent label="Rx Pending" value={stats?.pharmacy.pending || 0} icon={Pill} bgColor="bg-orange-100" iconColor="text-orange-600" />
                    <StatCardComponent label="Dispensed Today" value={stats?.pharmacy.dispensed || 0} icon={CheckCircle} bgColor="bg-green-100" iconColor="text-green-600" />
                  </>
                )}
                {canReadBilling && (
                  <StatCardComponent label="Today's Revenue" value={stats?.billing.todayRevenue || 0} icon={DollarSign} bgColor="bg-emerald-100" iconColor="text-emerald-600" isCurrency />
                )}
                {canReadPharmacy && (
                  <StatCardComponent label="Items in Stock" value={stats?.pharmacy.dispensed ? 0 : 0} icon={Package} bgColor="bg-purple-100" iconColor="text-purple-600" />
                )}
                {canReadBilling && (
                  <StatCardComponent label="Pending Payments" value={stats?.billing.pendingPayments || 0} icon={CreditCard} bgColor="bg-teal-100" iconColor="text-teal-600" isCurrency />
                )}
              </>
            )}

            {/* Dental-specific stats */}
            {user?.businessType === 'dental' && (
              <>
                {canReadPatients && (
                  <StatCardComponent label="Total Patients" value={stats?.patients.total || 0} icon={Users} bgColor="bg-blue-100" iconColor="text-blue-600" />
                )}
                {canReadEncounters && (
                  <>
                    <StatCardComponent label="Waiting" value={stats?.encounters.waiting || 0} icon={Clock} bgColor="bg-orange-100" iconColor="text-orange-600" />
                    <StatCardComponent label="In Chair" value={stats?.encounters.inProgress || 0} icon={Smile} bgColor="bg-pink-100" iconColor="text-pink-600" />
                    <StatCardComponent label="Completed Today" value={stats?.encounters.completed || 0} icon={CheckCircle} bgColor="bg-green-100" iconColor="text-green-600" />
                    <StatCardComponent label="Today's Appointments" value={stats?.encounters.total || 0} icon={CalendarCheck} bgColor="bg-purple-100" iconColor="text-purple-600" />
                  </>
                )}
                {canReadBilling && (
                  <StatCardComponent label="Today's Revenue" value={stats?.billing.todayRevenue || 0} icon={DollarSign} bgColor="bg-emerald-100" iconColor="text-emerald-600" isCurrency />
                )}
              </>
            )}

            {/* Optical-specific stats */}
            {user?.businessType === 'optical' && (
              <>
                {canReadPatients && (
                  <StatCardComponent label={`Total ${biz.entityName}`} value={stats?.patients.total || 0} icon={Users} bgColor="bg-blue-100" iconColor="text-blue-600" />
                )}
                {canReadEncounters && (
                  <>
                    <StatCardComponent label="Waiting" value={stats?.encounters.waiting || 0} icon={Clock} bgColor="bg-orange-100" iconColor="text-orange-600" />
                    <StatCardComponent label="In Exam" value={stats?.encounters.inProgress || 0} icon={Eye} bgColor="bg-violet-100" iconColor="text-violet-600" />
                    <StatCardComponent label="Exams Today" value={stats?.encounters.completed || 0} icon={CheckCircle} bgColor="bg-green-100" iconColor="text-green-600" />
                  </>
                )}
                {canReadBilling && (
                  <>
                    <StatCardComponent label="Today's Revenue" value={stats?.billing.todayRevenue || 0} icon={DollarSign} bgColor="bg-emerald-100" iconColor="text-emerald-600" isCurrency />
                    <StatCardComponent label="Pending Payments" value={stats?.billing.pendingPayments || 0} icon={CreditCard} bgColor="bg-teal-100" iconColor="text-teal-600" isCurrency />
                  </>
                )}
              </>
            )}

            {/* Hospital (default) stats */}
            {(!user?.businessType || user?.businessType === 'hospital') && (
              <>
                {canReadPatients && (
                  <StatCardComponent label="Total Patients" value={stats?.patients.total || 0} icon={Users} bgColor="bg-blue-100" iconColor="text-blue-600" />
                )}
                {canReadEncounters && (
                  <>
                    <StatCardComponent label="Waiting" value={stats?.encounters.waiting || 0} icon={Clock} bgColor="bg-orange-100" iconColor="text-orange-600" />
                    <StatCardComponent label="In Consultation" value={stats?.encounters.inProgress || 0} icon={Stethoscope} bgColor="bg-purple-100" iconColor="text-purple-600" />
                    <StatCardComponent label="Completed Today" value={stats?.encounters.completed || 0} icon={CheckCircle} bgColor="bg-green-100" iconColor="text-green-600" />
                  </>
                )}
                {canReadIPD && (
                  <StatCardComponent label="Beds Available" value={stats?.beds.available || 0} icon={Bed} bgColor="bg-indigo-100" iconColor="text-indigo-600" />
                )}
                {canReadEncounters && (
                  <StatCardComponent label="Today's Visits" value={stats?.encounters.total || 0} icon={TrendingUp} bgColor="bg-teal-100" iconColor="text-teal-600" />
                )}
              </>
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

function StatCardComponent({ label, value, icon: Icon, bgColor, iconColor, isCurrency }: {
  label: string;
  value: number;
  icon: LucideIcon;
  bgColor: string;
  iconColor: string;
  isCurrency?: boolean;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`p-2 ${bgColor} rounded-lg`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{isCurrency ? formatCurrency(value) : value}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
