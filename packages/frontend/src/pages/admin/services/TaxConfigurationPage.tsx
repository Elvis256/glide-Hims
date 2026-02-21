import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  X,
  Receipt,
  AlertTriangle,
  Check,
  Percent,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import {
  getTaxRates, createTaxRate, updateTaxRate, deleteTaxRate,
  getTaxExemptions, createTaxExemption, updateTaxExemption, deleteTaxExemption,
} from '../../../services/pricing';

const TAX_TYPE_LABELS: Record<string, string> = {
  vat: 'VAT', service_tax: 'Service Tax', excise: 'Excise', custom: 'Custom',
};

export default function TaxConfigurationPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'rates' | 'exemptions'>('rates');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'rate' | 'exemption'>('rate');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [formError, setFormError] = useState('');

  // Rate form
  const [rateForm, setRateForm] = useState({
    name: '', code: '', rate: 0, type: 'vat', applicableServices: '', isActive: true, effectiveFrom: '',
  });
  // Exemption form
  const [exForm, setExForm] = useState({
    category: '', reason: '', applicableTaxes: '', isActive: true,
  });

  const { data: taxRates = [], isLoading: loadingRates } = useQuery({
    queryKey: ['tax-rates'], queryFn: getTaxRates, staleTime: 30000,
  });
  const { data: exemptions = [], isLoading: loadingExemptions } = useQuery({
    queryKey: ['tax-exemptions'], queryFn: getTaxExemptions, staleTime: 30000,
  });

  // Rate mutations
  const createRateMut = useMutation({
    mutationFn: createTaxRate,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-rates'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });
  const updateRateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => updateTaxRate(id, dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-rates'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });
  const deleteRateMut = useMutation({
    mutationFn: deleteTaxRate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-rates'] }),
  });

  // Exemption mutations
  const createExMut = useMutation({
    mutationFn: createTaxExemption,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-exemptions'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });
  const updateExMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: any }) => updateTaxExemption(id, dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tax-exemptions'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });
  const deleteExMut = useMutation({
    mutationFn: deleteTaxExemption,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tax-exemptions'] }),
  });

  const closeModal = () => { setShowModal(false); setEditingItem(null); setFormError(''); };

  const openAddRate = () => {
    setModalType('rate'); setEditingItem(null); setFormError('');
    setRateForm({ name: '', code: '', rate: 0, type: 'vat', applicableServices: '', isActive: true, effectiveFrom: '' });
    setShowModal(true);
  };
  const openEditRate = (tax: any) => {
    setModalType('rate'); setEditingItem(tax); setFormError('');
    setRateForm({
      name: tax.name, code: tax.code, rate: Number(tax.rate),
      type: tax.type || 'vat',
      applicableServices: (tax.applicableServices || []).join(', '),
      isActive: tax.isActive, effectiveFrom: tax.effectiveFrom || '',
    });
    setShowModal(true);
  };
  const openAddExemption = () => {
    setModalType('exemption'); setEditingItem(null); setFormError('');
    setExForm({ category: '', reason: '', applicableTaxes: '', isActive: true });
    setShowModal(true);
  };
  const openEditExemption = (ex: any) => {
    setModalType('exemption'); setEditingItem(ex); setFormError('');
    setExForm({
      category: ex.category, reason: ex.reason || '',
      applicableTaxes: (ex.applicableTaxes || []).join(', '), isActive: ex.isActive,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (modalType === 'rate') {
      const dto = {
        name: rateForm.name, code: rateForm.code, rate: rateForm.rate, type: rateForm.type,
        applicableServices: rateForm.applicableServices.split(',').map(s => s.trim()).filter(Boolean),
        isActive: rateForm.isActive,
        effectiveFrom: rateForm.effectiveFrom || undefined,
      };
      if (editingItem) updateRateMut.mutate({ id: editingItem.id, dto });
      else createRateMut.mutate(dto);
    } else {
      const dto = {
        category: exForm.category, reason: exForm.reason,
        applicableTaxes: exForm.applicableTaxes.split(',').map(s => s.trim()).filter(Boolean),
        isActive: exForm.isActive,
      };
      if (editingItem) updateExMut.mutate({ id: editingItem.id, dto });
      else createExMut.mutate(dto);
    }
  };

  const filteredRates = useMemo(() =>
    taxRates.filter((t: any) => t.name?.toLowerCase().includes(searchTerm.toLowerCase()) || t.code?.toLowerCase().includes(searchTerm.toLowerCase())),
    [taxRates, searchTerm]);

  const filteredExemptions = useMemo(() =>
    exemptions.filter((e: any) => e.category?.toLowerCase().includes(searchTerm.toLowerCase())),
    [exemptions, searchTerm]);

  const stats = useMemo(() => ({
    totalRates: taxRates.length,
    activeRates: taxRates.filter((t: any) => t.isActive).length,
    exemptionCount: exemptions.filter((e: any) => e.isActive).length,
  }), [taxRates, exemptions]);

  const isLoading = loadingRates || loadingExemptions;
  const isSaving = createRateMut.isPending || updateRateMut.isPending || createExMut.isPending || updateExMut.isPending;

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tax Configuration</h1>
            <p className="text-sm text-gray-500">Manage tax rates and exemptions</p>
          </div>
          <button onClick={activeTab === 'rates' ? openAddRate : openAddExemption}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4" />{activeTab === 'rates' ? 'Add Tax Rate' : 'Add Exemption'}
          </button>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Tax Rates', value: stats.totalRates, icon: <Receipt className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
            { label: 'Active Rates', value: stats.activeRates, icon: <Check className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
            { label: 'Active Exemptions', value: stats.exemptionCount, icon: <AlertTriangle className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 flex items-center gap-3`}>
              <div className="p-2 bg-white rounded-lg shadow-sm">{s.icon}</div>
              <div><div className="text-sm text-gray-500">{s.label}</div><div className="text-xl font-bold">{s.value}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-6">
          {[{ id: 'rates' as const, label: 'Tax Rates', icon: Percent }, { id: 'exemptions' as const, label: 'Exemptions', icon: AlertTriangle }].map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchTerm(''); }}
              className={`flex items-center gap-2 py-3 border-b-2 transition-colors text-sm ${
                activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <tab.icon className="w-4 h-4" />{tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white border-b px-6 py-3">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder={activeTab === 'rates' ? 'Search tax rates...' : 'Search exemptions...'}
            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : activeTab === 'rates' ? (
          filteredRates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Receipt className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No tax rates configured</h3>
              <p className="text-gray-500 text-sm mb-6">Add tax rates applicable to your facility's services.</p>
              <button onClick={openAddRate} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" />Add Tax Rate
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-lg border">
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Tax Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rate</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Applicable Services</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredRates.map((tax: any) => (
                    <tr key={tax.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded ${Number(tax.rate) === 0 ? 'bg-green-100' : 'bg-blue-100'}`}>
                            <Percent className={`w-4 h-4 ${Number(tax.rate) === 0 ? 'text-green-600' : 'text-blue-600'}`} />
                          </div>
                          <span className="font-medium text-gray-900">{tax.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><code className="text-sm bg-gray-100 px-2 py-1 rounded">{tax.code}</code></td>
                      <td className="px-4 py-3"><span className="inline-flex items-center px-2.5 py-1 bg-gray-100 rounded-full text-sm">{TAX_TYPE_LABELS[tax.type] || tax.type}</span></td>
                      <td className="px-4 py-3 text-right"><span className={`font-bold text-lg ${Number(tax.rate) === 0 ? 'text-green-600' : 'text-gray-900'}`}>{tax.rate}%</span></td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(tax.applicableServices || []).map((svc: string, i: number) => (
                            <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{svc}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${tax.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {tax.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditRate(tax)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => updateRateMut.mutate({ id: tax.id, dto: { isActive: !tax.isActive } })}
                            className={`p-1.5 rounded ${tax.isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}>
                            {tax.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                          <button onClick={() => { if (confirm('Delete this tax rate?')) deleteRateMut.mutate(tax.id); }}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredExemptions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">No exemptions configured</h3>
              <p className="text-gray-500 text-sm mb-6">Add tax exemptions for specific service categories.</p>
              <button onClick={openAddExemption} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" />Add Exemption
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {filteredExemptions.map((ex: any) => (
                <div key={ex.id} className={`bg-white rounded-lg border p-4 ${!ex.isActive ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-orange-100 rounded-lg"><AlertTriangle className="w-5 h-5 text-orange-600" /></div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{ex.category}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${ex.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {ex.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => openEditExemption(ex)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={() => updateExMut.mutate({ id: ex.id, dto: { isActive: !ex.isActive } })}
                        className={`p-1.5 rounded ${ex.isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}>
                        {ex.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { if (confirm('Delete this exemption?')) deleteExMut.mutate(ex.id); }}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{ex.reason}</p>
                  <div>
                    <span className="text-xs text-gray-500">Exempt from:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(ex.applicableTaxes || []).map((t: string, i: number) => (
                        <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">
                {editingItem ? 'Edit' : 'Add'} {modalType === 'rate' ? 'Tax Rate' : 'Tax Exemption'}
              </h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{formError}</div>}

              {modalType === 'rate' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax Name *</label>
                    <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      value={rateForm.name} onChange={e => setRateForm(f => ({ ...f, name: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                      <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        value={rateForm.code} onChange={e => setRateForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                      <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        value={rateForm.type} onChange={e => setRateForm(f => ({ ...f, type: e.target.value }))}>
                        <option value="vat">VAT</option>
                        <option value="service_tax">Service Tax</option>
                        <option value="excise">Excise</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Rate (%) *</label>
                      <input type="number" step="0.01" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        value={rateForm.rate || ''} onChange={e => setRateForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Effective From</label>
                      <input type="date" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                        value={rateForm.effectiveFrom} onChange={e => setRateForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Services (comma-separated)</label>
                    <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="Pharmacy, Medical Supplies, ..."
                      value={rateForm.applicableServices} onChange={e => setRateForm(f => ({ ...f, applicableServices: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={rateForm.isActive} onChange={e => setRateForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="e.g. Emergency Services" value={exForm.category} onChange={e => setExForm(f => ({ ...f, category: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <textarea rows={2} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      value={exForm.reason} onChange={e => setExForm(f => ({ ...f, reason: e.target.value }))} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Tax Codes (comma-separated)</label>
                    <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      placeholder="VAT18, SVC5, ..." value={exForm.applicableTaxes} onChange={e => setExForm(f => ({ ...f, applicableTaxes: e.target.value }))} />
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={exForm.isActive} onChange={e => setExForm(f => ({ ...f, isActive: e.target.checked }))}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm text-gray-700">Active</span>
                  </label>
                </>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={isSaving || (modalType === 'rate' ? !rateForm.name || !rateForm.code : !exForm.category)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm">
                {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingItem ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
