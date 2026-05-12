import { useEffect, useState } from 'react';
import api from '../../services/api';
import {
  Rocket, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Clock,
  Pause, Play, XCircle, TrendingUp, Plus, X,
} from 'lucide-react';
import { toast } from 'sonner';

type RolloutStatus = 'scheduled' | 'in_progress' | 'paused' | 'completed' | 'rolled_back' | 'failed';
type RolloutPhase = 'phase_1' | 'phase_2' | 'phase_3';

interface Rollout {
  id: string;
  releaseCandidateId: string;
  status: RolloutStatus;
  currentPhase: RolloutPhase;
  startDate: string;
  endDate?: string | null;
  phase1PercentageTarget: number;
  phase2PercentageTarget: number;
  phase3PercentageTarget: number;
  errorThresholdPercentage: number;
  autoRollbackOnError: boolean;
  deploymentsTotalCount: number;
  deploymentsSuccessCount: number;
  deploymentsFailedCount: number;
  deploymentsRolledBackCount: number;
  rollbackReason?: Record<string, any> | null;
  notes?: string | null;
  rolledBackAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STATUS_BADGES: Record<RolloutStatus, { color: string; icon: React.ReactNode; label: string }> = {
  scheduled: { color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-3.5 h-3.5" />, label: 'Scheduled' },
  in_progress: { color: 'bg-indigo-100 text-indigo-800', icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'In progress' },
  paused: { color: 'bg-yellow-100 text-yellow-800', icon: <Pause className="w-3.5 h-3.5" />, label: 'Paused' },
  completed: { color: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Completed' },
  rolled_back: { color: 'bg-gray-100 text-gray-700', icon: <XCircle className="w-3.5 h-3.5" />, label: 'Rolled back' },
  failed: { color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-3.5 h-3.5" />, label: 'Failed' },
};

const PHASE_PERCENT: Record<RolloutPhase, number> = {
  phase_1: 10,
  phase_2: 50,
  phase_3: 100,
};

export default function SystemRolloutsPage() {
  const [rollouts, setRollouts] = useState<Rollout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [versions, setVersions] = useState<Array<{ id: string; version: string; isLatest?: boolean }>>([]);
  const [form, setForm] = useState({
    appVersionId: '',
    strategy: 'gradual' as 'immediate' | 'scheduled' | 'gradual',
    startDate: '',
    autoRollbackOnError: true,
    notes: '',
  });
  const [creating, setCreating] = useState(false);

  const loadVersions = async () => {
    try {
      const res = await api.get<any>('/updates/versions');
      const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
      setVersions(list);
      if (list.length && !form.appVersionId) {
        const latest = list.find((v: any) => v.isLatest) || list[0];
        setForm((f) => ({ ...f, appVersionId: latest.id }));
      }
    } catch {
      setVersions([]);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Rollout[]>('/deployments/rollouts');
      const list = Array.isArray(res.data) ? res.data : (res.data as any)?.data || [];
      setRollouts(list);
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Failed to load rollouts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadVersions();
  }, []);

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.appVersionId) {
      toast.error('Pick a version first');
      return;
    }
    if (form.strategy === 'scheduled' && !form.startDate) {
      toast.error('Scheduled rollouts need a start date');
      return;
    }
    setCreating(true);
    try {
      await api.post('/deployments/rollouts', {
        appVersionId: form.appVersionId,
        strategy: form.strategy,
        startDate: form.strategy === 'scheduled' ? form.startDate : undefined,
        autoRollbackOnError: form.autoRollbackOnError,
        notes: form.notes || undefined,
      });
      toast.success('Rollout created');
      setShowCreate(false);
      setForm({ ...form, notes: '' });
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to create rollout');
    } finally {
      setCreating(false);
    }
  };

  const action = async (rollout: Rollout, op: 'pause' | 'resume' | 'cancel') => {
    if (op === 'cancel' && !window.confirm('Cancel this rollout? Deployments already updated will not be reverted.')) return;
    setBusyId(rollout.id);
    try {
      await api.put(`/deployments/rollouts/${rollout.id}/${op}`, op === 'cancel' ? { reason: 'cancelled by admin' } : {});
      toast.success(`Rollout ${op === 'resume' ? 'resumed' : op + 'd'}`);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || `Failed to ${op} rollout`);
    } finally {
      setBusyId(null);
    }
  };

  const stats = {
    total: rollouts.length,
    inProgress: rollouts.filter((r) => r.status === 'in_progress').length,
    paused: rollouts.filter((r) => r.status === 'paused').length,
    completed: rollouts.filter((r) => r.status === 'completed').length,
  };

  return (
    <div className="px-4 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Rocket className="w-6 h-6 text-blue-600" />
            Update Rollouts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Phased software updates across the deployment fleet (immediate / scheduled / gradual).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Create Rollout
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'In progress', value: stats.inProgress, color: 'text-indigo-700' },
          { label: 'Paused', value: stats.paused, color: 'text-yellow-700' },
          { label: 'Completed', value: stats.completed, color: 'text-green-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-12 text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-700 font-medium">Could not load rollouts</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={load}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      ) : rollouts.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Rocket className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">No rollouts yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Rollouts are created when a new release candidate is promoted to the fleet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rollouts.map((r) => {
            const badge = STATUS_BADGES[r.status] || STATUS_BADGES.scheduled;
            const total = r.deploymentsTotalCount || 0;
            const success = r.deploymentsSuccessCount || 0;
            const failed = r.deploymentsFailedCount || 0;
            const rolled = r.deploymentsRolledBackCount || 0;
            const completed = success + failed + rolled;
            const progress = total > 0 ? Math.round((completed / total) * 100) : PHASE_PERCENT[r.currentPhase] || 0;
            const isBusy = busyId === r.id;

            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.color}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="text-xs text-gray-500 capitalize">
                        Phase: {r.currentPhase.replace('_', ' ')} ({PHASE_PERCENT[r.currentPhase]}%)
                      </span>
                      {r.autoRollbackOnError && (
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded">
                          auto-rollback @ {r.errorThresholdPercentage}% errors
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 font-mono truncate">
                      Release: {r.releaseCandidateId}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Started {new Date(r.startDate).toLocaleString()}
                      {r.endDate && ` · Ended ${new Date(r.endDate).toLocaleString()}`}
                    </p>
                    {r.notes && (
                      <p className="text-xs text-gray-600 mt-2 italic">{r.notes}</p>
                    )}
                    {r.rollbackReason && (
                      <p className="text-xs text-red-600 mt-1">
                        Rolled back: {(r.rollbackReason as any)?.reason || 'unknown'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.status === 'in_progress' && (
                      <button
                        onClick={() => action(r, 'pause')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-yellow-300 text-yellow-800 bg-yellow-50 rounded text-xs font-medium hover:bg-yellow-100 disabled:opacity-50"
                      >
                        <Pause className="w-3.5 h-3.5" /> Pause
                      </button>
                    )}
                    {r.status === 'paused' && (
                      <button
                        onClick={() => action(r, 'resume')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-blue-300 text-blue-800 bg-blue-50 rounded text-xs font-medium hover:bg-blue-100 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5" /> Resume
                      </button>
                    )}
                    {(r.status === 'in_progress' || r.status === 'paused' || r.status === 'scheduled') && (
                      <button
                        onClick={() => action(r, 'cancel')}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-300 text-red-800 bg-red-50 rounded text-xs font-medium hover:bg-red-100 disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                    {isBusy && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 text-xs text-gray-600">
                    <span>Progress</span>
                    <span>{completed}/{total || '?'} deployments · {progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        r.status === 'completed' ? 'bg-green-500'
                          : r.status === 'failed' || r.status === 'rolled_back' ? 'bg-red-500'
                          : r.status === 'paused' ? 'bg-yellow-500'
                          : 'bg-blue-500'
                      }`}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-xs">
                    <div className="text-center">
                      <p className="text-green-700 font-semibold">{success}</p>
                      <p className="text-gray-500">Succeeded</p>
                    </div>
                    <div className="text-center">
                      <p className="text-red-700 font-semibold">{failed}</p>
                      <p className="text-gray-500">Failed</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-700 font-semibold">{rolled}</p>
                      <p className="text-gray-500">Rolled back</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Rocket className="w-5 h-5 text-blue-600" />
                Create Rollout
              </h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={submitCreate} className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">App version</label>
                {versions.length === 0 ? (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    No app versions yet. Publish a version via <code>POST /api/v1/updates/versions</code> first.
                  </p>
                ) : (
                  <select
                    value={form.appVersionId}
                    onChange={(e) => setForm({ ...form, appVersionId: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    {versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.version}{v.isLatest ? ' (latest)' : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Strategy</label>
                <select
                  value={form.strategy}
                  onChange={(e) => setForm({ ...form, strategy: e.target.value as any })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="immediate">Immediate (100% now)</option>
                  <option value="gradual">Gradual (10% → 50% → 100%)</option>
                  <option value="scheduled">Scheduled (start at specified time)</option>
                </select>
              </div>
              {form.strategy === 'scheduled' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Start date/time</label>
                  <input
                    type="datetime-local"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.autoRollbackOnError}
                  onChange={(e) => setForm({ ...form, autoRollbackOnError: e.target.checked })}
                />
                Auto-rollback on error threshold (5%)
              </label>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-2 text-sm text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || versions.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
