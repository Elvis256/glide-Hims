import { useEffect, useState } from 'react';
import { Download, Loader2, Plus, RefreshCw, Trash2, Upload, FileArchive, AlertCircle } from 'lucide-react';
import api from '../../services/api';

interface Installer {
  id: string;
  name: string;
  version: string;
  channel: 'stable' | 'beta' | 'lts';
  kind: 'docker-image' | 'tarball' | 'iso' | 'usb-bundle' | 'updater';
  platform: string;
  filename: string;
  sizeBytes: string;
  sha256: string;
  releaseNotes: string | null;
  isPublished: boolean;
  releasedAt: string;
}

interface AuditEntry {
  id: string;
  installerId: string;
  username: string | null;
  ipAddress: string | null;
  bytesServed: string | null;
  success: boolean;
  createdAt: string;
}

const CHANNEL_BADGE: Record<string, string> = {
  stable: 'bg-emerald-100 text-emerald-700',
  beta: 'bg-amber-100 text-amber-700',
  lts: 'bg-blue-100 text-blue-700',
};

function fmtSize(bytes: string) {
  const n = Number(bytes);
  if (!isFinite(n) || n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0; let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

export default function SystemDownloadsPage() {
  const [items, setItems] = useState<Installer[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: 'Glide HIMS Standalone',
    version: '',
    channel: 'stable' as 'stable' | 'beta' | 'lts',
    kind: 'tarball' as Installer['kind'],
    platform: 'linux-amd64',
    filename: '',
    sizeBytes: '',
    sha256: '',
    releaseNotes: '',
    isPublished: true,
    minLicenseTier: '',
  });

  async function load() {
    setLoading(true);
    try {
      const r = await api.get('/downloads');
      setItems(r.data?.data ?? r.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load installers');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function loadAudit() {
    try {
      const r = await api.get('/downloads/audit');
      setAudit(r.data?.data ?? r.data ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load audit log');
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const payload: any = { ...form };
      if (!payload.minLicenseTier) delete payload.minLicenseTier;
      await api.post('/downloads', payload);
      setShowForm(false);
      setForm({ ...form, version: '', filename: '', sizeBytes: '', sha256: '', releaseNotes: '', minLicenseTier: '' });
      load();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to register installer');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this installer record? The file on disk is not removed.')) return;
    await api.delete(`/downloads/${id}`);
    load();
  }

  async function handleTogglePublish(it: Installer) {
    await api.patch(`/downloads/${it.id}`, { isPublished: !it.isPublished });
    load();
  }

  function downloadHref(id: string) {
    const base = api.defaults.baseURL || '';
    return `${base}/downloads/${id}/file`;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Installers & Downloads</h1>
          <p className="text-sm text-gray-500">
            Auth-gated installer portal. Place files in <code className="bg-gray-100 px-1 rounded">/var/lib/glide-hims/installers/</code> and register them here.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { const next = !showAudit; setShowAudit(next); if (next) loadAudit(); }} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50">
            {showAudit ? 'Hide audit' : 'Audit log'}
          </button>
          <button onClick={load} className="px-3 py-2 text-sm border rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowForm(true)} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register installer
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <FileArchive className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            No installers registered yet. Click "Register installer" once you've copied a build into the storage directory.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
              <tr>
                <th className="text-left px-4 py-2">Name / version</th>
                <th className="text-left px-4 py-2">Channel</th>
                <th className="text-left px-4 py-2">Platform</th>
                <th className="text-left px-4 py-2">Size</th>
                <th className="text-left px-4 py-2">SHA-256</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-right px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{it.name}</div>
                    <div className="text-xs text-gray-500">{it.version} · {it.kind} · {it.filename}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${CHANNEL_BADGE[it.channel] || 'bg-gray-100'}`}>{it.channel}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{it.platform}</td>
                  <td className="px-4 py-3 text-gray-600">{fmtSize(it.sizeBytes)}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{it.sha256.slice(0, 12)}…</td>
                  <td className="px-4 py-3">
                    <button onClick={() => handleTogglePublish(it)} className={`text-xs px-2 py-0.5 rounded ${it.isPublished ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'}`}>
                      {it.isPublished ? 'Published' : 'Hidden'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={downloadHref(it.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded hover:bg-blue-100 mr-1">
                      <Download className="w-3 h-3" /> Download
                    </a>
                    <button onClick={() => handleDelete(it.id)} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-red-50 text-red-700 rounded hover:bg-red-100">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4" /> Register installer</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700">Name *</label>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Version *</label>
                <input required value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Channel</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value as any })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="stable">Stable</option><option value="beta">Beta</option><option value="lts">LTS</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Kind</label>
                <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as any })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="tarball">Tarball</option>
                  <option value="docker-image">Docker image</option>
                  <option value="iso">ISO</option>
                  <option value="usb-bundle">USB bundle</option>
                  <option value="updater">Updater</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Platform</label>
                <input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700">Filename in storage dir *</label>
                <input required value={form.filename} onChange={(e) => setForm({ ...form, filename: e.target.value })} placeholder="glide-hims-1.0.0-linux-amd64.tar.gz" className="mt-1 w-full border rounded-lg px-3 py-2 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">Size (bytes) *</label>
                <input required value={form.sizeBytes} onChange={(e) => setForm({ ...form, sizeBytes: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">SHA-256 *</label>
                <input required value={form.sha256} onChange={(e) => setForm({ ...form, sha256: e.target.value.toLowerCase() })} className="mt-1 w-full border rounded-lg px-3 py-2 text-xs font-mono" />
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700">Release notes</label>
                <textarea rows={4} value={form.releaseNotes} onChange={(e) => setForm({ ...form, releaseNotes: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
                Publish immediately (visible to all authenticated users)
              </label>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-700">Minimum license tier (gating)</label>
                <select value={form.minLicenseTier} onChange={(e) => setForm({ ...form, minLicenseTier: e.target.value })} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">No restriction (all tenants)</option>
                  <option value="standard">Standard or higher</option>
                  <option value="professional">Professional or higher</option>
                  <option value="enterprise">Enterprise only</option>
                </select>
              </div>
              <div className="col-span-2 flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm border rounded-lg">Cancel</button>
                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <strong>How it works:</strong> Run <code>./scripts/build-installer.sh 1.0.0</code> on the server to create a tarball of this repo at <code>/var/lib/glide-hims/installers/</code>, then register the metadata here. Authenticated users hit <code>/api/v1/downloads/:id/file</code>.
      </div>

      {showAudit && (
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="px-4 py-3 border-b font-medium text-sm">Recent download activity</div>
          {audit.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">No download activity yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 border-b">
                <tr>
                  <th className="text-left px-4 py-2">When</th>
                  <th className="text-left px-4 py-2">User</th>
                  <th className="text-left px-4 py-2">IP</th>
                  <th className="text-left px-4 py-2">Installer</th>
                  <th className="text-left px-4 py-2">Bytes</th>
                  <th className="text-left px-4 py-2">Result</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((a) => {
                  const inst = items.find((i) => i.id === a.installerId);
                  return (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-xs text-gray-600">{new Date(a.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-2">{a.username || '—'}</td>
                      <td className="px-4 py-2 font-mono text-xs">{a.ipAddress || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-600">{inst ? `${inst.name} v${inst.version}` : a.installerId.slice(0, 8)}…</td>
                      <td className="px-4 py-2 text-xs">{a.bytesServed || '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${a.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {a.success ? 'OK' : 'denied'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
