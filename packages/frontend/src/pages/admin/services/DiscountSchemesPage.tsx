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
import {
  getPricingRules, createPricingRule, updatePricingRule, deletePricingRule,
  type PricingRule, type CreatePricingRuleDto,
} from '../../../services/pricing';

const RULE_TYPE_LABELS: Record<string, string> = {
  insurance: 'Insurance', membership: 'Membership', loyalty: 'Loyalty',
  corporate: 'Corporate', promotion: 'Promotion', volume: 'Volume',
};

const APPLIES_TO_LABELS: Record<string, string> = {
  all: 'All Services', services: 'Services', lab: 'Laboratory', pharmacy: 'Pharmacy', radiology: 'Radiology',
};

export default function DiscountSchemesPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'percentage' | 'fixed'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState({
    name: '', description: '',
    ruleType: 'promotion' as string,
    discountType: 'percentage' as string,
    discountValue: 0, priority: 100,
    minAmount: 0, maxDiscount: 0,
    canStack: false, appliesTo: 'all' as string,
    validFrom: '', validTo: '', isActive: true,
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['pricing-rules'],
    queryFn: getPricingRules,
    staleTime: 30000,
  });

  const createMut = useMutation({
    mutationFn: (dto: CreatePricingRuleDto) => createPricingRule(dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pricing-rules'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: Partial<CreatePricingRuleDto> }) => updatePricingRule(id, dto),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pricing-rules'] }); closeModal(); },
    onError: (e: Error) => setFormError(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deletePricingRule,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pricing-rules'] }),
  });

  const closeModal = () => { setShowModal(false); setEditingRule(null); setFormError(''); resetForm(); };

  const resetForm = () => setForm({
    name: '', description: '', ruleType: 'promotion', discountType: 'percentage',
    discountValue: 0, priority: 100, minAmount: 0, maxDiscount: 0,
    canStack: false, appliesTo: 'all', validFrom: '', validTo: '', isActive: true,
  });

  const openEdit = (rule: PricingRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name, description: rule.description || '',
      ruleType: rule.ruleType, discountType: rule.discountType,
      discountValue: rule.discountValue || 0, priority: rule.priority || 100,
      minAmount: 0, maxDiscount: 0,
      canStack: rule.canStack || false, appliesTo: rule.appliesTo || 'all',
      validFrom: rule.validFrom || '', validTo: rule.validTo || '', isActive: rule.isActive,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    const dto: CreatePricingRuleDto = {
      name: form.name, description: form.description || undefined,
      ruleType: form.ruleType as any, discountType: form.discountType as any,
      discountValue: form.discountValue || undefined, priority: form.priority,
      canStack: form.canStack, appliesTo: form.appliesTo as any,
      validFrom: form.validFrom || undefined, validTo: form.validTo || undefined,
    };
    if (editingRule) {
      updateMut.mutate({ id: editingRule.id, dto });
    } else {
      createMut.mutate(dto);
    }
  };

  const filteredRules = useMemo(() => {
    return rules.filter((r: PricingRule) => {
      const matchSearch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchType = filterType === 'all' ||
        (filterType === 'percentage' && r.discountType === 'percentage') ||
        (filterType === 'fixed' && r.discountType === 'fixed_amount');
      return matchSearch && matchType;
    });
  }, [rules, searchTerm, filterType]);

  const stats = useMemo(() => ({
    total: rules.length,
    active: rules.filter((r: PricingRule) => r.isActive).length,
    promotions: rules.filter((r: PricingRule) => r.ruleType === 'promotion').length,
    corporate: rules.filter((r: PricingRule) => r.ruleType === 'corporate').length,
  }), [rules]);

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Discount & Pricing Rules</h1>
            <p className="text-sm text-gray-500">Manage discount rules, promotions, and eligibility criteria</p>
          </div>
          <button onClick={() => { resetForm(); setFormError(''); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm">
            <Plus className="w-4 h-4" />Create Rule
          </button>
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Rules', value: stats.total, icon: <Percent className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50' },
            { label: 'Active', value: stats.active, icon: <CheckCircle className="w-5 h-5 text-green-600" />, bg: 'bg-green-50' },
            { label: 'Promotions', value: stats.promotions, icon: <ShieldCheck className="w-5 h-5 text-orange-600" />, bg: 'bg-orange-50' },
            { label: 'Corporate', value: stats.corporate, icon: <Users className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-lg p-3 flex items-center gap-3`}>
              <div className="p-2 bg-white rounded-lg shadow-sm">{s.icon}</div>
              <div><div className="text-sm text-gray-500">{s.label}</div><div className="text-xl font-bold">{s.value}</div></div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b px-6 py-3 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search rules..." value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Type:</span>
          {(['all', 'percentage', 'fixed'] as const).map(type => (
            <button key={type} onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-sm capitalize ${
                filterType === type ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>{type}</button>
          ))}
        </div>
      </div>

      {/* Rules Grid */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
        ) : filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Percent className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No pricing rules yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create discount rules for promotions, corporate partners, staff, etc.</p>
            <button onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm">
              <Plus className="w-4 h-4" />Create First Rule
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredRules.map((rule: PricingRule) => (
              <div key={rule.id} className={`bg-white rounded-lg border p-4 ${!rule.isActive ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-2 rounded-lg ${rule.discountType === 'percentage' ? 'bg-green-100' : 'bg-blue-100'}`}>
                      {rule.discountType === 'percentage' ? <Percent className="w-5 h-5 text-green-600" /> : <DollarSign className="w-5 h-5 text-blue-600" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{rule.name}</h3>
                      <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{RULE_TYPE_LABELS[rule.ruleType] || rule.ruleType}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {rule.discountType === 'percentage' ? `${rule.discountValue}%` : formatCurrency(rule.discountValue || 0)}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rule.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>
                {rule.description && <p className="text-sm text-gray-500 mb-2">{rule.description}</p>}
                <div className="space-y-1.5 mb-3">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                    Applies to: {APPLIES_TO_LABELS[rule.appliesTo] || rule.appliesTo}
                  </div>
                  {(rule.validFrom || rule.validTo) && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar className="w-3.5 h-3.5 text-gray-400" />
                      {rule.validFrom || '—'} to {rule.validTo || 'ongoing'}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Clock className="w-3.5 h-3.5 text-gray-400" />
                    Priority: {rule.priority} · {rule.canStack ? 'Stackable' : 'Non-stackable'}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t">
                  <span className="text-xs text-gray-400">ID: {rule.id.slice(0, 8)}…</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(rule)} className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => updateMut.mutate({ id: rule.id, dto: { isActive: !rule.isActive } as any })}
                      className={`p-1.5 rounded ${rule.isActive ? 'text-gray-500 hover:text-red-600 hover:bg-red-50' : 'text-gray-500 hover:text-green-600 hover:bg-green-50'}`}>
                      {rule.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => { if (confirm('Delete this rule?')) deleteMut.mutate(rule.id); }}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-bold">{editingRule ? 'Edit Rule' : 'Create Pricing Rule'}</h2>
              <button onClick={closeModal} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {formError && <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{formError}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
                <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  placeholder="e.g. Staff Discount" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Rule Type *</label>
                  <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.ruleType} onChange={e => setForm(f => ({ ...f, ruleType: e.target.value }))}>
                    <option value="promotion">Promotion</option>
                    <option value="corporate">Corporate</option>
                    <option value="membership">Membership</option>
                    <option value="loyalty">Loyalty</option>
                    <option value="volume">Volume</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Discount Type *</label>
                  <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed_amount">Fixed Amount ({CURRENCY_SYMBOL})</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value {form.discountType === 'percentage' ? '(%)' : `(${CURRENCY_SYMBOL})`} *
                  </label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.discountValue || ''} onChange={e => setForm(f => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority (lower = first)</label>
                  <input type="number" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.priority} onChange={e => setForm(f => ({ ...f, priority: parseInt(e.target.value) || 100 }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Applies To</label>
                <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  value={form.appliesTo} onChange={e => setForm(f => ({ ...f, appliesTo: e.target.value }))}>
                  <option value="all">All Services</option>
                  <option value="services">Services Only</option>
                  <option value="lab">Laboratory</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="radiology">Radiology</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid From</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.validFrom} onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid To</label>
                  <input type="date" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                    value={form.validTo} onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea rows={2} className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.canStack} onChange={e => setForm(f => ({ ...f, canStack: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Can stack with other discounts</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white">
              <button onClick={closeModal} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              <button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending || !form.name}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm">
                {(createMut.isPending || updateMut.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editingRule ? 'Update Rule' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}