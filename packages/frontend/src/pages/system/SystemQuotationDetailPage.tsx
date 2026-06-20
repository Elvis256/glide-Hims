import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Send, Check, X, Plus, Trash2, Loader2, FileText,
  RefreshCw, Clock, History,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import {
  Quotation, QuotationRevision, QuotationLineItem, CatalogItem,
  QuotationStatus, QUOTATION_STATUS_STYLES,
  fmtMoney, fmtDate, fmtDateTime, unwrap,
} from './saas/_shared';

export default function SystemQuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'details' | 'revisions'>('details');

  // Form state
  const [form, setForm] = useState({
    clientName: '', clientOrganization: '', clientEmail: '', clientPhone: '', clientCountry: '',
    currency: 'UGX', billingInterval: 'monthly', seats: 1,
    includeVat: true, vatRatePercent: 18, deductWht: false, whtRatePercent: 6,
    discountPercent: 0, discountFixedMinor: 0,
    validUntil: '', notes: '', internalNotes: '', leadId: '', planId: '',
  });
  const [lineItems, setLineItems] = useState<Array<{ catalogItemId?: string; moduleId?: string; description: string; quantity: number; unitPriceMinor: number; category: string }>>([]);

  const loadCatalog = useCallback(async () => {
    try {
      const r = await api.get('/saas-revenue/price-catalog');
      setCatalog(unwrap<CatalogItem[]>(r) || []);
    } catch { /* ok */ }
  }, []);

  const loadQuotation = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    try {
      const r = await api.get(`/saas-revenue/quotations/${id}`);
      const q = unwrap<Quotation>(r);
      setQuotation(q);
      setForm({
        clientName: q.clientName, clientOrganization: q.clientOrganization || '',
        clientEmail: q.clientEmail || '', clientPhone: q.clientPhone || '',
        clientCountry: q.clientCountry || '', currency: q.currency,
        billingInterval: q.billingInterval, seats: q.seats,
        includeVat: q.includeVat, vatRatePercent: parseFloat(q.vatRatePercent) || 18,
        deductWht: q.deductWht, whtRatePercent: parseFloat(q.whtRatePercent) || 6,
        discountPercent: parseFloat(q.discountPercent) || 0,
        discountFixedMinor: q.discountFixedMinor,
        validUntil: q.validUntil ? new Date(q.validUntil).toISOString().slice(0, 10) : '',
        notes: q.notes || '', internalNotes: q.internalNotes || '',
        leadId: q.leadId || '', planId: q.planId || '',
      });
      // Load current revision line items
      const currentRev = q.revisions?.find((r) => r.revisionNumber === q.currentRevisionNumber);
      if (currentRev) {
        setLineItems(currentRev.lineItems.map((l) => ({
          catalogItemId: l.catalogItemId || undefined,
          moduleId: l.moduleId || undefined,
          description: l.description,
          quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor,
          category: l.category,
        })));
      }
    } finally { setLoading(false); }
  }, [id, isNew]);

  useEffect(() => { loadCatalog(); loadQuotation(); }, [loadCatalog, loadQuotation]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        lineItems: lineItems.map((l) => ({
          catalogItemId: l.catalogItemId, moduleId: l.moduleId,
          description: l.description, quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor, category: l.category,
        })),
      };
      if (isNew) {
        const r = await api.post('/saas-revenue/quotations', payload);
        const q = unwrap<Quotation>(r);
        toast.success('Quotation created');
        navigate(`/system/quotations/${q.id}`, { replace: true });
      } else {
        await api.put(`/saas-revenue/quotations/${id}`, payload);
        toast.success('Quotation updated');
        loadQuotation();
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleAction = async (action: 'send' | 'accept' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this quotation?`)) return;
    setSaving(true);
    try {
      if (action === 'reject') {
        const reason = prompt('Rejection reason (optional):') || '';
        await api.post(`/saas-revenue/quotations/${id}/${action}`, { reason });
      } else {
        await api.post(`/saas-revenue/quotations/${id}/${action}`);
      }
      toast.success(`Quotation ${action === 'send' ? 'sent' : action === 'accept' ? 'accepted' : 'rejected'}`);
      loadQuotation();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${action}`);
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this quotation?')) return;
    await api.delete(`/saas-revenue/quotations/${id}`);
    toast.success('Quotation deleted');
    navigate('/system/quotations', { replace: true });
  };

  const handleNewRevision = async () => {
    const changeNotes = prompt('Change notes for new revision:') || '';
    setSaving(true);
    try {
      await api.post(`/saas-revenue/quotations/${id}/revisions`, {
        lineItems: lineItems.map((l) => ({
          catalogItemId: l.catalogItemId, moduleId: l.moduleId,
          description: l.description, quantity: l.quantity,
          unitPriceMinor: l.unitPriceMinor, category: l.category,
        })),
        changeNotes,
      });
      toast.success('New revision created');
      loadQuotation();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create revision');
    } finally { setSaving(false); }
  };

  const addCatalogItem = (item: CatalogItem) => {
    setLineItems([...lineItems, {
      catalogItemId: item.id,
      moduleId: item.code,
      description: item.name,
      quantity: 1,
      unitPriceMinor: item.unitPriceMinor,
      category: item.category,
    }]);
  };

  const addBlankLine = () => {
    setLineItems([...lineItems, { description: '', quantity: 1, unitPriceMinor: 0, category: 'other' }]);
  };

  const updateLine = (idx: number, field: string, value: any) => {
    const updated = [...lineItems];
    (updated[idx] as any)[field] = value;
    setLineItems(updated);
  };

  const removeLine = (idx: number) => {
    setLineItems(lineItems.filter((_, i) => i !== idx));
  };

  // Compute totals locally for preview
  const subtotal = lineItems.reduce((s, l) => s + l.quantity * l.unitPriceMinor, 0);
  const discountAmt = Math.round(subtotal * (form.discountPercent || 0) / 100) + (form.discountFixedMinor || 0);
  const afterDiscount = subtotal - discountAmt;
  const vat = form.includeVat ? Math.round(afterDiscount * form.vatRatePercent / 100) : 0;
  const wht = form.deductWht ? Math.round(afterDiscount * form.whtRatePercent / 100) : 0;
  const total = afterDiscount + vat - wht;
  const isDraft = !quotation || quotation.status === 'draft';

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/system/quotations" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Quotation' : quotation?.quotationNumber}</h1>
          {quotation && <p className="text-sm text-gray-500">Revision v{quotation.currentRevisionNumber} &middot; Created {fmtDate(quotation.createdAt)}</p>}
        </div>
        {quotation && (
          <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${QUOTATION_STATUS_STYLES[quotation.status]}`}>{quotation.status}</span>
        )}
      </div>

      {/* Action bar */}
      {quotation && (
        <div className="flex flex-wrap gap-2">
          {isDraft && <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Save'}</button>}
          {isDraft && <button onClick={() => handleAction('send')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"><Send className="w-4 h-4" /> Send</button>}
          {(quotation.status === 'sent' || quotation.status === 'draft') && (
            <button onClick={() => handleAction('accept')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700"><Check className="w-4 h-4" /> Accept</button>
          )}
          {(quotation.status === 'sent' || quotation.status === 'draft') && (
            <button onClick={() => handleAction('reject')} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"><X className="w-4 h-4" /> Reject</button>
          )}
          {isDraft && <button onClick={handleNewRevision} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 border rounded text-sm hover:bg-gray-50"><History className="w-4 h-4" /> New Revision</button>}
          <a href={`/api/v1/saas-revenue/quotations/${quotation.id}/html`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 border rounded text-sm hover:bg-gray-50"><FileText className="w-4 h-4" /> View PDF</a>
          {isDraft && <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 rounded text-sm hover:bg-red-50"><Trash2 className="w-4 h-4" /> Delete</button>}
        </div>
      )}

      {/* Tabs */}
      {!isNew && (
        <div className="flex gap-1 border-b">
          <button onClick={() => setTab('details')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Details</button>
          <button onClick={() => setTab('revisions')} className={`px-4 py-2 text-sm font-medium border-b-2 ${tab === 'revisions' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>Revisions ({quotation?.revisions?.length || 0})</button>
        </div>
      )}

      {(tab === 'details' || isNew) && (
        <>
          {/* Client Info */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Client Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Client Name *</label><input className="w-full border rounded px-3 py-2 text-sm" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Organization</label><input className="w-full border rounded px-3 py-2 text-sm" value={form.clientOrganization} onChange={(e) => setForm({ ...form, clientOrganization: e.target.value })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Email</label><input type="email" className="w-full border rounded px-3 py-2 text-sm" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Phone</label><input className="w-full border rounded px-3 py-2 text-sm" value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Country</label><input className="w-full border rounded px-3 py-2 text-sm" value={form.clientCountry} onChange={(e) => setForm({ ...form, clientCountry: e.target.value })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Valid Until</label><input type="date" className="w-full border rounded px-3 py-2 text-sm" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} disabled={!isDraft && !isNew} /></div>
            </div>
          </div>

          {/* Billing Terms */}
          <div className="bg-white rounded-lg border p-6">
            <h2 className="text-lg font-semibold mb-4">Billing Terms</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><label className="block text-sm font-medium mb-1">Currency</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} disabled={!isDraft && !isNew}>
                  <option value="UGX">UGX</option><option value="USD">USD</option><option value="KES">KES</option><option value="TZS">TZS</option><option value="RWF">RWF</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Billing Interval</label>
                <select className="w-full border rounded px-3 py-2 text-sm" value={form.billingInterval} onChange={(e) => setForm({ ...form, billingInterval: e.target.value })} disabled={!isDraft && !isNew}>
                  <option value="monthly">Monthly</option><option value="annual">Annual</option>
                </select>
              </div>
              <div><label className="block text-sm font-medium mb-1">Seats</label><input type="number" min={1} className="w-full border rounded px-3 py-2 text-sm" value={form.seats} onChange={(e) => setForm({ ...form, seats: parseInt(e.target.value) || 1 })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Discount %</label><input type="number" min={0} max={100} className="w-full border rounded px-3 py-2 text-sm" value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: parseFloat(e.target.value) || 0 })} disabled={!isDraft && !isNew} /></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.includeVat} onChange={(e) => setForm({ ...form, includeVat: e.target.checked })} disabled={!isDraft && !isNew} /> Include VAT ({form.vatRatePercent}%)</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.deductWht} onChange={(e) => setForm({ ...form, deductWht: e.target.checked })} disabled={!isDraft && !isNew} /> Deduct WHT ({form.whtRatePercent}%)</label>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Line Items</h2>
              {(isDraft || isNew) && (
                <div className="flex gap-2">
                  <button onClick={addBlankLine} className="inline-flex items-center gap-1 px-3 py-1.5 border rounded text-sm hover:bg-gray-50"><Plus className="w-3.5 h-3.5" /> Custom Line</button>
                </div>
              )}
            </div>

            {/* Quick-add from catalog */}
            {(isDraft || isNew) && catalog.length > 0 && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs font-medium text-gray-500 mb-2 uppercase">Add from catalog</p>
                <div className="flex flex-wrap gap-1">
                  {catalog.filter((c) => c.isActive && !lineItems.some((l) => l.catalogItemId === c.id)).map((c) => (
                    <button key={c.id} onClick={() => addCatalogItem(c)} className="px-2 py-1 text-xs bg-white border rounded hover:bg-blue-50 hover:border-blue-300 transition">{c.name}</button>
                  ))}
                </div>
              </div>
            )}

            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Category</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-20">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Unit Price</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase w-32">Amount</th>
                {(isDraft || isNew) && <th className="px-3 py-2 w-10"></th>}
              </tr></thead>
              <tbody className="divide-y divide-gray-100">
                {lineItems.map((line, idx) => (
                  <tr key={idx}>
                    <td className="px-3 py-2">
                      {isDraft || isNew ? (
                        <input className="w-full border rounded px-2 py-1 text-sm" value={line.description} onChange={(e) => updateLine(idx, 'description', e.target.value)} />
                      ) : line.description}
                    </td>
                    <td className="px-3 py-2"><span className="text-xs text-gray-500">{line.category}</span></td>
                    <td className="px-3 py-2 text-right">
                      {isDraft || isNew ? (
                        <input type="number" min={1} className="w-16 border rounded px-2 py-1 text-sm text-right" value={line.quantity} onChange={(e) => updateLine(idx, 'quantity', parseInt(e.target.value) || 1)} />
                      ) : line.quantity}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {isDraft || isNew ? (
                        <input type="number" min={0} className="w-28 border rounded px-2 py-1 text-sm text-right" value={line.unitPriceMinor} onChange={(e) => updateLine(idx, 'unitPriceMinor', parseInt(e.target.value) || 0)} />
                      ) : fmtMoney(line.unitPriceMinor, form.currency)}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{fmtMoney(line.quantity * line.unitPriceMinor, form.currency)}</td>
                    {(isDraft || isNew) && <td className="px-3 py-2"><button onClick={() => removeLine(idx)} className="text-red-500 hover:text-red-700"><Trash2 className="w-3.5 h-3.5" /></button></td>}
                  </tr>
                ))}
                {lineItems.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No line items added yet</td></tr>}
              </tbody>
            </table>

            {/* Totals */}
            <div className="mt-4 flex justify-end">
              <div className="w-72 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="font-medium">{fmtMoney(subtotal, form.currency)}</span></div>
                {discountAmt > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-red-600">-{fmtMoney(discountAmt, form.currency)}</span></div>}
                {vat > 0 && <div className="flex justify-between"><span className="text-gray-500">VAT ({form.vatRatePercent}%)</span><span>{fmtMoney(vat, form.currency)}</span></div>}
                {wht > 0 && <div className="flex justify-between"><span className="text-gray-500">WHT ({form.whtRatePercent}%)</span><span className="text-red-600">-{fmtMoney(wht, form.currency)}</span></div>}
                <div className="flex justify-between pt-2 border-t font-bold text-base"><span>Total</span><span>{fmtMoney(total, form.currency)}</span></div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white rounded-lg border p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium mb-1">Client Notes</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={!isDraft && !isNew} /></div>
              <div><label className="block text-sm font-medium mb-1">Internal Notes</label><textarea className="w-full border rounded px-3 py-2 text-sm" rows={3} value={form.internalNotes} onChange={(e) => setForm({ ...form, internalNotes: e.target.value })} disabled={!isDraft && !isNew} /></div>
            </div>
          </div>

          {/* Save button for new */}
          {isNew && (
            <div className="flex justify-end">
              <button onClick={handleSave} disabled={saving || !form.clientName} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{saving ? 'Creating...' : 'Create Quotation'}</button>
            </div>
          )}

          {/* Subscription link */}
          {quotation?.subscriptionId && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
              <p className="text-sm text-emerald-800 font-medium">This quotation has been accepted and converted to a subscription.</p>
              <Link to={`/system/subscriptions/${quotation.subscriptionId}`} className="text-sm text-emerald-600 hover:underline mt-1 inline-block">View Subscription &rarr;</Link>
            </div>
          )}
        </>
      )}

      {/* Revisions tab */}
      {tab === 'revisions' && quotation && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50"><tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Revision</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Subtotal</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Notes</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {(quotation.revisions || []).sort((a, b) => b.revisionNumber - a.revisionNumber).map((rev) => (
                <tr key={rev.id} className={rev.revisionNumber === quotation.currentRevisionNumber ? 'bg-blue-50' : ''}>
                  <td className="px-4 py-3 font-medium">v{rev.revisionNumber} {rev.revisionNumber === quotation.currentRevisionNumber && <span className="text-xs text-blue-600">(current)</span>}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(rev.subtotalMinor, quotation.currency)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{fmtMoney(rev.totalMinor, quotation.currency)}</td>
                  <td className="px-4 py-3 text-gray-600">{rev.lineItems?.length || 0} items</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{rev.changeNotes || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDateTime(rev.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
