import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle, AlertTriangle, Plus, Trash2, RotateCcw, Percent } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';

interface VatRule {
  country: string;
  rate: number;
  taxLabel?: string;
  taxNumberLabel?: string;
}

interface VatSettings {
  enabled: boolean;
  defaultLabel: string;
  defaultRate: number;
  rules: VatRule[];
}

const DEFAULTS: VatSettings = {
  enabled: false,
  defaultLabel: 'VAT',
  defaultRate: 0,
  rules: [
    { country: 'Uganda', rate: 18, taxLabel: 'VAT', taxNumberLabel: 'TIN' },
    { country: 'Kenya', rate: 16, taxLabel: 'VAT', taxNumberLabel: 'KRA PIN' },
    { country: 'Tanzania', rate: 18, taxLabel: 'VAT', taxNumberLabel: 'TIN' },
    { country: 'Rwanda', rate: 18, taxLabel: 'VAT', taxNumberLabel: 'TIN' },
  ],
};

export default function SystemVatRulesPage() {
  const [data, setData] = useState<VatSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/vat-rules');
      setData(unwrap<VatSettings>(r));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const update = <K extends keyof VatSettings>(k: K, v: VatSettings[K]) =>
    setData((d) => ({ ...(d as VatSettings), [k]: v }));

  const updateRule = (idx: number, patch: Partial<VatRule>) =>
    setData((d) => {
      if (!d) return d;
      const rules = d.rules.slice();
      rules[idx] = { ...rules[idx], ...patch };
      return { ...d, rules };
    });

  const removeRule = (idx: number) =>
    setData((d) => d ? { ...d, rules: d.rules.filter((_, i) => i !== idx) } : d);

  const addRule = () =>
    setData((d) => d ? { ...d, rules: [...d.rules, { country: '', rate: 0, taxLabel: 'VAT', taxNumberLabel: 'TIN' }] } : d);

  const save = async () => {
    if (!data) return;
    if (data.defaultRate < 0 || data.defaultRate > 100) {
      setError('Default rate must be between 0 and 100.');
      return;
    }
    for (const r of data.rules) {
      if (!r.country.trim()) { setError('Every rule needs a country.'); return; }
      if (r.rate < 0 || r.rate > 100) { setError(`Rate for ${r.country} must be 0-100.`); return; }
    }
    setError(null);
    setSaving(true);
    try {
      const r = await api.put('/saas-revenue/vat-rules', data);
      setData(unwrap<VatSettings>(r));
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setData(DEFAULTS);

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" /> Loading VAT rules…</div>;
  }
  if (!data) {
    return <div className="p-8 text-red-700">{error || 'Failed to load.'}</div>;
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Percent className="w-6 h-6 text-emerald-600" /> VAT / Tax Rules</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure per-country tax rates applied to renewal invoices. Tenant country is read from organization settings;
            falls back to the default rate when no rule matches.
          </p>
        </div>
        <button onClick={reset} className="text-xs px-3 py-1.5 border rounded inline-flex items-center gap-1 hover:bg-gray-50">
          <RotateCcw className="w-3.5 h-3.5" /> Reset defaults
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="bg-white border rounded-lg p-5 space-y-5">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
            className="w-4 h-4"
          />
          <div>
            <div className="font-medium">Enable VAT / tax on invoices</div>
            <div className="text-xs text-gray-500">When disabled, all invoices are issued with zero tax regardless of rules.</div>
          </div>
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium block mb-1">Default tax label</label>
            <input
              type="text"
              value={data.defaultLabel}
              onChange={(e) => update('defaultLabel', e.target.value)}
              className="w-full px-3 py-2 border rounded text-sm"
              placeholder="VAT"
            />
            <div className="text-xs text-gray-500 mt-1">Used when a country has no specific taxLabel.</div>
          </div>
          <div>
            <label className="text-sm font-medium block mb-1">Default rate (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={data.defaultRate}
              onChange={(e) => update('defaultRate', Number(e.target.value))}
              className="w-full px-3 py-2 border rounded text-sm"
            />
            <div className="text-xs text-gray-500 mt-1">Applied when tenant's country has no matching rule.</div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-medium">Country rules</h2>
            <button onClick={addRule} className="text-xs px-3 py-1.5 border rounded inline-flex items-center gap-1 hover:bg-gray-50">
              <Plus className="w-3.5 h-3.5" /> Add country
            </button>
          </div>
          <div className="overflow-hidden border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">Country</th>
                  <th className="text-left px-3 py-2 w-28">Rate (%)</th>
                  <th className="text-left px-3 py-2 w-32">Tax label</th>
                  <th className="text-left px-3 py-2 w-40">Tax-number label</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {data.rules.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-gray-500 italic">No rules — invoices will use the default rate.</td></tr>
                )}
                {data.rules.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.country}
                        onChange={(e) => updateRule(i, { country: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="Uganda"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={r.rate}
                        onChange={(e) => updateRule(i, { rate: Number(e.target.value) })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.taxLabel || ''}
                        onChange={(e) => updateRule(i, { taxLabel: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="VAT"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={r.taxNumberLabel || ''}
                        onChange={(e) => updateRule(i, { taxNumberLabel: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                        placeholder="TIN"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeRule(i)} className="text-red-600 hover:text-red-800" title="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-3 border-t flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Tax is added on top of (subtotal − discount) — i.e. tax-exclusive pricing.
          </div>
          <div className="flex items-center gap-3">
            {savedAt && (
              <span className="text-xs text-emerald-700 inline-flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Saved
              </span>
            )}
            <button
              onClick={save}
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium inline-flex items-center gap-2 hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
