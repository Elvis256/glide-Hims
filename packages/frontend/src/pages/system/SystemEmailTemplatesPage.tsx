import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, RotateCcw, Send, Mail, AlertCircle, CheckCircle, History, Undo2, Building2 } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';

interface TemplateListItem {
  key: string;
  label: string;
  description: string;
  variables: string[];
  isCustom: boolean;
  hasTenantOverride?: boolean;
  historyCount?: number;
}

interface TemplateDetail extends TemplateListItem {
  defaults: { subject: string; body: string };
  current: { subject: string; body: string };
  history: Array<{ subject: string; body: string; savedAt: string; savedBy?: string }>;
  hasOverride: boolean;
  scope: 'global' | 'tenant';
}

interface TenantOpt { id: string; name: string }

export default function SystemEmailTemplatesPage() {
  const [items, setItems] = useState<TemplateListItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<TemplateDetail | null>(null);
  const [tenants, setTenants] = useState<TenantOpt[]>([]);
  const [tenantId, setTenantId] = useState<string>(''); // '' = global
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [reverting, setReverting] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const params = useMemo(() => (tenantId ? { tenantId } : {}), [tenantId]);

  const loadList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/email-templates', { params });
      const list = unwrap<TemplateListItem[]>(r) || [];
      setItems(list);
      if (!activeKey && list.length) setActiveKey(list[0].key);
    } finally { setLoading(false); }
  };

  const loadDetail = async (key: string) => {
    setLoadingDetail(true);
    try {
      const r = await api.get(`/saas-revenue/email-templates/${key}`, { params });
      const d = unwrap<TemplateDetail>(r);
      setDetail(d);
      if (d) {
        setDraftSubject(d.current.subject);
        setDraftBody(d.current.body);
      }
      setMsg(null);
    } finally { setLoadingDetail(false); }
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get('/tenants', { params: { perPage: 200 } });
        const arr = unwrap<any>(r);
        const list: TenantOpt[] = Array.isArray(arr) ? arr : (arr?.items || arr?.data || []);
        setTenants(list.map((t: any) => ({ id: t.id, name: t.name || t.displayName || t.id })));
      } catch { /* tenants are optional */ }
    })();
  }, []);

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, [tenantId]);
  useEffect(() => { if (activeKey) loadDetail(activeKey); /* eslint-disable-next-line */ }, [activeKey, tenantId]);

  useEffect(() => {
    if (!detail) return;
    const h = setTimeout(async () => {
      try {
        const r = await api.post(`/saas-revenue/email-templates/${detail.key}/preview`, { subject: draftSubject, body: draftBody }, { params });
        const data = unwrap<{ subject: string; html: string }>(r)!;
        setPreviewSubject(data.subject); setPreviewHtml(data.html);
      } catch { /* ignore */ }
    }, 350);
    return () => clearTimeout(h);
  }, [draftSubject, draftBody, detail, tenantId]);

  const onSave = async () => {
    if (!detail) return;
    setSaving(true); setMsg(null);
    try {
      await api.put(`/saas-revenue/email-templates/${detail.key}`, { subject: draftSubject, body: draftBody }, { params });
      setMsg({ tone: 'ok', text: tenantId ? 'Tenant override saved.' : 'Global override saved.' });
      await Promise.all([loadList(), loadDetail(detail.key)]);
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Save failed' }); }
    finally { setSaving(false); }
  };

  const onReset = async () => {
    if (!detail) return;
    const what = tenantId ? `tenant override for "${detail.label}"` : `"${detail.label}"`;
    if (!confirm(`Reset ${what} to the ${tenantId ? 'global/default' : 'built-in default'}?`)) return;
    setResetting(true); setMsg(null);
    try {
      await api.delete(`/saas-revenue/email-templates/${detail.key}`, { params });
      setMsg({ tone: 'ok', text: 'Reset.' });
      await Promise.all([loadList(), loadDetail(detail.key)]);
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Reset failed' }); }
    finally { setResetting(false); }
  };

  const onTest = async () => {
    if (!detail) return;
    const to = window.prompt('Send a test email to:');
    if (!to) return;
    setTesting(true); setMsg(null);
    try {
      await api.post(`/saas-revenue/email-templates/${detail.key}/test`, { to: to.trim() }, { params });
      setMsg({ tone: 'ok', text: `Test sent to ${to.trim()}.` });
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Send failed' }); }
    finally { setTesting(false); }
  };

  const onRevert = async (versionIndex: number) => {
    if (!detail) return;
    if (!confirm(`Revert to version saved on ${new Date(detail.history[versionIndex].savedAt).toLocaleString()}? The current version will be added to history.`)) return;
    setReverting(versionIndex); setMsg(null);
    try {
      await api.post(`/saas-revenue/email-templates/${detail.key}/revert`, { versionIndex }, { params });
      setMsg({ tone: 'ok', text: 'Reverted.' });
      await Promise.all([loadList(), loadDetail(detail.key)]);
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Revert failed' }); }
    finally { setReverting(null); }
  };

  const insertVar = (v: string) => setDraftBody((b) => `${b}{{${v}}}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="w-6 h-6" /> Email Templates</h1>
          <p className="text-sm text-gray-500">Customize subject and body of the SaaS billing emails. Use <code className="bg-gray-100 px-1 rounded">{'{{variable}}'}</code> tokens.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2 text-sm">
          <Building2 className="w-4 h-4 text-gray-500" />
          <label className="text-xs text-gray-500">Scope:</label>
          <select className="text-sm border rounded px-2 py-1" value={tenantId} onChange={(e) => setTenantId(e.target.value)}>
            <option value="">Global (all tenants)</option>
            {tenants.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          <div className="bg-white border rounded-lg overflow-hidden">
            {items.map((t) => (
              <button key={t.key} onClick={() => setActiveKey(t.key)} className={`w-full text-left px-3 py-2 border-b text-sm flex items-center justify-between gap-2 ${activeKey === t.key ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                <span className="truncate">{t.label}</span>
                <span className="flex items-center gap-1">
                  {tenantId && t.hasTenantOverride && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">tenant</span>}
                  {!tenantId && t.isCustom && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">custom</span>}
                  {(t.historyCount || 0) > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">v{t.historyCount}</span>}
                </span>
              </button>
            ))}
          </div>

          {loadingDetail ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : detail && (
            <div className="space-y-3">
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm text-gray-600">{detail.description}</div>
                  <div className="flex items-center gap-1 text-xs">
                    {detail.hasOverride ? (
                      <span className={`px-2 py-0.5 rounded ${tenantId ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                        {tenantId ? 'Tenant override active' : 'Custom (global)'}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                        {tenantId ? 'Using global/default' : 'Built-in default'}
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 block mb-1">Subject</label>
                  <input className="w-full border rounded px-3 py-2 text-sm" value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Body (HTML allowed)</label>
                  <textarea rows={12} className="w-full border rounded px-3 py-2 text-sm font-mono" value={draftBody} onChange={(e) => setDraftBody(e.target.value)} />
                </div>

                <div>
                  <div className="text-xs text-gray-500 mb-1">Variables (click to insert):</div>
                  <div className="flex flex-wrap gap-1">
                    {detail.variables.map((v) => (
                      <button key={v} onClick={() => insertVar(v)} className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 font-mono">{`{{${v}}}`}</button>
                    ))}
                  </div>
                </div>

                {msg && (
                  <div className={`text-sm flex items-center gap-2 ${msg.tone === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {msg.tone === 'ok' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />} {msg.text}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button onClick={onSave} disabled={saving} className="inline-flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save {tenantId ? 'tenant override' : 'override'}
                  </button>
                  <button onClick={onTest} disabled={testing} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test
                  </button>
                  {detail.hasOverride && (
                    <button onClick={onReset} disabled={resetting} className="inline-flex items-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded text-sm hover:bg-rose-50 disabled:opacity-50">
                      {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset
                    </button>
                  )}
                  <button onClick={() => setShowHistory((s) => !s)} disabled={!detail.history?.length} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50">
                    <History className="w-4 h-4" /> History ({detail.history?.length || 0})
                  </button>
                </div>
              </div>

              {showHistory && detail.history?.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Version history (newest first, capped at 10)</div>
                  <div className="space-y-2">
                    {detail.history.map((v, idx) => (
                      <div key={idx} className="border rounded p-3 text-sm">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="font-medium text-gray-700">{new Date(v.savedAt).toLocaleString()}</div>
                          <button onClick={() => onRevert(idx)} disabled={reverting === idx} className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-blue-300 text-blue-700 rounded hover:bg-blue-50 disabled:opacity-50">
                            {reverting === idx ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />} Revert to this
                          </button>
                        </div>
                        <div className="text-xs text-gray-600"><span className="font-semibold">Subject:</span> {v.subject}</div>
                        <details className="mt-1">
                          <summary className="text-xs text-gray-500 cursor-pointer">Show body</summary>
                          <pre className="mt-1 text-xs bg-gray-50 p-2 rounded overflow-auto max-h-48 whitespace-pre-wrap">{v.body}</pre>
                        </details>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border rounded-lg p-4">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-2">Live preview (sample data)</div>
                <div className="text-sm font-medium mb-2">Subject: <span className="text-gray-700">{previewSubject || '—'}</span></div>
                <iframe title="preview" srcDoc={previewHtml} className="w-full h-[420px] border rounded bg-gray-50" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
