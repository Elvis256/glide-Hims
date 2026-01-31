import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Loader2,
  X,
} from 'lucide-react';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

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

const defaultDiscounts: DiscountScheme[] = [
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

const STORAGE_KEY = 'services_discount_schemes';

// localStorage service functions
const discountService = {
  getAll: (): DiscountScheme[] => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultDiscounts));
    return defaultDiscounts;
  },
  create: async (data: Omit<DiscountScheme, 'id'>): Promise<DiscountScheme> => {
    const discounts = discountService.getAll();
    const newDiscount: DiscountScheme = {
      ...data,
      id: Date.now().toString(),
    };
    discounts.push(newDiscount);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(discounts));
    return newDiscount;
  },
  update: async (id: string, data: Partial<DiscountScheme>): Promise<DiscountScheme> => {
    const discounts = discountService.getAll();
    const index = discounts.findIndex((d) => d.id === id);
    if (index === -1) throw new Error('Discount scheme not found');
    discounts[index] = { ...discounts[index], ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(discounts));
    return discounts[index];
  },
  delete: async (id: string): Promise<void> => {
    const discounts = discountService.getAll();
    const filtered = discounts.filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },
};

export default function DiscountSchemesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [showApprovalOnly, setShowApprovalOnly] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountScheme | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    eligibility: [] as string[],
    applicableServices: '',
    requiresApproval: false,
    approvalLevel: null as string | null,
    usageLimit: null as number | null,
    usedCount: 0,
    validFrom: '',
    validTo: '',
    isActive: true,
  });
  const [eligibilityInput, setEligibilityInput] = useState('');

  // Query for discounts
  const { data: discounts = [], isLoading } = useQuery({
    queryKey: ['discount-schemes'],
    queryFn: discountService.getAll,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: discountService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-schemes'] });
      handleCloseModal();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<DiscountScheme> }) =>
      discountService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-schemes'] });
      handleCloseModal();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: discountService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discount-schemes'] });
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      type: 'percentage',
      value: 0,
      eligibility: [],
      applicableServices: '',
      requiresApproval: false,
      approvalLevel: null,
      usageLimit: null,
      usedCount: 0,
      validFrom: '',
      validTo: '',
      isActive: true,
    });
    setEligibilityInput('');
  };

  const handleAdd = () => {
    createMutation.mutate({
      ...formData,
    });
  };

  const handleEdit = (discount: DiscountScheme) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      code: discount.code,
      type: discount.type,
      value: discount.value,
      eligibility: discount.eligibility,
      applicableServices: discount.applicableServices,
      requiresApproval: discount.requiresApproval,
      approvalLevel: discount.approvalLevel,
      usageLimit: discount.usageLimit,
      usedCount: discount.usedCount,
      validFrom: discount.validFrom,
      validTo: discount.validTo,
      isActive: discount.isActive,
    });
    setShowAddModal(true);
  };

  const handleUpdate = () => {
    if (!editingDiscount) return;
    updateMutation.mutate({
      id: editingDiscount.id,
      data: formData,
    });
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this discount scheme?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingDiscount(null);
    resetForm();
  };

  const toggleStatus = (id: string) => {
    const discount = discounts.find((d) => d.id === id);
    if (discount) {
      updateMutation.mutate({
        id,
        data: { isActive: !discount.isActive },
      });
    }
  };

  const addEligibility = () => {
    if (eligibilityInput.trim() && !formData.eligibility.includes(eligibilityInput.trim())) {
      setFormData({
        ...formData,
        eligibility: [...formData.eligibility, eligibilityInput.trim()],
      });
      setEligibilityInput('');
    }
  };

  const removeEligibility = (item: string) => {
    setFormData({
      ...formData,
      eligibility: formData.eligibility.filter((e) => e !== item),
    });
  };

  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        d.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === 'all' || d.type === filterType;
      const matchesApproval = !showApprovalOnly || d.requiresApproval;
      return matchesSearch && matchesType && matchesApproval;
    });
  }, [discounts, searchTerm, filterType, showApprovalOnly]);

  const stats = useMemo(() => ({
    total: discounts.length,
    active: discounts.filter(d => d.isActive).length,
    requireApproval: discounts.filter(d => d.requiresApproval).length,
    totalUsage: discounts.reduce((sum, d) => sum + d.usedCount, 0),
  }), [discounts]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount Schemes</h1>
            <p className="text-sm text-gray-500">Manage discount rules and eligibility criteria</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
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
                    {discount.type === 'percentage' ? `${discount.value}%` : formatCurrency(discount.value)}
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
                  <button
                    onClick={() => handleEdit(discount)}
                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                  >
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
                  <button
                    onClick={() => handleDelete(discount.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingDiscount ? 'Edit Discount Scheme' : 'Create New Discount Scheme'}
              </h2>
              <button onClick={handleCloseModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheme Name</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., Senior Citizen Discount"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Code</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g., SENIOR15"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'percentage' | 'fixed' })}
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount ({CURRENCY_SYMBOL})</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value {formData.type === 'percentage' ? '(%)' : `(${CURRENCY_SYMBOL})`}
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={formData.type === 'percentage' ? '15' : '500'}
                    value={formData.value || ''}
                    onChange={(e) => setFormData({ ...formData, value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eligibility Groups</label>
                <div className="flex gap-2 mb-2">
                  <input
                    type="text"
                    className="flex-1 border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Add eligibility group (e.g., Senior Citizens)"
                    value={eligibilityInput}
                    onChange={(e) => setEligibilityInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEligibility())}
                  />
                  <button
                    type="button"
                    onClick={addEligibility}
                    className="px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {formData.eligibility.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.eligibility.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                      >
                        {item}
                        <button
                          type="button"
                          onClick={() => removeEligibility(item)}
                          className="hover:bg-blue-200 rounded-full p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Services</label>
                <input
                  type="text"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., All Services, Consultation, Lab"
                  value={formData.applicableServices}
                  onChange={(e) => setFormData({ ...formData, applicableServices: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid To</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    value={formData.validTo}
                    onChange={(e) => setFormData({ ...formData, validTo: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.requiresApproval}
                    onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Requires Approval</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>

              {formData.requiresApproval && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Approval Level</label>
                  <select
                    className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={formData.approvalLevel || ''}
                    onChange={(e) => setFormData({ ...formData, approvalLevel: e.target.value || null })}
                  >
                    <option value="">Select Approval Level</option>
                    <option value="Duty Manager">Duty Manager</option>
                    <option value="Finance Manager">Finance Manager</option>
                    <option value="Administrator">Administrator</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit (Optional)</label>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave empty for unlimited"
                  value={formData.usageLimit || ''}
                  onChange={(e) => setFormData({ ...formData, usageLimit: e.target.value ? parseInt(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={editingDiscount ? handleUpdate : handleAdd}
                disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.code}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {editingDiscount ? 'Update Scheme' : 'Create Scheme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}