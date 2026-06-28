import type { QuotationFormState } from './useQuotationForm';

interface Props {
  form: QuotationFormState;
  onChange: (patch: Partial<QuotationFormState>) => void;
  disabled: boolean;
}

export default function QuotationBillingForm({ form, onChange, disabled }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
      <h2 className="text-base font-bold text-slate-800 mb-4">Billing Terms</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1">Currency</label>
          <select className="w-full border rounded px-3 py-2 text-sm" value={form.currency} onChange={(e) => onChange({ currency: e.target.value })} disabled={disabled}>
            <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option><option value="TZS">TZS</option><option value="RWF">RWF</option><option value="EUR">EUR</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Billing Interval</label>
          <select className="w-full border rounded px-3 py-2 text-sm" value={form.billingInterval} onChange={(e) => onChange({ billingInterval: e.target.value })} disabled={disabled}>
            <option value="monthly">Monthly</option><option value="annual">Annual</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Seats</label>
          <input type="number" min={1} className="w-full border rounded px-3 py-2 text-sm" value={form.seats} onChange={(e) => onChange({ seats: parseInt(e.target.value) || 1 })} disabled={disabled} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Discount %</label>
          <input type="number" min={0} max={100} className="w-full border rounded px-3 py-2 text-sm" value={form.discountPercent} onChange={(e) => onChange({ discountPercent: parseFloat(e.target.value) || 0 })} disabled={disabled} />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div>
          <label className="block text-xs font-medium mb-1">Fixed Discount</label>
          <input type="number" min={0} className="w-full border rounded px-3 py-2 text-sm" value={form.discountFixedMinor} onChange={(e) => onChange({ discountFixedMinor: parseInt(e.target.value) || 0 })} disabled={disabled} />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.includeVat} onChange={(e) => onChange({ includeVat: e.target.checked })} disabled={disabled} /> Include VAT ({form.vatRatePercent}%)</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.deductWht} onChange={(e) => onChange({ deductWht: e.target.checked })} disabled={disabled} /> Deduct WHT ({form.whtRatePercent}%)</label>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <div>
          <label className="block text-xs font-medium mb-1">Deployment Type</label>
          <select className="w-full border rounded px-3 py-2 text-sm" value={form.deploymentType} onChange={(e) => onChange({ deploymentType: e.target.value })} disabled={disabled}>
            <option value="hybrid">Hybrid</option>
            <option value="standalone">Standalone (On-Premise)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Deployment Domain</label>
          <input type="text" placeholder="e.g. client.glidehims.com" className="w-full border rounded px-3 py-2 text-sm" value={form.deploymentDomain} onChange={(e) => onChange({ deploymentDomain: e.target.value })} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
