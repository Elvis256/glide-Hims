import { Printer, FileText } from 'lucide-react';
import { formatMoney } from './quotation-constants';

interface Props {
  clientName: string;
  quotationNumber?: string;
  validUntil: string;
  lineCount: number;
  currency: string;
  subtotal: number;
  trainingAmount: number;
  baseSubtotal: number;
  discountAmt: number;
  afterDiscount: number;
  vatAmount: number;
  whtAmount: number;
  total: number;
  includeTraining: boolean;
  includeVat: boolean;
  deductWht: boolean;
  vatRatePercent: number;
  whtRatePercent: number;
  discountPercent: number;
  onToggleTraining: (v: boolean) => void;
  onToggleVat: (v: boolean) => void;
  onToggleWht: (v: boolean) => void;
  editable: boolean;
  quotationId?: string;
}

export default function QuotationSummaryPanel({
  clientName, quotationNumber, validUntil, lineCount, currency,
  subtotal, trainingAmount, baseSubtotal, discountAmt, afterDiscount,
  vatAmount, whtAmount, total,
  includeTraining, includeVat, deductWht,
  vatRatePercent, whtRatePercent, discountPercent,
  onToggleTraining, onToggleVat, onToggleWht,
  editable, quotationId,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm sticky top-6">
      <div className="border-b border-slate-100 pb-3 mb-4">
        <h2 className="text-base font-bold text-slate-800">Commercial Summary</h2>
        <p className="text-xs text-slate-500 mt-0.5">Live calculation of project fees and local taxes.</p>
      </div>

      <div className="space-y-3.5 text-xs text-slate-700 border-b border-slate-100 pb-4">
        <div className="flex justify-between">
          <span className="text-slate-500">Client:</span>
          <span className="font-semibold truncate max-w-[180px]">{clientName || 'Not specified'}</span>
        </div>
        {quotationNumber && (
          <div className="flex justify-between">
            <span className="text-slate-500">Quote Reference:</span>
            <span className="font-semibold font-mono">{quotationNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-slate-500">Valid Until:</span>
          <span className="font-semibold">{validUntil || '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Line Items:</span>
          <span className="font-semibold">{lineCount} modules</span>
        </div>
      </div>

      {/* Tax & fee toggles */}
      <div className="py-4 border-b border-slate-100 space-y-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Local Taxes & Implementation Fees</span>

        <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={includeTraining} onChange={(e) => onToggleTraining(e.target.checked)} disabled={!editable} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span>Implementation & Training Fee (+15%)</span>
        </label>

        <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={includeVat} onChange={(e) => onToggleVat(e.target.checked)} disabled={!editable} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span>Include VAT (+{vatRatePercent}%)</span>
        </label>

        <label className="flex items-center gap-3 text-xs font-semibold text-slate-700 cursor-pointer select-none">
          <input type="checkbox" checked={deductWht} onChange={(e) => onToggleWht(e.target.checked)} disabled={!editable} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
          <span>Deduct Withholding Tax (-{whtRatePercent}%)</span>
        </label>
      </div>

      {/* Totals */}
      <div className="pt-4 space-y-2.5 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Software Subtotal</span>
          <span>{formatMoney(subtotal, currency)}</span>
        </div>

        {includeTraining && (
          <div className="flex justify-between text-slate-600">
            <span>Setup & Training Fee</span>
            <span>{formatMoney(trainingAmount, currency)}</span>
          </div>
        )}
        {includeTraining && (
          <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-50 pt-1.5">
            <span>Base Subtotal</span>
            <span>{formatMoney(baseSubtotal, currency)}</span>
          </div>
        )}

        {discountAmt > 0 && (
          <>
            <div className="flex justify-between text-red-600">
              <span>Discount{discountPercent > 0 ? ` (${discountPercent}%)` : ''}</span>
              <span>-{formatMoney(discountAmt, currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-50 pt-1.5">
              <span>After Discount</span>
              <span>{formatMoney(afterDiscount, currency)}</span>
            </div>
          </>
        )}

        {includeVat && (
          <div className="flex justify-between text-slate-600">
            <span>Value Added Tax ({vatRatePercent}%)</span>
            <span>{formatMoney(vatAmount, currency)}</span>
          </div>
        )}

        <div className="flex justify-between text-base font-extrabold text-slate-900 border-t border-slate-200 pt-3">
          <span>Gross Total</span>
          <span>{formatMoney(afterDiscount + vatAmount, currency)}</span>
        </div>

        {deductWht && (
          <>
            <div className="flex justify-between text-rose-600 border-t border-dashed border-slate-200 pt-2.5">
              <span>Less: {whtRatePercent}% WHT Deduction</span>
              <span>-{formatMoney(whtAmount, currency)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-emerald-700 border-t border-slate-200 pt-2.5">
              <span>Net Payable Amount</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 space-y-2">
        <button onClick={() => window.print()} className="inline-flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-900/10 hover:shadow-lg transition-all active:scale-[0.98]">
          <Printer className="w-4 h-4" /> Print Proposal / Save PDF
        </button>
        {quotationId && (
          <a href={`/api/v1/saas-revenue/quotations/${quotationId}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 w-full rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-700 transition-all">
            <FileText className="w-4 h-4" /> View PDF
          </a>
        )}
      </div>
    </div>
  );
}
