import { useEffect, useState } from 'react';
import { ShieldAlert, Loader2, RefreshCw, Unlock, AlertCircle, ShieldCheck } from 'lucide-react';
import api from '../../services/api';
import ConfirmDialog from '../../components/ConfirmDialog';

interface BlockedEntry {
  kind: 'ip' | 'user';
  ip: string;
  username?: string | null;
  blockedUntil: string;
  remainingSeconds: number;
}

function formatRemaining(sec: number): string {
  if (sec <= 0) return 'expired';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

export default function SystemSecurityPage() {
  const [items, setItems] = useState<BlockedEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmUnblock, setConfirmUnblock] = useState<BlockedEntry | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/auth/admin/rate-limit/blocked');
      setItems(res.data?.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load blocks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const unblock = async (entry: BlockedEntry) => {
    const id = `${entry.ip}|${entry.username ?? ''}`;
    setUnblocking(id);
    setNotice(null);
    try {
      const url = `/auth/admin/rate-limit/blocked/${encodeURIComponent(entry.ip)}`;
      const config = entry.username ? { params: { username: entry.username } } : undefined;
      await api.delete(url, config);
      setNotice(
        entry.username
          ? `Unblocked ${entry.username} on ${entry.ip}`
          : `Unblocked all attempts from ${entry.ip}`,
      );
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Unblock failed');
    } finally {
      setUnblocking(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-600" />
            Security &amp; Login Blocks
          </h1>
          <p className="text-sm text-gray-500">
            View and clear IPs / accounts currently rate-limited from logging in.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded hover:bg-gray-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded text-sm text-emerald-700">
          <ShieldCheck className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      <div className="bg-white border rounded shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-3 py-2 w-24">Scope</th>
              <th className="px-3 py-2">IP Address</th>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Expires In</th>
              <th className="px-3 py-2">Blocked Until</th>
              <th className="px-3 py-2 w-32"></th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  <Loader2 className="w-5 h-5 animate-spin inline mr-2" />
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-gray-500">
                  <ShieldCheck className="w-5 h-5 inline mr-2 text-emerald-500" />
                  No active login blocks.
                </td>
              </tr>
            ) : (
              items.map((entry) => {
                const id = `${entry.ip}|${entry.username ?? ''}`;
                return (
                  <tr key={id} className="border-t">
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          entry.kind === 'ip'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {entry.kind === 'ip' ? 'IP-wide' : 'Account'}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.ip}</td>
                    <td className="px-3 py-2">{entry.username || <span className="text-gray-400">—</span>}</td>
                    <td className="px-3 py-2">{formatRemaining(entry.remainingSeconds)}</td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {new Date(entry.blockedUntil).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setConfirmUnblock(entry)}
                        disabled={unblocking === id}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-emerald-300 text-emerald-700 rounded hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {unblocking === id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Unlock className="w-3 h-3" />
                        )}
                        Unblock
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>
          <strong>IP-wide</strong> blocks trigger after many failed attempts from one IP across multiple
          accounts (anti-fanout). <strong>Account</strong> blocks trigger after repeated failures for a
          single (IP, username) pair, so a typo from one user behind NAT no longer affects everyone.
        </p>
        <p>Auto-refreshes every 10 seconds. Blocks expire automatically — manual unblock is for emergencies.</p>
      </div>

      <ConfirmDialog
        open={confirmUnblock !== null}
        title="Unblock IP?"
        message="Are you sure you want to unblock this IP address? This will allow login attempts from this IP again."
        confirmLabel="Unblock"
        variant="warning"
        loading={unblocking !== null}
        onCancel={() => setConfirmUnblock(null)}
        onConfirm={async () => {
          if (!confirmUnblock) return;
          await unblock(confirmUnblock);
          setConfirmUnblock(null);
        }}
      />
    </div>
  );
}
