import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, RefreshCw, TrendingUp, Users, AlertTriangle, Calendar, DollarSign, Activity, PlayCircle } from 'lucide-react';
import api from '../../services/api';
import { fmtMoney, fmtDate, unwrap } from './saas/_shared';

interface Dashboard {
  currency: string;
  counts: { active: number; trial: number; pastDue: number; cancelled: number; churned30d: number; total: number };
  mrrMinor: number; arrMinor: number; arpaMinor: number; ltvMinor: number;
  churnRatePct: number; outstandingMinor: number; overdueCount: number;
  monthlyRevenue: Array<{ month: string; totalMinor: number }>;
  topCustomers: Array<{ tenantId: string; totalMinor: number }>;
  planBreakdown: Array<{ planId: string; planName: string; count: number; mrrMinor: number }>;
  forecast: { d30Minor: number; d60Minor: number; d90Minor: number };
  expiringSoon: Array<{ id: string; tenantId: string; planName: string; nextRenewalAt: string; amountMinor: number; currency: string; autoRenew: boolean }>;
}

export default function SystemRevenuePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

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
        <Hero label="MRR" value={fmtMoney(data.mrrMinor, cur)} icon={<TrendingUp className="w-5 h-5" />} accent="emerald" />
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card title="Plan breakdown (active)">
          {data.planBreakdown.length === 0 ? <div className="text-sm text-gray-500">No active subscriptions</div> :
            <table className="w-full text-sm">
              <thead className="text-gray-500 text-xs"><tr><th className="text-left">Plan</th><th className="text-right">Subs</th><th className="text-right">MRR</th></tr></thead>
              <tbody>
                {data.planBreakdown.map((p) => (
                  <tr key={p.planId} className="border-t"><td className="py-2">{p.planName}</td><td className="py-2 text-right">{p.count}</td><td className="py-2 text-right font-medium">{fmtMoney(p.mrrMinor, cur)}</td></tr>
                ))}
              </tbody>
            </table>}
        </Card>

        <Card title="Top customers (lifetime)">
          {data.topCustomers.length === 0 ? <div className="text-sm text-gray-500">No paid invoices yet</div> :
            <ul className="divide-y text-sm">
              {data.topCustomers.map((c) => (
                <li key={c.tenantId} className="py-2 flex items-center justify-between">
                  <span className="font-mono text-xs">{c.tenantId}</span>
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
                  <td className="py-2 font-mono text-xs">{s.tenantId.slice(0, 8)}…</td>
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
    </div>
  );
}

function Hero({ label, value, sub, icon, accent }: { label: string; value: string; sub?: string; icon?: React.ReactNode; accent?: 'emerald' | 'blue' }) {
  const cls = accent === 'emerald' ? 'border-emerald-200 bg-emerald-50' : accent === 'blue' ? 'border-blue-200 bg-blue-50' : 'bg-white';
  return (
    <div className={`border rounded-lg p-5 ${cls}`}>
      <div className="flex items-center justify-between text-gray-600 text-sm">{label}{icon}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
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
