import { useEffect, useMemo, useState } from 'react';
import {
  Loader2, RefreshCw, GitMerge, AlertTriangle, History, X, CheckCircle2, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import api, { getApiErrorMessage } from '../../services/api';
import { unwrap } from './saas/_shared';

/**
 * Master-data sync conflicts queue (Phase 2-4 epic, surface 3).
 *
 * A conflict is a PAIR of changesets on one entity whose operations disagree,
 * so resolving names both ids and a strategy. The API detects them structurally
 * rather than storing a conflict row, which is why there is no conflict id here
 * — the pair itself is the identity.
 */

type Strategy = 'KEEP_LOCAL' | 'TAKE_REMOTE' | 'MERGE' | 'MANUAL';

interface ConflictSide {
  id: string;
  entity: string;
  operation: string;
  timestamp: string;
}

interface ConflictRow {
  isConflict: boolean;
  local: ConflictSide;
  remote: ConflictSide;
  severity: string;
}

interface HistoryRow {
  changesetId: string;
  entity: string;
  operation: string;
  resolution: string;
  reason: string | null;
  resolvedAt: string | null;
}

const STRATEGY_HELP: Record<Strategy, string> = {
  KEEP_LOCAL: 'Keep the local change and discard the remote one.',
  TAKE_REMOTE: 'Take the remote change and discard the local one.',
  MERGE: 'Merge both sides.',
  MANUAL: 'Record a manual decision made outside the system.',
};

export default function SystemSyncConflictsPage() {
  const [conflicts, setConflicts] = useState<ConflictRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'queue' | 'history'>('queue');
  const [selected, setSelected] = useState<ConflictRow | null>(null);
  const [strategy, setStrategy] = useState<Strategy>('MERGE');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [cRes, hRes] = await Promise.all([
        api.get('/deployments/sync-conflicts'),
        api.get('/deployments/sync-conflicts/history'),
      ]);
      const c = unwrap<ConflictRow[]>(cRes);
      const h = unwrap<HistoryRow[]>(hRes);
      setConflicts(Array.isArray(c) ? c : []);
      setHistory(Array.isArray(h) ? h : []);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not load sync conflicts'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openResolve = (row: ConflictRow) => {
    setSelected(row);
    setStrategy('MERGE');
    setReason('');
  };

  const submit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put('/deployments/sync-conflicts/resolve', {
        localChangesetId: selected.local.id,
        remoteChangesetId: selected.remote.id,
        strategy,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      });
      toast.success(`Resolved the ${selected.local.entity} conflict`);
      setSelected(null);
      await load();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not resolve this conflict'));
    } finally {
      setSaving(false);
    }
  };

  const entityCounts = useMemo(() => {
    const m = new Map<string, number>();
    conflicts.forEach((c) => m.set(c.local.entity, (m.get(c.local.entity) || 0) + 1));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [conflicts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GitMerge className="w-6 h-6" /> Sync Conflicts
          </h1>
          <p className="text-sm text-gray-500">
            Master-data changes that disagree between a deployment and the centre.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Stat title="Unresolved" value={conflicts.length} tone={conflicts.length ? 'err' : 'muted'} />
        <Stat title="Entities affected" value={entityCounts.length} />
        <Stat title="Resolved (last 100 changesets)" value={history.length} tone="muted" />
      </div>

      <div className="flex gap-1 border-b">
        <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
          Queue {conflicts.length > 0 && <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">{conflicts.length}</span>}
        </TabButton>
        <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
          <History className="w-3.5 h-3.5 inline mr-1" />History
        </TabButton>
      </div>

      {tab === 'queue' && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Entity</th>
                <th className="text-left px-3 py-2">Local</th>
                <th className="text-left px-3 py-2">Remote</th>
                <th className="text-left px-3 py-2">Apart</th>
                <th className="text-right px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && conflicts.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  <Loader2 className="inline w-4 h-4 animate-spin mr-2" />Loading…
                </td></tr>
              )}
              {!loading && conflicts.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                  <CheckCircle2 className="inline w-4 h-4 mr-2 text-emerald-500" />
                  No unresolved sync conflicts.
                </td></tr>
              )}
              {conflicts.map((c) => (
                <tr key={`${c.local.id}:${c.remote.id}`} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">
                    <div className="font-medium">{c.local.entity}</div>
                    <div className="text-xs text-gray-400 inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />{c.severity}
                    </div>
                  </td>
                  <td className="px-3 py-2"><SideCell side={c.local} /></td>
                  <td className="px-3 py-2"><SideCell side={c.remote} /></td>
                  <td className="px-3 py-2 text-xs text-gray-500">{apartMs(c)} ms</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => openResolve(c)} className="text-blue-600 hover:underline text-xs">
                      Resolve…
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'history' && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Entity</th>
                <th className="text-left px-3 py-2">Operation</th>
                <th className="text-left px-3 py-2">Resolution</th>
                <th className="text-left px-3 py-2">Reason</th>
                <th className="text-left px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400">Nothing has been resolved yet.</td></tr>
              )}
              {history.map((h) => (
                <tr key={h.changesetId} className="border-t hover:bg-gray-50">
                  <td className="px-3 py-2">{h.entity}</td>
                  <td className="px-3 py-2"><code className="text-xs">{h.operation}</code></td>
                  <td className="px-3 py-2">
                    <span className="text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-700">{h.resolution}</span>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600 max-w-[280px] truncate" title={h.reason || ''}>
                    {h.reason || <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    {h.resolvedAt ? new Date(h.resolvedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !saving && setSelected(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">Resolve “{selected.local.entity}” conflict</h2>
              <button onClick={() => setSelected(null)} disabled={saving} className="text-gray-400 hover:text-gray-700 disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <SidePanel title="Local" side={selected.local} />
                <ArrowRight className="w-4 h-4 text-gray-300" />
                <SidePanel title="Remote" side={selected.remote} />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Strategy</label>
                <select
                  className="border rounded px-2 py-1.5 text-sm w-full"
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value as Strategy)}
                >
                  {(Object.keys(STRATEGY_HELP) as Strategy[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">{STRATEGY_HELP[strategy]}</p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Reason (kept in changeset metadata)</label>
                <textarea
                  className="border rounded px-2 py-1.5 text-sm w-full h-20"
                  placeholder="Why this side wins…"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={() => setSelected(null)} disabled={saving} className="px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-40">
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-2 px-3 py-2 rounded bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />}
                Resolve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function apartMs(c: ConflictRow) {
  return Math.abs(new Date(c.local.timestamp).getTime() - new Date(c.remote.timestamp).getTime());
}

function SideCell({ side }: { side: ConflictSide }) {
  return (
    <div>
      <code className="text-xs px-1.5 py-0.5 rounded bg-gray-100">{side.operation}</code>
      <div className="text-xs text-gray-400 mt-0.5">{new Date(side.timestamp).toLocaleString()}</div>
    </div>
  );
}

function SidePanel({ title, side }: { title: string; side: ConflictSide }) {
  return (
    <div className="border rounded p-3 bg-gray-50">
      <div className="text-xs text-gray-500 mb-1">{title}</div>
      <code className="text-xs px-1.5 py-0.5 rounded bg-white border">{side.operation}</code>
      <div className="text-xs text-gray-500 mt-1">{new Date(side.timestamp).toLocaleString()}</div>
      <div className="text-[10px] text-gray-400 mt-1 font-mono truncate" title={side.id}>{side.id}</div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-2 text-sm border-b-2 -mb-px ${active ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
    >
      {children}
    </button>
  );
}

function Stat({ title, value, tone }: { title: string; value: number; tone?: 'err' | 'muted' }) {
  const cls = tone === 'err' ? 'text-rose-700' : tone === 'muted' ? 'text-gray-400' : 'text-gray-900';
  return (
    <div className="bg-white border rounded-lg p-3">
      <div className="text-xs text-gray-500">{title}</div>
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
    </div>
  );
}
