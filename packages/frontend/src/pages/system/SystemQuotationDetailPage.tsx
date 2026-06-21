import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, Check, X, Trash2, Loader2, History, Sparkles,
} from 'lucide-react';
import { fmtDate, QUOTATION_STATUS_STYLES } from './saas/_shared';
import { useQuotationForm } from './quotation/useQuotationForm';
import QuotationPresetBar from './quotation/QuotationPresetBar';
import QuotationClientForm from './quotation/QuotationClientForm';
import QuotationBillingForm from './quotation/QuotationBillingForm';
import QuotationLineItems from './quotation/QuotationLineItems';
import QuotationSummaryPanel from './quotation/QuotationSummaryPanel';
import QuotationModuleGrid from './quotation/QuotationModuleGrid';
import QuotationHardwareSuggestions from './quotation/QuotationHardwareSuggestions';
import QuotationPrintProposal from './quotation/QuotationPrintProposal';
import QuotationRevisions from './quotation/QuotationRevisions';

export default function SystemQuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuotationForm(id);

  if (q.loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="print:hidden space-y-8 max-w-7xl mx-auto pb-12">
        {/* Header banner */}
        {(q.isNew || q.isDraft) ? (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 p-8 shadow-lg text-white">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -ml-20 -mb-20" />
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <Link to="/system/quotations" className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-xs">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations
                </Link>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" /> {q.isNew ? 'New Proposal' : `Draft ${q.quotation?.quotationNumber}`}
                </div>
                <h1 className="text-3xl font-extrabold tracking-tight">Glide-HIMS Proposal Builder</h1>
                <p className="text-sm text-slate-300 max-w-2xl">
                  Configure hospital modules, hardware specifications, and local tax requirements for <strong>{q.company.legalName}</strong> commercial bids.
                </p>
              </div>
              {/* Action buttons */}
              <div className="flex flex-wrap gap-3 shrink-0">
                <button onClick={q.handleSave} disabled={q.saving || !q.form.clientName} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50">
                  {q.saving ? 'Saving...' : q.isNew ? 'Save as Draft' : 'Save'}
                </button>
                {!q.isNew && (
                  <>
                    <button onClick={() => q.handleAction('send')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all">
                      <Send className="w-4 h-4" /> Send
                    </button>
                    <button onClick={() => q.handleAction('accept')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all">
                      <Check className="w-4 h-4" /> Accept
                    </button>
                    <button onClick={() => q.handleAction('reject')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600/80 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all">
                      <X className="w-4 h-4" /> Reject
                    </button>
                    <button onClick={q.handleNewRevision} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/10 transition-all">
                      <History className="w-4 h-4" /> New Revision
                    </button>
                    <button onClick={q.handleDelete} className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-red-400/30 text-red-300 rounded-lg text-sm font-semibold hover:bg-red-900/30 transition-all">
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Non-editable header for sent/accepted/rejected */
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <div className="flex items-center gap-4">
              <Link to="/system/quotations" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900">{q.quotation?.quotationNumber}</h1>
                <p className="text-sm text-gray-500">Revision v{q.quotation?.currentRevisionNumber} &middot; Created {fmtDate(q.quotation?.createdAt)}</p>
              </div>
              {q.quotation && (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${QUOTATION_STATUS_STYLES[q.quotation.status]}`}>{q.quotation.status}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              {q.quotation?.status === 'sent' && (
                <>
                  <button onClick={() => q.handleAction('accept')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"><Check className="w-4 h-4" /> Accept</button>
                  <button onClick={() => q.handleAction('reject')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"><X className="w-4 h-4" /> Reject</button>
                </>
              )}
              <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 px-4 py-2 border rounded text-sm hover:bg-gray-50">Print Proposal</button>
              {q.quotation?.id && (
                <a href={`/api/v1/saas-revenue/quotations/${q.quotation.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 border rounded text-sm hover:bg-gray-50">View PDF</a>
              )}
            </div>
          </div>
        )}

        {/* Tabs (only for saved quotations) */}
        {!q.isNew && (
          <div className="flex gap-1 border-b">
            <button onClick={() => q.setTab('details')} className={`px-4 py-2 text-sm font-medium border-b-2 ${q.tab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Details</button>
            <button onClick={() => q.setTab('revisions')} className={`px-4 py-2 text-sm font-medium border-b-2 ${q.tab === 'revisions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Revisions ({q.quotation?.revisions?.length || 0})</button>
          </div>
        )}

        {/* Revisions tab */}
        {q.tab === 'revisions' && q.quotation && (
          <QuotationRevisions quotation={q.quotation} />
        )}

        {/* Details tab / new quotation */}
        {(q.tab === 'details' || q.isNew) && (
          <>
            {/* Preset bar — only for editable quotations */}
            {q.isEditable && <QuotationPresetBar onApply={q.applyPresetPackage} />}

            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
              {/* Left column */}
              <div className="space-y-6">
                <QuotationClientForm form={q.form} onChange={(patch) => q.setForm((f) => ({ ...f, ...patch }))} disabled={!q.isEditable} />
                <QuotationBillingForm form={q.form} onChange={(patch) => q.setForm((f) => ({ ...f, ...patch }))} disabled={!q.isEditable} />
                <QuotationLineItems
                  lines={q.lines}
                  currency={q.form.currency}
                  editable={q.isEditable}
                  onAdd={q.addLine}
                  onRemove={q.removeLine}
                  onUpdate={q.updateLine}
                  onApplyModule={q.applyModuleToLine}
                />

                {/* Notes */}
                <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
                  <div className="border-b border-slate-100 pb-3 mb-4">
                    <h2 className="text-base font-bold text-slate-800">Custom Bidding & Payment Terms</h2>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">Client Notes</label>
                      <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[100px]" value={q.form.notes} onChange={(e) => q.setForm((f) => ({ ...f, notes: e.target.value }))} disabled={!q.isEditable} placeholder="Specify payment terms, support SLA, deployment schedules..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">Internal Notes</label>
                      <textarea className="w-full border rounded px-3 py-2 text-sm min-h-[100px]" value={q.form.internalNotes} onChange={(e) => q.setForm((f) => ({ ...f, internalNotes: e.target.value }))} disabled={!q.isEditable} />
                    </div>
                  </div>
                </div>

                {/* Subscription link */}
                {q.quotation?.subscriptionId && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <p className="text-sm text-emerald-800 font-medium">This quotation has been accepted and converted to a subscription.</p>
                    <Link to={`/system/subscriptions/${q.quotation.subscriptionId}`} className="text-sm text-emerald-600 hover:underline mt-1 inline-block">View Subscription &rarr;</Link>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-6">
                <QuotationSummaryPanel
                  clientName={q.form.clientName}
                  quotationNumber={q.quotation?.quotationNumber}
                  validUntil={q.form.validUntil}
                  lineCount={q.lines.length}
                  currency={q.form.currency}
                  subtotal={q.subtotal}
                  trainingAmount={q.trainingAmount}
                  baseSubtotal={q.baseSubtotal}
                  discountAmt={q.discountAmt}
                  afterDiscount={q.afterDiscount}
                  vatAmount={q.vatAmount}
                  whtAmount={q.whtAmount}
                  total={q.total}
                  includeTraining={q.includeTraining}
                  includeVat={q.form.includeVat}
                  deductWht={q.form.deductWht}
                  vatRatePercent={q.form.vatRatePercent}
                  whtRatePercent={q.form.whtRatePercent}
                  discountPercent={q.form.discountPercent}
                  onToggleTraining={q.setIncludeTraining}
                  onToggleVat={(v) => q.setForm((f) => ({ ...f, includeVat: v }))}
                  onToggleWht={(v) => q.setForm((f) => ({ ...f, deductWht: v }))}
                  editable={q.isEditable}
                  quotationId={q.quotation?.id}
                />

                {q.isEditable && (
                  <>
                    <QuotationHardwareSuggestions
                      suggestions={q.hardwareSuggestions}
                      currency={q.form.currency}
                      onAdd={q.addQuotedModule}
                    />
                    <QuotationModuleGrid
                      selectedModuleIds={q.selectedModuleIds}
                      currency={q.form.currency}
                      catalogPrices={q.catalogPrices}
                      onAdd={q.addQuotedModule}
                    />
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Print proposal (hidden on screen, shown on print) */}
      <QuotationPrintProposal
        company={q.company}
        clientName={q.form.clientName || q.form.clientOrganization}
        clientContact={q.form.clientEmail || q.form.clientPhone || ''}
        quotationNumber={q.quotation?.quotationNumber || 'DRAFT'}
        issueDate={q.quotation?.issueDate || new Date().toISOString().slice(0, 10)}
        validUntil={q.form.validUntil}
        currency={q.form.currency}
        lines={q.lines}
        notes={q.form.notes}
        subtotal={q.subtotal}
        trainingAmount={q.trainingAmount}
        baseSubtotal={q.baseSubtotal}
        vatAmount={q.vatAmount}
        whtAmount={q.whtAmount}
        total={q.total}
        includeTraining={q.includeTraining}
        includeVat={q.form.includeVat}
        deductWht={q.form.deductWht}
      />
    </div>
  );
}
