import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { Building2, Users, Shield, Activity, ArrowRight, Loader2 } from 'lucide-react';

interface TenantSummary {
  total: number;
  active: number;
  suspended: number;
}

interface SystemAdminSummary {
  total: number;
}

export default function SystemDashboardPage() {
  const [tenants, setTenants] = useState<TenantSummary>({ total: 0, active: 0, suspended: 0 });
  const [admins, setAdmins] = useState<SystemAdminSummary>({ total: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [tenantRes, adminRes] = await Promise.all([
          api.get('/tenants', { params: { limit: 100 } }),
          api.get('/users/system-admins', { params: { limit: 100 } }),
        ]);
        const tenantList = Array.isArray(tenantRes.data) ? tenantRes.data : (tenantRes.data?.data || []);
        const adminList = Array.isArray(adminRes.data) ? adminRes.data : (adminRes.data?.data || []);
        setAdmins({ total: adminList.length });

        const list = tenantList;
        setTenants({
          total: list.length,
          active: list.filter((t: any) => t.status === 'active').length,
          suspended: list.filter((t: any) => t.status !== 'active').length,
        });
      } catch {
        // Keep defaults
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const cards = [
    {
      title: 'Organizations',
      value: tenants.total,
      subtitle: `${tenants.active} active, ${tenants.suspended} suspended`,
      icon: Building2,
      color: 'from-blue-500 to-blue-600',
      href: '/system/tenants',
    },
    {
      title: 'System Admins',
      value: admins.total,
      subtitle: 'Platform administrators',
      icon: Shield,
      color: 'from-slate-600 to-slate-800',
      href: '/system/users',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">System Administration</h1>
        <p className="text-gray-500 mt-1">Platform overview and management</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <Activity className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">Online</p>
          <p className="text-sm font-medium text-gray-700 mt-1">System Status</p>
          <p className="text-xs text-gray-500 mt-1">All services running</p>
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
