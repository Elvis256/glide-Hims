import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import { api, getApiErrorMessage } from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';
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

type SchemeType = 'REGULAR' | 'VIP' | 'STAFF' | 'CORPORATE' | 'INSURANCE' | 'CHARITY';

interface MembershipScheme {
  id: string;
  code: string;
  name: string;
  type: SchemeType;
  description?: string;
  discountPercent: number;
  creditLimit: number;
  requiresApproval: boolean;
  validDays: number;
  isActive: boolean;
  benefits?: Record<string, unknown>[];
  facilityId?: string;
  createdAt: string;
}

interface SchemeFormData {
  code: string;
  name: string;
  type: SchemeType;
  description: string;
  discountPercent: number;
  creditLimit: number;
  requiresApproval: boolean;
  validDays: number;
  isActive: boolean;
}

const statusColors = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-red-100 text-red-700',
};

const typeColors: Record<SchemeType, string> = {
  REGULAR: 'bg-gray-100 text-gray-700',
  VIP: 'bg-purple-100 text-purple-700',
  STAFF: 'bg-blue-100 text-blue-700',
  CORPORATE: 'bg-indigo-100 text-indigo-700',
  INSURANCE: 'bg-teal-100 text-teal-700',
  CHARITY: 'bg-pink-100 text-pink-700',
};

const statuses = ['All', 'active', 'inactive'];

const emptyForm: SchemeFormData = {
  code: '',
  name: '',
  type: 'CORPORATE',
  description: '',
  discountPercent: 0,
  creditLimit: 0,
  requiresApproval: false,
  validDays: 365,
  isActive: true,
};

export default function CorporatePlansPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [showModal, setShowModal] = useState(false);
  const [editingScheme, setEditingScheme] = useState<MembershipScheme | null>(null);
  const [viewingScheme, setViewingScheme] = useState<MembershipScheme | null>(null);
  const [formData, setFormData] = useState<SchemeFormData>(emptyForm);

  const { data: schemes = [], isLoading: loading } = useQuery({
    queryKey: ['membership-schemes'],
    queryFn: async () => {
      const response = await api.get('/membership/schemes');
      return response.data as MembershipScheme[];
    },
    staleTime: 60000,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<SchemeFormData> & { facilityId?: string }) =>
      api.post('/membership/schemes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-schemes'] });
      toast.success('Scheme created successfully');
      setShowModal(false);
      setFormData(emptyForm);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to create scheme')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SchemeFormData> }) =>
      api.patch(`/membership/schemes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-schemes'] });
      toast.success('Scheme updated successfully');
      setShowModal(false);
      setEditingScheme(null);
      setFormData(emptyForm);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update scheme')),
  });

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const handleAddPlan = () => {
    setEditingScheme(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const handleEditPlan = (scheme: MembershipScheme) => {
    setEditingScheme(scheme);
    setFormData({
      code: scheme.code,
      name: scheme.name,
      type: scheme.type,
      description: scheme.description || '',
      discountPercent: scheme.discountPercent,
      creditLimit: scheme.creditLimit,
      requiresApproval: scheme.requiresApproval,
      validDays: scheme.validDays,
      isActive: scheme.isActive,
    });
    setShowModal(true);
  };

  const handleViewPlan = (scheme: MembershipScheme) => {
    setViewingScheme(scheme);
  };

  const handleSavePlan = () => {
    if (!formData.code || !formData.name) {
      toast.error('Please fill in required fields (code and name)');
      return;
    }

    if (editingScheme) {
      updateMutation.mutate({
        id: editingScheme.id,
        data: {
          name: formData.name,
          type: formData.type,
          description: formData.description || undefined,
          discountPercent: formData.discountPercent,
          creditLimit: formData.creditLimit,
          requiresApproval: formData.requiresApproval,
          validDays: formData.validDays,
          isActive: formData.isActive,
        },
      });
    } else {
      createMutation.mutate({
        code: formData.code,
        name: formData.name,
        type: formData.type,
        description: formData.description || undefined,
        discountPercent: formData.discountPercent,
        creditLimit: formData.creditLimit,
        requiresApproval: formData.requiresApproval,
        validDays: formData.validDays,
        isActive: formData.isActive,
        facilityId,
      });
    }
  };

  const handleExport = () => {
    const csv = [
      ['Code', 'Name', 'Type', 'Discount %', 'Credit Limit', 'Valid Days', 'Requires Approval', 'Active'].join(','),
      ...schemes.map(s => [s.code, s.name, s.type, s.discountPercent, s.creditLimit, s.validDays, s.requiresApproval, s.isActive].join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'corporate_schemes.csv';
    a.click();
  };

  const filteredPlans = useMemo(() => {
    return schemes.filter(scheme => {
      const matchesSearch = scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scheme.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = selectedStatus === 'All' ||
        (selectedStatus === 'active' ? scheme.isActive : !scheme.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [schemes, searchTerm, selectedStatus]);

  const stats = useMemo(() => ({
    totalSchemes: schemes.length,
    activeSchemes: schemes.filter(s => s.isActive).length,
    corporateSchemes: schemes.filter(s => s.type === 'CORPORATE').length,
    avgDiscount: schemes.length > 0
      ? Math.round(schemes.reduce((sum, s) => sum + s.discountPercent, 0) / schemes.length)
      : 0,
  }), [schemes]);

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
              New Scheme
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Schemes:</span>
            <span className="font-semibold">{stats.totalSchemes}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.activeSchemes}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-500">Corporate:</span>
            <span className="font-semibold text-blue-600">{stats.corporateSchemes}</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-500">Avg Discount:</span>
            <span className="font-semibold text-green-600">{stats.avgDiscount}%</span>
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Scheme</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Discount %</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Credit Limit</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Valid Days</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Approval</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredPlans.map(scheme => (
                  <tr key={scheme.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{scheme.name}</p>
                          <code className="text-xs text-gray-500">{scheme.code}</code>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${typeColors[scheme.type]}`}>
                        {scheme.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-gray-900">{scheme.discountPercent}%</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-gray-900">{formatCurrency(scheme.creditLimit)}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1 text-sm">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span className="font-medium">{scheme.validDays}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${scheme.requiresApproval ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                        {scheme.requiresApproval ? 'Required' : 'No'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${scheme.isActive ? statusColors.active : statusColors.inactive}`}>
                        {scheme.isActive ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={() => handleViewPlan(scheme)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditPlan(scheme)}
                          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}
      </div>

      {/* View Modal */}
      {viewingScheme && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Scheme Details</h2>
              <button onClick={() => setViewingScheme(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div><span className="text-gray-500">Code:</span> <span className="font-medium">{viewingScheme.code}</span></div>
              <div><span className="text-gray-500">Name:</span> <span className="font-medium">{viewingScheme.name}</span></div>
              <div><span className="text-gray-500">Type:</span> <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${typeColors[viewingScheme.type]}`}>{viewingScheme.type}</span></div>
              {viewingScheme.description && <div><span className="text-gray-500">Description:</span> <span className="font-medium">{viewingScheme.description}</span></div>}
              <div><span className="text-gray-500">Discount:</span> <span className="font-medium">{viewingScheme.discountPercent}%</span></div>
              <div><span className="text-gray-500">Credit Limit:</span> <span className="font-medium">{formatCurrency(viewingScheme.creditLimit)}</span></div>
              <div><span className="text-gray-500">Valid Days:</span> <span className="font-medium">{viewingScheme.validDays}</span></div>
              <div><span className="text-gray-500">Requires Approval:</span> <span className="font-medium">{viewingScheme.requiresApproval ? 'Yes' : 'No'}</span></div>
              <div><span className="text-gray-500">Status:</span> <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${viewingScheme.isActive ? statusColors.active : statusColors.inactive}`}>{viewingScheme.isActive ? 'active' : 'inactive'}</span></div>
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setViewingScheme(null)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">{editingScheme ? 'Edit Scheme' : 'New Scheme'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                  disabled={!!editingScheme}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as SchemeType }))}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="CORPORATE">Corporate</option>
                  <option value="REGULAR">Regular</option>
                  <option value="VIP">VIP</option>
                  <option value="STAFF">Staff</option>
                  <option value="INSURANCE">Insurance</option>
                  <option value="CHARITY">Charity</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={formData.discountPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit ({CURRENCY_SYMBOL})</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={formData.creditLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Days</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.validDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, validDays: parseInt(e.target.value) || 365 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresApproval}
                      onChange={(e) => setFormData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">Requires Approval</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">Cancel</button>
              <button
                onClick={handleSavePlan}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingScheme ? 'Save Changes' : 'Create Scheme'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
