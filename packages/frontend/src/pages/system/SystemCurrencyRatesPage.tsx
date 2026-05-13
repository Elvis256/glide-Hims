import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle, AlertTriangle, Plus, Trash2, RotateCcw, Coins } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';

interface CurrencyRates {
  base: string;
  rates: Record<string, number>;
  updatedAt: string | null;
}

const DEFAULTS: CurrencyRates = {
  base: 'UGX',
  rates: { UGX: 1, KES: 0.034, TZS: 0.71, RWF: 0.36, USD: 0.00027, EUR: 0.00025 },
  updatedAt: null,
};

export default function SystemCurrencyRatesPage() {
  const [data, setData] = useState<CurrencyRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newCcy, setNewCcy] = useState('');
  const [newRate, setNewRate] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/currency-rates');
      setData(unwrap<CurrencyRates>(r));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const updateRate = (ccy: string, value: number) =>
    setData((d) => d ? { ...d, rates: { ...d.rates, [ccy]: value } } : d);

  const removeRate = (ccy: string) =>
    setData((d) => {
      if (!d || ccy === d.base) return d;
      const r = { ...d.rates };
      delete r[ccy];
      return { ...d, rates: r };
    });

  const addRate = () => {
    const ccy = newCcy.trim().toUpperCase();
    const rate = Number(newRate);
    if (!ccy || ccy.length !== 3) { setError('Currency code must be 3 letters'); return; }
    if (!isFinite(rate) || rate <= 0) { setError('Rate must be a positive number'); return; }
    setError(null);
    setData((d) => d ? { ...d, rates: { ...d.rates, [ccy]: rate } } : d);
    setNewCcy(''); setNewRate('');
  };

  const save = async () => {
    if (!data) return;
    setError(null);
    setSaving(true);
    try {
      const r = await api.put('/saas-revenue/currency-rates', { base: data.base, rates: data.rates });
      setData(unwrap<CurrencyRates>(r));
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
    return <div className="p-8 flex items-center gap-2 text-gray-600"><Loader2 className="w-5 h-5 animate-spin" /> Loading FX rates…</div>;
  }
  if (!data) {
    return <div className="p-8 text-red-700">{error || 'Failed to load.'}</div>;
  }

  const baseCcy = data.base;
  const sortedCurrencies = Object.keys(data.rates).sort((a, b) => a === baseCcy ? -1 : b === baseCcy ? 1 : a.localeCompare(b));

  return (
    <div className="p-6 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2"><Coins className="w-6 h-6 text-amber-600" /> Currency / FX Rates</h1>
          <p className="text-sm text-gray-600 mt-1">
            Conversion rates used to display plan prices in tenant-local currency. Rates are stored as
            <strong> 1 {baseCcy} = N target</strong>. Update periodically to track real-world FX changes.
          </p>
          {data.updatedAt && <p className="text-xs text-gray-500 mt-1">Last updated: {new Date(data.updatedAt).toLocaleString()}</p>}
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
        <div>
          <label className="text-sm font-medium block mb-1">Base currency</label>
          <input
            type="text"
            value={data.base}
            onChange={(e) => setData((d) => d ? { ...d, base: e.target.value.toUpperCase().slice(0, 3) } : d)}
            className="w-32 px-3 py-2 border rounded text-sm font-mono"
            maxLength={3}
          />
          <div className="text-xs text-gray-500 mt-1">Plans store prices in their own currency; conversions pivot through this base.</div>
        </div>

        <div>
          <h2 className="font-medium mb-2">Rates</h2>
          <div className="overflow-hidden border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2 w-24">Currency</th>
                  <th className="text-left px-3 py-2">Rate (1 {baseCcy} = N)</th>
                  <th className="text-left px-3 py-2 w-32">Example</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody>
                {sortedCurrencies.map((ccy) => {
                  const rate = data.rates[ccy];
                  const isBase = ccy === baseCcy;
                  return (
                    <tr key={ccy} className="border-t">
                      <td className="px-3 py-2 font-mono font-medium">{ccy}{isBase && <span className="ml-1 text-[10px] text-emerald-700">(base)</span>}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          value={rate}
                          disabled={isBase}
                          onChange={(e) => updateRate(ccy, Number(e.target.value))}
                          className="w-full px-2 py-1 border rounded text-sm disabled:bg-gray-50"
                        />
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        1,000 {baseCcy} ≈ {(1000 * (rate || 0)).toLocaleString(undefined, { maximumFractionDigits: 4 })} {ccy}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {!isBase && (
                          <button onClick={() => removeRate(ccy)} className="text-red-600 hover:text-red-800" title="Remove">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t bg-gray-50">
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={newCcy}
                      onChange={(e) => setNewCcy(e.target.value.toUpperCase().slice(0, 3))}
                      placeholder="GBP"
                      className="w-full px-2 py-1 border rounded text-sm font-mono"
                      maxLength={3}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={newRate}
                      onChange={(e) => setNewRate(e.target.value)}
                      placeholder="0.00021"
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={addRate} className="text-emerald-600 hover:text-emerald-800" title="Add"><Plus className="w-4 h-4" /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-3 border-t flex items-center justify-between">
          <div className="text-xs text-gray-500">
            Tenants see plan prices in their own currency on the public pricing page and registration wizard.
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
              Save rates
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
