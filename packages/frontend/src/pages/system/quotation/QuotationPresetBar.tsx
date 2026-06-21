import { Briefcase } from 'lucide-react';
import type { PRESET_PACKAGES } from './quotation-constants';

interface Props {
  onApply: (pack: keyof typeof PRESET_PACKAGES) => void;
}

export default function QuotationPresetBar({ onApply }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-indigo-600" /> Loaded Preset Packages
          </h3>
          <p className="text-xs text-slate-500">Fast-track bid configurations using standard hospital setup presets.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 w-full md:w-auto min-w-[360px]">
          <button
            type="button"
            onClick={() => onApply('clinic')}
            className="px-4 py-3 bg-blue-50/50 hover:bg-blue-50 text-blue-700 hover:text-blue-800 text-xs font-bold rounded-lg transition-all text-center border border-blue-100 hover:border-blue-200 shadow-sm flex flex-col items-center justify-center gap-1"
          >
            <span>Clinic Pack</span>
            <span className="text-[10px] font-normal text-blue-500">Basic EMR (5 modules)</span>
          </button>
          <button
            type="button"
            onClick={() => onApply('hospital')}
            className="px-4 py-3 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 text-xs font-bold rounded-lg transition-all text-center border border-indigo-100 hover:border-indigo-200 shadow-sm flex flex-col items-center justify-center gap-1"
          >
            <span>Hospital Pack</span>
            <span className="text-[10px] font-normal text-indigo-500">Standard ERP (11 modules)</span>
          </button>
          <button
            type="button"
            onClick={() => onApply('enterprise')}
            className="px-4 py-3 bg-purple-50/50 hover:bg-purple-50 text-purple-700 hover:text-purple-800 text-xs font-bold rounded-lg transition-all text-center border border-purple-100 hover:border-purple-200 shadow-sm flex flex-col items-center justify-center gap-1"
          >
            <span>Enterprise Pack</span>
            <span className="text-[10px] font-normal text-purple-500">Full System (20+ modules)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
