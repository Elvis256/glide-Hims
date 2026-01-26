import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Eye,
  Download,
  Filter,
  Building2,
  Users,
  Calendar,
  CreditCard,
  FileText,
  MoreHorizontal,
  TrendingUp,
  Clock,
} from 'lucide-react';

interface CorporatePlan {
  id: string;
  companyName: string;
  contractNumber: string;
  plan: string;
  employeeCoverage: number;
  dependentsCoverage: number;
  billingType: 'prepaid' | 'postpaid';
  contractStart: string;
  contractEnd: string;
  monthlyValue: number;
  usedThisMonth: number;
  status: 'active' | 'pending' | 'expiring' | 'expired';
}

const mockCorporatePlans: CorporatePlan[] = [
  {
    id: '1',
    companyName: 'Safaricom PLC',
    contractNumber: 'CORP-2024-001',
    plan: 'Gold Premium',
    employeeCoverage: 250,
    dependentsCoverage: 500,
    billingType: 'postpaid',
    contractStart: '2024-01-01',
    contractEnd: '2024-12-31',
    monthlyValue: 750000,
    usedThisMonth: 485000,
    status: 'active',
  },
  {
    id: '2',
    companyName: 'Kenya Commercial Bank',
    contractNumber: 'CORP-2024-002',
    plan: 'Platinum Elite',
    employeeCoverage: 180,
    dependentsCoverage: 360,
    billingType: 'postpaid',
    contractStart: '2024-03-01',
    contractEnd: '2025-02-28',
    monthlyValue: 900000,
    usedThisMonth: 620000,
    status: 'active',
  },
  {
    id: '3',
    companyName: 'Equity Bank',
    contractNumber: 'CORP-2024-003',
    plan: 'Silver Health',
    employeeCoverage: 120,
    dependentsCoverage: 240,
    billingType: 'prepaid',
    contractStart: '2024-02-01',
    contractEnd: '2025-01-31',
    monthlyValue: 180000,
    usedThisMonth: 95000,
    status: 'active',
  },
  {
    id: '4',
    companyName: 'Nation Media Group',
    contractNumber: 'CORP-2023-015',
    plan: 'Gold Premium',
    employeeCoverage: 80,
    dependentsCoverage: 160,
    billingType: 'postpaid',
    contractStart: '2023-06-01',
    contractEnd: '2024-05-31',
    monthlyValue: 240000,
    usedThisMonth: 198000,
    status: 'expiring',
  },
  {
    id: '5',
    companyName: 'TechStart Kenya',
    contractNumber: 'CORP-2024-010',
    plan: 'Basic Care',
    employeeCoverage: 30,
    dependentsCoverage: 0,
    billingType: 'prepaid',
    contractStart: '2024-04-01',
    contractEnd: '2025-03-31',
    monthlyValue: 15000,
    usedThisMonth: 8500,
    status: 'pending',
  },
  {
    id: '6',
    companyName: 'Old Mutual Kenya',
    contractNumber: 'CORP-2023-008',
    plan: 'Silver Health',
    employeeCoverage: 150,
    dependentsCoverage: 300,
    billingType: 'postpaid',
    contractStart: '2023-01-01',
    contractEnd: '2023-12-31',
    monthlyValue: 225000,
    usedThisMonth: 0,
    status: 'expired',
  },
];

const statusColors = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  expiring: 'bg-orange-100 text-orange-700',
  expired: 'bg-red-100 text-red-700',
};

const billingColors = {
  prepaid: 'bg-blue-100 text-blue-700',
  postpaid: 'bg-purple-100 text-purple-700',
};

const statuses = ['All', 'active', 'pending', 'expiring', 'expired'];

export default function CorporatePlansPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [plans] = useState<CorporatePlan[]>(mockCorporatePlans);

  const filteredPlans = useMemo(() => {
    return plans.filter(plan => {
      const matchesSearch = plan.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        plan.contractNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' || plan.status === selectedStatus;
      return matchesSearch && matchesStatus;
    });
  }, [plans, searchTerm, selectedStatus]);

  const stats = useMemo(() => ({
    totalCompanies: plans.length,
    activeContracts: plans.filter(p => p.status === 'active').length,
    totalEmployees: plans.filter(p => p.status === 'active').reduce((sum, p) => sum + p.employeeCoverage, 0),
    monthlyRevenue: plans.filter(p => p.status === 'active').reduce((sum, p) => sum + p.monthlyValue, 0),
  }), [plans]);

  const formatDate = (date: string) => new Date(date).toLocaleDateString('en-KE', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });

  const getUsagePercentage = (used: number, total: number) => Math.round((used / total) * 100);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corporate Plans</h1>
            <p className="text-sm text-gray-500">Manage corporate and group memberships</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <FileText className="w-4 h-4" />
              Reports
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" />
              New Contract
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Companies:</span>
            <span className="font-semibold">{stats.totalCompanies}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active Contracts:</span>
            <span className="font-semibold text-green-600">{stats.activeContracts}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Covered Employees:</span>
            <span className="font-semibold text-blue-600">{stats.totalEmployees.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">Monthly Value:</span>
            <span className="font-semibold text-green-600">KES {stats.monthlyRevenue.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by company or contract..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            {statuses.map(status => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize transition-colors ${
                  selectedStatus === status
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="bg-white rounded-lg border">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Company</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Plan</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Coverage</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Billing</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Contract Period</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usage</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPlans.map(plan => {
                const usagePercent = getUsagePercentage(plan.usedThisMonth, plan.monthlyValue);
                return (
                  <tr key={plan.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{plan.companyName}</p>
                          <code className="text-xs text-gray-500">{plan.contractNumber}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{plan.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Users className="w-3.5 h-3.5 text-gray-400" />
                          <span className="font-medium">{plan.employeeCoverage}</span>
                          <span className="text-gray-400">emp</span>
                        </div>
                        {plan.dependentsCoverage > 0 && (
                          <span className="text-xs text-gray-500">+{plan.dependentsCoverage} dep</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${billingColors[plan.billingType]}`}>
                        <CreditCard className="w-3 h-3" />
                        {plan.billingType === 'prepaid' ? 'Prepaid' : 'Postpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-sm">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{formatDate(plan.contractStart)}</span>
                        <span className="text-gray-400">-</span>
                        <span>{formatDate(plan.contractEnd)}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-32">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-500">This month</span>
                          <span className="font-medium">{usagePercent}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${
                              usagePercent > 90 ? 'bg-red-500' : usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${Math.min(usagePercent, 100)}%` }}
                          ></div>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          KES {plan.usedThisMonth.toLocaleString()} / {plan.monthlyValue.toLocaleString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusColors[plan.status]}`}>
                        {plan.status === 'expiring' && <Clock className="w-3 h-3 mr-1" />}
                        {plan.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded">
                          <MoreHorizontal className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
