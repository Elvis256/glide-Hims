import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../../services/api';
import { useFacilityId } from '../../../lib/facility';
import {
  Building2,
  Search,
  Plus,
  Edit,
  Eye,
  X,
  Phone,
  Mail,
  FileText,
  CheckCircle,
  TrendingUp,
  DollarSign,
  Clock,
  BarChart3,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface InsuranceProvider {
  id: string;
  code: string;
  name: string;
  providerType: 'nhis' | 'private' | 'corporate' | 'government';
  contactPerson?: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
  claimSubmissionMethod?: string;
  averagePaymentDays?: number;
  notes?: string;
}

interface InsurancePriceList {
  id: string;
  insuranceProviderId: string;
  serviceId?: string;
  labTestId?: string;
  agreedPrice: number;
  discountPercent?: number;
  effectiveFrom?: string;
  effectiveTo?: string;
  isActive: boolean;
  notes?: string;
  service?: { name: string; code: string };
  labTest?: { name: string; testCode: string };
}

interface PerformanceData {
  totalClaims: number;
  approvalRate: number;
  avgProcessingDays: number;
  totalPaid: number;
}

interface ProviderFormData {
  code: string;
  name: string;
  type: 'nhis' | 'private' | 'corporate' | 'government';
  contactPerson?: string;
  email: string;
  phone: string;
  address: string;
  isActive: boolean;
  claimSubmissionMethod?: string;
  averagePaymentDays?: number;
  notes?: string;
}

export default function ProvidersPage() {
  const queryClient = useQueryClient();
  const facilityId = useFacilityId();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<InsuranceProvider | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [detailsTab, setDetailsTab] = useState<'info' | 'coverage' | 'metrics'>('info');
  const [showAddPriceModal, setShowAddPriceModal] = useState(false);
  const [priceForm, setPriceForm] = useState({ serviceId: '', agreedPrice: '', effectiveFrom: '', notes: '' });
  const [formData, setFormData] = useState<ProviderFormData>({
    code: '',
    name: '',
    type: 'private',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    isActive: true,
    claimSubmissionMethod: '',
    averagePaymentDays: undefined,
    notes: '',
  });

  // Fetch providers
  const { data: providersData, isLoading } = useQuery({
    queryKey: ['insurance-providers', facilityId, showActiveOnly],
    queryFn: async () => {
      const params: Record<string, string> = { facilityId };
      if (showActiveOnly) params.active = 'true';
      const res = await api.get('/insurance/providers', { params });
      return res.data;
    },
    enabled: !!facilityId,
  });

  const providers: InsuranceProvider[] = providersData?.data || providersData || [];

  // Fetch insurance price lists for selected provider
  const { data: priceLists = [] } = useQuery<InsurancePriceList[]>({
    queryKey: ['insurance-price-lists', selectedProvider?.id],
    queryFn: async () => {
      const res = await api.get('/pricing/insurance-price-lists', {
        params: { insuranceProviderId: selectedProvider!.id, isActive: true },
      });
      return res.data?.data || res.data || [];
    },
    enabled: !!selectedProvider && showDetailsModal && detailsTab === 'coverage',
  });

  // Fetch services for add-price dropdown
  const { data: servicesData } = useQuery({
    queryKey: ['services-list'],
    queryFn: async () => {
      const res = await api.get('/services');
      return res.data?.data || res.data || [];
    },
    enabled: showAddPriceModal,
  });
  const servicesList: { id: string; name: string; code: string }[] = servicesData || [];

  // Fetch performance data for selected provider
  const { data: performanceData } = useQuery<PerformanceData>({
    queryKey: ['provider-performance', selectedProvider?.id, facilityId],
    queryFn: async () => {
      const now = new Date();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
      const today = now.toISOString().split('T')[0];
      const res = await api.get('/insurance/reports/provider-performance', {
        params: { facilityId, startDate: yearStart, endDate: today },
      });
      const data = res.data?.data || res.data;
      // The endpoint may return an array; find matching provider or use first result
      if (Array.isArray(data)) {
        return data.find((d: any) => d.providerId === selectedProvider!.id) || data[0] || null;
      }
      return data || null;
    },
    enabled: !!selectedProvider && !!facilityId && showDetailsModal && detailsTab === 'metrics',
  });
  const perf: PerformanceData = performanceData || { totalClaims: 0, approvalRate: 0, avgProcessingDays: 0, totalPaid: 0 };

  // Create price list mutation
  const createPriceMutation = useMutation({
    mutationFn: async (data: { insuranceProviderId: string; serviceId?: string; agreedPrice: number; effectiveFrom?: string; notes?: string }) => {
      const payload: Record<string, any> = { insuranceProviderId: data.insuranceProviderId, agreedPrice: data.agreedPrice };
      if (data.serviceId) payload.serviceId = data.serviceId;
      if (data.effectiveFrom) payload.effectiveFrom = data.effectiveFrom;
      if (data.notes) payload.notes = data.notes;
      const res = await api.post('/pricing/insurance-price-lists', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-price-lists', selectedProvider?.id] });
      setShowAddPriceModal(false);
      setPriceForm({ serviceId: '', agreedPrice: '', effectiveFrom: '', notes: '' });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: ProviderFormData) => {
      const payload = {
        facilityId,
        name: data.name,
        code: data.code,
        providerType: data.type,
        contactPerson: data.contactPerson || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        claimSubmissionMethod: data.claimSubmissionMethod || undefined,
        paymentTermsDays: data.averagePaymentDays || undefined,
      };
      const res = await api.post('/insurance/providers', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-providers'] });
      setShowEditModal(false);
      setSelectedProvider(null);
      resetForm();
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ProviderFormData }) => {
      const payload = {
        name: data.name,
        code: data.code,
        providerType: data.type,
        contactPerson: data.contactPerson || undefined,
        email: data.email || undefined,
        phone: data.phone || undefined,
        address: data.address || undefined,
        claimSubmissionMethod: data.claimSubmissionMethod || undefined,
        paymentTermsDays: data.averagePaymentDays || undefined,
      };
      const res = await api.patch(`/insurance/providers/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insurance-providers'] });
      setShowEditModal(false);
      setSelectedProvider(null);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      code: '',
      name: '',
      type: 'private',
      contactPerson: '',
      email: '',
      phone: '',
      address: '',
      isActive: true,
      claimSubmissionMethod: '',
      averagePaymentDays: undefined,
      notes: '',
    });
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const stats = useMemo(() => ({
    total: providers.length,
    active: providers.filter(p => p.isActive).length,
  }), [providers]);

  const filteredProviders = useMemo(() => {
    return providers.filter(provider => {
      const matchesSearch = provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesActive = !showActiveOnly || provider.isActive;
      return matchesSearch && matchesActive;
    });
  }, [providers, searchTerm, showActiveOnly]);

  const handleViewDetails = (provider: InsuranceProvider) => {
    setSelectedProvider(provider);
    setDetailsTab('info');
    setShowDetailsModal(true);
  };

  const handleEdit = (provider: InsuranceProvider) => {
    setSelectedProvider(provider);
    setFormData({
      code: provider.code,
      name: provider.name,
      type: provider.providerType || 'private',
      contactPerson: provider.contactPerson || '',
      email: provider.email,
      phone: provider.phone,
      address: provider.address,
      isActive: provider.isActive,
      claimSubmissionMethod: provider.claimSubmissionMethod || '',
      averagePaymentDays: provider.averagePaymentDays,
      notes: provider.notes || '',
    });
    setShowEditModal(true);
  };

  const handleAddNew = () => {
    setSelectedProvider(null);
    resetForm();
    setShowEditModal(true);
  };

  const handleSave = () => {
    if (selectedProvider) {
      updateMutation.mutate({ id: selectedProvider.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleCloseEditModal = () => {
    setShowEditModal(false);
    setSelectedProvider(null);
    resetForm();
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Insurance Providers</h1>
            <p className="text-gray-500 text-sm">Manage provider contracts and coverage</p>
          </div>
        </div>
        <button onClick={handleAddNew} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-3 mb-4 flex-shrink-0">
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Total Providers</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Building2 className="w-8 h-8 text-gray-200" />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Active</p>
              <p className="text-xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="card p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Inactive</p>
              <p className="text-xl font-bold text-yellow-600">{stats.total - stats.active}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-200" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 mb-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or code..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-9 py-2 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showActiveOnly}
              onChange={(e) => setShowActiveOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Active providers only</span>
          </label>
        </div>
      </div>

      {/* Providers Grid */}
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProviders.map(provider => (
            <div key={provider.id} className={`card p-4 ${!provider.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                    <Building2 className={`w-5 h-5 ${provider.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{provider.name}</h3>
                    <p className="text-xs text-gray-500 font-mono">{provider.code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {provider.isActive ? (
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  ) : (
                    <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                  )}
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="truncate">{provider.email}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{provider.phone}</span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3 py-2 border-y">
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500">Type</p>
                  <p className="font-semibold text-xs">{provider.providerType?.toUpperCase() || 'N/A'}</p>
                </div>
                <div className="text-center flex-1 border-x">
                  <p className="text-xs text-gray-500">Payment Terms</p>
                  <p className="font-semibold">{provider.averagePaymentDays || '—'} {provider.averagePaymentDays ? 'days' : ''}</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-xs text-gray-500">Status</p>
                  <p className={`font-semibold ${provider.isActive ? 'text-green-600' : 'text-gray-400'}`}>{provider.isActive ? 'Active' : 'Inactive'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-gray-500">Type</p>
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {provider.providerType?.toUpperCase() || 'N/A'}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Contact</p>
                  <p className="text-sm font-medium">{provider.contactPerson || 'N/A'}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewDetails(provider)}
                  className="flex-1 btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                >
                  <Eye className="w-4 h-4" />
                  View
                </button>
                <button
                  onClick={() => handleEdit(provider)}
                  className="flex-1 btn-secondary text-sm py-1.5 flex items-center justify-center gap-1"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="col-span-full card p-12 text-center">
              <Loader2 className="w-8 h-8 text-blue-500 mx-auto mb-4 animate-spin" />
              <p className="text-gray-500">Loading providers...</p>
            </div>
          )}

          {!isLoading && filteredProviders.length === 0 && (
            <div className="col-span-full card p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No providers yet</h3>
              <p className="text-gray-500 mb-4">Get started by adding your first insurance provider.</p>
              <button onClick={handleAddNew} className="btn-primary inline-flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add Provider
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Details Modal */}
      {showDetailsModal && selectedProvider && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-lg">{selectedProvider.name}</h2>
                  <p className="text-sm text-gray-500">{selectedProvider.code}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailsModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b flex-shrink-0">
              {[
                { key: 'info', label: 'Information', icon: Building2 },
                { key: 'coverage', label: 'Insurance Prices', icon: DollarSign },
                { key: 'metrics', label: 'Performance', icon: BarChart3 },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setDetailsTab(tab.key as typeof detailsTab)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-[1px] ${
                    detailsTab === tab.key
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {detailsTab === 'info' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Email</p>
                      <p className="font-medium">{selectedProvider.email}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Phone</p>
                      <p className="font-medium">{selectedProvider.phone}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-gray-500 mb-1">Address</p>
                      <p className="font-medium">{selectedProvider.address}</p>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Provider Details
                    </h3>
                    <div className="grid grid-cols-2 gap-4 bg-gray-50 rounded-lg p-4">
                      <div>
                        <p className="text-xs text-gray-500">Provider Type</p>
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                          {selectedProvider.providerType?.toUpperCase() || 'N/A'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${selectedProvider.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {selectedProvider.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Claim Submission Method</p>
                        <p className="font-medium">{selectedProvider.claimSubmissionMethod || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Payment Terms</p>
                        <p className="font-medium">{selectedProvider.averagePaymentDays ? `${selectedProvider.averagePaymentDays} days` : 'N/A'}</p>
                      </div>
                      {selectedProvider.contactPerson && (
                        <div>
                          <p className="text-xs text-gray-500">Contact Person</p>
                          <p className="font-medium">{selectedProvider.contactPerson}</p>
                        </div>
                      )}
                      {selectedProvider.notes && (
                        <div className="col-span-2">
                          <p className="text-xs text-gray-500">Notes</p>
                          <p className="font-medium">{selectedProvider.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {detailsTab === 'coverage' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-medium">Insurance Price Lists</h3>
                    <button onClick={() => setShowAddPriceModal(true)} className="btn-secondary text-sm py-1">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Price
                    </button>
                  </div>
                  {priceLists.length > 0 ? (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-600">Service / Test</th>
                          <th className="text-left p-3 font-medium text-gray-600">Code</th>
                          <th className="text-right p-3 font-medium text-gray-600">Agreed Price</th>
                          <th className="text-right p-3 font-medium text-gray-600">Discount %</th>
                          <th className="text-left p-3 font-medium text-gray-600">Effective From</th>
                          <th className="text-center p-3 font-medium text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {priceLists.map(pl => (
                          <tr key={pl.id} className="hover:bg-gray-50">
                            <td className="p-3 font-medium">{pl.service?.name || pl.labTest?.name || '—'}</td>
                            <td className="p-3 font-mono text-blue-600">{pl.service?.code || pl.labTest?.testCode || '—'}</td>
                            <td className="p-3 text-right font-medium">UGX {pl.agreedPrice?.toLocaleString()}</td>
                            <td className="p-3 text-right">{pl.discountPercent != null ? `${pl.discountPercent}%` : '—'}</td>
                            <td className="p-3">{pl.effectiveFrom ? new Date(pl.effectiveFrom).toLocaleDateString() : '—'}</td>
                            <td className="p-3 text-center">
                              {pl.isActive ? (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">Active</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">Inactive</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="text-center py-8 text-gray-500">No insurance prices defined</div>
                  )}

                  {/* Add Price Modal */}
                  {showAddPriceModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
                      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
                        <div className="flex items-center justify-between p-4 border-b">
                          <h2 className="font-semibold text-lg">Add Insurance Price</h2>
                          <button onClick={() => setShowAddPriceModal(false)} className="p-1 hover:bg-gray-100 rounded">
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                        <form onSubmit={(e) => {
                          e.preventDefault();
                          if (!selectedProvider) return;
                          createPriceMutation.mutate({
                            insuranceProviderId: selectedProvider.id,
                            serviceId: priceForm.serviceId || undefined,
                            agreedPrice: Number(priceForm.agreedPrice),
                            effectiveFrom: priceForm.effectiveFrom || undefined,
                            notes: priceForm.notes || undefined,
                          });
                        }} className="p-4 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
                            <select
                              value={priceForm.serviceId}
                              onChange={e => setPriceForm(f => ({ ...f, serviceId: e.target.value }))}
                              className="input w-full"
                            >
                              <option value="">Select a service</option>
                              {servicesList.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Agreed Price (UGX) *</label>
                            <input
                              type="number"
                              required
                              min="0"
                              step="0.01"
                              value={priceForm.agreedPrice}
                              onChange={e => setPriceForm(f => ({ ...f, agreedPrice: e.target.value }))}
                              className="input w-full"
                              placeholder="0.00"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                            <input
                              type="date"
                              value={priceForm.effectiveFrom}
                              onChange={e => setPriceForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                              className="input w-full"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                            <textarea
                              value={priceForm.notes}
                              onChange={e => setPriceForm(f => ({ ...f, notes: e.target.value }))}
                              className="input w-full"
                              rows={2}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-2">
                            <button type="button" onClick={() => setShowAddPriceModal(false)} className="btn-secondary">Cancel</button>
                            <button type="submit" disabled={createPriceMutation.isPending || !priceForm.agreedPrice} className="btn-primary flex items-center gap-2">
                              {createPriceMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                              Save
                            </button>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}
                </div>
              )}


              {detailsTab === 'metrics' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <span className="text-sm text-gray-600">Total Claims</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">{perf.totalClaims}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        <span className="text-sm text-gray-600">Approval Rate</span>
                      </div>
                      <p className="text-2xl font-bold text-green-600">{perf.approvalRate}%</p>
                    </div>
                    <div className="bg-yellow-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <span className="text-sm text-gray-600">Avg Processing</span>
                      </div>
                      <p className="text-2xl font-bold text-yellow-600">{perf.avgProcessingDays} days</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-purple-600" />
                        <span className="text-sm text-gray-600">Total Paid</span>
                      </div>
                      <p className="text-xl font-bold text-purple-600">UGX {((perf.totalPaid || 0) / 1000000).toFixed(1)}M</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-medium mb-3">Performance Summary</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Claims Approval Rate</span>
                          <span className="font-medium">{perf.approvalRate || 0}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-green-500 rounded-full"
                            style={{ width: `${perf.approvalRate || 0}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span>Processing Efficiency</span>
                          <span className="font-medium">{Math.max(0, 100 - (perf.avgProcessingDays || 0) * 10)}%</span>
                        </div>
                        <div className="h-2 bg-gray-200 rounded-full">
                          <div
                            className="h-2 bg-blue-500 rounded-full"
                            style={{ width: `${Math.max(0, 100 - (perf.avgProcessingDays || 0) * 10)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 p-4 border-t flex-shrink-0">
              <button onClick={() => setShowDetailsModal(false)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold text-lg">
                {selectedProvider ? 'Edit Provider' : 'Add New Provider'}
              </h2>
              <button onClick={handleCloseEditModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter name..."
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Provider Code *</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    placeholder="e.g., AAR"
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as 'nhis' | 'private' | 'corporate' | 'government' })}
                  className="input"
                >
                  <option value="private">Private</option>
                  <option value="nhis">NHIS</option>
                  <option value="corporate">Corporate</option>
                  <option value="government">Government</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input
                  type="text"
                  value={formData.contactPerson}
                  onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                  placeholder="Contact person name"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="claims@provider.com"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+256 700 000 000"
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Enter address..."
                  className="input h-20 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Claim Submission Method</label>
                  <select
                    value={formData.claimSubmissionMethod}
                    onChange={(e) => setFormData({ ...formData, claimSubmissionMethod: e.target.value })}
                    className="input"
                  >
                    <option value="">Select...</option>
                    <option value="electronic">Electronic</option>
                    <option value="portal">Portal</option>
                    <option value="manual">Manual</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Avg Payment Days</label>
                  <input
                    type="number"
                    value={formData.averagePaymentDays || ''}
                    onChange={(e) => setFormData({ ...formData, averagePaymentDays: e.target.value ? Number(e.target.value) : undefined })}
                    placeholder="e.g., 30"
                    className="input"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                  className="input h-20 resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm text-gray-700">Active provider</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-4 border-t">
              <button onClick={handleCloseEditModal} className="btn-secondary" disabled={isSaving}>
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.name || !formData.code || !formData.email || !formData.phone}
                className="btn-primary flex items-center gap-2"
              >
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {selectedProvider ? 'Save Changes' : 'Add Provider'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
