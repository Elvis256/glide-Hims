import { MODULE_CATALOG, DEFAULT_PRICES, HARDWARE_IDS, formatMoney } from './quotation-constants';

interface Props {
  selectedModuleIds: Set<string>;
  currency: string;
  catalogPrices: Record<string, number>;
  onAdd: (moduleId: string) => void;
}

export default function QuotationModuleGrid({ selectedModuleIds, currency, catalogPrices, onAdd }: Props) {

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-sm space-y-5">
      <div className="border-b border-slate-100 pb-2.5">
        <h3 className="text-sm font-bold text-slate-800">Quick-Add Module Directory</h3>
        <p className="text-xs text-slate-500">Tap modules to instantly add them to the quotation lines.</p>
      </div>

      <div className="space-y-5">
        {MODULE_CATALOG.map((group) => (
          <div key={group.group} className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block border-b border-slate-50 pb-1">{group.group}</span>
            <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
              {group.modules.map((mod) => {
                const isAdded = selectedModuleIds.has(mod.id);
                const isHardware = HARDWARE_IDS.has(mod.id);
                const isSoftware = !isHardware;
                const price = catalogPrices[mod.id] ?? DEFAULT_PRICES[mod.id] ?? 0;

                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => onAdd(mod.id)}
                    className={`flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 text-left text-xs transition-all ${
                      isAdded && isSoftware
                        ? 'border-emerald-300 bg-emerald-50/50 text-emerald-800 font-semibold'
                        : 'border-slate-200/80 bg-slate-50/50 text-slate-650 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="truncate flex items-center gap-1">
                      {mod.label}
                      {isAdded && isSoftware && <span className="text-emerald-600 font-bold ml-1">&check;</span>}
                    </span>
                    <span className="font-bold text-slate-700 shrink-0">
                      {formatMoney(price, currency)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
