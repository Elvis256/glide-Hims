import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Printer, Ban, ArrowLeft, ExternalLink, Plus, AlertTriangle, CheckCircle, Mail, Undo2, Upload, FileText, Image, Download, ShieldCheck, ShieldX } from 'lucide-react';
import api from '../../services/api';
import {
  SaasInvoice, SaasPayment, PaymentProof, INVOICE_STATUS_STYLES, VERIFICATION_STATUS_STYLES,
  VERIFICATION_STATUS_LABELS, fmtMoney, fmtDate, fmtDateTime, unwrap,
  PaymentVerificationStatus,
} from './saas/_shared';

interface PaymentWithRefund extends SaasPayment {
  gatewayPayload?: { refundedMinor?: number; refunds?: Array<{ at: string; amountMinor: number; reason: string | null }> } | null;
}
interface InvoiceDetail extends SaasInvoice { payments?: PaymentWithRefund[] }

export default function SystemInvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const [inv, setInv] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPay, setShowPay] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [proofs, setProofs] = useState<Record<string, PaymentProof[]>>({});

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.get(`/saas-revenue/invoices/${id}`);
      const data = unwrap<InvoiceDetail>(r);
      setInv(data);
      // Load proofs for each payment
      if (data?.payments?.length) {
        const proofMap: Record<string, PaymentProof[]> = {};
        await Promise.all(data.payments.map(async (p) => {
          try {
            const pr = await api.get(`/saas-revenue/payments/${p.id}/proofs`);
            proofMap[p.id] = unwrap<PaymentProof[]>(pr) || [];
          } catch { proofMap[p.id] = []; }
        }));
        setProofs(proofMap);
      }
    } catch (e: any) { setErr(e?.response?.data?.message || 'Failed to load invoice'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const onVoid = async () => {
    if (!inv) return;
    if (!confirm(`Void invoice ${inv.invoiceNumber}? This cannot be undone.`)) return;
    setVoiding(true);
    try { await api.post(`/saas-revenue/invoices/${inv.id}/void`, {}); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Void failed'); }
    finally { setVoiding(false); }
  };

  const onPrint = () => {
    if (!inv) return;
    const baseURL = (api.defaults.baseURL || '').replace(/\/$/, '');
    fetch(`${baseURL}/saas-revenue/invoices/${inv.id}/print`, { credentials: 'include' })
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then((html) => {
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, '_blank', 'noopener,noreferrer');
        if (!w) { URL.revokeObjectURL(url); alert('Pop-up blocked. Allow pop-ups to print invoices.'); return; }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      })
      .catch((e) => alert(`Could not open invoice: ${e.message}`));
  };

  const onSend = async () => {
    if (!inv) return;
    const def = (inv as any).billingEmail || '';
    const to = window.prompt('Send invoice to (email):', def);
    if (to === null) return;
    setSending(true);
    try {
      const res = await api.post(`/saas-revenue/invoices/${inv.id}/send-email`, to.trim() ? { to: to.trim() } : {});
      const data = unwrap<{ ok: boolean; to: string }>(res);
      alert(`Sent to ${data?.to || to || '(default recipient)'}`);
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Send failed');
    } finally { setSending(false); }
  };

  if (loading) return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  if (!inv) return <div className="p-6 text-rose-700">{err || 'Invoice not found'}</div>;

  const overdue = inv.status === 'open' && new Date(inv.dueAt) < new Date();
  const balance = inv.totalMinor - inv.amountPaidMinor;
  const pendingCount = (inv.payments || []).filter((p) => p.verificationStatus === 'pending_verification').length;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <button onClick={() => nav('/system/saas-invoices')} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"><ArrowLeft className="w-4 h-4" /> Back to invoices</button>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><Printer className="w-4 h-4" /> Print / PDF</button>
          <button onClick={onSend} disabled={sending} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"><Mail className="w-4 h-4" /> {sending ? 'Sending...' : 'Send by email'}</button>
          {inv.status === 'open' && (
            <button onClick={() => setShowPay(true)} className="inline-flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"><Plus className="w-4 h-4" /> Record payment</button>
          )}
          {(inv.status === 'open' || inv.status === 'draft') && (
            <button onClick={onVoid} disabled={voiding} className="inline-flex items-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded text-sm hover:bg-rose-50 disabled:opacity-50"><Ban className="w-4 h-4" /> {voiding ? 'Voiding...' : 'Void'}</button>
          )}
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wider">Invoice</div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{inv.invoiceNumber}</h1>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs ${INVOICE_STATUS_STYLES[inv.status]}`}>{inv.status}</span>
              {overdue && <span className="inline-flex items-center text-xs text-amber-700"><AlertTriangle className="w-3 h-3 mr-0.5" />overdue</span>}
              {inv.status === 'paid' && <span className="inline-flex items-center text-xs text-emerald-700"><CheckCircle className="w-3 h-3 mr-0.5" />settled</span>}
              {pendingCount > 0 && <span className="inline-flex items-center text-xs text-amber-700"><AlertTriangle className="w-3 h-3 mr-0.5" />{pendingCount} payment{pendingCount > 1 ? 's' : ''} pending verification</span>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500 uppercase tracking-wider">Balance due</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">{fmtMoney(balance, inv.currency)}</div>
            <div className="text-xs text-gray-500 mt-1">of {fmtMoney(inv.totalMinor, inv.currency)} total</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6 pt-6 border-t">
          <Field label="Tenant" value={
            inv.tenant ? (<><div className="font-medium">{inv.tenant.name}</div><div className="text-xs text-gray-500 font-mono">{inv.tenant.slug}</div></>) : <span className="font-mono text-xs">{inv.tenantId.slice(0, 8)}...</span>
          } />
          <Field label="Issued" value={fmtDate(inv.issuedAt)} />
          <Field label="Due" value={fmtDate(inv.dueAt)} />
          {inv.paidAt && <Field label="Paid" value={fmtDate(inv.paidAt)} />}
          {inv.periodStart && <Field label="Period" value={`${fmtDate(inv.periodStart)} - ${fmtDate(inv.periodEnd)}`} />}
          <Field label="Subscription" value={<Link to={`/system/subscriptions/${inv.subscriptionId}`} className="text-blue-600 inline-flex items-center gap-1 hover:underline">Open <ExternalLink className="w-3 h-3" /></Link>} />
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b font-semibold text-sm text-gray-700">Line items</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr><th className="text-left px-4 py-2">Description</th><th className="text-right px-4 py-2">Qty</th><th className="text-right px-4 py-2">Unit price</th><th className="text-right px-4 py-2">Amount</th></tr>
          </thead>
          <tbody>
            {(inv.lines || []).map((l, i) => (
              <tr key={i} className="border-t"><td className="px-4 py-2">{l.description}</td><td className="px-4 py-2 text-right">{l.quantity}</td><td className="px-4 py-2 text-right">{fmtMoney(l.unitPriceMinor, inv.currency)}</td><td className="px-4 py-2 text-right">{fmtMoney(l.amountMinor, inv.currency)}</td></tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 text-sm">
            <tr><td colSpan={3} className="px-4 py-2 text-right">Subtotal</td><td className="px-4 py-2 text-right">{fmtMoney(inv.subtotalMinor, inv.currency)}</td></tr>
            {inv.discountMinor > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right">Discount</td><td className="px-4 py-2 text-right">-{fmtMoney(inv.discountMinor, inv.currency)}</td></tr>}
            {inv.taxMinor > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right">Tax</td><td className="px-4 py-2 text-right">{fmtMoney(inv.taxMinor, inv.currency)}</td></tr>}
            <tr className="font-bold"><td colSpan={3} className="px-4 py-2 text-right">Total</td><td className="px-4 py-2 text-right">{fmtMoney(inv.totalMinor, inv.currency)}</td></tr>
            {inv.amountPaidMinor > 0 && <tr><td colSpan={3} className="px-4 py-2 text-right">Paid</td><td className="px-4 py-2 text-right">-{fmtMoney(inv.amountPaidMinor, inv.currency)}</td></tr>}
            {balance > 0 && <tr className="font-bold text-amber-700"><td colSpan={3} className="px-4 py-2 text-right">Balance due</td><td className="px-4 py-2 text-right">{fmtMoney(balance, inv.currency)}</td></tr>}
          </tfoot>
        </table>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <div className="px-6 py-3 border-b font-semibold text-sm text-gray-700">Payment history</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr><th className="text-left px-4 py-2">Date</th><th className="text-left px-4 py-2">Gateway</th><th className="text-left px-4 py-2">Method</th><th className="text-left px-4 py-2">Reference</th><th className="text-right px-4 py-2">Amount</th><th className="text-left px-4 py-2">Status</th><th className="text-left px-4 py-2">Verification</th><th></th></tr>
          </thead>
          <tbody>
            {(inv.payments || []).map((p) => {
              const refunded = Number(p.gatewayPayload?.refundedMinor || 0);
              const refundable = Math.max(0, p.amountMinor - refunded);
              const paymentProofs = proofs[p.id] || [];
              const vs = (p.verificationStatus || 'unverified') as PaymentVerificationStatus;
              return (
                <tr key={p.id} className="border-t align-top">
                  <td className="px-4 py-2">{fmtDate(p.paidAt)}</td>
                  <td className="px-4 py-2 capitalize">{p.gateway}</td>
                  <td className="px-4 py-2">{p.method || '-'}</td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{p.gatewayRef || '-'}</td>
                  <td className="px-4 py-2 text-right font-medium">
                    {fmtMoney(p.amountMinor, p.currency)}
                    {refunded > 0 && <div className="text-[10px] text-red-600 font-normal">- {fmtMoney(refunded, p.currency)} refunded</div>}
                  </td>
                  <td className="px-4 py-2 capitalize">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${p.status === 'refunded' ? 'bg-red-100 text-red-700' : p.status === 'succeeded' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${VERIFICATION_STATUS_STYLES[vs]}`}>{VERIFICATION_STATUS_LABELS[vs]}</span>
                    {p.verifiedAt && <div className="text-[10px] text-gray-500 mt-0.5">{fmtDateTime(p.verifiedAt)}</div>}
                    {p.verificationNotes && <div className="text-[10px] text-gray-500 mt-0.5 italic">{p.verificationNotes}</div>}
                  </td>
                  <td className="px-4 py-2 text-right space-y-1">
                    <div className="flex flex-wrap items-center gap-1 justify-end">
                      {refundable > 0 && p.status === 'succeeded' && (
                        <button
                          onClick={async () => {
                            const amtStr = window.prompt(`Refund amount (max ${fmtMoney(refundable, p.currency)}). Enter full amount in ${p.currency} (not minor units), or leave blank for full refund:`);
                            if (amtStr === null) return;
                            const reason = window.prompt('Reason (optional):') || '';
                            let amountMinor: number | undefined;
                            if (amtStr.trim()) {
                              const v = parseFloat(amtStr.trim());
                              if (!isFinite(v) || v <= 0) { alert('Invalid amount'); return; }
                              amountMinor = Math.round(v * 100);
                            }
                            try {
                              await api.post(`/saas-revenue/payments/${p.id}/refund`, { amountMinor, reason });
                              await load();
                            } catch (e: any) { alert(e?.response?.data?.message || 'Refund failed'); }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-700 text-xs rounded hover:bg-red-50"
                        >
                          <Undo2 className="w-3 h-3" /> Refund
                        </button>
                      )}
                      {vs === 'pending_verification' && (
                        <>
                          <button
                            onClick={async () => {
                              const notes = window.prompt('Verification notes (optional):') ?? '';
                              try {
                                await api.post(`/saas-revenue/payments/${p.id}/verify`, { status: 'verified', notes: notes || undefined });
                                await load();
                              } catch (e: any) { alert(e?.response?.data?.message || 'Verify failed'); }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 border border-emerald-200 text-emerald-700 text-xs rounded hover:bg-emerald-50"
                          >
                            <ShieldCheck className="w-3 h-3" /> Verify
                          </button>
                          <button
                            onClick={async () => {
                              const notes = window.prompt('Rejection reason:');
                              if (notes === null) return;
                              try {
                                await api.post(`/saas-revenue/payments/${p.id}/verify`, { status: 'rejected', notes: notes || undefined });
                                await load();
                              } catch (e: any) { alert(e?.response?.data?.message || 'Reject failed'); }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 border border-red-200 text-red-700 text-xs rounded hover:bg-red-50"
                          >
                            <ShieldX className="w-3 h-3" /> Reject
                          </button>
                        </>
                      )}
                    </div>
                    {/* Proof section */}
                    <PaymentProofSection paymentId={p.id} proofs={paymentProofs} onReload={load} />
                  </td>
                </tr>
              );
            })}
            {(!inv.payments || inv.payments.length === 0) && <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-500">No payments recorded</td></tr>}
          </tbody>
        </table>
      </div>

      {inv.memo && <div className="bg-amber-50 border border-amber-200 rounded p-4 text-sm text-amber-900"><strong>Memo:</strong> {inv.memo}</div>}

      {showPay && <RecordPaymentModal invoice={inv} balance={balance} onClose={() => setShowPay(false)} onSaved={async () => { setShowPay(false); await load(); }} />}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-sm text-gray-900">{value}</div>
    </div>
  );
}

function PaymentProofSection({ paymentId, proofs, onReload }: { paymentId: string; proofs: PaymentProof[]; onReload: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const baseURL = (api.defaults.baseURL || '').replace(/\/$/, '');

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/saas-revenue/payments/${paymentId}/proofs`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onReload();
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); }
  };

  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-1">
      {proofs.length > 0 && (
        <div className="space-y-1 mb-1">
          {proofs.map((proof) => {
            const isImage = proof.fileType.startsWith('image/');
            return (
              <a
                key={proof.id}
                href={`${baseURL}/saas-revenue/payment-proofs/${proof.id}/download${isImage ? '?inline=1' : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-blue-600 hover:underline"
                title={`${proof.originalFilename} (${fmtSize(proof.fileSize)})`}
              >
                {isImage ? <Image className="w-3 h-3 flex-shrink-0" /> : <FileText className="w-3 h-3 flex-shrink-0" />}
                <span className="truncate max-w-[120px]">{proof.originalFilename}</span>
                <Download className="w-2.5 h-2.5 flex-shrink-0" />
              </a>
            );
          })}
        </div>
      )}
      <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden" onChange={(e) => { if (e.target.files?.[0]) upload(e.target.files[0]); e.target.value = ''; }} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] border border-dashed border-gray-300 text-gray-500 rounded hover:bg-gray-50 disabled:opacity-50"
      >
        <Upload className="w-3 h-3" /> {uploading ? 'Uploading...' : 'Attach proof'}
      </button>
    </div>
  );
}

function RecordPaymentModal({ invoice, balance, onClose, onSaved }: { invoice: InvoiceDetail; balance: number; onClose: () => void; onSaved: () => void }) {
  const [amountMinor, setAmountMinor] = useState<number>(balance);
  const [gateway, setGateway] = useState<string>('manual');
  const [method, setMethod] = useState<string>('bank');
  const [gatewayRef, setGatewayRef] = useState<string>('');
  const [paidAt, setPaidAt] = useState<string>(new Date().toISOString().slice(0, 16));
  const [notes, setNotes] = useState<string>('');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (amountMinor <= 0) { setErr('Amount must be greater than zero'); return; }
    setErr(null); setSaving(true);
    try {
      const res = await api.post(`/saas-revenue/invoices/${invoice.id}/payments`, {
        amountMinor, currency: invoice.currency, gateway, method, gatewayRef: gatewayRef || undefined,
        paidAt: new Date(paidAt).toISOString(), notes: notes || undefined,
      });
      const payment = unwrap<{ id: string }>(res);
      // Upload proof if provided
      if (proofFile && payment?.id) {
        const fd = new FormData();
        fd.append('file', proofFile);
        await api.post(`/saas-revenue/payments/${payment.id}/proofs`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).catch(() => {});
      }
      onSaved();
    } catch (e: any) { setErr(e?.response?.data?.message || 'Failed to record payment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-lg w-full max-w-lg p-6 space-y-4">
        <h2 className="text-lg font-bold">Record payment for {invoice.invoiceNumber}</h2>
        {gateway === 'manual' && (
          <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded p-2">
            Manual payments start as "Pending Verification" and require a second admin to verify.
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2"><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Amount ({invoice.currency})</div>
            <input type="number" min={1} value={amountMinor} onChange={(e) => setAmountMinor(parseInt(e.target.value || '0', 10))} className="w-full border rounded px-3 py-2" />
            <div className="text-xs text-gray-500 mt-1">Outstanding balance: {fmtMoney(balance, invoice.currency)}</div>
          </label>
          <label><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Gateway</div>
            <select value={gateway} onChange={(e) => setGateway(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="manual">Manual</option><option value="bank">Bank transfer</option><option value="cash">Cash</option>
              <option value="momo">Mobile money</option><option value="flutterwave">Flutterwave</option><option value="stripe">Stripe</option>
            </select>
          </label>
          <label><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Method</div>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border rounded px-3 py-2">
              <option value="bank">Bank</option><option value="cash">Cash</option><option value="card">Card</option><option value="momo">Mobile money</option><option value="cheque">Cheque</option>
            </select>
          </label>
          <label className="col-span-2"><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Reference (transaction / receipt #)</div>
            <input value={gatewayRef} onChange={(e) => setGatewayRef(e.target.value)} className="w-full border rounded px-3 py-2" placeholder="e.g. MTN-TXN-123456" />
          </label>
          <label className="col-span-2"><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Paid at</div>
            <input type="datetime-local" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} className="w-full border rounded px-3 py-2" />
          </label>
          <label className="col-span-2"><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Payment proof (bank slip, receipt)</div>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setProofFile(e.target.files?.[0] || null)} className="w-full border rounded px-3 py-2 text-xs" />
            {proofFile && <div className="text-xs text-gray-500 mt-1">{proofFile.name} ({(proofFile.size / 1024).toFixed(0)} KB)</div>}
          </label>
          <label className="col-span-2"><div className="text-xs font-semibold uppercase text-gray-700 mb-1">Notes</div>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded px-3 py-2" />
          </label>
        </div>
        {err && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{err}</div>}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <button onClick={onClose} className="px-3 py-2 border rounded text-sm hover:bg-gray-50">Cancel</button>
          <button onClick={submit} disabled={saving} className="px-3 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50">{saving ? 'Saving...' : 'Record payment'}</button>
        </div>
      </div>
    </div>
  );
}
