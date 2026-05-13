import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle, Building2 } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';

interface VendorBilling {
  legalName: string;
  tradingName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  website?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  logoUrl?: string;
  defaultCurrency?: string;
  invoiceFooter?: string;
}

const FIELDS: Array<{ key: keyof VendorBilling; label: string; placeholder?: string; full?: boolean; type?: string }> = [
  { key: 'legalName', label: 'Legal name *', placeholder: 'e.g. IT Solutions Uganda Ltd' },
  { key: 'tradingName', label: 'Trading name (shown on invoices)', placeholder: 'e.g. Glide HIMS' },
  { key: 'taxId', label: 'Tax / TIN', placeholder: 'e.g. 1009876543' },
  { key: 'defaultCurrency', label: 'Default currency', placeholder: 'UGX' },
  { key: 'email', label: 'Billing email', type: 'email', placeholder: 'billing@example.com' },
  { key: 'phone', label: 'Phone', placeholder: '+256 …' },
  { key: 'website', label: 'Website', placeholder: 'https://…' },
  { key: 'logoUrl', label: 'Logo URL', placeholder: 'https://…/logo.png' },
  { key: 'addressLine1', label: 'Address line 1', full: true },
  { key: 'addressLine2', label: 'Address line 2', full: true },
  { key: 'city', label: 'City' },
  { key: 'country', label: 'Country' },
  { key: 'invoiceFooter', label: 'Invoice footer / terms', full: true },
];

export default function SystemBillingSettingsPage() {
  const [data, setData] = useState<VendorBilling | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/billing-settings');
      setData(unwrap<VendorBilling>(r));
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const update = (k: keyof VendorBilling, v: string) => setData((d) => ({ ...(d as VendorBilling), [k]: v }));

  const save = async () => {
    if (!data) return;
    if (!data.legalName?.trim()) { setError('Legal name is required'); return; }
    setError(null); setSaving(true);
    try {
      const r = await api.put('/saas-revenue/billing-settings', data);
      setData(unwrap<VendorBilling>(r));
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  if (loading || !data) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Building2 className="w-7 h-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendor billing identity</h1>
          <p className="text-sm text-gray-500">Your business details — appear on every SaaS invoice (PDF/print) sent to tenants.</p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key as string} className={f.full ? 'md:col-span-2' : ''}>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">{f.label}</label>
            {f.key === 'invoiceFooter' ? (
              <textarea
                value={(data[f.key] as string) || ''}
                onChange={(e) => update(f.key, e.target.value)}
                rows={3}
                placeholder={f.placeholder}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            ) : (
              <input
                type={f.type || 'text'}
                value={(data[f.key] as string) || ''}
                onChange={(e) => update(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            )}
          </div>
        ))}
      </div>

      {data.logoUrl && (
        <div className="bg-white border rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Logo preview</div>
          <img src={data.logoUrl} alt="logo preview" className="max-h-16" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
        </div>
      )}

      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{error}</div>}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save settings'}
        </button>
        {savedAt && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle className="w-4 h-4" /> Saved</span>
        )}
      </div>
    </div>
  );
}
