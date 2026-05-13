import { useEffect, useMemo, useState } from 'react';
import { Loader2, Save, RotateCcw, Send, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import api from '../../services/api';
import { unwrap } from './saas/_shared';

interface TemplateMeta {
  key: string;
  label: string;
  description: string;
  variables: string[];
  defaults: { subject: string; body: string };
  current: { subject: string; body: string };
  isCustom: boolean;
}

export default function SystemEmailTemplatesPage() {
  const [items, setItems] = useState<TemplateMeta[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewSubject, setPreviewSubject] = useState('');
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const active = useMemo(() => items.find((t) => t.key === activeKey) || null, [items, activeKey]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get('/saas-revenue/email-templates');
      const list = unwrap<TemplateMeta[]>(r) || [];
      setItems(list);
      if (!activeKey && list.length) setActiveKey(list[0].key);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  useEffect(() => {
    if (active) {
      setDraftSubject(active.current.subject);
      setDraftBody(active.current.body);
      setMsg(null);
    }
  }, [activeKey, items.length]);

  // Live preview (debounced)
  useEffect(() => {
    if (!active) return;
    const h = setTimeout(async () => {
      try {
        const r = await api.post(`/saas-revenue/email-templates/${active.key}/preview`, { subject: draftSubject, body: draftBody });
        const data = unwrap<{ subject: string; html: string }>(r)!;
        setPreviewSubject(data.subject); setPreviewHtml(data.html);
      } catch { /* ignore preview errors */ }
    }, 350);
    return () => clearTimeout(h);
  }, [draftSubject, draftBody, active]);

  const onSave = async () => {
    if (!active) return;
    setSaving(true); setMsg(null);
    try {
      await api.put(`/saas-revenue/email-templates/${active.key}`, { subject: draftSubject, body: draftBody });
      setMsg({ tone: 'ok', text: 'Saved.' });
      await load();
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Save failed' }); }
    finally { setSaving(false); }
  };

  const onReset = async () => {
    if (!active) return;
    if (!confirm(`Reset "${active.label}" to the built-in default?`)) return;
    setResetting(true); setMsg(null);
    try {
      await api.delete(`/saas-revenue/email-templates/${active.key}`);
      setMsg({ tone: 'ok', text: 'Reset to default.' });
      await load();
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Reset failed' }); }
    finally { setResetting(false); }
  };

  const onTest = async () => {
    if (!active) return;
    const to = window.prompt('Send a test email to:');
    if (!to) return;
    setTesting(true); setMsg(null);
    try {
      await api.post(`/saas-revenue/email-templates/${active.key}/test`, { to: to.trim() });
      setMsg({ tone: 'ok', text: `Test sent to ${to.trim()}.` });
    } catch (e: any) { setMsg({ tone: 'err', text: e?.response?.data?.message || 'Send failed' }); }
    finally { setTesting(false); }
  };

  const insertVar = (v: string) => {
    setDraftBody((b) => `${b}{{${v}}}`);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Mail className="w-6 h-6" /> Email Templates</h1>
        <p className="text-sm text-gray-500">Customize subject and body of the SaaS billing emails. Use <code className="bg-gray-100 px-1 rounded">{'{{variable}}'}</code> tokens.</p>
      </div>

      {loading ? <Loader2 className="w-5 h-5 animate-spin text-gray-400" /> : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          {/* Left: template list */}
          <div className="bg-white border rounded-lg overflow-hidden">
            {items.map((t) => (
              <button key={t.key} onClick={() => setActiveKey(t.key)} className={`w-full text-left px-3 py-2 border-b text-sm flex items-center justify-between ${activeKey === t.key ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'}`}>
                <span>{t.label}</span>
                {t.isCustom && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">custom</span>}
              </button>
            ))}
          </div>

          {/* Right: editor + preview */}
          {active && (
            <div className="space-y-3">
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <div className="text-sm text-gray-600">{active.description}</div>

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
                    {active.variables.map((v) => (
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
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save override
                  </button>
                  <button onClick={onTest} disabled={testing} className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50 disabled:opacity-50">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test
                  </button>
                  {active.isCustom && (
                    <button onClick={onReset} disabled={resetting} className="inline-flex items-center gap-2 px-3 py-2 border border-rose-300 text-rose-700 rounded text-sm hover:bg-rose-50 disabled:opacity-50">
                      {resetting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Reset to default
                    </button>
                  )}
                </div>
              </div>

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
