import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, TrendingUp, Users, AlertTriangle, Calendar, DollarSign, Activity, PlayCircle, BarChart3, X } from 'lucide-react';
import api from '../../services/api';
import { fmtMoney, fmtDate, unwrap } from './saas/_shared';

interface Dashboard {
  currency: string;
  counts: { active: number; trial: number; pastDue: number; cancelled: number; churned30d: number; total: number };
  mrrMinor: number; arrMinor: number; arpaMinor: number; ltvMinor: number;
  churnRatePct: number; outstandingMinor: number; overdueCount: number;
  monthlyRevenue: Array<{ month: string; totalMinor: number }>;
  topCustomers: Array<{ tenantId: string; totalMinor: number; tenant?: { id: string; name: string; slug: string } | null }>;
  planBreakdown: Array<{
    planId: string; planName: string; planCode?: string; tier?: string;
    count: number; trialCount: number; churnedCount: number; pastDueCount: number;
    mrrMinor: number; arrMinor: number; lifetimeMinor: number; arpaMinor: number; sharePct: number;
  }>;
  forecast: { d30Minor: number; d60Minor: number; d90Minor: number };
  expiringSoon: Array<{ id: string; tenantId: string; tenant?: { id: string; name: string; slug: string } | null; planName: string; nextRenewalAt: string; amountMinor: number; currency: string; autoRenew: boolean }>;
}

export default function SystemRevenuePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [planDetail, setPlanDetail] = useState<any | null>(null);

  const openPlan = async (planId: string) => {
    setPlanDetail({ loading: true });
    try { const r = await api.get(`/saas-revenue/revenue/plans/${planId}`); setPlanDetail(unwrap<any>(r)); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); setPlanDetail(null); }
  };

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/saas-revenue/revenue/dashboard'); setData(unwrap<Dashboard>(r)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const runCron = async () => {
    setRunning(true);
    try { await api.post('/saas-revenue/cron/run'); await load(); }
    catch (e: any) { alert(e?.response?.data?.message || 'Failed'); }
    finally { setRunning(false); }
  };

  if (loading || !data) return <div className="flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>;

  const cur = data.currency;
  const maxMonthly = Math.max(1, ...data.monthlyRevenue.map((m) => m.totalMinor));

  // MRR sparkline + MoM delta from monthlyRevenue (oldest → newest)
  const series = data.monthlyRevenue;
  const last = series[series.length - 1]?.totalMinor ?? 0;
  const prev = series[series.length - 2]?.totalMinor ?? 0;
  const momDeltaPct = prev > 0 ? ((last - prev) / prev) * 100 : (last > 0 ? 100 : 0);
  const sparkMax = Math.max(1, ...series.map((m) => m.totalMinor));
  const sparkW = 120, sparkH = 32;
  const sparkPts = series.length > 1
    ? series.map((m, i) => `${(i / (series.length - 1)) * sparkW},${sparkH - (m.totalMinor / sparkMax) * (sparkH - 4) - 2}`).join(' ')
    : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Revenue</h1>
          <p className="text-sm text-gray-500">SaaS metrics across all tenants</p>
        </div>
        <div className="flex gap-2">
          <button onClick={runCron} disabled={running} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Run renewal/dunning now
          </button>
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
        </div>
      </div>

      {/* Hero metrics */}
      <div className="grid md:grid-cols-4 gap-4">
        <Hero
          label="MRR"
          value={fmtMoney(data.mrrMinor, cur)}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="emerald"
          spark={sparkPts}
          sparkW={sparkW}
          sparkH={sparkH}
          delta={series.length >= 2 ? momDeltaPct : undefined}
          deltaLabel={series.length >= 2 ? `vs ${series[series.length - 2].month}` : undefined}
        />
        <Hero label="ARR" value={fmtMoney(data.arrMinor, cur)} icon={<Activity className="w-5 h-5" />} accent="blue" />
        <Hero label="ARPA" value={fmtMoney(data.arpaMinor, cur)} sub="Avg revenue / account" icon={<DollarSign className="w-5 h-5" />} />
        <Hero label="LTV" value={fmtMoney(data.ltvMinor, cur)} sub="Customer lifetime value" icon={<Users className="w-5 h-5" />} />
      </div>

      {/* Sub counts */}
      <div className="grid md:grid-cols-6 gap-3">
        <Mini label="Active" value={data.counts.active} color="emerald" link="/system/subscriptions?status=active" />
        <Mini label="Trial" value={data.counts.trial} color="blue" link="/system/subscriptions?status=trial" />
        <Mini label="Past due" value={data.counts.pastDue} color="amber" link="/system/subscriptions?status=past_due" />
        <Mini label="Cancelled" value={data.counts.cancelled} color="gray" link="/system/subscriptions?status=cancelled" />
        <Mini label="Churned 30d" value={data.counts.churned30d} color="red" link="/system/subscriptions?status=churned" />
        <Mini label="Total" value={data.counts.total} color="gray" link="/system/subscriptions" />
      </div>

      {/* Health indicators */}
      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Churn rate (30d)" value={`${data.churnRatePct}%`} accent={data.churnRatePct > 5 ? 'amber' : undefined} />
        <Stat label="Outstanding A/R" value={fmtMoney(data.outstandingMinor, cur)} sub={`${data.overdueCount} overdue`} accent={data.overdueCount > 0 ? 'amber' : undefined} link="/system/saas-invoices?status=open" />
        <Stat label="Forecast next 30d" value={fmtMoney(data.forecast.d30Minor, cur)} sub={`60d: ${fmtMoney(data.forecast.d60Minor, cur)} · 90d: ${fmtMoney(data.forecast.d90Minor, cur)}`} />
      </div>

      {/* Monthly revenue bar chart */}
      <Card title="Last 12 months revenue" icon={<Calendar className="w-4 h-4" />}>
        {data.monthlyRevenue.length === 0 ? <div className="text-sm text-gray-500">No paid invoices yet</div> : (
          <div className="space-y-2">
            {data.monthlyRevenue.map((m) => (
              <div key={m.month} className="flex items-center gap-3">
                <div className="w-20 text-xs text-gray-600">{m.month}</div>
                <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
                  <div className="bg-emerald-500 h-full" style={{ width: `${Math.max(2, (m.totalMinor / maxMonthly) * 100)}%` }} />
                </div>
                <div className="w-32 text-right text-sm font-medium">{fmtMoney(m.totalMinor, cur)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Plan breakdown">
        {data.planBreakdown.length === 0 ? <div className="text-sm text-gray-500">No subscriptions</div> :
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs">
                <tr>
                  <th className="text-left">Plan</th>
                  <th className="text-right">Active</th>
                  <th className="text-right">Trial</th>
                  <th className="text-right">Churned</th>
                  <th className="text-right">MRR</th>
                  <th className="text-right">ARR</th>
                  <th className="text-right">Lifetime</th>
                  <th className="text-right">Share</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.planBreakdown.map((p) => (
                  <tr key={p.planId} className="border-t hover:bg-gray-50">
                    <td className="py-2">
                      <div className="font-medium">{p.planName}</div>
                      {p.tier && <div className="text-[10px] uppercase text-gray-400">{p.tier}</div>}
                    </td>
                    <td className="py-2 text-right">{p.count}</td>
                    <td className="py-2 text-right text-blue-700">{p.trialCount}</td>
                    <td className="py-2 text-right text-rose-700">{p.churnedCount}</td>
                    <td className="py-2 text-right font-medium">{fmtMoney(p.mrrMinor, cur)}</td>
                    <td className="py-2 text-right">{fmtMoney(p.arrMinor, cur)}</td>
                    <td className="py-2 text-right text-emerald-700">{fmtMoney(p.lifetimeMinor, cur)}</td>
                    <td className="py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <div className="w-12 h-1.5 bg-gray-200 rounded overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, p.sharePct)}%` }} />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{p.sharePct.toFixed(1)}%</span>
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button onClick={() => openPlan(p.planId)} className="inline-flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-blue-50 text-blue-700">
                        <BarChart3 className="w-3 h-3" /> Drill in
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </Card>

      <div className="grid md:grid-cols-1 gap-6">
        <Card title="Top customers (lifetime)">
          {data.topCustomers.length === 0 ? <div className="text-sm text-gray-500">No paid invoices yet</div> :
            <ul className="divide-y text-sm">
              {data.topCustomers.map((c) => (
                <li key={c.tenantId} className="py-2 flex items-center justify-between">
                  <div>
                    {c.tenant ? (
                      <>
                        <div className="font-medium">{c.tenant.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{c.tenant.slug}</div>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-gray-500" title={c.tenantId}>{c.tenantId.slice(0, 8)}…</span>
                    )}
                  </div>
                  <span className="font-medium">{fmtMoney(c.totalMinor, cur)}</span>
                </li>
              ))}
            </ul>}
        </Card>
      </div>

      <Card title="Renewing in next 14 days" icon={<AlertTriangle className="w-4 h-4" />}>
        {data.expiringSoon.length === 0 ? <div className="text-sm text-gray-500">Nothing renewing in the next 14 days</div> : (
          <table className="w-full text-sm">
            <thead className="text-gray-500 text-xs"><tr><th className="text-left">Tenant</th><th className="text-left">Plan</th><th className="text-left">Renews</th><th className="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              {data.expiringSoon.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="py-2">
                    {s.tenant ? (
                      <div>
                        <div className="font-medium text-gray-900">{s.tenant.name}</div>
                        <div className="text-xs text-gray-500 font-mono">{s.tenant.slug}</div>
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-gray-500" title={s.tenantId}>{s.tenantId.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="py-2">{s.planName}</td>
                  <td className="py-2">{fmtDate(s.nextRenewalAt)} {!s.autoRenew && <span className="text-xs text-amber-600">(no auto)</span>}</td>
                  <td className="py-2 text-right font-medium">{fmtMoney(s.amountMinor, s.currency)}</td>
                  <td className="py-2 text-right"><Link to={`/system/subscriptions/${s.id}`} className="text-blue-600 text-xs hover:underline">Open</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {planDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPlanDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {planDetail.loading ? (
              <div className="p-8 flex items-center gap-2 text-gray-500"><Loader2 className="w-5 h-5 animate-spin" /> Loading plan analytics…</div>
            ) : (
              <>
                <div className="px-6 py-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                  <div>
                    <div className="text-xs text-gray-500 uppercase">{planDetail.plan?.tier} · {planDetail.plan?.code}</div>
                    <h2 className="text-xl font-bold">{planDetail.plan?.name}</h2>
                  </div>
                  <button onClick={() => setPlanDetail(null)} className="p-1 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
                </div>
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PStat label="MRR" value={fmtMoney(planDetail.mrrMinor, planDetail.plan?.currency || cur)} accent="emerald" />
                    <PStat label="ARR" value={fmtMoney(planDetail.arrMinor, planDetail.plan?.currency || cur)} />
                    <PStat label="ARPA" value={fmtMoney(planDetail.arpaMinor, planDetail.plan?.currency || cur)} />
                    <PStat label="Lifetime revenue" value={fmtMoney(planDetail.lifetimeMinor, planDetail.plan?.currency || cur)} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <PStat label="Active" value={String(planDetail.counts.active)} />
                    <PStat label="Trial" value={String(planDetail.counts.trial)} />
                    <PStat label="Churned (30d)" value={String(planDetail.counts.churned30d)} />
                    <PStat label="Churn rate (30d)" value={`${planDetail.churnRatePct}%`} />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <PStat label="Total subs" value={String(planDetail.counts.total)} />
                    <PStat label="Trial conversion" value={`${planDetail.trialConversionPct}%`} />
                    <PStat label="Outstanding A/R" value={fmtMoney(planDetail.outstandingMinor, planDetail.plan?.currency || cur)} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Last 12 months revenue</h3>
                    {(planDetail.monthlyRevenue || []).length === 0 ? (
                      <div className="text-sm text-gray-500">No paid invoices yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {(() => {
                          const max = Math.max(1, ...planDetail.monthlyRevenue.map((m: any) => m.totalMinor));
                          return planDetail.monthlyRevenue.map((m: any) => (
                            <div key={m.month} className="flex items-center gap-2 text-xs">
                              <span className="w-16 text-gray-500 font-mono">{m.month}</span>
                              <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
                                <div className="h-full bg-blue-500" style={{ width: `${(m.totalMinor / max) * 100}%` }} />
                              </div>
                              <span className="w-28 text-right font-medium">{fmtMoney(m.totalMinor, planDetail.plan?.currency || cur)}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Customers on this plan</h3>
                    {(planDetail.customers || []).length === 0 ? (
                      <div className="text-sm text-gray-500">No customers on this plan.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead className="text-gray-500 text-xs">
                          <tr><th className="text-left">Tenant</th><th className="text-left">Status</th><th className="text-left">Cycle</th><th className="text-right">Seats</th><th className="text-right">MRR</th><th className="text-left">Renews</th></tr>
                        </thead>
                        <tbody>
                          {planDetail.customers.map((c: any) => (
                            <tr key={c.subscriptionId} className="border-t">
                              <td className="py-2">
                                {c.tenant ? (
                                  <div>
                                    <div className="font-medium">{c.tenant.name}</div>
                                    <div className="text-xs text-gray-500 font-mono">{c.tenant.slug}</div>
                                  </div>
                                ) : <span className="font-mono text-xs text-gray-500">{c.tenantId.slice(0, 8)}…</span>}
                              </td>
                              <td className="py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100">{c.status}</span></td>
                              <td className="py-2 text-xs text-gray-600">{c.billingInterval}</td>
                              <td className="py-2 text-right">{c.seats}</td>
                              <td className="py-2 text-right font-medium">{fmtMoney(c.mrrMinor, c.currency)}</td>
                              <td className="py-2 text-xs">{c.nextRenewalAt ? fmtDate(c.nextRenewalAt) : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  <div className="pt-3 border-t flex justify-between">
                    <Link to={`/system/subscriptions?plan=${planDetail.plan?.id}`} className="text-sm text-blue-600 hover:underline">View all subscriptions on this plan →</Link>
                    <button onClick={() => setPlanDetail(null)} className="px-3 py-1.5 text-sm border rounded">Close</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PStat({ label, value, accent }: { label: string; value: string; accent?: 'emerald' | 'blue' }) {
  const cls = accent === 'emerald' ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white';
  return (
    <div className={`border rounded-lg p-3 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
    </div>
  );
}

function Hero({ label, value, sub, icon, accent, spark, sparkW, sparkH, delta, deltaLabel }: { label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: 'emerald' | 'blue'; spark?: string; sparkW?: number; sparkH?: number; delta?: number; deltaLabel?: string }) {
  const cls = accent === 'emerald' ? 'border-emerald-200 bg-emerald-50' : accent === 'blue' ? 'border-blue-200 bg-blue-50' : 'bg-white';
  const stroke = accent === 'emerald' ? '#059669' : accent === 'blue' ? '#2563eb' : '#374151';
  const deltaUp = (delta ?? 0) >= 0;
  return (
    <div className={`border rounded-lg p-5 ${cls}`}>
      <div className="flex items-center justify-between text-gray-600 text-sm">{label}{icon}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      {typeof delta === 'number' && (
        <div className={`text-xs mt-1 inline-flex items-center gap-1 ${deltaUp ? 'text-emerald-700' : 'text-rose-700'}`}>
          <span>{deltaUp ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%</span>
          {deltaLabel && <span className="text-gray-500">· {deltaLabel}</span>}
        </div>
      )}
      {spark && sparkW && sparkH && (
        <svg width={sparkW} height={sparkH} className="mt-1 block">
          <polyline fill="none" stroke={stroke} strokeWidth="1.5" points={spark} />
        </svg>
      )}
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
}

function Mini({ label, value, color, link }: { label: string; value: number; color: string; link?: string }) {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    blue: 'text-blue-700 bg-blue-50 border-blue-200',
    amber: 'text-amber-700 bg-amber-50 border-amber-200',
    red: 'text-red-700 bg-red-50 border-red-200',
    gray: 'text-gray-700 bg-gray-50 border-gray-200',
  };
  const inner = (
    <div className={`border rounded-lg px-3 py-2 ${colors[color]}`}>
      <div className="text-xs">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
  return link ? <Link to={link} className="hover:opacity-80 transition">{inner}</Link> : inner;
}

function Stat({ label, value, sub, accent, link }: { label: string; value: string; sub?: string; accent?: 'amber'; link?: string }) {
  const cls = accent === 'amber' ? 'border-amber-300 bg-amber-50' : 'bg-white';
  const body = (
    <div className={`border rounded-lg p-4 ${cls}`}>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  );
  return link ? <Link to={link}>{body}</Link> : body;
}

function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2 text-sm font-medium text-gray-700">{icon}{title}</div>
      <div className="p-4">{children}</div>
    </div>
  );
}
