import { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Percent,
  DollarSign,
  Users,
  ShieldCheck,
  Calendar,
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface DiscountScheme {
  id: string;
  name: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  eligibility: string[];
  applicableServices: string;
  requiresApproval: boolean;
  approvalLevel: string | null;
  usageLimit: number | null;
  usedCount: number;
  validFrom: string;
  validTo: string;
  isActive: boolean;
}

const mockDiscounts: DiscountScheme[] = [
  {
    id: '1',
    name: 'Senior Citizen Discount',
    code: 'SENIOR15',
    type: 'percentage',
    value: 15,
    eligibility: ['Senior Citizens (60+)'],
    applicableServices: 'All Services',
    requiresApproval: false,
    approvalLevel: null,
    usageLimit: null,
    usedCount: 342,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
  },
  {
    id: '2',
    name: 'Staff Discount',
    code: 'STAFF25',
    type: 'percentage',
    value: 25,
    eligibility: ['Hospital Staff', 'Staff Dependents'],
    applicableServices: 'All Services',
    requiresApproval: false,
    approvalLevel: null,
    usageLimit: null,
    usedCount: 189,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
  },
  {
    id: '3',
    name: 'Corporate Partner Discount',
    code: 'CORP10',
    type: 'percentage',
    value: 10,
    eligibility: ['Corporate Partners', 'Partner Employees'],
    applicableServices: 'Consultation, Lab, Radiology',
    requiresApproval: false,
    approvalLevel: null,
    usageLimit: null,
    usedCount: 567,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
  },
  {
    id: '4',
    name: 'Hardship Discount',
    code: 'HARDSHIP',
    type: 'percentage',
    value: 50,
    eligibility: ['Verified Hardship Cases'],
    applicableServices: 'All Services',
    requiresApproval: true,
    approvalLevel: 'Finance Manager',
    usageLimit: 100,
    usedCount: 23,
    validFrom: '2024-01-01',
    validTo: '2024-12-31',
    isActive: true,
  },
  {
    id: '5',
    name: 'Lab Combo Discount',
    code: 'LAB500',
    type: 'fixed',
    value: 500,
    eligibility: ['All Patients'],
    applicableServices: 'Lab (min 3 tests)',
    requiresApproval: false,
    approvalLevel: null,
    usageLimit: null,
    usedCount: 234,
    validFrom: '2024-01-01',
    validTo: '2024-06-30',
    isActive: true,
  },
  {
    id: '6',
    name: 'Emergency Relief',
    code: 'EMERG20',
    type: 'percentage',
    value: 20,
    eligibility: ['Emergency Cases'],
    applicableServices: 'Emergency Services',
    requiresApproval: true,
    approvalLevel: 'Duty Manager',
    usageLimit: 50,
    usedCount: 50,
    validFrom: '2023-01-01',
    validTo: '2023-12-31',
    isActive: false,
  },
];

export default function DiscountSchemesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [showApprovalOnly, setShowApprovalOnly] = useState(false);
  const [discounts, setDiscounts] = useState<DiscountScheme[]>(mockDiscounts);

  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || d.type === filterType;
      const matchesApproval = !showApprovalOnly || d.requiresApproval;
      return matchesSearch && matchesType && matchesApproval;
    });
  }, [discounts, searchTerm, filterType, showApprovalOnly]);

  const toggleStatus = (id: string) => {
    setDiscounts(prev => prev.map(d => d.id === id ? { ...d, isActive: !d.isActive } : d));
  };

  const stats = useMemo(() => ({
    total: discounts.length,
    active: discounts.filter(d => d.isActive).length,
    requireApproval: discounts.filter(d => d.requiresApproval).length,
    totalUsage: discounts.reduce((sum, d) => sum + d.usedCount, 0),
  }), [discounts]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount Schemes</h1>
            <p className="text-sm text-gray-500">Manage discount rules and eligibility criteria</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" />
            Create Discount
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Percent className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Schemes</div>
              <div className="text-xl font-bold text-gray-900">{stats.total}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Active</div>
              <div className="text-xl font-bold text-green-600">{stats.active}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Require Approval</div>
              <div className="text-xl font-bold text-orange-600">{stats.requireApproval}</div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm text-gray-500">Total Usage</div>
              <div className="text-xl font-bold text-purple-600">{stats.totalUsage.toLocaleString()}</div>
            </div>
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
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Type:</span>
            {(['all', 'percentage', 'fixed'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-full text-sm capitalize flex items-center gap-1 ${
                  filterType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'percentage' && <Percent className="w-3 h-3" />}
                {type === 'fixed' && <DollarSign className="w-3 h-3" />}
                {type}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showApprovalOnly}
              onChange={(e) => setShowApprovalOnly(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Approval Required</span>
          </label>
        </div>
      </div>

      {/* Discounts Grid */}
      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-2 gap-4">
          {filteredDiscounts.map(discount => (
            <div
              key={discount.id}
              className={`bg-white rounded-lg border p-4 ${!discount.isActive ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`p-2 rounded-lg ${
                    discount.type === 'percentage' ? 'bg-green-100' : 'bg-blue-100'
                  }`}>
                    {discount.type === 'percentage' ? (
                      <Percent className="w-5 h-5 text-green-600" />
                    ) : (
                      <DollarSign className="w-5 h-5 text-blue-600" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{discount.name}</h3>
                    <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{discount.code}</code>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-gray-900">
                    {discount.type === 'percentage' ? `${discount.value}%` : `KES ${discount.value}`}
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    discount.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {discount.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="text-sm text-gray-500">Eligibility: </span>
                    <span className="text-sm text-gray-700">{discount.eligibility.join(', ')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {discount.validFrom} to {discount.validTo}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Used: {discount.usedCount.toLocaleString()}
                    {discount.usageLimit && ` / ${discount.usageLimit}`}
                  </span>
                  {discount.usageLimit && discount.usedCount >= discount.usageLimit && (
                    <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded">Limit Reached</span>
                  )}
                </div>
              </div>

              {discount.requiresApproval && (
                <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg mb-3">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span className="text-sm text-orange-700">
                    Requires approval from {discount.approvalLevel}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-gray-500">
                  Applies to: {discount.applicableServices}
                </span>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleStatus(discount.id)}
                    className={`p-1.5 rounded ${
                      discount.isActive
                        ? 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                        : 'text-gray-500 hover:text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {discount.isActive ? (
                      <ToggleRight className="w-4 h-4" />
                    ) : (
                      <ToggleLeft className="w-4 h-4" />
                    )}
                  </button>
                  <button className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}