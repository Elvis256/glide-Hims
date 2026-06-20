import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Edit2, Trash2, Eye, EyeOff, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import SystemPagination from '../../components/SystemPagination';
import { Plan, fmtMoney, unwrap } from './saas/_shared';

const EMPTY: Partial<Plan> = {
  code: '', name: '', description: '', tier: 'professional',
  priceMonthlyMinor: 0, priceAnnualMinor: 0, currency: 'UGX',
  annualDiscountPercent: 0, trialDays: 14,
  maxUsers: 50, maxFacilities: 1,
  enabledModules: [], features: {},
  isActive: true, isPublic: true, sortOrder: 10,
};

export default function SystemPlansPage() {
  const [items, setItems] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<Partial<Plan> | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/plans', { params: showInactive ? { includeInactive: 'true' } : {} });
      setItems(unwrap<Plan[]>(r) || []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load plans');
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [showInactive]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const payload = {
        ...edit,
        enabledModules: typeof (edit as any).enabledModules === 'string'
          ? (edit as any).enabledModules.split(',').map((s: string) => s.trim()).filter(Boolean)
          : edit.enabledModules,
        features: typeof (edit as any).features === 'string'
          ? JSON.parse((edit as any).features || '{}')
          : edit.features,
      };
      if ((edit as any).id) {
        await api.put(`/saas-revenue/plans/${(edit as any).id}`, payload);
      } else {
        await api.post('/saas-revenue/plans', payload);
      }
      setEdit(null);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const paginatedItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const remove = async (id: string) => {
    if (!confirm('Delete plan? Subscriptions will be blocked if any are still on it.')) return;
    try {
      await api.delete(`/saas-revenue/plans/${id}`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Plans</h1>
          <p className="text-sm text-gray-500">Catalog of subscription plans you sell to tenants</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Show inactive
          </label>
          <button onClick={() => setEdit({ ...EMPTY })}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700">
            <Plus className="w-4 h-4" /> New plan
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedItems.map((p) => (
            <div key={p.id} className={`border rounded-lg bg-white p-5 ${!p.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-semibold">{p.name}</div>
                  <div className="text-xs uppercase tracking-wide text-gray-500">{p.tier} · {p.code}</div>
                </div>
                <div className="flex gap-1">
                  {p.isPublic ? <Eye className="w-4 h-4 text-emerald-600" titleAccess="Public" /> : <EyeOff className="w-4 h-4 text-gray-400" titleAccess="Private" />}
                </div>
              </div>
              {p.description && <p className="text-sm text-gray-600 mt-2">{p.description}</p>}
              <div className="mt-4 space-y-1 text-sm">
                <div><span className="text-gray-500">Monthly:</span> <span className="font-medium">{fmtMoney(p.priceMonthlyMinor, p.currency)}</span></div>
                <div><span className="text-gray-500">Annual:</span> <span className="font-medium">{fmtMoney(p.priceAnnualMinor, p.currency)}</span> {p.annualDiscountPercent > 0 && <span className="text-emerald-600 text-xs">(save {p.annualDiscountPercent}%)</span>}</div>
                <div><span className="text-gray-500">Trial:</span> {p.trialDays}d · <span className="text-gray-500">Users:</span> {p.maxUsers ?? '∞'} · <span className="text-gray-500">Facilities:</span> {p.maxFacilities ?? '∞'}</div>
                {p.enabledModules && p.enabledModules.length > 0 && (
                  <div className="text-xs text-gray-500 mt-2">Modules: {p.enabledModules.join(', ')}</div>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => setEdit({ ...p, enabledModules: p.enabledModules ?? [] } as any)} className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 hover:bg-gray-50"><Edit2 className="w-3 h-3" /> Edit</button>
                <button onClick={() => remove(p.id)} className="text-xs px-2 py-1 border rounded inline-flex items-center gap-1 text-red-600 hover:bg-red-50"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && (
        <SystemPagination page={page} pageSize={pageSize} total={items.length} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
      )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setEdit(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{(edit as any).id ? 'Edit plan' : 'New plan'}</h2>
              <button onClick={() => setEdit(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Code (slug)"><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></Field>
              <Field label="Name"><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Tier">
                <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.tier || 'professional'} onChange={(e) => setEdit({ ...edit, tier: e.target.value as any })}>
                  <option value="community">community</option>
                  <option value="standard">standard</option>
                  <option value="professional">professional</option>
                  <option value="enterprise">enterprise</option>
                </select>
              </Field>
              <Field label="Currency"><input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.currency || 'UGX'} onChange={(e) => setEdit({ ...edit, currency: e.target.value })} /></Field>
              <Field label={`Monthly price (minor — e.g. 1500000 = ${edit.currency} 15,000.00)`}><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.priceMonthlyMinor ?? 0} onChange={(e) => setEdit({ ...edit, priceMonthlyMinor: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Annual price (minor)"><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.priceAnnualMinor ?? 0} onChange={(e) => setEdit({ ...edit, priceAnnualMinor: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Annual discount %"><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.annualDiscountPercent ?? 0} onChange={(e) => setEdit({ ...edit, annualDiscountPercent: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Trial days"><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.trialDays ?? 0} onChange={(e) => setEdit({ ...edit, trialDays: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Max users"><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.maxUsers ?? 0} onChange={(e) => setEdit({ ...edit, maxUsers: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Max facilities"><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.maxFacilities ?? 0} onChange={(e) => setEdit({ ...edit, maxFacilities: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Sort order"><input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={edit.sortOrder ?? 0} onChange={(e) => setEdit({ ...edit, sortOrder: parseInt(e.target.value || '0', 10) })} /></Field>
              <Field label="Enabled modules (comma-separated)" wide>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={Array.isArray(edit.enabledModules) ? edit.enabledModules.join(', ') : (edit.enabledModules || '')}
                  onChange={(e) => setEdit({ ...edit, enabledModules: e.target.value as any })} />
              </Field>
              <Field label="Description" wide><textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[60px]" value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
              <Field label="Features (JSON)" wide>
                <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[80px] font-mono text-xs" value={typeof edit.features === 'string' ? edit.features : JSON.stringify(edit.features ?? {}, null, 2)}
                  onChange={(e) => setEdit({ ...edit, features: e.target.value as any })} />
              </Field>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Active</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.isPublic} onChange={(e) => setEdit({ ...edit, isPublic: e.target.checked })} /> Public (pricing page)</label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="px-3 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-3 py-2 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'col-span-2' : ''}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  );
}
