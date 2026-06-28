import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, Loader2, Heart, AlertTriangle, Activity } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { ClientHealth, HealthStatus, HEALTH_STATUS_STYLES, unwrap } from './saas/_shared';

export default function SystemClientHealthPage() {
  const [scores, setScores] = useState<ClientHealth[]>([]);
  const [dashboard, setDashboard] = useState<{ total: number; healthy: number; atRisk: number; critical: number; avgScore: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recalculating, setRecalculating] = useState(false);
  const [showRecalcConfirm, setShowRecalcConfirm] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filteredScores = useMemo(() => {
    if (!debouncedSearch) return scores;
    const q = debouncedSearch.toLowerCase();
    return scores.filter((s) =>
      s.tenantId.toLowerCase().includes(q) ||
      (s.tenant?.name || '').toLowerCase().includes(q) ||
      String(s.overallScore).includes(q) ||
      s.healthStatus.toLowerCase().includes(q)
    );
  }, [scores, debouncedSearch]);

  const load = async () => {
    setLoading(true);
    try {
      const [scoresRes, dashRes] = await Promise.all([
        api.get('/saas-revenue/client-health'),
        api.get('/saas-revenue/client-health/dashboard'),
      ]);
      setScores(unwrap<ClientHealth[]>(scoresRes) || []);
      setDashboard(unwrap<any>(dashRes));
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to load client health');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleRecalculate = async () => {
    setShowRecalcConfirm(false);
    setRecalculating(true);
    try {
      await api.post('/saas-revenue/client-health/recalculate');
      await load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to recalculate health scores');
    } finally { setRecalculating(false); }
  };

  const scoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const scoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500';
    if (score >= 40) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Health</h1>
          <p className="text-sm text-gray-500">Monitor client health scores across all tenants</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"><RefreshCw className="w-4 h-4" /> Refresh</button>
          <button onClick={() => setShowRecalcConfirm(true)} disabled={recalculating} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
            {recalculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />} Recalculate All
          </button>
        </div>
      </div>

      {/* Dashboard cards */}
      {dashboard && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{dashboard.total}</div>
            <div className="text-xs text-gray-500 mt-1">Total Clients</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-emerald-600">{dashboard.healthy}</div>
            <div className="text-xs text-gray-500 mt-1">Healthy</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-amber-600">{dashboard.atRisk}</div>
            <div className="text-xs text-gray-500 mt-1">At Risk</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{dashboard.critical}</div>
            <div className="text-xs text-gray-500 mt-1">Critical</div>
          </div>
          <div className="bg-white rounded-lg border p-4 text-center">
            <div className={`text-2xl font-bold ${scoreColor(dashboard.avgScore)}`}>{dashboard.avgScore}</div>
            <div className="text-xs text-gray-500 mt-1">Avg Score</div>
          </div>
        </div>
      )}

      <input
        type="text"
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Overall</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Usage</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Payment</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Support</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Adoption</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Deploy</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Alerts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredScores.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{s.tenant?.name || <span className="font-mono text-gray-400">{s.tenantId.slice(0, 8)}...</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${HEALTH_STATUS_STYLES[s.healthStatus]}`}>{s.healthStatus.replace('_', ' ')}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className={`text-sm font-bold ${scoreColor(s.overallScore)}`}>{s.overallScore}</div>
                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1"><div className={`h-1 rounded-full ${scoreBg(s.overallScore)}`} style={{ width: `${s.overallScore}%` }} /></div>
                  </td>
                  {[s.usageScore, s.paymentScore, s.supportScore, s.adoptionScore, s.deploymentScore].map((score, i) => (
                    <td key={i} className="px-4 py-3 text-center">
                      <span className={`text-sm ${scoreColor(score)}`}>{score}</span>
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    {(s.alerts || []).length > 0 ? (
                      <div className="flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="text-xs">{s.alerts.length}</span>
                      </div>
                    ) : (
                      <Heart className="w-3.5 h-3.5 text-emerald-500" />
                    )}
                  </td>
                </tr>
              ))}
              {filteredScores.length === 0 && <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-500">No health scores calculated yet. Click "Recalculate All" to generate scores.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={showRecalcConfirm}
        title="Recalculate All Health Scores"
        message="This will recalculate health scores for all tenants. This may take a moment depending on the number of tenants."
        confirmLabel="Recalculate"
        variant="warning"
        loading={recalculating}
        onConfirm={handleRecalculate}
        onCancel={() => setShowRecalcConfirm(false)}
      />
    </div>
  );
}
