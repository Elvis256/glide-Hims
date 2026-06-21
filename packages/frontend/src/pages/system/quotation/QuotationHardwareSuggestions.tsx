import { AlertCircle } from 'lucide-react';
import { formatMoney } from './quotation-constants';

interface Suggestion {
  id: string;
  label: string;
  reason: string;
  price: number;
}

interface Props {
  suggestions: Suggestion[];
  currency: string;
  onAdd: (moduleId: string) => void;
}

export default function QuotationHardwareSuggestions({ suggestions, currency, onAdd }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-5 shadow-sm space-y-3">
      <div className="flex items-center gap-2 text-amber-900">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
        <h3 className="text-xs font-bold uppercase tracking-wider">Recommended Hardware Options</h3>
      </div>
      <p className="text-xs text-amber-700 leading-normal">
        Based on your software choices, we suggest adding the following compatible peripheral hardware:
      </p>
      <div className="space-y-3 mt-1">
        {suggestions.map((item) => (
          <div key={item.id} className="text-xs bg-white border border-amber-200/50 rounded-lg p-3 flex items-start justify-between gap-3 shadow-sm hover:border-amber-300 transition-all">
            <div className="space-y-1">
              <p className="font-bold text-slate-800">{item.label}</p>
              <p className="text-slate-500 text-[11px] leading-relaxed">{item.reason}</p>
              <p className="font-bold text-indigo-700 text-[11px] mt-0.5">{formatMoney(item.price, currency)}</p>
            </div>
            <button
              onClick={() => onAdd(item.id)}
              className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-md whitespace-nowrap self-center text-[10px] shadow-sm transition-all active:scale-[0.97]"
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
