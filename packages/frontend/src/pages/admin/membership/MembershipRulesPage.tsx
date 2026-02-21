import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, getApiErrorMessage } from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';
import { CURRENCY_SYMBOL } from '../../../lib/currency';
import {
  Search,
  Edit2,
  Power,
  Download,
  Filter,
  Settings,
  ChevronRight,
  Loader2,
  X,
} from 'lucide-react';

interface MembershipScheme {
  id: string;
  code: string;
  name: string;
  type: string;
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
  discountPercent: number;
  creditLimit: number;
  requiresApproval: boolean;
  validDays: number;
  isActive: boolean;
}

const typeColors: Record<string, string> = {
  individual: 'bg-blue-100 text-blue-700',
  family: 'bg-green-100 text-green-700',
  corporate: 'bg-purple-100 text-purple-700',
  senior: 'bg-yellow-100 text-yellow-700',
};

const typeLabels: Record<string, string> = {
  individual: 'Individual',
  family: 'Family',
  corporate: 'Corporate',
  senior: 'Senior',
};

export default function MembershipRulesPage() {
  const facilityId = useFacilityId();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState('All');
  const [expandedScheme, setExpandedScheme] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingScheme, setEditingScheme] = useState<MembershipScheme | null>(null);
  const [formData, setFormData] = useState<SchemeFormData>({
    discountPercent: 0,
    creditLimit: 0,
    requiresApproval: false,
    validDays: 365,
    isActive: true,
  });

  const { data: schemes = [], isLoading } = useQuery({
    queryKey: ['membership-schemes', facilityId],
    queryFn: async () => {
      const response = await api.get('/membership/schemes');
      return response.data as MembershipScheme[];
    },
    staleTime: 60000,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SchemeFormData> }) =>
      api.patch(`/membership/schemes/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-schemes', facilityId] });
      toast.success('Scheme rules updated successfully');
      setIsModalOpen(false);
    },
    onError: (err) => toast.error(getApiErrorMessage(err, 'Failed to update scheme rules')),
  });

  const handleEditScheme = useCallback((scheme: MembershipScheme) => {
    setEditingScheme(scheme);
    setFormData({
      discountPercent: scheme.discountPercent,
      creditLimit: scheme.creditLimit,
      requiresApproval: scheme.requiresApproval,
      validDays: scheme.validDays,
      isActive: scheme.isActive,
    });
    setIsModalOpen(true);
  }, []);

  const handleSave = useCallback(() => {
    if (!editingScheme) return;
    updateMutation.mutate({ id: editingScheme.id, data: formData });
  }, [editingScheme, formData, updateMutation]);

  const toggleSchemeStatus = useCallback((scheme: MembershipScheme) => {
    updateMutation.mutate({ id: scheme.id, data: { isActive: !scheme.isActive } });
  }, [updateMutation]);

  const handleExport = useCallback(() => {
    const dataStr = JSON.stringify(schemes, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileName = `membership-rules-${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileName);
    linkElement.click();
  }, [schemes]);

  const filteredSchemes = useMemo(() => {
    return schemes.filter(scheme => {
      const matchesSearch = scheme.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        scheme.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType === 'All' || scheme.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [schemes, searchTerm, selectedType]);

  const schemeTypes = useMemo(() => {
    const types = new Set(schemes.map(s => s.type));
    return ['All', ...Array.from(types)];
  }, [schemes]);

  const stats = useMemo(() => ({
    total: schemes.length,
    active: schemes.filter(s => s.isActive).length,
    approvalRequired: schemes.filter(s => s.requiresApproval).length,
    avgDiscount: schemes.length > 0
      ? (schemes.reduce((sum, s) => sum + s.discountPercent, 0) / schemes.length).toFixed(1)
      : '0',
  }), [schemes]);

  if (isLoading) {
    return (
      <div className="h-[calc(100vh-120px)] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-500">Loading membership rules...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Membership Rules</h1>
            <p className="text-sm text-gray-500">Configure enrollment, renewal, and loyalty policies</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">Total Schemes:</span>
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            <span className="text-sm text-gray-500">Active:</span>
            <span className="font-semibold text-green-600">{stats.active}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Approval Required:</span>
            <span className="font-semibold">{stats.approvalRequired}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Avg Discount:</span>
            <span className="font-semibold">{stats.avgDiscount}%</span>
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
              placeholder="Search schemes by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-500" />
            {schemeTypes.map(type => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  selectedType === type
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'All' ? 'All' : (typeLabels[type] || type)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rules List */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <div className="space-y-4">
          {filteredSchemes.map(scheme => {
            const isExpanded = expandedScheme === scheme.id;

            return (
              <div key={scheme.id} className="bg-white rounded-lg border">
                <button
                  onClick={() => setExpandedScheme(isExpanded ? null : scheme.id)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`px-2.5 py-1 rounded-lg text-xs font-medium ${typeColors[scheme.type] || 'bg-gray-100 text-gray-700'}`}>
                      {(typeLabels[scheme.type] || scheme.type).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">{scheme.name}</h3>
                      <p className="text-xs text-gray-500">{scheme.code}{scheme.description ? ` — ${scheme.description}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      scheme.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {scheme.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Setting</th>
                          <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Value</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Description</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">Discount Percent</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-900">{scheme.discountPercent}<span className="text-gray-500 font-normal ml-1">%</span></span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">Discount applied to services for members of this scheme</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">Credit Limit</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-900">{CURRENCY_SYMBOL} {scheme.creditLimit.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">Maximum credit allowed for members under this scheme</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">Requires Approval</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              scheme.requiresApproval ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                            }`}>
                              {scheme.requiresApproval ? 'Yes' : 'No'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">Whether new enrollments require admin approval</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">Validity Period</td>
                          <td className="px-4 py-3 text-center">
                            <span className="font-semibold text-gray-900">{scheme.validDays}<span className="text-gray-500 font-normal ml-1">days</span></span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">Number of days a membership remains valid after enrollment</td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">Status</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              scheme.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {scheme.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">Whether this scheme is currently accepting new enrollments</td>
                        </tr>
                      </tbody>
                    </table>
                    <div className="flex items-center justify-end gap-2 px-4 py-3 bg-gray-50 border-t">
                      <button
                        onClick={() => toggleSchemeStatus(scheme)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm ${
                          scheme.isActive
                            ? 'text-red-600 hover:bg-red-50'
                            : 'text-green-600 hover:bg-green-50'
                        }`}
                      >
                        <Power className="w-4 h-4" />
                        {scheme.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                      <button
                        onClick={() => handleEditScheme(scheme)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded text-sm"
                      >
                        <Edit2 className="w-4 h-4" />
                        Edit Rules
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filteredSchemes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              {schemes.length === 0 ? 'No membership schemes found.' : 'No schemes match your search.'}
            </div>
          )}
        </div>
      </div>

      {/* Edit Rule Modal */}
      {isModalOpen && editingScheme && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                Edit Rules — {editingScheme.name}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Percent *</label>
                  <input
                    type="number"
                    value={formData.discountPercent}
                    onChange={(e) => setFormData(prev => ({ ...prev, discountPercent: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                    max={100}
                    step={0.1}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Credit Limit ({CURRENCY_SYMBOL}) *</label>
                  <input
                    type="number"
                    value={formData.creditLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, creditLimit: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={0}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Validity Period (days) *</label>
                  <input
                    type="number"
                    value={formData.validDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, validDays: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={1}
                  />
                </div>
                <div className="flex items-center pt-6 gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.requiresApproval}
                      onChange={(e) => setFormData(prev => ({ ...prev, requiresApproval: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">Requires Approval</span>
                  </label>
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMutation.isPending ? 'Saving...' : 'Update Rules'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}