import { useEffect, useState } from 'react';
import { Loader2, Save, CheckCircle, AlertTriangle, Play, RotateCcw } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';
import ConfirmDialog from '../../components/ConfirmDialog';

interface DunningRules {
  enabled: boolean;
  graceDays: number;
  reminderIntervalDays: number;
  churnAfterDays: number;
}

const DEFAULTS: DunningRules = {
  enabled: true,
  graceDays: 1,
  reminderIntervalDays: 3,
  churnAfterDays: 30,
};

export default function SystemDunningRulesPage() {
  const [data, setData] = useState<DunningRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{open: boolean; title: string; message: string; variant: 'danger'|'warning'|'info'; confirmLabel: string; onConfirm: () => void}>({open: false, title: '', message: '', variant: 'danger', confirmLabel: 'Confirm', onConfirm: () => {}});

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/dunning-rules');
      setData(unwrap<DunningRules>(r));
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const update = <K extends keyof DunningRules>(k: K, v: DunningRules[K]) =>
    setData((d) => ({ ...(d as DunningRules), [k]: v }));

  const save = async () => {
    if (!data) return;
    if (data.churnAfterDays < data.graceDays) {
      setError('Churn-after-days must be greater than or equal to grace days.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const r = await api.put('/saas-revenue/dunning-rules', data);
      setData(unwrap<DunningRules>(r));
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const reset = () => setConfirmAction({
    open: true,
    title: 'Reset to defaults?',
    message: 'This will discard your current dunning rule configuration and restore all fields to their default values. Unsaved changes will be lost.',
    variant: 'warning',
    confirmLabel: 'Reset to defaults',
    onConfirm: () => { setData({ ...DEFAULTS }); setConfirmAction(prev => ({ ...prev, open: false })); },
  });

  const executeRunNow = async () => {
    setRunning(true);
    try {
      await api.post('/saas-revenue/cron/run');
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Run failed');
    } finally {
      setRunning(false);
    }
  };

  const runNow = () => setConfirmAction({
    open: true,
    title: 'Run dunning now?',
    message: 'This will immediately process all overdue invoices, send dunning emails to affected customers, and may auto-churn subscriptions that exceed the churn threshold. This action cannot be undone.',
    variant: 'danger',
    confirmLabel: 'Run dunning now',
    onConfirm: () => { setConfirmAction(prev => ({ ...prev, open: false })); executeRunNow(); },
  });

  if (loading || !data) {
    return <div className="p-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;
  }

  const timeline = [
    { day: 0, label: 'Invoice due date', color: 'bg-gray-200 text-gray-800' },
    { day: data.graceDays, label: `+${data.graceDays}d → mark sub past_due + first dunning email`, color: 'bg-amber-100 text-amber-900' },
    { day: data.graceDays + data.reminderIntervalDays, label: `+${data.graceDays + data.reminderIntervalDays}d → reminder #2`, color: 'bg-amber-100 text-amber-900' },
    { day: data.graceDays + data.reminderIntervalDays * 2, label: `+${data.graceDays + data.reminderIntervalDays * 2}d → reminder #3`, color: 'bg-amber-100 text-amber-900' },
    { day: data.churnAfterDays, label: `+${data.churnAfterDays}d → auto-churn, license suspended`, color: 'bg-rose-100 text-rose-900' },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dunning rules</h1>
          <p className="text-sm text-gray-500">
            Controls how the nightly cron handles overdue invoices: when to escalate, how often to email the customer, and when to auto-churn.
          </p>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6 space-y-5">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.enabled}
            onChange={(e) => update('enabled', e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
          />
          <div>
            <div className="text-sm font-semibold text-gray-900">Dunning enabled</div>
            <div className="text-xs text-gray-500">When off, overdue invoices are left alone (no past_due transition, no auto-churn).</div>
          </div>
        </label>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Grace days</label>
            <input
              type="number"
              min={0}
              max={60}
              value={data.graceDays}
              onChange={(e) => update('graceDays', Math.max(0, parseInt(e.target.value || '0', 10)))}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">Days after due date before the subscription is flagged past_due.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Reminder cadence (days)</label>
            <input
              type="number"
              min={1}
              max={30}
              value={data.reminderIntervalDays}
              onChange={(e) => update('reminderIntervalDays', Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">Gap between dunning reminder emails while past_due.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">Churn after (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={data.churnAfterDays}
              onChange={(e) => update('churnAfterDays', Math.max(1, parseInt(e.target.value || '1', 10)))}
              className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">Days past due before subscription is auto-churned and license suspended.</p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-lg p-6">
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-3">Schedule preview</div>
        <ol className="space-y-2">
          {timeline.filter((t) => t.day <= data.churnAfterDays).map((t, i) => (
            <li key={i} className="flex items-center gap-3 text-sm">
              <span className={`inline-block min-w-[60px] text-center px-2 py-1 rounded text-xs font-semibold ${t.color}`}>
                D+{t.day}
              </span>
              <span className="text-gray-700">{t.label}</span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          Dunning runs nightly via cron. You can also trigger it on demand using the button below.
        </p>
      </div>

      {error && <div className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded p-3">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save rules'}
        </button>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-800 rounded font-medium hover:bg-gray-200"
        >
          <RotateCcw className="w-4 h-4" /> Reset to defaults
        </button>
        <button
          onClick={runNow}
          disabled={running}
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 disabled:opacity-50"
        >
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {running ? 'Running…' : 'Run dunning now'}
        </button>
        {savedAt && (
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700"><CheckCircle className="w-4 h-4" /> Done</span>
        )}
      </div>

      <ConfirmDialog
        open={confirmAction.open}
        title={confirmAction.title}
        message={confirmAction.message}
        variant={confirmAction.variant}
        confirmLabel={confirmAction.confirmLabel}
        onConfirm={confirmAction.onConfirm}
        onCancel={() => setConfirmAction(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
}
