import { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/auth';
import Logo from '../../components/Logo';
import {
  Building2,
  Users,
  LayoutDashboard,
  Settings,
  Shield,
  LogOut,
  Menu,
  X,
  ChevronRight,
  LifeBuoy,
  ClipboardCheck,
  Server,
  Rocket,
  ScrollText,
  Mail,
  Download,
  KeyRound,
  ShieldAlert,
  BookOpen,
  Package,
  CreditCard,
  Receipt,
  Tag,
  TrendingUp,
  AlertTriangle,
  Percent,
  Coins,
  Inbox,
  FileText,
  HeartPulse,
  Handshake,
  ListChecks,
  DollarSign,
} from 'lucide-react';

const sidebarItems = [
  { name: 'Dashboard', href: '/system', icon: LayoutDashboard },
  { name: 'SaaS Organizations', href: '/system/tenants', icon: Building2 },
  { name: 'Deployments', href: '/system/deployments', icon: Server },
  { name: 'Rollouts', href: '/system/rollouts', icon: Rocket },
  { name: 'System Users', href: '/system/users', icon: Users },
  { name: 'Support Requests', href: '/system/support-requests', icon: LifeBuoy },
  { name: 'Leads', href: '/system/leads', icon: Mail },
  { name: 'Downloads', href: '/system/downloads', icon: Download },
  { name: 'Licenses', href: '/system/licenses', icon: KeyRound },
  { name: 'Plans', href: '/system/plans', icon: Package },
  { name: 'Subscriptions', href: '/system/subscriptions', icon: CreditCard },
  { name: 'Price Catalog', href: '/system/price-catalog', icon: DollarSign },
  { name: 'Quotations', href: '/system/quotations', icon: FileText },
  { name: 'Contracts', href: '/system/contracts', icon: Handshake },
  { name: 'Onboarding', href: '/system/onboardings', icon: ListChecks },
  { name: 'Client Health', href: '/system/client-health', icon: HeartPulse },
  { name: 'SaaS Invoices', href: '/system/saas-invoices', icon: Receipt },
  { name: 'Billing Identity', href: '/system/billing-settings', icon: Building2 },
  { name: 'Email Templates', href: '/system/email-templates', icon: Mail },
  { name: 'Email Log', href: '/system/email-logs', icon: Inbox },
  { name: 'Dunning Rules', href: '/system/dunning-rules', icon: AlertTriangle },
  { name: 'VAT / Tax Rules', href: '/system/vat-rules', icon: Percent },
  { name: 'Currency Rates', href: '/system/currency-rates', icon: Coins },
  { name: 'Coupons', href: '/system/coupons', icon: Tag },
  { name: 'Revenue', href: '/system/revenue', icon: TrendingUp },
  { name: 'SaaS Audit', href: '/system/saas-audit', icon: Receipt },
  { name: 'Compliance Center', href: '/system/compliance', icon: ClipboardCheck },
  { name: 'Security & Blocks', href: '/system/security', icon: ShieldAlert },
  { name: 'Audit Logs', href: '/system/audit-logs', icon: ScrollText },
  { name: 'Documentation', href: '/system/docs', icon: BookOpen },
  { name: 'Settings', href: '/system/settings', icon: Settings },
];

export default function SystemAdminLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/system/login');
  };

  const isActive = (href: string) => {
    if (href === '/system') return location.pathname === '/system';
    return location.pathname.startsWith(href);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold">Glide HIMS</h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider">System Admin</p>
              </div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Nav links */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {sidebarItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {item.name}
                  {active && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="border-t border-slate-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-sm font-bold uppercase">
                {user?.fullName?.[0] || 'A'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user?.fullName || 'Admin'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-600 hover:text-gray-900"
          >
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Shield className="w-4 h-4" />
            System Administrator
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
