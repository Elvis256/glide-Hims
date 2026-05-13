import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Check, X, Tag, CheckCircle, Clock, Activity, Pencil, Power, Users, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import { Coupon, fmtMoney, fmtDate, fmtDateTime, unwrap } from './saas/_shared';

type Filter = 'all' | 'active' | 'inactive' | 'expired' | 'exhausted';

interface RedemptionRow {
  id: string;
  tenantId: string;
  tenant: { id: string; name: string; slug: string } | null;
  planId: string;
  billingInterval: string;
  status: string;
  discountPercent: number;
  discountFixedMinor: number;
  createdAt: string;
}

export default function SystemCouponsPage() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState<(Partial<Coupon> & { id?: string }) | null>(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [redemptionsOf, setRedemptionsOf] = useState<Coupon | null>(null);
  const [redemptions, setRedemptions] = useState<RedemptionRow[]>([]);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/saas-revenue/coupons'); setItems(unwrap<Coupon[]>(r) || []); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const now = Date.now();
  const isExpired = (c: Coupon) => !!c.expiresAt && new Date(c.expiresAt).getTime() < now;
  const isExhausted = (c: Coupon) => !!c.maxRedemptions && c.timesRedeemed >= c.maxRedemptions;

  const stats = useMemo(() => {
    const total = items.length;
    let active = 0, expired = 0, exhausted = 0, redemptions = 0;
    for (const c of items) {
      redemptions += c.timesRedeemed || 0;
      if (isExpired(c)) expired++;
      else if (isExhausted(c)) exhausted++;
      else if (c.isActive) active++;
    }
    return { total, active, expired, exhausted, redemptions };
  }, [items]);

  const visible = useMemo(() => items.filter((c) => {
    switch (filter) {
      case 'active':    return c.isActive && !isExpired(c) && !isExhausted(c);
      case 'inactive':  return !c.isActive;
      case 'expired':   return isExpired(c);
      case 'exhausted': return isExhausted(c);
      default:          return true;
    }
  }), [items, filter]);

  const save = async () => {
    if (!edit) return;
    setSaving(true);
    try {
      const payload: any = { ...edit };
      // strip readonly
      delete payload.id; delete payload.timesRedeemed; delete payload.createdAt;
      if (edit.id) await api.put(`/saas-revenue/coupons/${edit.id}`, payload);
      else await api.post('/saas-revenue/coupons', payload);
      setEdit(null); await load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete coupon? This cannot be undone (existing subscriptions keep their discount).')) return;
    await api.delete(`/saas-revenue/coupons/${id}`); await load();
  };

  const toggleActive = async (c: Coupon) => {
    setTogglingId(c.id);
    try {
      await api.put(`/saas-revenue/coupons/${c.id}`, { isActive: !c.isActive });
      await load();
    } catch (e: any) { alert(e?.response?.data?.message || 'Toggle failed'); }
    finally { setTogglingId(null); }
  };

  const openRedemptions = async (c: Coupon) => {
    setRedemptionsOf(c); setRedemptions([]); setRedemptionsLoading(true);
    try {
      const r = await api.get(`/saas-revenue/coupons/${c.id}/redemptions`);
      const data = unwrap<{ subscriptions: RedemptionRow[] }>(r);
      setRedemptions(data?.subscriptions || []);
    } finally { setRedemptionsLoading(false); }
  };

  const StatCard = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: number | string; tone: string }) => (
    <div className="bg-white border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500 uppercase tracking-wider">{label}</div>
        <Icon className={`w-4 h-4 ${tone}`} />
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );

  const Chip = ({ id, label, count }: { id: Filter; label: string; count: number }) => (
    <button onClick={() => setFilter(id)} className={`px-3 py-1 rounded-full text-xs border ${filter === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>
      {label} <span className="opacity-70">({count})</span>
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Coupons</h1>
          <p className="text-sm text-gray-500">Promo codes that discount new subscriptions</p>
        </div>
        <button onClick={() => setEdit({ code: '', discountType: 'percent', amount: 10, currency: 'UGX', isActive: true })} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"><Plus className="w-4 h-4" /> New coupon</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Tag} label="Total coupons" value={stats.total} tone="text-gray-400" />
        <StatCard icon={CheckCircle} label="Active" value={stats.active} tone="text-emerald-600" />
        <StatCard icon={Clock} label="Expired/Exhausted" value={stats.expired + stats.exhausted} tone="text-amber-600" />
        <StatCard icon={Activity} label="Total redemptions" value={stats.redemptions} tone="text-blue-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip id="all"       label="All"       count={stats.total} />
        <Chip id="active"    label="Active"    count={stats.active} />
        <Chip id="inactive"  label="Disabled"  count={items.filter((c) => !c.isActive).length} />
        <Chip id="expired"   label="Expired"   count={stats.expired} />
        <Chip id="exhausted" label="Exhausted" count={stats.exhausted} />
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600"><tr>
              <th className="text-left px-4 py-2">Code</th><th className="text-left px-4 py-2">Discount</th>
              <th className="text-left px-4 py-2">Duration</th><th className="text-left px-4 py-2">Redemptions</th>
              <th className="text-left px-4 py-2">Expires</th><th className="text-left px-4 py-2">Status</th><th></th>
            </tr></thead>
            <tbody>
              {visible.map((c) => {
                const expired = isExpired(c);
                const exhausted = isExhausted(c);
                const status = expired ? { t: 'expired',   k: 'text-amber-700' }
                              : exhausted ? { t: 'exhausted', k: 'text-amber-700' }
                              : c.isActive ? { t: 'active',  k: 'text-emerald-700' }
                              : { t: 'disabled', k: 'text-gray-500' };
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-4 py-2 font-mono">{c.code}</td>
                    <td className="px-4 py-2">{c.discountType === 'percent' ? `${c.amount}%` : fmtMoney(c.amount, c.currency)}</td>
                    <td className="px-4 py-2">{c.durationMonths ? `${c.durationMonths} mo` : 'Forever'}</td>
                    <td className="px-4 py-2">
                      <button onClick={() => openRedemptions(c)} className="text-blue-600 hover:underline inline-flex items-center gap-1">
                        <Users className="w-3 h-3" /> {c.timesRedeemed}{c.maxRedemptions ? `/${c.maxRedemptions}` : ''}
                      </button>
                    </td>
                    <td className="px-4 py-2">{c.expiresAt ? fmtDate(c.expiresAt) : '—'}</td>
                    <td className="px-4 py-2"><span className={`text-xs ${status.k}`}>{status.t}</span></td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => toggleActive(c)} disabled={togglingId === c.id} title={c.isActive ? 'Disable' : 'Enable'} className={`p-1.5 rounded hover:bg-gray-100 ${c.isActive ? 'text-emerald-600' : 'text-gray-400'} disabled:opacity-50`}>
                          {togglingId === c.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Power className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setEdit({ ...c, expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : null })} title="Edit" className="p-1.5 rounded hover:bg-gray-100 text-blue-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(c.id)} title="Delete" className="p-1.5 rounded hover:bg-gray-100 text-rose-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-500">No coupons match this filter</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {edit && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !saving && setEdit(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">{edit.id ? `Edit coupon ${edit.code}` : 'New coupon'}</h2>
              <button onClick={() => setEdit(null)} className="text-gray-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div><div className="text-xs text-gray-500 mb-1">Code (will be uppercased)</div><input className="input w-full" value={edit.code || ''} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-gray-500 mb-1">Discount type</div>
                  <select className="input w-full" value={edit.discountType || 'percent'} onChange={(e) => setEdit({ ...edit, discountType: e.target.value as any })}>
                    <option value="percent">Percent</option>
                    <option value="fixed">Fixed amount</option>
                  </select>
                </div>
                <div><div className="text-xs text-gray-500 mb-1">Amount {edit.discountType === 'percent' ? '(%)' : '(minor units)'}</div><input type="number" className="input w-full" value={edit.amount ?? 0} onChange={(e) => setEdit({ ...edit, amount: parseInt(e.target.value || '0', 10) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><div className="text-xs text-gray-500 mb-1">Max redemptions (optional)</div><input type="number" className="input w-full" value={edit.maxRedemptions ?? ''} onChange={(e) => setEdit({ ...edit, maxRedemptions: e.target.value ? parseInt(e.target.value, 10) : null })} /></div>
                <div><div className="text-xs text-gray-500 mb-1">Duration months (forever if blank)</div><input type="number" className="input w-full" value={edit.durationMonths ?? ''} onChange={(e) => setEdit({ ...edit, durationMonths: e.target.value ? parseInt(e.target.value, 10) : null })} /></div>
              </div>
              <div><div className="text-xs text-gray-500 mb-1">Expires at (YYYY-MM-DD, optional)</div><input className="input w-full" value={edit.expiresAt || ''} onChange={(e) => setEdit({ ...edit, expiresAt: e.target.value || null })} placeholder="2026-12-31" /></div>
              <div><div className="text-xs text-gray-500 mb-1">Notes (internal)</div><input className="input w-full" value={edit.notes || ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></div>
              <label className="flex items-center gap-2"><input type="checkbox" checked={!!edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} /> Active</label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setEdit(null)} className="px-3 py-2 text-sm border rounded hover:bg-gray-50">Cancel</button>
              <button onClick={save} disabled={saving} className="px-3 py-2 text-sm bg-blue-600 text-white rounded inline-flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save</button>
            </div>
            <style>{`.input{border:1px solid #d1d5db;border-radius:6px;padding:6px 10px;font-size:13px}`}</style>
          </div>
        </div>
      )}

      {redemptionsOf && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setRedemptionsOf(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Redemptions for <span className="font-mono">{redemptionsOf.code}</span></h2>
              <button onClick={() => setRedemptionsOf(null)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4">
              {redemptionsLoading ? (
                <div className="text-center py-6 text-gray-400"><Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…</div>
              ) : redemptions.length === 0 ? (
                <div className="text-center py-6 text-gray-400">No subscriptions have used this coupon yet.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-xs text-gray-500"><tr>
                    <th className="text-left py-2">Tenant</th>
                    <th className="text-left py-2">Plan / cycle</th>
                    <th className="text-left py-2">Discount</th>
                    <th className="text-left py-2">Status</th>
                    <th className="text-left py-2">When</th>
                    <th></th>
                  </tr></thead>
                  <tbody>
                    {redemptions.map((s) => (
                      <tr key={s.id} className="border-t">
                        <td className="py-2">{s.tenant?.name || s.tenantId.slice(0, 8) + '…'}</td>
                        <td className="py-2 text-xs">{s.planId.slice(0, 8)}… · {s.billingInterval}</td>
                        <td className="py-2 text-xs">{s.discountPercent ? `${s.discountPercent}%` : fmtMoney(s.discountFixedMinor, redemptionsOf.currency)}</td>
                        <td className="py-2 text-xs">{s.status}</td>
                        <td className="py-2 text-xs text-gray-500">{fmtDateTime(s.createdAt)}</td>
                        <td className="py-2 text-right"><a href={`/system/subscriptions/${s.id}`} className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Open</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
