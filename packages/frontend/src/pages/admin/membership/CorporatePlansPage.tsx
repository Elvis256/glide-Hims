import { useState, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
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
  TrendingUp,
  Clock,
  Trash2,
  X,
  Loader2,
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

const STORAGE_KEY = 'glide_corporate_plans';

const defaultPlans: CorporatePlan[] = [
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

const loadPlansFromStorage = (): CorporatePlan[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : defaultPlans;
  } catch {
    return defaultPlans;
  }
};

const savePlansToStorage = (plans: CorporatePlan[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
};

export default function CorporatePlansPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [plans, setPlans] = useState<CorporatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<CorporatePlan | null>(null);
  const [viewingPlan, setViewingPlan] = useState<CorporatePlan | null>(null);
  const [formData, setFormData] = useState<Partial<CorporatePlan>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setPlans(loadPlansFromStorage());
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!loading && plans.length > 0) {
      savePlansToStorage(plans);
    }
  }, [plans, loading]);

  const handleAddPlan = () => {
    setEditingPlan(null);
    setFormData({
      companyName: '',
      contractNumber: '',
      plan: 'Basic Care',
      employeeCoverage: 0,
      dependentsCoverage: 0,
      billingType: 'prepaid',
      contractStart: '',
      contractEnd: '',
      monthlyValue: 0,
      usedThisMonth: 0,
      status: 'pending',
    });
    setShowModal(true);
  };

  const handleEditPlan = (plan: CorporatePlan) => {
    setEditingPlan(plan);
    setFormData({ ...plan });
    setShowModal(true);
  };

  const handleViewPlan = (plan: CorporatePlan) => {
    setViewingPlan(plan);
  };

  const handleDeletePlan = (id: string) => {
    if (confirm('Are you sure you want to delete this contract?')) {
      setPlans(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleSavePlan = () => {
    if (!formData.companyName || !formData.contractNumber) {
      toast.error('Please fill in required fields');
      return;
    }

    if (editingPlan) {
      setPlans(prev => prev.map(p => p.id === editingPlan.id ? { ...p, ...formData } as CorporatePlan : p));
    } else {
      const newPlan: CorporatePlan = {
        ...formData as CorporatePlan,
        id: Date.now().toString(),
      };
      setPlans(prev => [...prev, newPlan]);
    }
    setShowModal(false);
    setEditingPlan(null);
    setFormData({});
  };

  const handleExport = () => {
    const csv = [
      ['Company', 'Contract', 'Plan', 'Employees', 'Dependents', 'Billing', 'Start', 'End', 'Monthly Value', 'Status'].join(','),
      ...plans.map(p => [p.companyName, p.contractNumber, p.plan, p.employeeCoverage, p.dependentsCoverage, p.billingType, p.contractStart, p.contractEnd, p.monthlyValue, p.status].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corporate_plans.csv';
    a.click();
  };

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
            <button 
              onClick={() => toast.error('Reports feature coming soon')}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              <FileText className="w-4 h-4" />
              Reports
            </button>
            <button 
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
            <button 
              onClick={handleAddPlan}
              className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
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
            <span className="font-semibold text-green-600">{formatCurrency(stats.monthlyRevenue)}</span>
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
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            <span className="ml-2 text-gray-500">Loading corporate plans...</span>
          </div>
        ) : (
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
                          {formatCurrency(plan.usedThisMonth)} / {formatCurrency(plan.monthlyValue)}
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
                        <button 
                          onClick={() => handleViewPlan(plan)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditPlan(plan)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeletePlan(plan.id)}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* View Modal */}
      {viewingPlan && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Contract Details</h2>
              <button onClick={() => setViewingPlan(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div><span className="text-gray-500">Company:</span> <span className="font-medium">{viewingPlan.companyName}</span></div>
              <div><span className="text-gray-500">Contract:</span> <span className="font-medium">{viewingPlan.contractNumber}</span></div>
              <div><span className="text-gray-500">Plan:</span> <span className="font-medium">{viewingPlan.plan}</span></div>
              <div><span className="text-gray-500">Employees:</span> <span className="font-medium">{viewingPlan.employeeCoverage}</span></div>
              <div><span className="text-gray-500">Dependents:</span> <span className="font-medium">{viewingPlan.dependentsCoverage}</span></div>
              <div><span className="text-gray-500">Billing:</span> <span className="font-medium capitalize">{viewingPlan.billingType}</span></div>
              <div><span className="text-gray-500">Period:</span> <span className="font-medium">{formatDate(viewingPlan.contractStart)} - {formatDate(viewingPlan.contractEnd)}</span></div>
              <div><span className="text-gray-500">Monthly Value:</span> <span className="font-medium">{formatCurrency(viewingPlan.monthlyValue)}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${statusColors[viewingPlan.status]}`}>{viewingPlan.status}</span></div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setViewingPlan(null)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingPlan ? 'Edit Contract' : 'New Contract'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name *</label>
                <input
                  type="text"
                  value={formData.companyName || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contract Number *</label>
                <input
                  type="text"
                  value={formData.contractNumber || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, contractNumber: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={formData.plan || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, plan: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Basic Care">Basic Care</option>
                  <option value="Silver Health">Silver Health</option>
                  <option value="Gold Premium">Gold Premium</option>
                  <option value="Platinum Elite">Platinum Elite</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Coverage</label>
                  <input
                    type="number"
                    value={formData.employeeCoverage || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, employeeCoverage: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dependents Coverage</label>
                  <input
                    type="number"
                    value={formData.dependentsCoverage || 0}
                    onChange={(e) => setFormData(prev => ({ ...prev, dependentsCoverage: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Billing Type</label>
                <select
                  value={formData.billingType || 'prepaid'}
                  onChange={(e) => setFormData(prev => ({ ...prev, billingType: e.target.value as 'prepaid' | 'postpaid' }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="prepaid">Prepaid</option>
                  <option value="postpaid">Postpaid</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract Start</label>
                  <input
                    type="date"
                    value={formData.contractStart || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractStart: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contract End</label>
                  <input
                    type="date"
                    value={formData.contractEnd || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, contractEnd: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Value ({CURRENCY_SYMBOL})</label>
                <input
                  type="number"
                  value={formData.monthlyValue || 0}
                  onChange={(e) => setFormData(prev => ({ ...prev, monthlyValue: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={formData.status || 'pending'}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as CorporatePlan['status'] }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="expiring">Expiring</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button onClick={handleSavePlan} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {editingPlan ? 'Save Changes' : 'Create Contract'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
