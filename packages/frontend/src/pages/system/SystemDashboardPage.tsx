import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../../services/api';
import {
  Building2, Users, Shield, Activity, ArrowRight, Loader2,
  AlertTriangle, TrendingUp, LifeBuoy, KeyRound, CreditCard,
  CheckCircle2, XCircle, RefreshCw,
} from 'lucide-react';

interface DashboardStats {
  tenants: { total: number; active: number; suspended: number };
  admins: { total: number };
  health: { status: 'online' | 'degraded' | 'offline'; message: string };
  subscriptions: { active: number; pastDue: number; trial: number };
  licenses: { expiringSoon: number };
  support: { pending: number };
  revenue: { mrr: number; currency: string };
}

const defaultStats: DashboardStats = {
  tenants: { total: 0, active: 0, suspended: 0 },
  admins: { total: 0 },
  health: { status: 'online', message: 'All services running' },
  subscriptions: { active: 0, pastDue: 0, trial: 0 },
  licenses: { expiringSoon: 0 },
  support: { pending: 0 },
  revenue: { mrr: 0, currency: 'USD' },
};

export default function SystemDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>(defaultStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.allSettled([
        api.get('/tenants', { params: { limit: 1 } }),
        api.get('/users/system-admins', { params: { limit: 1 } }),
        api.get('/health').catch(() => ({ data: null })),
        api.get('/saas-revenue/subscriptions', { params: { limit: 1 } }).catch(() => ({ data: null })),
        api.get('/license', { params: { limit: 1 } }).catch(() => ({ data: null })),
        api.get('/support-access/requests/pending').catch(() => ({ data: [] })),
        api.get('/saas-revenue/dashboard').catch(() => ({ data: null })),
      ]);

      const s = { ...defaultStats };

      // Tenants
      if (results[0].status === 'fulfilled') {
        const res = results[0].value;
        const meta = (res as any).meta;
        const list = Array.isArray(res.data) ? res.data : (res.data?.items || res.data?.data || []);
        s.tenants.total = meta?.total ?? list.length;
        // Fetch all for status counts if small enough
        if (s.tenants.total <= 200) {
          try {
            const allRes = await api.get('/tenants', { params: { limit: 200 } });
            const allList = Array.isArray(allRes.data) ? allRes.data : (allRes.data?.items || allRes.data?.data || []);
            s.tenants.total = (allRes as any).meta?.total ?? allList.length;
            s.tenants.active = allList.filter((t: any) => t.status === 'active').length;
            s.tenants.suspended = s.tenants.total - s.tenants.active;
          } catch { /* use total only */ }
        }
      }

      // Admins
      if (results[1].status === 'fulfilled') {
        const res = results[1].value;
        const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        s.admins.total = (res as any).meta?.total ?? list.length;
      }

      // Health
      if (results[2].status === 'fulfilled' && results[2].value.data) {
        const h = results[2].value.data;
        if (h.status === 'ok' || h.status === 'up') {
          s.health = { status: 'online', message: 'All services running' };
        } else if (h.status === 'degraded') {
          s.health = { status: 'degraded', message: h.info || 'Some services degraded' };
        } else {
          s.health = { status: 'offline', message: h.error || 'Services unavailable' };
        }
      }

      // Support requests
      if (results[5].status === 'fulfilled') {
        const pendingData = results[5].value.data;
        const pendingList = Array.isArray(pendingData) ? pendingData : (pendingData?.data || []);
        s.support.pending = pendingList.length;
      }

      // Revenue + Subscription counts (from /saas-revenue/dashboard)
      if (results[6].status === 'fulfilled' && results[6].value.data) {
        const rev = results[6].value.data;
        if (rev.mrr != null) s.revenue.mrr = rev.mrr;
        if (rev.currency) s.revenue.currency = rev.currency;
        if (rev.counts) {
          s.subscriptions = {
            active: rev.counts.active ?? 0,
            pastDue: rev.counts.pastDue ?? 0,
            trial: rev.counts.trial ?? 0,
          };
        }
      }

      setStats(s);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to load dashboard data';
      setError(msg);
      toast.error('Dashboard load error', { description: msg });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const healthStyles = {
    online: { color: 'from-green-500 to-green-600', text: 'text-green-700', label: 'Online' },
    degraded: { color: 'from-amber-500 to-amber-600', text: 'text-amber-700', label: 'Degraded' },
    offline: { color: 'from-red-500 to-red-600', text: 'text-red-700', label: 'Offline' },
  };
  const h = healthStyles[stats.health.status];

  const cards = [
    {
      title: 'Organizations',
      value: stats.tenants.total,
      subtitle: `${stats.tenants.active} active, ${stats.tenants.suspended} suspended`,
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
      href: '/system/tenants',
    },
    {
      title: 'System Admins',
      value: stats.admins.total,
      subtitle: 'Platform administrators',
      icon: Shield,
      color: 'from-slate-600 to-slate-800',
      href: '/system/users',
    },
    {
      title: 'Active Subscriptions',
      value: stats.subscriptions.active,
      subtitle: `${stats.subscriptions.trial} trial, ${stats.subscriptions.pastDue} past due`,
      icon: CreditCard,
      color: 'from-indigo-500 to-indigo-600',
      href: '/system/subscriptions',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
          <p className="text-gray-500 mt-1">Platform overview and management</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Failed to load some dashboard data</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Alert banners */}
      {(stats.support.pending > 0 || stats.subscriptions.pastDue > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {stats.support.pending > 0 && (
            <Link
              to="/system/support-requests"
              className="flex items-center gap-3 p-4 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors"
            >
              <LifeBuoy className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-sm font-semibold text-orange-800">
                  {stats.support.pending} pending support request{stats.support.pending !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-orange-600">Requires your attention</p>
              </div>
            </Link>
          )}
          {stats.subscriptions.pastDue > 0 && (
            <Link
              to="/system/subscriptions?status=past_due"
              className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {stats.subscriptions.pastDue} past-due subscription{stats.subscriptions.pastDue !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-red-600">May need dunning action</p>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
              <ArrowRight className="w-5 h-5 text-gray-300 group-hover:text-gray-500 transition-colors" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{card.value}</p>
            <p className="text-sm font-medium text-gray-700 mt-1">{card.title}</p>
            <p className="text-xs text-gray-500 mt-1">{card.subtitle}</p>
          </Link>
        ))}

        {/* System health card - wired to /health endpoint */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${h.color} flex items-center justify-center`}>
              <Activity className="w-6 h-6 text-white" />
            </div>
            {stats.health.status === 'online' ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : stats.health.status === 'degraded' ? (
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
          </div>
          <p className={`text-3xl font-bold text-gray-900`}>{h.label}</p>
          <p className="text-sm font-medium text-gray-700 mt-1">System Status</p>
          <p className="text-xs text-gray-500 mt-1">{stats.health.message}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            to="/system/tenants"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Manage Organizations</span>
          </Link>
          <Link
            to="/system/users"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <Users className="w-5 h-5 text-slate-600" />
            <span className="text-sm font-medium text-gray-700">Manage System Users</span>
          </Link>
          <Link
            to="/system/revenue"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
          >
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            <span className="text-sm font-medium text-gray-700">Revenue Dashboard</span>
          </Link>
          <Link
            to="/system/settings"
            className="flex items-center gap-3 px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            <Activity className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">Platform Settings</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
