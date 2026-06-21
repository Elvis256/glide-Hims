import { Plus, Trash2, Check } from 'lucide-react';
import { ALL_MODULE_OPTIONS } from './quotation-constants';
import { formatMoney } from './quotation-constants';
import type { QuoteLine } from './useQuotationForm';

interface Props {
  lines: QuoteLine[];
  currency: string;
  editable: boolean;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onUpdate: (id: string, patch: Partial<QuoteLine>) => void;
  onApplyModule: (lineId: string, moduleId: string) => void;
}

export default function QuotationLineItems({ lines, currency, editable, onAdd, onRemove, onUpdate, onApplyModule }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <Check className="w-5 h-5 text-indigo-600" /> Scope of Work Breakdown
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Define software modules, pricing structures, and specifications.</p>
        </div>
        {editable && (
          <button onClick={onAdd} className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition-all">
            <Plus className="w-4 h-4" /> Add Row
          </button>
        )}
      </div>

      <div className="space-y-4">
        {lines.map((line, index) => (
          <div key={line.id} className="relative p-5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-4 hover:border-slate-350 transition-all">
            <span className="absolute -top-2 -left-2 w-6 h-6 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center text-xs font-bold border border-slate-300">
              {index + 1}
            </span>

            <div className="grid gap-4 md:grid-cols-[1.5fr_0.5fr_1fr_1fr] items-start pt-1">
              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Select System Module</label>
                {editable ? (
                  <select className="w-full border rounded px-3 py-2 text-sm bg-white" value={line.moduleId} onChange={(e) => onApplyModule(line.id, e.target.value)}>
                    <option value="">Select standard module...</option>
                    {ALL_MODULE_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-slate-800">{ALL_MODULE_OPTIONS.find((o) => o.id === line.moduleId)?.label || line.description || 'Custom'}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity</label>
                {editable ? (
                  <input type="number" min={1} className="w-full border rounded px-3 py-2 text-sm bg-white text-center" value={line.quantity} onChange={(e) => onUpdate(line.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                ) : (
                  <p className="text-sm text-center">{line.quantity}</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Unit Price ({currency})</label>
                {editable ? (
                  <input type="number" min={0} className="w-full border rounded px-3 py-2 text-sm bg-white" value={line.unitPrice} onChange={(e) => onUpdate(line.id, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                ) : (
                  <p className="text-sm">{formatMoney(line.unitPrice, currency)}</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-2 self-end pb-1.5 h-10">
                <div className="text-right">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Line Total</p>
                  <p className="font-bold text-slate-800 text-sm">{formatMoney(line.quantity * line.unitPrice, currency)}</p>
                </div>
                {editable && (
                  <button onClick={() => onRemove(line.id)} className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-all" title="Delete Row">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Scope / Custom Line Description</label>
              {editable ? (
                <textarea className="w-full border rounded px-3 py-2 text-xs bg-white min-h-[60px]" value={line.description} onChange={(e) => onUpdate(line.id, { description: e.target.value })} placeholder="Detail the modules, user licenses or implementation terms..." />
              ) : (
                <p className="text-xs text-slate-600">{line.description || 'No description provided.'}</p>
              )}
            </div>
          </div>
        ))}
        {lines.length === 0 && (
          <div className="py-8 text-center text-gray-400">No line items added yet</div>
        )}
      </div>
    </div>
  );
}
