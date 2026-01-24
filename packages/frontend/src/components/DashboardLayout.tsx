import { useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import {
  Building2,
  Users,
  Building,
  UserCircle,
  Stethoscope,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Shield,
  ShieldCheck,
  ClipboardList,
  Pill,
  CreditCard,
  Package,
  FlaskConical,
  Scan,
  Bed,
  Siren,
  Scissors,
  Baby,
  Briefcase,
  Calculator,
  BarChart3,
  Crown,
  Layers,
  Warehouse,
  ListOrdered,
  Building as TenantIcon,
  Activity,
  FileText,
  ArrowRightLeft,
  CalendarCheck,
  FileSpreadsheet,
  ClipboardCheck,
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Emergency', href: '/emergency', icon: Siren },
  { name: 'Queue Management', href: '/queue', icon: ListOrdered },
  { name: 'OPD Visits', href: '/encounters', icon: ClipboardList },
  { name: 'IPD/Wards', href: '/wards', icon: Bed },
  { name: 'Theatre', href: '/theatre', icon: Scissors },
  { name: 'Maternity', href: '/maternity', icon: Baby },
  { name: 'Lab', href: '/lab', icon: FlaskConical },
  { name: 'Radiology', href: '/radiology', icon: Scan },
  { name: 'Pharmacy', href: '/pharmacy', icon: Pill },
  { name: 'Cashier', href: '/cashier', icon: CreditCard },
  { name: 'Referrals', href: '/referrals', icon: ArrowRightLeft },
  { name: 'Follow-ups', href: '/follow-ups', icon: CalendarCheck },
  { name: 'Treatment Plans', href: '/treatment-plans', icon: FileSpreadsheet },
  { name: 'Discharge', href: '/discharge', icon: ClipboardCheck },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Stores', href: '/stores', icon: Warehouse },
  { name: 'Orders', href: '/orders', icon: ListOrdered },
  { name: 'HR & Payroll', href: '/hr', icon: Briefcase },
  { name: 'Finance', href: '/finance', icon: Calculator },
  { name: 'Insurance', href: '/insurance', icon: ShieldCheck },
  { name: 'Membership', href: '/membership', icon: Crown },
  { name: 'Services', href: '/services', icon: Layers },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Patients', href: '/patients', icon: UserCircle },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Facilities', href: '/facilities', icon: Building },
  { name: 'Tenants', href: '/tenants', icon: TenantIcon },
  { name: 'Roles', href: '/roles', icon: Shield },
];

export default function DashboardLayout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-lg transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900">Glide HIMS</h1>
            <p className="text-xs text-gray-500">Healthcare Management</p>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-500 hover:text-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Header */}
        <header className="bg-white shadow-sm sticky top-0 z-30">
          <div className="flex items-center justify-between px-4 py-3">
            <button
              className="lg:hidden text-gray-600 hover:text-gray-900"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2 text-sm text-gray-500 lg:ml-0">
              <Stethoscope className="w-4 h-4" />
              <span>Main Hospital</span>
            </div>

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 text-gray-700 hover:text-gray-900"
              >
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-medium text-sm">
                    {user?.fullName?.charAt(0) || 'U'}
                  </span>
                </div>
                <span className="hidden sm:inline text-sm font-medium">
                  {user?.fullName || 'User'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border py-1 z-50">
                    <div className="px-4 py-2 border-b">
                      <p className="text-sm font-medium text-gray-900">{user?.fullName}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
