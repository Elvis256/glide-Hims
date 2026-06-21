import { Building2 } from 'lucide-react';
import type { QuotationFormState } from './useQuotationForm';

interface Props {
  form: QuotationFormState;
  onChange: (patch: Partial<QuotationFormState>) => void;
  disabled: boolean;
}

export default function QuotationClientForm({ form, onChange, disabled }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm space-y-6">
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-indigo-600" /> Client Information
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">Specify customer profile, reference details and timelines.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Client Name *</label>
          <input className="w-full border rounded px-3 py-2 text-sm" value={form.clientName} onChange={(e) => onChange({ clientName: e.target.value })} disabled={disabled} placeholder="e.g. St. Mary Hospital Lacor" />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Organization</label>
          <input className="w-full border rounded px-3 py-2 text-sm" value={form.clientOrganization} onChange={(e) => onChange({ clientOrganization: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Email</label>
          <input type="email" className="w-full border rounded px-3 py-2 text-sm" value={form.clientEmail} onChange={(e) => onChange({ clientEmail: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Phone</label>
          <input className="w-full border rounded px-3 py-2 text-sm" value={form.clientPhone} onChange={(e) => onChange({ clientPhone: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Country</label>
          <input className="w-full border rounded px-3 py-2 text-sm" value={form.clientCountry} onChange={(e) => onChange({ clientCountry: e.target.value })} disabled={disabled} />
        </div>
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">Valid Until</label>
          <input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.validUntil} onChange={(e) => onChange({ validUntil: e.target.value })} disabled={disabled} />
        </div>
      </div>
    </div>
  );
}
