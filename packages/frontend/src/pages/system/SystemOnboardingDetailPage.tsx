import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Check, Loader2, Rocket, SkipForward, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';
import { Onboarding, OnboardingItem, OnboardingPhase, ONBOARDING_STATUS_STYLES, fmtDate, unwrap } from './saas/_shared';

const PHASE_LABELS: Record<OnboardingPhase, string> = {
  setup: 'Setup',
  configuration: 'Configuration',
  data_migration: 'Data Migration',
  training: 'Training',
  testing: 'Testing',
  go_live: 'Go-Live',
};

const ITEM_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  skipped: 'bg-gray-50 text-gray-400',
  blocked: 'bg-red-100 text-red-700',
};

export default function SystemOnboardingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get(`/saas-revenue/onboardings/${id}`);
      setOnboarding(unwrap<Onboarding>(r));
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateItem = async (itemId: string, status: string) => {
    setSaving(itemId);
    try {
      await api.patch(`/saas-revenue/onboardings/${id}/items/${itemId}`, { status });
      toast.success(`Item ${status}`);
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update');
    } finally { setSaving(null); }
  };

  const handleGoLive = async () => {
    if (!confirm('Mark this onboarding as go-live? This will complete all remaining go-live items.')) return;
    setSaving('golive');
    try {
      await api.post(`/saas-revenue/onboardings/${id}/go-live`);
      toast.success('Go-live completed!');
      load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed');
    } finally { setSaving(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  if (!onboarding) return <div className="text-center py-12 text-gray-500">Onboarding not found</div>;

  // Group items by phase
  const phases: OnboardingPhase[] = ['setup', 'configuration', 'data_migration', 'training', 'testing', 'go_live'];
  const groupedItems: Record<string, OnboardingItem[]> = {};
  for (const phase of phases) groupedItems[phase] = [];
  for (const item of onboarding.items || []) {
    if (!groupedItems[item.phase]) groupedItems[item.phase] = [];
    groupedItems[item.phase].push(item);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link to="/system/onboardings" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Onboarding</h1>
          <p className="text-sm text-gray-500">ID: {onboarding.id.slice(0, 8)} &middot; Target go-live: {fmtDate(onboarding.targetGoLiveDate)}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${ONBOARDING_STATUS_STYLES[onboarding.status]}`}>{onboarding.status.replace('_', ' ')}</span>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-lg border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm font-bold text-gray-900">{onboarding.progressPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div className={`h-3 rounded-full transition-all ${onboarding.progressPercent === 100 ? 'bg-emerald-500' : 'bg-blue-600'}`} style={{ width: `${onboarding.progressPercent}%` }} />
        </div>
        {onboarding.status !== 'completed' && (
          <div className="mt-3 flex justify-end">
            <button onClick={handleGoLive} disabled={saving === 'golive'} className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded text-sm hover:bg-emerald-700 disabled:opacity-50">
              <Rocket className="w-4 h-4" /> Mark Go-Live
            </button>
          </div>
        )}
      </div>

      {/* Checklist grouped by phase */}
      {phases.map((phase) => {
        const items = groupedItems[phase] || [];
        if (items.length === 0) return null;
        const completed = items.filter((i) => i.status === 'completed' || i.status === 'skipped').length;
        return (
          <div key={phase} className="bg-white rounded-lg border">
            <div className="px-5 py-3 border-b bg-gray-50 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-800">{PHASE_LABELS[phase]}</h3>
              <span className="text-xs text-gray-500">{completed}/{items.length} done</span>
            </div>
            <div className="divide-y divide-gray-100">
              {items.map((item) => (
                <div key={item.id} className={`px-5 py-3 flex items-center gap-3 ${item.status === 'completed' || item.status === 'skipped' ? 'opacity-60' : ''}`}>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{item.title}</div>
                    {item.description && <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${ITEM_STATUS_STYLES[item.status] || ''}`}>{item.status}</span>
                  {item.status !== 'completed' && item.status !== 'skipped' && (
                    <div className="flex gap-1">
                      <button onClick={() => updateItem(item.id, 'completed')} disabled={saving === item.id} className="px-2 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50" title="Complete"><Check className="w-3 h-3" /></button>
                      <button onClick={() => updateItem(item.id, 'skipped')} disabled={saving === item.id} className="px-2 py-1 text-xs bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50" title="Skip"><SkipForward className="w-3 h-3" /></button>
                      <button onClick={() => updateItem(item.id, 'blocked')} disabled={saving === item.id} className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50" title="Block"><AlertTriangle className="w-3 h-3" /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
