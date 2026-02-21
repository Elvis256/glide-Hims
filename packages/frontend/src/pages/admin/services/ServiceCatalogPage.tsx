import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, Plus, Edit2, Power, Download, Upload, Stethoscope, FlaskConical,
  Radio, Scissors, Pill, Loader2, AlertCircle, Trash2, X, Tag, Activity,
  Clock, Calendar, CheckCircle2, XCircle, LayoutGrid, FolderOpen,
  ChevronDown, Zap, Package, DollarSign, Shield, Users, Heart, Save,
  ChevronRight,
} from 'lucide-react';
import { servicesService, type Service, type ServiceCategory } from '../../../services/services';
import { CURRENCY_SYMBOL, formatCurrency } from '../../../lib/currency';
import {
  getInsurancePriceLists, createInsurancePriceList, updateInsurancePriceList,
  type InsurancePriceList,
} from '../../../services/pricing';
import { insuranceService, type InsuranceProvider } from '../../../services/insurance';
import { facilitiesService, type Department } from '../../../services/facilities';

// ─── Default seed data ──────────────────────────────────────────────────────
const DEFAULT_CATEGORIES = [
  { code: 'CON', name: 'Consultation', sortOrder: 1 },
  { code: 'LAB', name: 'Laboratory',   sortOrder: 2 },
  { code: 'RAD', name: 'Radiology',    sortOrder: 3 },
  { code: 'PROC', name: 'Procedures',  sortOrder: 4 },
  { code: 'PHARM', name: 'Pharmacy',   sortOrder: 5 },
  { code: 'SURG', name: 'Surgery',     sortOrder: 6 },
  { code: 'DENT', name: 'Dental',      sortOrder: 7 },
  { code: 'MAT', name: 'Maternity',    sortOrder: 8 },
];

const DEFAULT_SERVICES = [
  { code: 'CON001', name: 'General Consultation',       category: 'CON',  price: 5000,   dept: 'OPD',        dur: 20 },
  { code: 'CON002', name: 'Specialist Consultation',    category: 'CON',  price: 15000,  dept: 'OPD',        dur: 30 },
  { code: 'CON003', name: 'Emergency Consultation',     category: 'CON',  price: 10000,  dept: 'Emergency',  dur: 30 },
  { code: 'LAB001', name: 'Complete Blood Count (CBC)', category: 'LAB',  price: 8000,   dept: 'Laboratory', dur: 60 },
  { code: 'LAB002', name: 'Malaria RDT',                category: 'LAB',  price: 5000,   dept: 'Laboratory', dur: 30 },
  { code: 'LAB003', name: 'Blood Glucose (Random)',     category: 'LAB',  price: 3000,   dept: 'Laboratory', dur: 15 },
  { code: 'LAB004', name: 'Urinalysis',                 category: 'LAB',  price: 4000,   dept: 'Laboratory', dur: 30 },
  { code: 'LAB005', name: 'Liver Function Tests',       category: 'LAB',  price: 20000,  dept: 'Laboratory', dur: 60 },
  { code: 'LAB006', name: 'HIV Test',                   category: 'LAB',  price: 5000,   dept: 'Laboratory', dur: 20 },
  { code: 'RAD001', name: 'Chest X-Ray',                category: 'RAD',  price: 15000,  dept: 'Radiology',  dur: 15 },
  { code: 'RAD002', name: 'Abdominal Ultrasound',       category: 'RAD',  price: 30000,  dept: 'Radiology',  dur: 20 },
  { code: 'RAD003', name: 'Obstetric Ultrasound',       category: 'RAD',  price: 30000,  dept: 'Maternity',  dur: 20 },
  { code: 'PROC001', name: 'Wound Dressing',            category: 'PROC', price: 5000,   dept: 'OPD',        dur: 15 },
  { code: 'PROC002', name: 'IV Line Insertion',         category: 'PROC', price: 5000,   dept: 'Ward',       dur: 10 },
  { code: 'PROC003', name: 'Suturing (per stitch)',     category: 'PROC', price: 3000,   dept: 'Emergency',  dur: 20 },
  { code: 'PROC004', name: 'Circumcision',              category: 'PROC', price: 50000,  dept: 'Theatre',    dur: 60 },
  { code: 'MAT001', name: 'Antenatal Visit',            category: 'MAT',  price: 10000,  dept: 'Maternity',  dur: 30 },
  { code: 'MAT002', name: 'Normal Delivery',            category: 'MAT',  price: 150000, dept: 'Maternity',  dur: 0  },
  { code: 'MAT003', name: 'Postnatal Visit',            category: 'MAT',  price: 8000,   dept: 'Maternity',  dur: 20 },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Consultation: 'bg-blue-100 text-blue-700',
  Laboratory:   'bg-purple-100 text-purple-700',
  Radiology:    'bg-indigo-100 text-indigo-700',
  Procedures:   'bg-orange-100 text-orange-700',
  Pharmacy:     'bg-green-100 text-green-700',
  Surgery:      'bg-red-100 text-red-700',
  Dental:       'bg-teal-100 text-teal-700',
  Maternity:    'bg-pink-100 text-pink-700',
};

const getCategoryColor = (name?: string) =>
  CATEGORY_COLORS[name || ''] || 'bg-gray-100 text-gray-700';

const getCategoryIcon = (name?: string) => {
  switch (name) {
    case 'Consultation': return <Stethoscope className="w-3.5 h-3.5" />;
    case 'Laboratory':   return <FlaskConical className="w-3.5 h-3.5" />;
    case 'Radiology':    return <Radio className="w-3.5 h-3.5" />;
    case 'Procedures':   return <Scissors className="w-3.5 h-3.5" />;
    case 'Pharmacy':     return <Pill className="w-3.5 h-3.5" />;
    case 'Surgery':      return <Zap className="w-3.5 h-3.5" />;
    case 'Maternity':    return <Activity className="w-3.5 h-3.5" />;
    default:             return <Tag className="w-3.5 h-3.5" />;
  }
};

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ onAdd, onSeed, seeding }: { onAdd: () => void; onSeed: () => void; seeding: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
        <Package className="w-10 h-10 text-blue-400" />
      </div>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">No services yet</h3>
      <p className="text-gray-500 max-w-sm mb-8">
        Add your facility's services to enable billing, patient charges, and insurance claims.
      </p>
      <div className="flex gap-3">
        <button onClick={onSeed} disabled={seeding}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
          {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Load Default Services
        </button>
        <button onClick={onAdd}
          className="flex items-center gap-2 px-5 py-2.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50">
          <Plus className="w-4 h-4" />Add Manually
        </button>
      </div>
      <p className="text-xs text-gray-400 mt-4">
        "Load Default Services" adds {DEFAULT_SERVICES.length} common healthcare services automatically.
      </p>
    </div>
  );
}

// ─── Service Form ─────────────────────────────────────────────────────────────
interface ServiceFormData {
  code: string; name: string; categoryId: string; basePrice: number;
  description: string; department: string; tier: string;
  durationMinutes: number; requiresAppointment: boolean;
}

const emptyForm = (): ServiceFormData => ({
  code: '', name: '', categoryId: '', basePrice: 0,
  description: '', department: '', tier: 'standard',
  durationMinutes: 0, requiresAppointment: false,
});

function ServiceModal({
  service, categories, departments, onClose, onSave, saving, error,
}: {
  service: ServiceFormData; categories: ServiceCategory[]; departments: Department[];
  onClose: () => void; onSave: (data: ServiceFormData) => void;
  saving: boolean; error: string;
}) {
  const [form, setForm] = useState<ServiceFormData>(service);
  const set = (key: keyof ServiceFormData, val: string | number | boolean) =>
    setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {service.code ? 'Edit Service' : 'Add New Service'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Service Code *</label>
              <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                placeholder="e.g. CON001" value={form.code}
                onChange={e => set('code', e.target.value.toUpperCase())} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
              <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={form.categoryId} onChange={e => set('categoryId', e.target.value)}>
                <option value="">Select Category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
            <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g. General Consultation" value={form.name}
              onChange={e => set('name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cash Price ({CURRENCY_SYMBOL}) *</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0" value={form.basePrice}
                onChange={e => set('basePrice', parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={form.department} onChange={e => set('department', e.target.value)}>
                <option value="">Select Department</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
              <input type="number" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="0" value={form.durationMinutes}
                onChange={e => set('durationMinutes', parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tier</label>
              <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                value={form.tier} onChange={e => set('tier', e.target.value)}>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="vip">VIP</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              rows={2} placeholder="Brief description..."
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className={`w-10 h-6 rounded-full transition-colors ${form.requiresAppointment ? 'bg-blue-600' : 'bg-gray-300'}`}
              onClick={() => set('requiresAppointment', !form.requiresAppointment)}>
              <div className={`w-4 h-4 bg-white rounded-full shadow m-1 transition-transform ${form.requiresAppointment ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-sm text-gray-700">Requires appointment booking</span>
          </label>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {service.code ? 'Save Changes' : 'Add Service'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Category Modal ───────────────────────────────────────────────────────────
function CategoryModal({
  onClose, onSave, saving, error,
}: {
  onClose: () => void;
  onSave: (data: { code: string; name: string; description?: string }) => void;
  saving: boolean; error: string;
}) {
  const [form, setForm] = useState({ code: '', name: '', description: '' });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Add Category</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mb-3 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
              <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                placeholder="e.g. LAB" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="e.g. Laboratory" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={saving}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}Add Category
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pricing Drawer ───────────────────────────────────────────────────────────
function PricingDrawer({
  service,
  providers,
  priceLists,
  onClose,
  onSaved,
}: {
  service: Service;
  providers: InsuranceProvider[];
  priceLists: InsurancePriceList[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const servicePrices = priceLists.filter(p => p.serviceId === service.id);
  const [editPrices, setEditPrices] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    servicePrices.forEach(p => { map[p.insuranceProviderId] = String(p.agreedPrice); });
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const provider of providers) {
        const val = editPrices[provider.id];
        const existing = servicePrices.find(p => p.insuranceProviderId === provider.id);
        const price = val ? parseFloat(val) : 0;
        if (price > 0 && existing) {
          await updateInsurancePriceList(existing.id, { agreedPrice: price });
        } else if (price > 0 && !existing) {
          await createInsurancePriceList({
            insuranceProviderId: provider.id,
            serviceId: service.id,
            agreedPrice: price,
          });
        }
      }
      setSaved(true);
      setTimeout(() => { onSaved(); }, 600);
    } finally {
      setSaving(false);
    }
  };

  const discount = (providerPrice: number) => {
    if (!service.basePrice || !providerPrice) return null;
    const pct = ((service.basePrice - providerPrice) / service.basePrice * 100);
    return pct;
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative w-full max-w-lg bg-white shadow-2xl flex flex-col animate-in slide-in-from-right"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Pricing — {service.name}</h2>
              <p className="text-blue-100 text-sm mt-0.5">{service.code} · {service.category?.name}</p>
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/20"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Cash Price */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-sm font-semibold text-green-800">Cash / Walk-in Price</span>
            </div>
            <p className="text-3xl font-bold text-green-700">{formatCurrency(service.basePrice)}</p>
            <p className="text-xs text-green-600 mt-1">
              Set on the service details. This is the default price for cash-paying patients.
            </p>
          </div>

          {/* Insurance Prices */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-gray-800">Insurance Prices</span>
              <span className="text-xs text-gray-400 ml-auto">Negotiated rate per insurer</span>
            </div>
            {providers.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm border rounded-lg">
                No insurance providers configured yet.<br />
                Go to <strong>Admin → Insurance</strong> to add providers.
              </div>
            ) : (
              <div className="space-y-2">
                {providers.map(prov => {
                  const currentPrice = editPrices[prov.id] || '';
                  const numPrice = parseFloat(currentPrice) || 0;
                  const disc = discount(numPrice);
                  return (
                    <div key={prov.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{prov.name}</div>
                        <div className="text-xs text-gray-400">{prov.code} · {prov.type}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">{CURRENCY_SYMBOL}</span>
                        <input
                          type="number"
                          value={currentPrice}
                          onChange={e => setEditPrices(p => ({ ...p, [prov.id]: e.target.value }))}
                          placeholder="—"
                          className="w-28 border rounded-lg px-3 py-1.5 text-sm text-right focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        {disc !== null && disc !== 0 && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                            disc > 0 ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'
                          }`}>
                            {disc > 0 ? `-${disc.toFixed(0)}%` : `+${Math.abs(disc).toFixed(0)}%`}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Staff / Scheme */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-gray-800">Staff & Scheme Pricing</span>
            </div>
            <div className="border rounded-lg p-4 bg-gray-50">
              <p className="text-sm text-gray-500">
                Staff and hospital scheme prices are calculated automatically using <strong>Membership Plans</strong>.
                Each plan has a discount percentage applied to the cash price.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Configure at: <strong>Admin → Membership Plans</strong>
              </p>
            </div>
          </div>

          {/* Price comparison summary */}
          {providers.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Heart className="w-4 h-4 text-pink-600" />
                <span className="text-sm font-semibold text-gray-800">Price Summary</span>
              </div>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Payer</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Price</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">vs Cash</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <tr className="bg-green-50">
                      <td className="px-3 py-2 font-medium text-green-700">💵 Cash</td>
                      <td className="px-3 py-2 text-right font-semibold text-green-700">{formatCurrency(service.basePrice)}</td>
                      <td className="px-3 py-2 text-right text-gray-400">—</td>
                    </tr>
                    {providers.map(prov => {
                      const price = parseFloat(editPrices[prov.id] || '0');
                      if (!price) return null;
                      const disc = discount(price);
                      return (
                        <tr key={prov.id}>
                          <td className="px-3 py-2 text-gray-700">🛡️ {prov.name}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(price)}</td>
                          <td className="px-3 py-2 text-right">
                            {disc !== null && (
                              <span className={disc > 0 ? 'text-red-500' : 'text-green-500'}>
                                {disc > 0 ? `-${disc.toFixed(0)}%` : `+${Math.abs(disc).toFixed(0)}%`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-white flex items-center justify-between">
          <button onClick={onClose} className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm">Close</button>
          <button onClick={handleSave} disabled={saving || saved}
            className={`px-5 py-2 rounded-lg text-sm flex items-center gap-2 ${
              saved ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'
            } disabled:opacity-50`}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saved ? 'Saved!' : 'Save Insurance Prices'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
type Tab = 'services' | 'categories' | 'pricing';

export default function ServiceCatalogPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('services');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);
  const [deleteCatTarget, setDeleteCatTarget] = useState<ServiceCategory | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pricingService, setPricingService] = useState<Service | null>(null);
  const [formError, setFormError] = useState('');
  const [seeding, setSeeding] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: servicesData, isLoading, error } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesService.list({ includeInactive: true }),
    staleTime: 30000,
  });

  const { data: categoriesData } = useQuery({
    queryKey: ['serviceCategories'],
    queryFn: () => servicesService.categories.list(),
    staleTime: 60000,
  });

  const { data: insuranceProviders } = useQuery({
    queryKey: ['insuranceProviders'],
    queryFn: () => insuranceService.providers.list(),
    staleTime: 60000,
  });

  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: () => facilitiesService.departments.listAll(),
    staleTime: 60000,
  });

  const { data: allPriceLists } = useQuery({
    queryKey: ['insurancePriceLists'],
    queryFn: () => getInsurancePriceLists({ isActive: true }),
    staleTime: 30000,
    enabled: tab === 'pricing' || !!pricingService,
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (data: ServiceFormData) =>
      servicesService.create({
        code: data.code, name: data.name, categoryId: data.categoryId,
        basePrice: data.basePrice, description: data.description || undefined,
        department: data.department || undefined,
        tier: (data.tier || 'standard') as any,
        durationMinutes: data.durationMinutes || undefined,
        requiresAppointment: data.requiresAppointment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setShowAddModal(false);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message || 'Failed to create service'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ServiceFormData }) =>
      servicesService.update(id, {
        code: data.code, name: data.name, categoryId: data.categoryId,
        basePrice: data.basePrice, description: data.description || undefined,
        department: data.department || undefined,
        tier: (data.tier || 'standard') as any,
        durationMinutes: data.durationMinutes || undefined,
        requiresAppointment: data.requiresAppointment,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setEditService(null);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message || 'Failed to update service'),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      servicesService.update(id, { isActive: !isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['services'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => servicesService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      setDeleteTarget(null);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: servicesService.categories.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCategories'] });
      setShowCategoryModal(false);
      setFormError('');
    },
    onError: (e: Error) => setFormError(e.message || 'Failed to create category'),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => servicesService.categories.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCategories'] });
      setDeleteCatTarget(null);
    },
  });

  // ── Seed defaults ─────────────────────────────────────────────────────────
  const handleSeedDefaults = useCallback(async () => {
    setSeeding(true);
    try {
      const catMap: Record<string, string> = {};
      for (const cat of DEFAULT_CATEGORIES) {
        try {
          const existing = categoriesData?.find(c => c.code === cat.code);
          if (existing) { catMap[cat.code] = existing.id; continue; }
          const created = await servicesService.categories.create(cat);
          catMap[cat.code] = created.id;
        } catch { /* skip */ }
      }
      const freshCats = await servicesService.categories.list();
      freshCats.forEach(c => { catMap[c.code] = c.id; });
      for (const svc of DEFAULT_SERVICES) {
        try {
          await servicesService.create({
            code: svc.code, name: svc.name, categoryId: catMap[svc.category],
            basePrice: svc.price, department: svc.dept,
            durationMinutes: svc.dur || undefined, isActive: true,
          });
        } catch { /* skip */ }
      }
      queryClient.invalidateQueries({ queryKey: ['services'] });
      queryClient.invalidateQueries({ queryKey: ['serviceCategories'] });
    } finally { setSeeding(false); }
  }, [categoriesData, queryClient]);

  // ── CSV Export ─────────────────────────────────────────────────────────────
  const handleExport = () => {
    if (!servicesData?.length) return;
    const provs = insuranceProviders || [];
    const header = ['Code', 'Name', 'Category', 'Department', 'Cash Price', ...provs.map(p => p.name + ' Price'), 'Status'];
    const rows = servicesData.map(s => {
      const insurancePrices = provs.map(p => {
        const pl = allPriceLists?.find(x => x.serviceId === s.id && x.insuranceProviderId === p.id);
        return pl ? pl.agreedPrice : '';
      });
      return [s.code, s.name, s.category?.name || '', s.department || '', s.basePrice, ...insurancePrices, s.isActive ? 'Active' : 'Inactive'];
    });
    const csv = [header, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'services-pricing.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const services = servicesData || [];
  const catNames = ['All', ...(categoriesData?.map(c => c.name) || [])];

  const filteredServices = useMemo(() => services.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.department || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat = selectedCategory === 'All' || s.category?.name === selectedCategory;
    return matchSearch && matchCat;
  }), [services, searchTerm, selectedCategory]);

  const stats = useMemo(() => ({
    total: services.length,
    active: services.filter(s => s.isActive).length,
    inactive: services.filter(s => !s.isActive).length,
    categories: categoriesData?.length || 0,
  }), [services, categoriesData]);

  const serviceToForm = (s: Service): ServiceFormData => ({
    code: s.code, name: s.name, categoryId: s.categoryId,
    basePrice: s.basePrice, description: s.description || '',
    department: s.department || '', tier: s.tier || 'standard',
    durationMinutes: s.durationMinutes || 0,
    requiresAppointment: s.requiresAppointment || false,
  });

  const provs = insuranceProviders || [];

  // helper: get insurance price for a service
  const getInsurancePrice = (serviceId: string, providerId: string) =>
    allPriceLists?.find(p => p.serviceId === serviceId && p.insuranceProviderId === providerId);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col bg-gray-50">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Catalog</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage services, categories, and pricing</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExport} disabled={!services.length}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 text-sm disabled:opacity-40">
              <Download className="w-4 h-4" />Export
            </button>
            <button className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border rounded-lg hover:bg-gray-50 text-sm">
              <Upload className="w-4 h-4" />Import
            </button>
            {tab === 'categories' ? (
              <button onClick={() => { setFormError(''); setShowCategoryModal(true); }}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" />Add Category
              </button>
            ) : (
              <button onClick={() => { setFormError(''); setShowAddModal(true); }}
                className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 text-sm">
                <Plus className="w-4 h-4" />Add Service
              </button>
            )}
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4 mt-4">
          {[
            { label: 'Total Services', value: stats.total, icon: <Package className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', text: 'text-blue-700' },
            { label: 'Active', value: stats.active, icon: <CheckCircle2 className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', text: 'text-green-700' },
            { label: 'Inactive', value: stats.inactive, icon: <XCircle className="w-5 h-5 text-gray-500" />, bg: 'bg-gray-50', text: 'text-gray-600' },
            { label: 'Categories', value: stats.categories, icon: <FolderOpen className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-50', text: 'text-purple-700' },
          ].map(card => (
            <div key={card.label} className={`${card.bg} rounded-xl px-4 py-3 flex items-center gap-3`}>
              <div className="p-2 bg-white rounded-lg shadow-sm">{card.icon}</div>
              <div>
                <p className="text-xs text-gray-500">{card.label}</p>
                <p className={`text-2xl font-bold ${card.text}`}>{card.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 border-b -mb-4">
          {[
            { key: 'services',   label: 'Services',   icon: <LayoutGrid className="w-4 h-4" /> },
            { key: 'pricing',    label: 'Pricing',     icon: <DollarSign className="w-4 h-4" /> },
            { key: 'categories', label: 'Categories',  icon: <FolderOpen className="w-4 h-4" /> },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as Tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Services Tab ──────────────────────────────────────────────────── */}
      {tab === 'services' && (
        <>
          <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search name, code, department..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {catNames.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{cat}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Code</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Department</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cash Price</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Duration</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {isLoading ? (
                    <tr><td colSpan={8} className="py-12 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-blue-500" />
                      <p className="text-sm text-gray-500 mt-2">Loading services…</p>
                    </td></tr>
                  ) : error ? (
                    <tr><td colSpan={8} className="py-12 text-center">
                      <AlertCircle className="w-8 h-8 mx-auto text-red-400" />
                      <p className="text-sm text-red-600 mt-2">Failed to load services</p>
                    </td></tr>
                  ) : filteredServices.length === 0 && services.length === 0 ? (
                    <tr><td colSpan={8}>
                      <EmptyState onAdd={() => setShowAddModal(true)} onSeed={handleSeedDefaults} seeding={seeding} />
                    </td></tr>
                  ) : filteredServices.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-gray-500 text-sm">No services match your search.</td></tr>
                  ) : filteredServices.map(svc => (
                    <tr key={svc.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{svc.code}</code>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 text-sm">{svc.name}</div>
                        {svc.description && <div className="text-xs text-gray-400 truncate max-w-xs">{svc.description}</div>}
                        {svc.requiresAppointment && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 mt-0.5">
                            <Calendar className="w-3 h-3" />Appt required
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(svc.category?.name)}`}>
                          {getCategoryIcon(svc.category?.name)}{svc.category?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{svc.department || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="font-semibold text-gray-900 text-sm">{formatCurrency(svc.basePrice)}</div>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-500">
                        {svc.durationMinutes ? <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" />{svc.durationMinutes}m</span> : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                          svc.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${svc.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                          {svc.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button title="Set Prices" onClick={() => setPricingService(svc)}
                            className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors">
                            <DollarSign className="w-4 h-4" />
                          </button>
                          <button title="Edit" onClick={() => { setFormError(''); setEditService(svc); }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button title={svc.isActive ? 'Deactivate' : 'Activate'}
                            onClick={() => toggleMutation.mutate({ id: svc.id, isActive: svc.isActive })}
                            className={`p-1.5 rounded transition-colors ${svc.isActive
                              ? 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                              : 'text-gray-400 hover:text-green-600 hover:bg-green-50'}`}>
                            <Power className="w-4 h-4" />
                          </button>
                          <div className="relative">
                            <button title="More" onClick={() => setOpenMenuId(openMenuId === svc.id ? null : svc.id)}
                              className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors">
                              <ChevronDown className="w-4 h-4" />
                            </button>
                            {openMenuId === svc.id && (
                              <div className="absolute right-0 top-8 bg-white border shadow-lg rounded-lg z-20 min-w-32 py-1">
                                <button onClick={() => { setDeleteTarget(svc); setOpenMenuId(null); }}
                                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2">
                                  <Trash2 className="w-4 h-4" />Delete
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Pricing Tab ───────────────────────────────────────────────────── */}
      {tab === 'pricing' && (
        <>
          <div className="bg-white border-b px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-52 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search services..."
                value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {catNames.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>{cat}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-auto px-6 py-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide sticky left-0 bg-gray-50 z-10 min-w-48">Service</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-28">
                        <span className="inline-flex items-center gap-1">💵 Cash</span>
                      </th>
                      {provs.map(p => (
                        <th key={p.id} className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide min-w-28">
                          <span className="inline-flex items-center gap-1 truncate max-w-28" title={p.name}>
                            🛡️ {p.name}
                          </span>
                        </th>
                      ))}
                      <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredServices.length === 0 ? (
                      <tr><td colSpan={3 + provs.length} className="py-12 text-center text-gray-500 text-sm">
                        {services.length === 0 ? 'No services yet. Add services first.' : 'No services match your search.'}
                      </td></tr>
                    ) : filteredServices.map(svc => (
                      <tr key={svc.id} className="hover:bg-gray-50 group">
                        <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-gray-50 z-10">
                          <div className="flex items-center gap-2">
                            <span className={`p-1.5 rounded ${getCategoryColor(svc.category?.name)}`}>
                              {getCategoryIcon(svc.category?.name)}
                            </span>
                            <div>
                              <div className="font-medium text-gray-900 text-sm">{svc.name}</div>
                              <div className="text-xs text-gray-400">{svc.code} · {svc.department || '—'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="font-semibold text-green-700 text-sm">{formatCurrency(svc.basePrice)}</span>
                        </td>
                        {provs.map(p => {
                          const pl = getInsurancePrice(svc.id, p.id);
                          const price = pl ? Number(pl.agreedPrice) : 0;
                          const diff = price && svc.basePrice ? ((svc.basePrice - price) / svc.basePrice * 100) : 0;
                          return (
                            <td key={p.id} className="px-4 py-3 text-right">
                              {price > 0 ? (
                                <div>
                                  <span className="font-medium text-gray-900 text-sm">{formatCurrency(price)}</span>
                                  {diff !== 0 && (
                                    <div className={`text-xs ${diff > 0 ? 'text-red-500' : 'text-green-500'}`}>
                                      {diff > 0 ? `−${diff.toFixed(0)}%` : `+${Math.abs(diff).toFixed(0)}%`}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-gray-300 text-sm">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-4 py-3 text-center">
                          <button title="Set Prices" onClick={() => setPricingService(svc)}
                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            {provs.length === 0 && services.length > 0 && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <strong>No insurance providers configured.</strong> Go to Admin → Insurance to add insurance providers, then return here to set their prices per service.
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Categories Tab ────────────────────────────────────────────────── */}
      {tab === 'categories' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Category Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Description</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Services</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {!categoriesData?.length ? (
                  <tr><td colSpan={5} className="py-12 text-center text-gray-500 text-sm">
                    No categories yet. Click "Add Category" to create one.
                  </td></tr>
                ) : categoriesData.map(cat => {
                  const count = services.filter(s => s.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-gray-50 group">
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{cat.code}</code>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${getCategoryColor(cat.name)}`}>
                          {getCategoryIcon(cat.name)}{cat.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">{cat.description || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-gray-700">{count}</span>
                        <span className="text-xs text-gray-400 ml-1">services</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setDeleteCatTarget(cat)} disabled={count > 0}
                          title={count > 0 ? 'Cannot delete — has services' : 'Delete category'}
                          className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      {showAddModal && (
        <ServiceModal service={emptyForm()} categories={categoriesData || []} departments={departmentsData || []}
          onClose={() => { setShowAddModal(false); setFormError(''); }}
          onSave={data => createMutation.mutate(data)} saving={createMutation.isPending} error={formError} />
      )}
      {editService && (
        <ServiceModal service={serviceToForm(editService)} categories={categoriesData || []} departments={departmentsData || []}
          onClose={() => { setEditService(null); setFormError(''); }}
          onSave={data => updateMutation.mutate({ id: editService.id, data })} saving={updateMutation.isPending} error={formError} />
      )}
      {showCategoryModal && (
        <CategoryModal onClose={() => { setShowCategoryModal(false); setFormError(''); }}
          onSave={data => createCategoryMutation.mutate(data)} saving={createCategoryMutation.isPending} error={formError} />
      )}

      {/* Pricing Drawer */}
      {pricingService && (
        <PricingDrawer
          service={pricingService}
          providers={provs}
          priceLists={allPriceLists || []}
          onClose={() => setPricingService(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['insurancePriceLists'] });
            setPricingService(null);
          }}
        />
      )}

      {/* Delete Service Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Service?</h3>
            <p className="text-sm text-gray-500 mb-6"><strong>{deleteTarget.name}</strong> will be permanently deleted.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteTarget(null)} className="px-5 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteMutation.mutate(deleteTarget.id)} disabled={deleteMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirm */}
      {deleteCatTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">Delete Category?</h3>
            <p className="text-sm text-gray-500 mb-6"><strong>{deleteCatTarget.name}</strong> will be permanently removed.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteCatTarget(null)} className="px-5 py-2 border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={() => deleteCategoryMutation.mutate(deleteCatTarget.id)} disabled={deleteCategoryMutation.isPending}
                className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
                {deleteCategoryMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {openMenuId && <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />}
    </div>
  );
}
