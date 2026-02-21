import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  Package,
  Calendar,
  Tag,
  ChevronDown,
  ChevronUp,
  Check,
  ToggleLeft,
  ToggleRight,
  Percent,
  Users,
  Loader2,
  X,
  AlertCircle,
} from 'lucide-react';
import { servicesService, type ServicePackage as APIPackage, type CreateServicePackageDto } from '../../../services';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';

export default function ServicePackagesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingPkg, setEditingPkg] = useState<APIPackage | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    code: '', name: '', description: '', packagePrice: 0, validDays: 30,
    includedServiceIds: '' as string,
  });

  const { data: apiPackages = [], isLoading } = useQuery({
    queryKey: ['service-packages'],
    queryFn: () => servicesService.packages.list(),
    staleTime: 30000,
  });

  // Fetch services list for the service picker
  const { data: allServices = [] } = useQuery({
    queryKey: ['services-for-packages'],
    queryFn: () => servicesService.list({}),
    staleTime: 60000,
  });
  const servicesList = Array.isArray(allServices) ? allServices : (allServices as any)?.data || [];

  const createMut = useMutation({
    mutationFn: (dto: CreateServicePackageDto) => servicesService.packages.create(dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-packages'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateServicePackageDto> & { isActive?: boolean } }) =>
      servicesService.packages.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['service-packages'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => servicesService.packages.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['service-packages'] }),
  });

  const closeModal = () => { setShowModal(false); setEditingPkg(null); setFormError(''); };

  const resetForm = () => setForm({ code: '', name: '', description: '', packagePrice: 0, validDays: 30, includedServiceIds: '' });

  const openAdd = () => { resetForm(); setFormError(''); setShowModal(true); };

  const openEdit = (pkg: APIPackage) => {
    setEditingPkg(pkg);
    setForm({
      code: pkg.code, name: pkg.name, description: pkg.description || '',
      packagePrice: Number(pkg.packagePrice), validDays: pkg.validDays || 30,
      includedServiceIds: (pkg.includedServices || []).map(s => s.serviceId).join(', '),
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSave = () => {
    const serviceIds = form.includedServiceIds.split(',').map(s => s.trim()).filter(Boolean);
    const dto: CreateServicePackageDto = {
      code: form.code, name: form.name, description: form.description || undefined,
      packagePrice: form.packagePrice, validDays: form.validDays,
      includedServices: serviceIds.map(id => ({ serviceId: id, quantity: 1 })),
    };
    if (editingPkg) updateMut.mutate({ id: editingPkg.id, data: dto });
    else createMut.mutate(dto);
  };

  const filteredPackages = useMemo(() =>
    apiPackages.filter((p: APIPackage) => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code?.toLowerCase().includes(searchTerm.toLowerCase())),
    [apiPackages, searchTerm]);

  const stats = useMemo(() => ({
    total: apiPackages.length,
    active: apiPackages.filter((p: APIPackage) => p.isActive).length,
  }), [apiPackages]);

  const isSaving = createMut.isPending || updateMut.isPending;

  // Helper to resolve service names from IDs
  const getServiceName = (serviceId: string) => {
    const svc = servicesList.find((s: any) => s.id === serviceId);
    return svc ? svc.name : `Service ${serviceId.slice(0, 8)}…`;
  };
  const getServicePrice = (serviceId: string) => {
    const svc = servicesList.find((s: any) => s.id === serviceId);
    return svc ? Number(svc.basePrice || 0) : 0;
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Packages</h1>
            <p className="text-sm text-gray-500">Bundle services into attractive packages</p>
          </div>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4" />Create Package
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Total Packages', value: stats.total, icon: <Package className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
            { label: 'Active', value: stats.active, icon: <Check className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
            { label: 'Inactive', value: stats.total - stats.active, icon: <ToggleLeft className="w-5 h-5 text-gray-500" />, bg: 'bg-gray-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 flex items-center gap-3`}>
              <div className="p-2 bg-white rounded-lg shadow-sm">{s.icon}</div>
              <div><div className="text-sm text-gray-500">{s.label}</div><div className="text-xl font-bold">{s.value}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search packages..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : filteredPackages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No service packages yet</h3>
            <p className="text-gray-500 text-sm mb-6">Bundle multiple services into packages with discounted prices.</p>
            <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <Plus className="w-4 h-4" />Create First Package
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPackages.map((pkg: APIPackage) => {
              const services = pkg.includedServices || [];
              const totalOriginal = services.reduce((sum, s) => sum + getServicePrice(s.serviceId), 0);
              const pkgPrice = Number(pkg.packagePrice);
              const savings = totalOriginal - pkgPrice;
              const savingsPercent = totalOriginal > 0 ? Math.round((savings / totalOriginal) * 100) : 0;
              const isExpanded = expandedId === pkg.id;

              return (
                <div key={pkg.id} className={`bg-white rounded-lg border overflow-hidden ${!pkg.isActive ? 'opacity-60' : ''}`}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${pkg.isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          <Package className={`w-5 h-5 ${pkg.isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-gray-900">{pkg.name}</h3>
                            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pkg.code}</code>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pkg.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                              {pkg.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {pkg.description && <p className="text-sm text-gray-500 mt-1">{pkg.description}</p>}
                          <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                            <span className="flex items-center gap-1"><Tag className="w-3 h-3" />{services.length} services</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />Valid {pkg.validDays || 30} days</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">{formatCurrency(pkgPrice)}</div>
                        {totalOriginal > 0 && (
                          <>
                            <div className="text-sm text-gray-400 line-through">{formatCurrency(totalOriginal)}</div>
                            {savings > 0 && (
                              <div className="flex items-center gap-1 text-green-600 text-sm font-medium justify-end">
                                <Percent className="w-3 h-3" />Save {savingsPercent}%
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <button onClick={() => setExpandedId(isExpanded ? null : pkg.id)}
                        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        {services.length} services included
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEdit(pkg)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                        <button onClick={() => updateMut.mutate({ id: pkg.id, data: { isActive: !pkg.isActive } })}
                          className={`p-1.5 rounded ${pkg.isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}>
                          {pkg.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { if (confirm('Delete this package?')) deleteMut.mutate(pkg.id); }}
                          className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                  {isExpanded && services.length > 0 && (
                    <div className="border-t bg-gray-50 p-4">
                      <div className="grid grid-cols-2 gap-2">
                        {services.map((s, i) => (
                          <div key={i} className="flex items-center justify-between p-2 bg-white rounded border">
                            <span className="text-sm text-gray-700">{getServiceName(s.serviceId)}</span>
                            <span className="text-sm text-gray-500">{formatCurrency(getServicePrice(s.serviceId))}</span>
                          </div>
                        ))}
                      </div>
                      {totalOriginal > 0 && savings > 0 && (
                        <div className="flex justify-end mt-3 pt-3 border-t">
                          <div className="text-sm">
                            <span className="text-gray-500">Individual total: </span>
                            <span className="font-medium">{formatCurrency(totalOriginal)}</span>
                            <span className="text-green-600 ml-2">(Save {formatCurrency(savings)})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">{editingPkg ? 'Edit Package' : 'Create Service Package'}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{formError}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Code *</label>
                  <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    placeholder="e.g. HC-BASIC" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Name *</label>
                  <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    placeholder="e.g. Basic Health Checkup" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Package Price ({CURRENCY_SYMBOL}) *</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.packagePrice || ''} onChange={e => setForm(f => ({ ...f, packagePrice: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Days</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.validDays} onChange={e => setForm(f => ({ ...f, validDays: parseInt(e.target.value) || 30 }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Included Services</label>
                {servicesList.length > 0 ? (
                  <div className="border rounded-lg max-h-48 overflow-y-auto">
                    {servicesList.map((svc: any) => {
                      const selectedIds = form.includedServiceIds.split(',').map(s => s.trim()).filter(Boolean);
                      const isSelected = selectedIds.includes(svc.id);
                      return (
                        <label key={svc.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer border-b last:border-b-0">
                          <input type="checkbox" checked={isSelected} onChange={() => {
                            if (isSelected) {
                              setForm(f => ({ ...f, includedServiceIds: selectedIds.filter(id => id !== svc.id).join(', ') }));
                            } else {
                              setForm(f => ({ ...f, includedServiceIds: [...selectedIds, svc.id].join(', ') }));
                            }
                          }} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                          <span className="text-sm flex-1">{svc.name}</span>
                          <span className="text-sm text-gray-500">{formatCurrency(svc.basePrice || 0)}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No services available. Add services first.</p>
                )}
                {(() => {
                  const selectedIds = form.includedServiceIds.split(',').map(s => s.trim()).filter(Boolean);
                  const total = selectedIds.reduce((sum, id) => sum + getServicePrice(id), 0);
                  if (selectedIds.length > 0 && total > 0) {
                    const savings = total - form.packagePrice;
                    return (
                      <div className="mt-2 text-sm text-gray-600">
                        {selectedIds.length} services selected · Individual total: {formatCurrency(total)}
                        {savings > 0 && <span className="text-green-600 ml-1">(Save {formatCurrency(savings)})</span>}
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={isSaving || !form.code || !form.name || !form.packagePrice}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingPkg ? 'Update Package' : 'Create Package'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
