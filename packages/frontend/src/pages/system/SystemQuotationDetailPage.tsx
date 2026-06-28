import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, Check, X, Trash2, Loader2, History, Sparkles, Pencil, Save, Undo2, Printer,
  FileText, CheckCircle2, Clock, XCircle, Mail,
} from 'lucide-react';
import { fmtDate } from './saas/_shared';
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

/* ---------- Status-based header styling ---------- */
const STATUS_HEADER: Record<string, { gradient: string; glow1: string; glow2: string; badge: string; icon: any; label: string }> = {
  draft:    { gradient: 'from-slate-900 via-indigo-950 to-blue-900', glow1: 'bg-blue-500/10',   glow2: 'bg-indigo-500/10', badge: 'bg-indigo-500/20 border-indigo-400/30 text-indigo-200',  icon: Sparkles,      label: 'Draft' },
  sent:     { gradient: 'from-slate-900 via-sky-950 to-cyan-900',    glow1: 'bg-cyan-500/10',   glow2: 'bg-sky-500/10',    badge: 'bg-sky-500/20 border-sky-400/30 text-sky-200',          icon: Mail,          label: 'Sent' },
  accepted: { gradient: 'from-slate-900 via-emerald-950 to-green-900', glow1: 'bg-emerald-500/10', glow2: 'bg-green-500/10', badge: 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200', icon: CheckCircle2, label: 'Accepted' },
  rejected: { gradient: 'from-slate-900 via-red-950 to-rose-900',   glow1: 'bg-red-500/10',    glow2: 'bg-rose-500/10',   badge: 'bg-red-500/20 border-red-400/30 text-red-200',          icon: XCircle,       label: 'Rejected' },
  expired:  { gradient: 'from-slate-900 via-amber-950 to-yellow-900', glow1: 'bg-amber-500/10', glow2: 'bg-yellow-500/10', badge: 'bg-amber-500/20 border-amber-400/30 text-amber-200',    icon: Clock,         label: 'Expired' },
};

export default function SystemQuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuotationForm(id);

  if (q.loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const status = q.quotation?.status || 'draft';
  const headerStyle = STATUS_HEADER[status] || STATUS_HEADER.draft;
  const StatusIcon = headerStyle.icon;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="print:hidden space-y-8 max-w-7xl mx-auto pb-12">
        {/* ─── Unified Header Banner ─── */}
        <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${headerStyle.gradient} p-8 shadow-lg text-white`}>
          <div className={`absolute top-0 right-0 w-96 h-96 ${headerStyle.glow1} rounded-full blur-3xl -mr-20 -mt-20`} />
          <div className={`absolute bottom-0 left-0 w-96 h-96 ${headerStyle.glow2} rounded-full blur-3xl -ml-20 -mb-20`} />
          <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="space-y-2">
              <Link to="/system/quotations" className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-xs">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Quotations
              </Link>
              <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-xs font-semibold uppercase tracking-wider ${headerStyle.badge}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {q.isNew ? 'New Proposal' : `${headerStyle.label} ${q.quotation?.quotationNumber || ''}`}
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Glide-HIMS Proposal Builder</h1>
              <p className="text-sm text-slate-300 max-w-2xl">
                {q.isNew || q.isDraft
                  ? <>Configure hospital modules, hardware specifications, and local tax requirements for <strong>{q.company.legalName}</strong> commercial bids.</>
                  : <>Quotation for <strong>{q.form.clientOrganization || q.form.clientName || '—'}</strong> &middot; Revision v{q.quotation?.currentRevisionNumber} &middot; Created {fmtDate(q.quotation?.createdAt)}</>
                }
              </p>
            </div>

            {/* ─── Action Buttons ─── */}
            <div className="flex flex-wrap gap-3 shrink-0">
              {/* Print — always available */}
              <button onClick={() => q.handlePrint()} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all">
                <Printer className="w-4 h-4" /> Print Proposal
              </button>

              {/* View PDF — saved quotations */}
              {q.quotation?.id && (
                <a href={`/api/v1/saas-revenue/quotations/${q.quotation.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all">
                  <FileText className="w-4 h-4" /> View PDF
                </a>
              )}

              {/* Draft / New: Save */}
              {(q.isNew || q.isDraft) && !q.revising && (
                <button onClick={q.handleSave} disabled={q.saving || !q.form.clientName} className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all disabled:opacity-50">
                  {q.saving ? 'Saving...' : q.isNew ? 'Save as Draft' : 'Save'}
                </button>
              )}

              {/* Draft: Send / Accept / Reject */}
              {q.isDraft && !q.isNew && !q.revising && (
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
                </>
              )}

              {/* Sent: Accept / Reject */}
              {status === 'sent' && !q.revising && (
                <>
                  <button onClick={() => q.handleAction('accept')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-all">
                    <Check className="w-4 h-4" /> Accept
                  </button>
                  <button onClick={() => q.handleAction('reject')} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-red-600/80 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-all">
                    <X className="w-4 h-4" /> Reject
                  </button>
                </>
              )}

              {/* Revising controls */}
              {q.revising ? (
                <>
                  <button onClick={q.handleNewRevision} disabled={q.saving} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md transition-all">
                    <Save className="w-4 h-4" /> {q.saving ? 'Saving...' : 'Save New Revision'}
                  </button>
                  <button onClick={q.cancelRevising} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all">
                    <Undo2 className="w-4 h-4" /> Cancel
                  </button>
                </>
              ) : !q.isNew && (
                <button onClick={q.startRevising} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white/10 border border-white/20 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-all">
                  <Pencil className="w-4 h-4" /> Edit / Revise
                </button>
              )}

              {/* Draft: Delete + New Revision */}
              {q.isDraft && !q.isNew && !q.revising && (
                <>
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

        {/* Revising banner */}
        {q.revising && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-3">
            <Pencil className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800">
              <strong>Editing mode:</strong> Add/remove modules, change prices, discounts, terms, etc. When done, click <strong>"Save New Revision"</strong> to create a new version.
            </p>
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

                {/* Subscription & Contract links */}
                {q.quotation?.subscriptionId && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-emerald-800 font-medium">This quotation has been accepted and auto-provisioned.</p>
                    <div className="flex flex-wrap gap-4">
                      <Link to={`/system/subscriptions/${q.quotation.subscriptionId}`} className="text-sm text-emerald-600 hover:underline">View Subscription &rarr;</Link>
                      {q.quotation.contractId && (
                        <Link to={`/system/contracts/${q.quotation.contractId}`} className="text-sm text-blue-600 hover:underline">View Contract &rarr;</Link>
                      )}
                    </div>
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
        clientName={q.form.clientName}
        clientOrganization={q.form.clientOrganization}
        clientContact={q.form.clientEmail || q.form.clientPhone || ''}
        quotationNumber={q.quotation?.quotationNumber || 'DRAFT'}
        issueDate={q.quotation?.issueDate || new Date().toISOString().slice(0, 10)}
        validUntil={q.form.validUntil}
        currency={q.form.currency}
        billingInterval={q.form.billingInterval}
        seats={q.form.seats}
        deploymentType={q.form.deploymentType}
        lines={q.lines}
        notes={q.form.notes}
        subtotal={q.subtotal}
        trainingAmount={q.trainingAmount}
        baseSubtotal={q.baseSubtotal}
        discountAmt={q.discountAmt}
        afterDiscount={q.afterDiscount}
        discountPercent={q.form.discountPercent}
        discountFixedMinor={q.form.discountFixedMinor}
        vatAmount={q.vatAmount}
        vatRatePercent={q.form.vatRatePercent}
        whtAmount={q.whtAmount}
        whtRatePercent={q.form.whtRatePercent}
        total={q.total}
        includeTraining={q.includeTraining}
        includeVat={q.form.includeVat}
        deductWht={q.form.deductWht}
      />
    </div>
  );
}
