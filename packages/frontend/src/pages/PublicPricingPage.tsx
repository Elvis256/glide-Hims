import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';

interface Plan {
  id: string; code: string; name: string; description: string | null;
  tier: string; priceMonthlyMinor: number; priceAnnualMinor: number; currency: string;
  annualDiscountPercent: number; trialDays: number; maxUsers: number | null; maxFacilities: number | null;
  enabledModules: string[] | null; features: any;
}

const fmt = (m: number, cur: string) => {
  try { return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(m / 100); }
  catch { return `${cur} ${(m / 100).toLocaleString()}`; }
};

export default function PublicPricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  useEffect(() => {
    const base = (import.meta as any).env?.VITE_API_URL || '/api/v1';
    axios.get(`${base}/saas-revenue/public/plans`)
      .then((r) => setPlans(r.data?.data ?? r.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="px-6 py-5 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="font-bold text-xl text-blue-700">Glide-HIMS</Link>
          <div className="flex gap-3 text-sm">
            <Link to="/login" className="text-gray-600 hover:text-gray-900">Sign in</Link>
            <Link to="/register" className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700">Get started</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-14">
        <div className="text-center max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900">Simple, transparent pricing</h1>
          <p className="mt-3 text-gray-600">Pick the plan that fits your facility. Switch or cancel anytime.</p>
          <div className="mt-6 inline-flex bg-white border rounded-full p-1 shadow-sm">
            <button onClick={() => setInterval('monthly')} className={`px-4 py-1.5 text-sm rounded-full ${interval === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>Monthly</button>
            <button onClick={() => setInterval('annual')} className={`px-4 py-1.5 text-sm rounded-full ${interval === 'annual' ? 'bg-blue-600 text-white' : 'text-gray-600'}`}>
              Annual {plans.some((p) => p.annualDiscountPercent > 0) && <span className="text-xs ml-1 text-emerald-600">save</span>}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center mt-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : plans.length === 0 ? (
          <div className="text-center mt-16 text-gray-500">No public plans available yet — please <Link to="/contact" className="text-blue-600">contact sales</Link>.</div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {plans.map((p) => {
              const price = interval === 'annual' ? p.priceAnnualMinor : p.priceMonthlyMinor;
              const isFree = price === 0;
              const isFeatured = p.tier === 'professional';
              return (
                <div key={p.id} className={`rounded-2xl border-2 p-6 bg-white relative ${isFeatured ? 'border-blue-500 shadow-lg' : 'border-gray-200'}`}>
                  {isFeatured && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">Most popular</div>}
                  <h3 className="text-xl font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 min-h-[40px]">{p.description}</p>
                  <div className="mt-5">
                    <span className="text-4xl font-bold">{isFree ? 'Free' : fmt(price, p.currency)}</span>
                    {!isFree && <span className="text-sm text-gray-500 ml-1">/{interval === 'annual' ? 'year' : 'month'}</span>}
                  </div>
                  {p.trialDays > 0 && <div className="text-xs text-emerald-700 mt-1">{p.trialDays}-day free trial</div>}
                  <ul className="mt-5 space-y-2 text-sm text-gray-700">
                    {p.maxUsers != null && <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5" />Up to <b>{p.maxUsers}</b> users</li>}
                    {p.maxFacilities != null && <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5" />{p.maxFacilities === 1 ? 'Single facility' : `${p.maxFacilities} facilities`}</li>}
                    {(p.enabledModules || []).slice(0, 6).map((m) => <li key={m} className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5" />{m.charAt(0).toUpperCase() + m.slice(1)} module</li>)}
                    {p.features?.support && <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5" />{String(p.features.support).charAt(0).toUpperCase() + String(p.features.support).slice(1)} support</li>}
                    {p.features?.sla && <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5" />SLA: {p.features.sla}</li>}
                    {p.features?.backups && <li className="flex items-start gap-2"><Check className="w-4 h-4 text-emerald-600 mt-0.5" />{String(p.features.backups).charAt(0).toUpperCase() + String(p.features.backups).slice(1)} backups</li>}
                  </ul>
                  <Link to={`/contact?plan=${p.code}&interval=${interval}`} className={`mt-6 block text-center py-2.5 rounded-lg font-medium ${isFeatured ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-gray-300 hover:bg-gray-50'}`}>{isFree ? 'Start free' : 'Talk to sales'}</Link>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-16 text-center text-sm text-gray-500">
          Need a custom enterprise plan? <Link to="/contact" className="text-blue-600">Contact us</Link>.
        </div>
      </main>
    </div>
  );
}
